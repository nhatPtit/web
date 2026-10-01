
const express = require('express');
const router = express.Router();
const { connectDB } = require('../db');

router.get('/', async (req, res) => {
    try {
        const pool = await connectDB();
        const query = `
            SELECT TOP 11 
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
            WHERE TrangThai =2 
            ORDER BY 
                BaiBao.NgayDang DESC;
        `;

        const result = await pool.request().query(query);

        res.json(result.recordset);

    } catch (err) {
        console.error("Lỗi khi lấy 11 bài báo:", err);
        res.status(500).json({ error: "Lỗi truy vấn cơ sở dữ liệu" });
    }
});

module.exports = router;

