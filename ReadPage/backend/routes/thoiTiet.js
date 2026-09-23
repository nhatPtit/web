
const express = require('express');
const router = express.Router(); // Tạo một router cục bộ

// Lưu ý: Đường dẫn ở đây chỉ cần '/', vì lát nữa sẽ ghép chữ '/api/thoi-tiet' ở server.js
router.get('/', async (req, res) => {
    try {
        const apiKey = 'DEMO_KEY';
        const url = `https://api.openweathermap.org/data/2.5/weather?q=Hanoi&units=metric&lang=vi&appid=${apiKey}`;
        const response = await fetch(url);
        const externalData = await response.json();
        
        res.json({
            thanhPho: "Hà Nội",
            nhietDo: externalData.main.temp,
            moTa: externalData.weather[0].description
        });
    } catch (error) {
        res.status(500).json({ message: "Lỗi kết nối" });
    }
});


// Xuất module này ra để hệ thống có thể nhận diện
module.exports = router;