
const express = require('express');
const router = express.Router();
const { connectDB } = require('../db');

router.get('/', async (req, res) => {
    try {
        const pool = await connectDB();

        // 1. Lấy thông tin các bài viết được ghim ở 3 vị trí nổi bật (pin_position = 1, 2, 3)
        // Kèm điều kiện bài viết phải có trạng thái 'published'
        const pinQuery = `
            SELECT 
                p.pin_position,
                b.Id AS ID_BB, 
                b.Id,
                b.title AS TieuDe, 
                b.sapo AS TomTat, 
                b.published_at AS NgayDang,
                (
                    SELECT TOP 1 a.image_url 
                    FROM dbo.AnhBaiViet a 
                    WHERE a.id_BB = b.Id AND a.display_order = 1
                ) AS AnhBia
            FROM dbo.pin_position p
            INNER JOIN dbo.BaiViet b ON p.Id_BB = b.Id
            WHERE b.status = 'published' AND p.pin_position IN (1, 2, 3);
        `;

        // 2. Lấy danh sách các bài viết mới nhất để dự phòng (fallback) và bù các vị trí còn lại
        const latestQuery = `
            SELECT TOP 15 
                b.Id AS ID_BB, 
                b.Id,
                b.title AS TieuDe, 
                b.sapo AS TomTat, 
                b.published_at AS NgayDang,
                (
                    SELECT TOP 1 a.image_url 
                    FROM dbo.AnhBaiViet a 
                    WHERE a.id_BB = b.Id AND a.display_order = 1
                ) AS AnhBia
            FROM dbo.BaiViet b
            WHERE b.status = 'published'
            ORDER BY b.published_at DESC;
        `;

        const [pinResult, latestResult] = await Promise.all([
            pool.request().query(pinQuery),
            pool.request().query(latestQuery)
        ]);

        const pinnedList = pinResult.recordset;
        const latestList = latestResult.recordset;

        // Lưu danh sách bài ghim theo vị trí 1, 2, 3
        const pinnedMap = {};
        pinnedList.forEach(item => {
            pinnedMap[item.pin_position] = item;
        });

        const selectedArticles = [];
        const usedIds = new Set();

        // Hàm tiện ích: lấy bài mới nhất tiếp theo chưa xuất hiện trong danh sách đã chọn
        function getNextLatest() {
            return latestList.find(item => !usedIds.has(item.Id));
        }

        // --- XỬ LÝ 3 VỊ TRÍ NỔI BẬT ĐẦU TIÊN ---
        // Vị trí 1 (Hero Lead): Lấy bài pin_position = 1, nếu không có thì lấy bài mới nhất
        // Vị trí 2 & 3 (Sub-highlights): Lấy bài pin_position = 2 và 3, nếu không có thì lấy bài mới nhất tiếp theo
        for (let pos = 1; pos <= 3; pos++) {
            let article = pinnedMap[pos];

            // Nếu vị trí này chưa được ghim, hoặc bài ghim bị trùng với vị trí trước đó
            if (!article || usedIds.has(article.Id)) {
                article = getNextLatest();
            }

            if (article) {
                selectedArticles.push(article);
                usedIds.add(article.Id);
            }
        }

        // --- LẤY TIẾP CÁC BÀI CÒN LẠI (CHO ĐỦ 6 BÀI HIỂN THỊ TRANG CHỦ) ---
        while (selectedArticles.length < 6) {
            const nextItem = getNextLatest();
            if (!nextItem) break;
            selectedArticles.push(nextItem);
            usedIds.add(nextItem.Id);
        }

        res.json(selectedArticles);

    } catch (err) {
        console.error("Lỗi khi lấy 6 bài báo trang chủ:", err);
        res.status(500).json({ error: "Lỗi truy vấn cơ sở dữ liệu" });
    }
});

module.exports = router;

