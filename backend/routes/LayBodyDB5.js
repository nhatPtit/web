const express = require('express');
const sql = require('mssql');
const router = express.Router();

const { connectDB } = require('../db');

router.get('/', async (req, res) => {
    try {
        // Lấy offset từ query (ví dụ: /api/baibao?offset=6). 
        // Nếu không có, mặc định là 6.
        const offset = parseInt(req.query.offset) || 6;
        const limit = 5; // Số bài mỗi lần tải

        const pool = await connectDB();
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
            WHERE b.status = 'published' 
            ORDER BY 
                b.published_at DESC
            OFFSET @offset ROWS 
            FETCH NEXT @limit ROWS ONLY;
        `;

        const result = await pool.request()
            .input('offset', sql.Int, offset)
            .input('limit', sql.Int, limit)
            .query(query);

        res.json(result.recordset);

    } catch (err) {
        console.error("Lỗi khi tải thêm bài báo:", err);
        res.status(500).json({ error: "Lỗi truy vấn cơ sở dữ liệu" });
    }
});

module.exports = router;