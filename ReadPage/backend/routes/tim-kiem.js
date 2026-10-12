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
                BaiBao.ID_BB, 
                BaiBao.TieuDe, 
                BaiBao.TomTat, 
                BaiBao.NgayDang,
                (
                    SELECT TOP 1 Anh.URL 
                    FROM Anh 
                    WHERE Anh.ID_BB = BaiBao.ID_BB AND Anh.ViTriTrongBai = 1
                ) AS AnhBia
            FROM 
                BaiBao
            WHERE 
                TrangThai = 2 AND BaiBao.TieuDe LIKE @keyword
            ORDER BY 
                BaiBao.NgayDang DESC
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
