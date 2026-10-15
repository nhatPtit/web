const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { connectDB } = require('../db');

// Route API: GET /api/tim-kiem?q=...&offset=...
router.get('/', async (req, res) => {
    try {
        const keyword = req.query.q ? req.query.q.trim() : '';
        const offset = parseInt(req.query.offset) || 0;
        const limit = 5; // Số bài mỗi lần tải

        if (!keyword) {
            return res.status(400).json({ message: 'Vui lòng nhập từ khóa tìm kiếm!' });
        }

        const pool = await connectDB();

        // Truy vấn tìm kiếm bài báo theo tiêu đề
        const query = `
            SELECT 
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
            FROM 
                dbo.BaiViet b
            WHERE 
                b.status = 'published' AND b.title LIKE @keyword
            ORDER BY 
                b.published_at DESC
            OFFSET @offset ROWS 
            FETCH NEXT @limit ROWS ONLY;
        `;

        const result = await pool.request()
            .input('keyword', sql.NVarChar, `%${keyword}%`)
            .input('offset', sql.Int, offset)
            .input('limit', sql.Int, limit)
            .query(query);

        res.status(200).json(result.recordset);

    } catch (error) {
        console.error('Lỗi khi tìm kiếm bài báo:', error);
        res.status(500).json({ message: 'Lỗi server khi tìm kiếm bài báo!' });
    }
});

module.exports = router;
