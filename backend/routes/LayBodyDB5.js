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
                BaiBao.ID_BB, 
                BaiBao.TieuDe, 
                BaiBao.TomTat, 
                BaiBao.NgayDang,
                (
                    SELECT TOP 1 Anh.URL 
                    FROM Anh 
                    WHERE Anh.ID_BB = BaiBao.ID_BB AND Anh.ViTriTrongBai=1
                ) AS AnhBia
            FROM 
                BaiBao
            WHERE TrangThai = 2 
            ORDER BY 
                BaiBao.NgayDang DESC
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