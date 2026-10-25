//Trả về lịch sử giá xăng lưu trong DB
const express = require('express');
const router = express.Router();
const { connectDB } = require('../db');

router.get('/lich-su-gia-xang', async (req, res) => {
    try {
        const pool = await connectDB();

        const result = await pool.request().query(`
            SELECT TOP (100)
                FORMAT([Date], 'dd/MM') AS [date],
                [Price] AS [price]
            FROM [dbo].[N95III]
        `);

        res.status(200).json({
            success: true,
            data: result.recordset
        });

    } catch (error) {
        console.error('Lỗi khi lấy dữ liệu:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy dữ liệu'
        });
    }
});

module.exports = router;

