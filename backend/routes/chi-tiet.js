const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { connectDB } = require('../db');

// Route API: GET /api/chitietbaibao?id=...
router.get('/', async (req, res) => {
    try {
        // Lấy ID từ URL query
        const articleId = req.query.id;

        if (!articleId) {
            return res.status(400).json({ message: 'Thiếu ID bài viết!' });
        }

        const pool = await connectDB();

        // Chạy đồng thời 2 câu lệnh truy vấn để lấy Bài Báo và Ảnh
        const result = await pool.request()
            .input('id_bb', sql.Int, articleId)
            .query(`
                -- Chỉ tăng lượt xem khi bài viết đã được xuất bản (dành cho độc giả đọc tin)
                UPDATE dbo.BaiViet 
                SET views_count = COALESCE(views_count, 0) + 1 
                WHERE Id = @id_bb AND status IN ('published', 'daduyet');

                -- Ghi nhận lượt xem ngày hôm nay vào dbo.daily_views
                IF EXISTS (SELECT 1 FROM dbo.BaiViet WHERE Id = @id_bb AND status IN ('published', 'daduyet'))
                BEGIN
                    MERGE dbo.daily_views AS target
                    USING (SELECT CAST(SYSDATETIME() AS DATE) AS today) AS source
                    ON (target.view_date = source.today)
                    WHEN MATCHED THEN
                        UPDATE SET target.views_count = target.views_count + 1
                    WHEN NOT MATCHED THEN
                        INSERT (view_date, views_count, articles_viewed)
                        VALUES (source.today, 1, 1);
                END

                -- Truy vấn 1: Lấy chi tiết bài báo (đã được cộng 1 lượt xem)
                SELECT 
                    b.Id AS ID_BB,
                    b.Id,
                    b.title AS TieuDe,
                    b.sapo AS TomTat,
                    b.Content AS NoiDung,
                    b.published_at AS NgayDang,
                    b.category_id AS ID_TL,
                    b.author_id AS ID_NhaBao_Viet,
                    b.editor_id AS ID_Nguoi_Duyet,
                    b.status,
                    b.views_count
                FROM dbo.BaiViet b
                WHERE b.Id = @id_bb;

                -- Truy vấn 2: Lấy tất cả ảnh thuộc bài báo này
                SELECT 
                    a.Id AS ID_Anh, 
                    a.image_url AS [URL], 
                    a.caption AS [Caption], 
                    a.display_order AS [ViTriTrongBai]
                FROM dbo.AnhBaiViet a
                WHERE a.id_BB = @id_bb;
            `);

        // Truy vấn 1 sẽ nằm ở result.recordsets[0]
        const baiBaoData = result.recordsets[0];

        if (!baiBaoData || baiBaoData.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy bài viết' });
        }

        // Lấy bài báo đầu tiên
        const article = baiBaoData[0];

        // Truy vấn 2 (danh sách ảnh) sẽ nằm ở result.recordsets[1]
        const listAnh = result.recordsets[1];

        // Nếu có ảnh, lặp qua mảng ảnh và gán URL vào thuộc tính AnhX (VD: Anh2, Anh3...)
        if (listAnh && listAnh.length > 0) {
            listAnh.forEach(anh => {
                if (anh.ViTriTrongBai) {
                    // Tạo ra các key động như article.Anh2 = '/Anh-BB/xxhaha4.webp'
                    article[`Anh${anh.ViTriTrongBai}`] = anh.URL;

                    // (Tùy chọn) Gán thêm cả Caption nếu muốn hiển thị chú thích ảnh
                    if (anh.Caption) {
                        article[`Caption${anh.ViTriTrongBai}`] = anh.Caption;
                    }
                }
            });
        }

        // Trả về object bài báo đã được đính kèm toàn bộ link ảnh
        res.status(200).json(article);

    } catch (error) {
        console.error('Lỗi khi lấy chi tiết bài báo và ảnh:', error);
        res.status(500).json({ message: 'Lỗi server khi tải nội dung bài viết!' });
    }
});

module.exports = router;