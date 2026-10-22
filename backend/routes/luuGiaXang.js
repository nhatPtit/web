const sql = require('mssql');
const { connectDB } = require('../db');
const { spawn } = require('child_process');
const os = require('os');
const path = require('path');

// 1. Phân tích HTML từ trang PVOIL để bóc tách ngày và giá xăng RON 95
function parsePvoilHtml(html) {
    if (!html) return null;

    // A. Lấy ngày hiện tại (múi giờ địa phương Việt Nam)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // B. Bóc tách giá RON 95
    // Tìm dòng tr chứa "RON 95"
    let price = null;
    const trMatches = html.match(/<tr[\s\S]*?<\/tr>/gi);
    if (trMatches) {
        for (const tr of trMatches) {
            if (/RON\s*95/i.test(tr)) {
                // Lấy tất cả các thẻ td trong tr này
                const tdMatches = tr.match(/<td[\s\S]*?<\/td>/gi);
                if (tdMatches && tdMatches.length >= 3) {
                    // Cột 1: STT, Cột 2: Tên mặt hàng, Cột 3: Giá bán lẻ (Vùng 1)
                    // Một số table colspan="2" ở cột tên -> td[2] là giá
                    for (let i = 1; i < tdMatches.length; i++) {
                        const tdText = tdMatches[i].replace(/<[^>]+>/g, '').trim();
                        // Tìm chuỗi chứa số dạng "26.670" hoặc "26,670"
                        const numMatch = tdText.match(/(\d{1,3}[\.,]\d{3})/);
                        if (numMatch) {
                            price = parseInt(numMatch[1].replace(/[\.,]/g, ''), 10);
                            break;
                        }
                    }
                }
                if (price) break;
            }
        }
    }

    // Nếu không tìm thấy qua table row, thử regex trực tiếp
    if (!price) {
        const directMatch = html.match(/RON\s*95[^\d]*?(\d{1,3}[\.,]\d{3})/i);
        if (directMatch) {
            price = parseInt(directMatch[1].replace(/[\.,]/g, ''), 10);
        }
    }

    return { date: dateStr, price };
}

// 2. Lấy HTML trang PVOIL (Hỗ trợ Direct Fetch + Browser Fallback vượt Cloudflare)
async function fetchPvoilHtml() {
    const PVOIL_URL = 'https://www.pvoil.com.vn/tin-gia-xang-dau';

    // Bước 1: Thử fetch trực tiếp qua HTTP
    try {
        console.log('[PVOIL] Thử tải dữ liệu trực tiếp từ:', PVOIL_URL);
        const res = await fetch(PVOIL_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        });

        if (res.ok) {
            const html = await res.text();
            if (html.includes('RON 95') || html.includes('Xăng')) {
                console.log('[PVOIL] Tải trực tiếp thành công!');
                return html;
            }
        }
    } catch (e) {
        console.warn('[PVOIL] Fetch trực tiếp gặp lỗi:', e.message);
    }

    // Bước 2: Khi bị Cloudflare Turnstile chặn, dùng Edge offscreen tự động giải mã
    console.log('[PVOIL] Phát hiện lớp bảo vệ Cloudflare, đang kích hoạt trình duyệt cào tự động...');
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const profileDir = path.join(os.tmpdir(), 'edge_profile_cf');
    const port = 9222 + Math.floor(Math.random() * 50);

    const edge = spawn(edgePath, [
        `--remote-debugging-port=${port}`,
        '--window-position=-32000,-32000',
        '--window-size=800,600',
        '--no-first-run',
        '--no-default-browser-check',
        '--user-data-dir=' + profileDir,
        PVOIL_URL
    ]);

    try {
        let htmlResult = null;
        for (let i = 1; i <= 15; i++) {
            await new Promise(r => setTimeout(r, 1000));
            try {
                const res = await fetch(`http://127.0.0.1:${port}/json`);
                const tabs = await res.json();
                const tab = tabs.find(t => t.url && t.url.includes('pvoil.com.vn'));
                if (tab && tab.title && !tab.title.includes('Just a moment')) {
                    // Trang đã load thành công, kết nối WebSocket CDP lấy HTML
                    htmlResult = await new Promise((resolve, reject) => {
                        const ws = new WebSocket(tab.webSocketDebuggerUrl);
                        ws.onopen = () => {
                            ws.send(JSON.stringify({
                                id: 1,
                                method: 'Runtime.evaluate',
                                params: { expression: 'document.documentElement.outerHTML' }
                            }));
                        };
                        ws.onmessage = (event) => {
                            const data = JSON.parse(event.data);
                            if (data.id === 1 && data.result && data.result.result) {
                                ws.close();
                                resolve(data.result.result.value);
                            }
                        };
                        ws.onerror = reject;
                        setTimeout(() => reject(new Error('Timeout WebSocket CDP')), 5000);
                    });
                    break;
                }
            } catch (err) {
                // Tiếp tục chờ trang load
            }
        }
        edge.kill();
        return htmlResult;
    } catch (e) {
        console.error('[PVOIL] Lỗi khi cào dữ liệu qua trình duyệt:', e);
        edge.kill();
        return null;
    }
}

// 3. Hàm chính: Cào giá PVOIL và lưu vào database WebBao
async function luuGiaXang() {
    try {
        console.log('=== BẮT ĐẦU CẬP NHẬT GIÁ XĂNG TỪ PVOIL ===');
        const html = await fetchPvoilHtml();
        if (!html) {
            console.error('[PVOIL] Không thể tải nội dung trang web PVOIL!');
            return;
        }

        const data = parsePvoilHtml(html);
        if (!data || !data.price) {
            console.error('[PVOIL] Không trích xuất được giá xăng RON 95 từ HTML!');
            return;
        }

        console.log(`[PVOIL] Dữ liệu cào được: Ngày = ${data.date}, Giá Xăng RON 95 = ${data.price} đ/lít`);

        const pool = await connectDB();
        const check = await pool.request()
            .input('date', sql.Date, data.date)
            .query(`
                SELECT TOP 1 [Date], [Price]
                FROM [dbo].[N95III]
                WHERE [Date] = @date
            `);

        if (check.recordset.length > 0) {
            const oldPrice = check.recordset[0].Price;
            if (Number(oldPrice) === Number(data.price)) {
                console.log(`[PVOIL] Ngày ${data.date} đã có giá ${data.price}, không cần cập nhật.`);
                return;
            }

            await pool.request()
                .input('date', sql.Date, data.date)
                .input('price', sql.Decimal(18, 2), data.price)
                .query(`
                    UPDATE [dbo].[N95III]
                    SET [Price] = @price
                    WHERE [Date] = @date
                `);

            console.log(`[PVOIL] Đã cập nhật giá xăng ngày ${data.date}: ${oldPrice} -> ${data.price}`);
            return;
        }

        await pool.request()
            .input('date', sql.Date, data.date)
            .input('price', sql.Decimal(18, 2), data.price)
            .query(`
                INSERT INTO [dbo].[N95III] ([Date], [Price])
                VALUES (@date, @price)
            `);

        console.log(`[PVOIL] Đã lưu giá xăng mới thành công: Ngày ${data.date} - Giá ${data.price}`);

    } catch (error) {
        console.error('[PVOIL] Lỗi khi lưu giá xăng:', error);
    }
}

module.exports = { luuGiaXang };