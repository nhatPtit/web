
const express = require('express');
const router = express.Router();

const danhSachTinh = [
    'Hanoi',
    'Ho Chi Minh City',
    'Da Nang',
    'Hai Phong',
    'Can Tho',
    'Hue',
    'Nha Trang',
    'Da Lat',
    'Quy Nhon',
    'Vinh',
    'Thai Nguyen',
    'Nam Dinh',
    'Thanh Hoa',
    'Vung Tau',
    'Bien Hoa',
    'Buon Ma Thuot'
];

const tenHienThi = {
    'Hanoi': 'Hà Nội',
    'Ho Chi Minh City': 'TP. Hồ Chí Minh',
    'Da Nang': 'Đà Nẵng',
    'Hai Phong': 'Hải Phòng',
    'Can Tho': 'Cần Thơ',
    'Hue': 'Huế',
    'Nha Trang': 'Nha Trang',
    'Da Lat': 'Đà Lạt',
    'Quy Nhon': 'Quy Nhơn',
    'Vinh': 'Vinh',
    'Thai Nguyen': 'Thái Nguyên',
    'Nam Dinh': 'Nam Định',
    'Thanh Hoa': 'Thanh Hóa',
    'Vung Tau': 'Vũng Tàu',
    'Bien Hoa': 'Biên Hòa',
    'Buon Ma Thuot': 'Buôn Ma Thuột'
};

// API lấy thời tiết theo tỉnh/thành phố
router.get('/', async (req, res) => {
    try {
        const tinh = req.query.tinh;

        if (!tinh) {
            return res.status(400).json({
                loi: 'Vui lòng chọn tỉnh/thành phố.'
            });
        }

        // Chỉ chấp nhận địa điểm có trong danh sách
        const diaDiem = danhSachTinh.find(
            item => item.toLowerCase() === tinh.toLowerCase()
        );

        if (!diaDiem) {
            return res.status(400).json({
                loi: 'Tỉnh/thành phố không hợp lệ.'
            });
        }

        if (!process.env.WEATHER_API_KEY) {
            return res.status(500).json({
                loi: 'Chưa cấu hình WEATHER_API_KEY.'
            });
        }

        const url = new URL(
            'https://api.weatherapi.com/v1/current.json'
        );

        url.searchParams.set(
            'key',
            process.env.WEATHER_API_KEY
        );
        url.searchParams.set('q', diaDiem);
        url.searchParams.set('aqi', 'yes');
        url.searchParams.set('lang', 'vi');

        // Gọi API bằng fetch, không dùng Axios
        const response = await fetch(url);

        const data = await response.json();

        if (!response.ok) {
            console.error('WeatherAPI error:', data.error);

            return res.status(502).json({
                loi: 'Không lấy được dữ liệu thời tiết.'
            });
        }

        const hienTai = data.current;
        const khongKhi = hienTai.air_quality;

        if (!khongKhi) {
            return res.status(502).json({
                loi: 'API không trả về dữ liệu chất lượng không khí.'
            });
        }

        const aqi = khongKhi['us-epa-index'];

        const mucAqi = {
            1: 'Tốt',
            2: 'Trung bình',
            3: 'Không tốt cho nhóm nhạy cảm',
            4: 'Không tốt cho sức khỏe',
            5: 'Rất không tốt',
            6: 'Nguy hại'
        };

        return res.json({
            tinh: tenHienThi[diaDiem] || diaDiem,
            nhietDo: hienTai.temp_c,
            doAm: hienTai.humidity,
            moTa: hienTai.condition.text,
            bieuTuong: hienTai.condition.icon,
            aqi: aqi,
            mucAqi: mucAqi[aqi] || 'Không xác định',
            pm25: khongKhi.pm2_5,
            capNhatLuc: hienTai.last_updated
        });

    } catch (error) {
        console.error('Lỗi thời tiết:', error.message);

        return res.status(500).json({
            loi: 'Lỗi máy chủ khi lấy dữ liệu thời tiết.'
        });
    }
});

module.exports = router;
