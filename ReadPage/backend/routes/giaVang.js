// File: routes/giaVang.js
const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3OTEzNjMxNzEsImlhdCI6MTc5MDA2NzE3MSwic2NvcGUiOiJnb2xkIiwicGVybWlzc2lvbiI6MH0.snuciLCHLgMs9pr1XBgzOFojBmGvEZR2DCByJ6SKXAM';
        const url = 'https://api.vnappmob.com/api/v2/gold/sjc';
        const response = await fetch(url, {//fetch=http request
            headers: {//http request kèm thông tin xác thực
                Authorization: `Bearer ${apiKey}`
            }
        });

        const data = await response.json();//dữ liệu trả về có nhiều thứ nhưng chỉ lấy trong json

        res.json(data);

    } catch (error) {
        res.status(500).json({
            message: 'Lỗi kết nối API giá vàng'
        });
    }
});

module.exports = router;