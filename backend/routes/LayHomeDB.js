
const express = require('express');
const router = express.Router();
const { connectDB } = require('../db');

router.get('/', async (req, res) => {
    try {
        const pool = await connectDB();
        const query = `
            SELECT TOP 6 
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
                b.published_at DESC;
        `;

        const result = await pool.request().query(query);

        res.json(result.recordset);

    } catch (err) {
        console.error("Lỗi khi lấy 6 bài báo:", err);
        res.status(500).json({ error: "Lỗi truy vấn cơ sở dữ liệu" });
    }
});

module.exports = router;

