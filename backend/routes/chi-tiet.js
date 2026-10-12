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
                -- Truy vấn 1: Lấy chi tiết bài báo
                SELECT *
                FROM [WebBaoDB].[dbo].[BaiBao]
                WHERE ID_BB = @id_bb;

                -- Truy vấn 2: Lấy tất cả ảnh thuộc bài báo này
                SELECT [ID_Anh], [URL], [Caption], [ViTriTrongBai]
                FROM [WebBaoDB].[dbo].[Anh]
                WHERE ID_BB = @id_bb;
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