const express = require('express');
const router = express.Router();
const sql = require('mssql');
const path = require('path');
const { connectDB } = require('../db');

function formatDateVN(date) {
    if (!date) return '';
    const d = new Date(date);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('vi-VN');
}

/**
 * 1. GET /api/kiemduyet/articles
 * Lấy danh sách bài viết cho kiểm duyệt viên (hỗ trợ lọc status: pending, published, all)
 */
router.get('/articles', async (req, res) => {
    try {
        const pool = await connectDB();
        const statusFilter = (req.query.status || 'pending').toLowerCase();
        let whereClause = "WHERE b.status IN ('pending', 'choduyet')";
        if (statusFilter === 'published') {
            whereClause = "WHERE b.status IN ('published', 'daduyet')";
        } else if (statusFilter === 'all') {
            whereClause = "WHERE 1=1";
        }

        const query = `
            SELECT 
                b.Id,
                b.title,
                b.sapo,
                b.category_id,
                c.name AS category_name,
                b.author_id,
                COALESCE(u.ButDanh, u.full_name, 'Tác giả') AS author_name,
                b.editor_id,
                b.status,
                b.editor_note,
                b.published_at,
                b.views_count,
                p.pin_position,
                (
                    SELECT TOP 1 a.image_url 
                    FROM dbo.AnhBaiViet a 
                    WHERE a.id_BB = b.Id 
                    ORDER BY a.display_order ASC
                ) AS first_image
            FROM dbo.BaiViet b
            LEFT JOIN dbo.categories c ON b.category_id = c.id
            LEFT JOIN dbo.users u ON b.author_id = u.id
            LEFT JOIN dbo.pin_position p ON p.Id_BB = b.Id
            ${whereClause}
            ORDER BY COALESCE(b.published_at, '1970-01-01') DESC, b.Id DESC;
        `;

        const result = await pool.request().query(query);

        const articles = result.recordset.map(b => ({
            id: b.Id,
            t: b.title,
            title: b.title,
            s: b.sapo || '',
            sapo: b.sapo || '',
            c: b.category_name || 'Thời sự',
            category: b.category_name || 'Thời sự',
            category_id: b.category_id,
            a: b.author_name || 'Phóng viên',
            author: b.author_name || 'Phóng viên',
            author_id: b.author_id,
            d: formatDateVN(b.published_at) || formatDateVN(new Date()),
            published_at: formatDateVN(b.published_at) || formatDateVN(new Date()),
            rawDate: b.published_at,
            v: b.views_count || 0,
            views_count: b.views_count || 0,
            status: b.status,
            st: b.status === 'published' ? 'pub' : 'hide',
            note: b.editor_note || '',
            editor_note: b.editor_note || '',
            pin_position: b.pin_position || null,
            img: b.first_image || ''
        }));

        return res.status(200).json({
            success: true,
            articles: articles
        });
    } catch (err) {
        console.error('Lỗi khi lấy danh sách bài viết kiểm duyệt:', err);
        return res.status(500).json({ success: false, message: 'Lỗi CSDL khi tải bài viết: ' + err.message });
    }
});

/**
 * 2. GET /api/kiemduyet/articles/:id
 * Lấy chi tiết toàn bộ bài báo (gồm nội dung đầy đủ và danh sách ảnh/caption)
 */
router.get('/articles/:id', async (req, res) => {
    try {
        const articleId = parseInt(req.params.id, 10);
        if (!articleId || isNaN(articleId)) {
            return res.status(400).json({ success: false, message: 'ID bài báo không hợp lệ.' });
        }

        const pool = await connectDB();

        const query = `
            SELECT 
                b.Id,
                b.title,
                b.sapo,
                b.Content,
                b.category_id,
                c.name AS category_name,
                b.author_id,
                COALESCE(u.ButDanh, u.full_name, 'Tác giả') AS author_name,
                u.email AS author_email,
                b.editor_id,
                b.status,
                b.editor_note,
                b.published_at,
                b.views_count,
                p.pin_position
            FROM dbo.BaiViet b
            LEFT JOIN dbo.categories c ON b.category_id = c.id
            LEFT JOIN dbo.users u ON b.author_id = u.id
            LEFT JOIN dbo.pin_position p ON p.Id_BB = b.Id
            WHERE b.Id = @id;

            SELECT 
                a.Id,
                a.image_url,
                a.caption,
                a.display_order
            FROM dbo.AnhBaiViet a
            WHERE a.id_BB = @id
            ORDER BY a.display_order ASC;
        `;

        const result = await pool.request()
            .input('id', sql.Int, articleId)
            .query(query);

        if (!result.recordsets[0] || result.recordsets[0].length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết.' });
        }

        const b = result.recordsets[0][0];
        const imgs = (result.recordsets[1] || []).map(img => ({
            id: img.Id,
            url: img.image_url,
            caption: img.caption || '',
            order: img.display_order
        }));

        return res.status(200).json({
            success: true,
            article: {
                id: b.Id,
                title: b.title,
                sapo: b.sapo || '',
                content: b.Content || '',
                category: b.category_name || 'Thời sự',
                category_id: b.category_id,
                author: b.author_name || 'Phóng viên',
                author_email: b.author_email || '',
                status: b.status,
                editor_note: b.editor_note || '',
                published_at: formatDateVN(b.published_at),
                views_count: b.views_count || 0,
                pin_position: b.pin_position || null,
                images: imgs
            }
        });
    } catch (err) {
        console.error('Lỗi khi lấy chi tiết bài báo:', err);
        return res.status(500).json({ success: false, message: 'Lỗi server khi lấy chi tiết bài báo: ' + err.message });
    }
});

/**
 * 3. POST /api/kiemduyet/articles/:id/approve
 * Phê duyệt và xuất bản bài báo (kèm tùy chọn ghim vị trí 1, 2, 3)
 */
router.post('/articles/:id/approve', async (req, res) => {
    try {
        const articleId = parseInt(req.params.id, 10);
        const { featured_pos, editor_id } = req.body || {};

        if (!articleId || isNaN(articleId)) {
            return res.status(400).json({ success: false, message: 'ID bài báo không hợp lệ.' });
        }

        const pool = await connectDB();

        // 1. Cập nhật trạng thái bài báo thành 'published'
        await pool.request()
            .input('id', sql.Int, articleId)
            .input('editor_id', sql.Int, parseInt(editor_id, 10) || null)
            .query(`
                UPDATE dbo.BaiViet
                SET status = 'published',
                    published_at = SYSDATETIME(),
                    editor_id = @editor_id,
                    editor_note = NULL
                WHERE Id = @id;
            `);

        // 2. Xử lý ghim vị trí nổi bật (nếu có chọn vị trí 1, 2, 3)
        const pos = parseInt(featured_pos, 10);
        if (pos >= 1 && pos <= 3) {
            // Xóa bài đang ghim ở vị trí này hoặc bài này đang ở vị trí khác
            await pool.request()
                .input('pos', sql.Int, pos)
                .input('id_bb', sql.Int, articleId)
                .query(`
                    DELETE FROM dbo.pin_position 
                    WHERE pin_position = @pos OR Id_BB = @id_bb;
                `);

            // Thêm ghim mới
            await pool.request()
                .input('pos', sql.Int, pos)
                .input('id_bb', sql.Int, articleId)
                .input('editor_id', sql.Int, parseInt(editor_id, 10) || null)
                .query(`
                    INSERT INTO dbo.pin_position (pin_position, pinned_at, Id_BB, Id_editor)
                    VALUES (@pos, SYSDATETIME(), @id_bb, @editor_id);
                `);
        } else {
            // Không ghim nổi bật -> gỡ ghim nếu trước đó từng ghim
            await pool.request()
                .input('id_bb', sql.Int, articleId)
                .query(`DELETE FROM dbo.pin_position WHERE Id_BB = @id_bb;`);
        }

        return res.status(200).json({
            success: true,
            message: `Bài báo (ID ${articleId}) đã được duyệt và xuất bản thành công!` +
                (pos >= 1 && pos <= 3 ? ` (Đã ghim vị trí nổi bật ${pos})` : ' (Đăng luồng tin thường)')
        });
    } catch (err) {
        console.error('Lỗi khi duyệt bài báo:', err);
        return res.status(500).json({ success: false, message: 'Lỗi server khi duyệt bài báo: ' + err.message });
    }
});

/**
 * 4. POST /api/kiemduyet/articles/:id/reject
 * Yêu cầu sửa / trả lại bài báo cho tác giả kèm lý do
 */
router.post('/articles/:id/reject', async (req, res) => {
    try {
        const articleId = parseInt(req.params.id, 10);
        const { reason, editor_id } = req.body || {};

        if (!articleId || isNaN(articleId)) {
            return res.status(400).json({ success: false, message: 'ID bài báo không hợp lệ.' });
        }
        if (!reason || !reason.trim()) {
            return res.status(400).json({ success: false, message: 'Vui lòng cung cấp lý do / vị trí cần chỉnh sửa.' });
        }

        const pool = await connectDB();

        // 1. Cập nhật bài báo thành 'rejected' kèm lý do
        await pool.request()
            .input('id', sql.Int, articleId)
            .input('note', sql.NVarChar, reason.trim())
            .input('editor_id', sql.Int, parseInt(editor_id, 10) || null)
            .query(`
                UPDATE dbo.BaiViet
                SET status = 'rejected',
                    editor_note = @note,
                    editor_id = @editor_id
                WHERE Id = @id;
            `);

        // 2. Gỡ khỏi danh sách ghim nếu có
        await pool.request()
            .input('id_bb', sql.Int, articleId)
            .query(`DELETE FROM dbo.pin_position WHERE Id_BB = @id_bb;`);

        return res.status(200).json({
            success: true,
            message: `Đã gửi yêu cầu sửa bài (ID ${articleId}) về cho tác giả.`
        });
    } catch (err) {
        console.error('Lỗi khi trả bài báo:', err);
        return res.status(500).json({ success: false, message: 'Lỗi server khi trả bài báo: ' + err.message });
    }
});

/**
 * 5. POST /api/kiemduyet/articles/:id/toggle-publish
 * Gỡ bài hoặc Đăng lại bài (trong danh sách bài đã đăng)
 * Khi GỠ: Cập nhật status='rejected', lưu editor_note (feedback cho nhà báo), xóa ghim
 * Khi ĐĂNG LẠI: Cập nhật status='published', xóa editor_note, cập nhật NgayDang
 */
router.post('/articles/:id/toggle-publish', async (req, res) => {
    try {
        const articleId = parseInt(req.params.id, 10);
        const { reason, editor_id } = req.body || {};

        if (!articleId || isNaN(articleId)) {
            return res.status(400).json({ success: false, message: 'ID bài báo không hợp lệ.' });
        }

        const pool = await connectDB();

        const checkRes = await pool.request()
            .input('id', sql.Int, articleId)
            .query('SELECT status, title FROM dbo.BaiViet WHERE Id = @id;');

        if (checkRes.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết.' });
        }

        const currentStatus = checkRes.recordset[0].status;
        const newStatus = (currentStatus === 'published') ? 'rejected' : 'published';

        if (newStatus === 'rejected') {
            // Khi GỠ BÀI: Yêu cầu có lý do gỡ bài để feedback lại cho nhà báo
            const finalReason = (reason && reason.trim()) ? reason.trim() : 'Bài viết đã bị kiểm duyệt viên tạm gỡ khỏi trang báo để kiểm tra hoặc chỉnh sửa lại.';
            await pool.request()
                .input('id', sql.Int, articleId)
                .input('new_status', sql.VarChar, newStatus)
                .input('editor_note', sql.NVarChar, finalReason)
                .input('editor_id', sql.Int, parseInt(editor_id, 10) || null)
                .query(`
                    UPDATE dbo.BaiViet 
                    SET status = @new_status,
                        editor_note = @editor_note,
                        editor_id = @editor_id
                    WHERE Id = @id;
                `);

            // Xóa ghim khỏi trang chủ nếu đang ghim
            await pool.request()
                .input('id_bb', sql.Int, articleId)
                .query(`DELETE FROM dbo.pin_position WHERE Id_BB = @id_bb;`);

            return res.status(200).json({
                success: true,
                newStatus: newStatus,
                message: 'Đã gỡ bài viết xuống và gửi phản hồi lý do cho nhà báo thành công!'
            });
        } else {
            // Khi ĐĂNG LẠI: Cập nhật status = 'published', xóa editor_note, bài báo không bị mất
            await pool.request()
                .input('id', sql.Int, articleId)
                .input('new_status', sql.VarChar, newStatus)
                .query(`
                    UPDATE dbo.BaiViet 
                    SET status = @new_status,
                        editor_note = NULL,
                        published_at = GETDATE()
                    WHERE Id = @id;
                `);

            return res.status(200).json({
                success: true,
                newStatus: newStatus,
                message: 'Đã xuất bản lại bài viết lên trang báo thành công!'
            });
        }
    } catch (err) {
        console.error('Lỗi gỡ/đăng lại bài:', err);
        return res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
    }
});

/**
 * 5b. DELETE /api/kiemduyet/articles/:id
 * Xóa vĩnh viễn bài báo (kèm xóa liên kết pin_position, AnhBaiViet)
 */
router.delete('/articles/:id', async (req, res) => {
    try {
        const articleId = parseInt(req.params.id, 10);
        if (!articleId || isNaN(articleId)) {
            return res.status(400).json({ success: false, message: 'ID bài báo không hợp lệ.' });
        }
        const pool = await connectDB();
        await pool.request().input('id', sql.Int, articleId).query(`
            DELETE FROM dbo.pin_position WHERE Id_BB = @id;
            DELETE FROM dbo.AnhBaiViet WHERE bai_viet_id = @id;
            DELETE FROM dbo.BaiViet WHERE Id = @id;
        `);
        return res.status(200).json({
            success: true,
            message: `Đã xóa vĩnh viễn bài báo #${articleId} khỏi hệ thống CSDL thành công!`
        });
    } catch (err) {
        console.error('Lỗi khi xóa bài báo:', err);
        return res.status(500).json({ success: false, message: 'Lỗi server khi xóa bài: ' + err.message });
    }
});

/**
 * 5c. POST /api/kiemduyet/articles/:id/pin
 * Đổi vị trí ghim của bài báo (0: Tin thường, 1: Tiêu điểm chính, 2: Nổi bật phụ 1, 3: Nổi bật phụ 2)
 */
router.post('/articles/:id/pin', async (req, res) => {
    try {
        const articleId = parseInt(req.params.id, 10);
        const { featured_pos, editor_id } = req.body || {};
        if (!articleId || isNaN(articleId)) {
            return res.status(400).json({ success: false, message: 'ID bài báo không hợp lệ.' });
        }
        const pos = parseInt(featured_pos, 10) || 0;
        const pool = await connectDB();

        // 1. Luôn xóa bài báo này khỏi pin_position trước
        await pool.request()
            .input('id_bb', sql.Int, articleId)
            .query(`DELETE FROM dbo.pin_position WHERE Id_BB = @id_bb;`);

        // 2. Nếu pos >= 1 && pos <= 3: xóa bài nào đang ở vị trí pos và insert bài này
        if (pos >= 1 && pos <= 3) {
            await pool.request()
                .input('pos', sql.Int, pos)
                .query(`DELETE FROM dbo.pin_position WHERE pin_position = @pos;`);

            await pool.request()
                .input('pos', sql.Int, pos)
                .input('id_bb', sql.Int, articleId)
                .input('editor_id', sql.Int, parseInt(editor_id, 10) || null)
                .query(`
                    INSERT INTO dbo.pin_position (pin_position, pinned_at, Id_BB, Id_editor)
                    VALUES (@pos, SYSDATETIME(), @id_bb, @editor_id);
                `);
        }

        return res.status(200).json({
            success: true,
            featured_pos: pos,
            message: pos >= 1 && pos <= 3 ? `Đã đổi ghim bài báo #${articleId} sang vị trí nổi bật ${pos}!` : `Đã chuyển bài báo #${articleId} về luồng tin thường (không ghim).`
        });
    } catch (err) {
        console.error('Lỗi khi đổi ghim:', err);
        return res.status(500).json({ success: false, message: 'Lỗi server khi đổi ghim: ' + err.message });
    }
});

/**
 * 6. GET /api/kiemduyet/ads
 * Lấy danh sách mẫu quảng cáo (đang chờ duyệt hoặc tất cả)
 */
router.get('/ads', async (req, res) => {
    try {
        const pool = await connectDB();
        const statusFilter = (req.query.status || 'pending').toLowerCase();

        // Tự động cập nhật các đơn quảng cáo quá hạn theo các luồng quy định:
        // Luồng 1: chuaduyet -> daduyet -> choxacnhan -> dathanhtoan -> quahan (hết hạn ngày chạy)
        // Luồng 2: Chuaduyet -> tuchoi -> quahan (bị từ chối và qua ngày kết thúc)
        // Luồng 3: chuaduyet -> daduyet -> quahan (duyệt rồi nhưng không thanh toán, qua ngày bắt đầu)
        await pool.request().query(`
            -- Đơn đã thanh toán/đang chạy hết thời gian hiển thị
            UPDATE dbo.ad_requests
            SET status = 'hoanthanh'
            WHERE status IN ('dathanhtoan', 'Active', 'active')
              AND CAST(SYSDATETIME() AS DATE) > end_date;

            -- Đơn đã duyệt nhưng không thanh toán, để qua ngày bắt đầu
            UPDATE dbo.ad_requests
            SET status = 'hoanthanh'
            WHERE status IN ('daduyet')
              AND CAST(SYSDATETIME() AS DATE) > start_date;

            -- Đơn bị từ chối mẫu hoặc chờ duyệt mà đã qua ngày kết thúc
            UPDATE dbo.ad_requests
            SET status = 'hoanthanh'
            WHERE status IN ('tuchoi', 'tu_choi', 'chuaduyet', 'cho_duyet', 'pending')
              AND CAST(SYSDATETIME() AS DATE) > end_date;
        `);

        let whereClause = "WHERE r.status IN ('chuaduyet', 'cho_duyet', 'pending')";
        if (statusFilter === 'all') {
            whereClause = "WHERE 1=1";
        } else if (statusFilter === 'payment' || statusFilter === 'choxacnhan') {
            whereClause = "WHERE r.status IN ('choxacnhan', 'cho_xac_nhan')";
        } else if (statusFilter === 'schedule') {
            whereClause = "WHERE r.status IN ('dathanhtoan', 'Active', 'active', 'daduyet', 'choxacnhan')";
        } else if (statusFilter === 'active') {
            whereClause = "WHERE r.status IN ('Active', 'active', 'dathanhtoan')";
        }

        const query = `
            SELECT 
                r.Id,
                r.advertiser_id,
                COALESCE(u.company_name, u.full_name, 'Doanh nghiệp') AS company_name,
                COALESCE(u.full_name, 'Người liên hệ') AS contact_person,
                u.phone AS advertiser_phone,
                u.email AS advertiser_email,
                r.position_id,
                p.Name AS position_name,
                p.price_per_day,
                r.media_url,
                r.target_url,
                r.start_date,
                r.end_date,
                DATEDIFF(day, r.start_date, r.end_date) + 1 AS total_days,
                r.total_amount,
                r.status,
                r.rejection_reason,
                r.views_count,
                r.created_at
            FROM dbo.ad_requests r
            LEFT JOIN dbo.ad_positions p ON r.position_id = p.Id
            LEFT JOIN dbo.users u ON r.advertiser_id = u.id
            ${whereClause}
            ORDER BY r.created_at DESC, r.Id DESC;
        `;

        const result = await pool.request().query(query);

        const ads = result.recordset.map(ad => ({
            id: ad.Id,
            company_name: ad.company_name,
            contact_person: ad.contact_person,
            phone: ad.advertiser_phone || 'Chưa cập nhật',
            email: ad.advertiser_email || '',
            position_id: ad.position_id,
            position_name: ad.position_name || 'Banner',
            media_url: ad.media_url || '',
            target_url: ad.target_url || '#',
            start_date: formatDateVN(ad.start_date),
            end_date: formatDateVN(ad.end_date),
            total_days: ad.total_days || 1,
            total_amount: ad.total_amount || 0,
            status: ad.status,
            rejection_reason: ad.rejection_reason || '',
            views_count: ad.views_count || 0
        }));

        return res.status(200).json({
            success: true,
            ads: ads
        });
    } catch (err) {
        console.error('Lỗi khi lấy danh sách quảng cáo:', err);
        return res.status(500).json({ success: false, message: 'Lỗi server khi tải quảng cáo: ' + err.message });
    }
});

/**
 * 7. POST /api/kiemduyet/ads/:id/approve
 * Duyệt mẫu quảng cáo (chuyển chuaduyet -> daduyet)
 */
router.post('/ads/:id/approve', async (req, res) => {
    try {
        const adId = parseInt(req.params.id, 10);
        const { editor_id } = req.body || {};

        if (!adId || isNaN(adId)) {
            return res.status(400).json({ success: false, message: 'ID quảng cáo không hợp lệ.' });
        }

        const pool = await connectDB();

        await pool.request()
            .input('id', sql.Int, adId)
            .input('editor_id', sql.Int, parseInt(editor_id, 10) || null)
            .query(`
                UPDATE dbo.ad_requests
                SET status = 'daduyet',
                    approved_by = @editor_id,
                    rejection_reason = NULL
                WHERE Id = @id;
            `);

        return res.status(200).json({
            success: true,
            message: `Đã phê duyệt mẫu quảng cáo ID ${adId} thành công (chuyển sang [Đã duyệt], chờ doanh nghiệp thanh toán)!`
        });
    } catch (err) {
        console.error('Lỗi khi duyệt mẫu quảng cáo:', err);
        return res.status(500).json({ success: false, message: 'Lỗi server khi duyệt quảng cáo: ' + err.message });
    }
});

/**
 * 7b. POST /api/kiemduyet/ads/:id/confirm-payment
 * Xác nhận đã thanh toán tiền quảng cáo (chuyển choxacnhan -> dathanhtoan)
 */
router.post('/ads/:id/confirm-payment', async (req, res) => {
    try {
        const adId = parseInt(req.params.id, 10);
        const { editor_id } = req.body || {};

        if (!adId || isNaN(adId)) {
            return res.status(400).json({ success: false, message: 'ID quảng cáo không hợp lệ.' });
        }

        const pool = await connectDB();

        await pool.request()
            .input('id', sql.Int, adId)
            .input('editor_id', sql.Int, parseInt(editor_id, 10) || null)
            .query(`
                UPDATE dbo.ad_requests
                SET status = 'dathanhtoan',
                    approved_by = COALESCE(@editor_id, approved_by)
                WHERE Id = @id;
            `);

        return res.status(200).json({
            success: true,
            message: `Đã xác nhận thanh toán thành công cho đơn quảng cáo #${adId} (chuyển sang [Đã thanh toán])!`
        });
    } catch (err) {
        console.error('Lỗi khi xác nhận thanh toán quảng cáo:', err);
        return res.status(500).json({ success: false, message: 'Lỗi server khi xác nhận thanh toán: ' + err.message });
    }
});

/**
 * 8. POST /api/kiemduyet/ads/:id/reject
 * Từ chối mẫu quảng cáo
 */
router.post('/ads/:id/reject', async (req, res) => {
    try {
        const adId = parseInt(req.params.id, 10);
        const { reason, editor_id } = req.body || {};

        if (!adId || isNaN(adId)) {
            return res.status(400).json({ success: false, message: 'ID quảng cáo không hợp lệ.' });
        }

        const pool = await connectDB();

        await pool.request()
            .input('id', sql.Int, adId)
            .input('reason', sql.NVarChar, reason ? reason.trim() : 'Mẫu quảng cáo chưa đáp ứng tiêu chuẩn.')
            .input('editor_id', sql.Int, parseInt(editor_id, 10) || null)
            .query(`
                UPDATE dbo.ad_requests
                SET status = 'tuchoi',
                    rejection_reason = @reason,
                    approved_by = @editor_id
                WHERE Id = @id;
            `);

        return res.status(200).json({
            success: true,
            message: `Đã từ chối mẫu quảng cáo ID ${adId}.`
        });
    } catch (err) {
        console.error('Lỗi khi từ chối quảng cáo:', err);
        return res.status(500).json({ success: false, message: 'Lỗi server khi từ chối quảng cáo: ' + err.message });
    }
});

/**
 * 9. GET /api/kiemduyet/stats
 * Lấy số liệu thống kê thực tế cho màn hình Thống kê
 */
router.get('/stats', async (req, res) => {
    try {
        const pool = await connectDB();

        // Cập nhật các đơn quá hạn trước khi đếm thống kê
        await pool.request().query(`
            UPDATE dbo.ad_requests SET status = 'hoanthanh' WHERE status IN ('dathanhtoan', 'Active', 'active') AND CAST(SYSDATETIME() AS DATE) > end_date;
            UPDATE dbo.ad_requests SET status = 'hoanthanh' WHERE status = 'daduyet' AND CAST(SYSDATETIME() AS DATE) > start_date;
            UPDATE dbo.ad_requests SET status = 'hoanthanh' WHERE status IN ('tuchoi', 'tu_choi', 'chuaduyet', 'cho_duyet', 'pending') AND CAST(SYSDATETIME() AS DATE) > end_date;
        `);

        // 1. Đếm bài chờ duyệt
        const pendingCountRes = await pool.request().query("SELECT COUNT(*) AS total FROM dbo.BaiViet WHERE status IN ('pending', 'choduyet');");
        // 2. Đếm QC chờ duyệt
        const pendingAdsRes = await pool.request().query("SELECT COUNT(*) AS total FROM dbo.ad_requests WHERE status IN ('chuaduyet', 'cho_duyet', 'pending');");
        // 2b. Đếm đơn QC chờ xác nhận thanh toán
        const pendingPaymentRes = await pool.request().query("SELECT COUNT(*) AS total FROM dbo.ad_requests WHERE status IN ('choxacnhan', 'cho_xac_nhan');");
        // 2c. Đếm đơn QC trong bảng lịch (đã thanh toán hoặc đang chạy)
        const scheduledAdsRes = await pool.request().query("SELECT COUNT(*) AS total FROM dbo.ad_requests WHERE status IN ('dathanhtoan', 'Active', 'active', 'daduyet');");
        // 3. Đếm bài đang xuất bản
        const publishedCountRes = await pool.request().query("SELECT COUNT(*) AS total, COALESCE(SUM(views_count), 0) AS total_views FROM dbo.BaiViet WHERE status IN ('published', 'daduyet');");
        // 4. Lượt xem theo chuyên mục
        const catViewsRes = await pool.request().query(`
            SELECT c.name, COALESCE(SUM(b.views_count), 0) AS total_views
            FROM dbo.categories c
            LEFT JOIN dbo.BaiViet b ON c.id = b.category_id AND b.status IN ('published', 'daduyet')
            GROUP BY c.id, c.name
            ORDER BY total_views DESC;
        `);

        // 5. Thống kê 7 ngày gần nhất (truy vấn chuẩn xác từ bảng dbo.daily_views)
        const dailyRes = await pool.request().query(`
            SELECT CONVERT(VARCHAR(10), view_date, 23) AS view_date_str,
                   views_count,
                   articles_viewed
            FROM dbo.daily_views
            WHERE view_date >= DATEADD(day, -8, CAST(SYSDATETIME() AS DATE));
        `);

        const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
        const daysMap = {};
        (dailyRes.recordset || []).forEach(r => {
            if (r.view_date_str) {
                daysMap[r.view_date_str] = r.views_count || 0;
            }
        });

        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const k = `${y}-${m}-${day}`;
            const label = dayNames[d.getDay()];
            const views = daysMap[k] != null ? daysMap[k] : 0;
            last7Days.push([label, views]);
        }

        return res.status(200).json({
            success: true,
            stats: {
                pending_articles: pendingCountRes.recordset[0]?.total || 0,
                pending_ads: pendingAdsRes.recordset[0]?.total || 0,
                pending_payments: pendingPaymentRes.recordset[0]?.total || 0,
                scheduled_ads: scheduledAdsRes.recordset[0]?.total || 0,
                published_articles: publishedCountRes.recordset[0]?.total || 0,
                total_views: publishedCountRes.recordset[0]?.total_views || 0,
                category_views: catViewsRes.recordset.map(r => ({ name: r.name, views: r.total_views })),
                days: last7Days
            }
        });
    } catch (err) {
        console.error('Lỗi khi lấy thống kê:', err);
        return res.status(500).json({ success: false, message: 'Lỗi server khi tải thống kê: ' + err.message });
    }
});

module.exports = router;
