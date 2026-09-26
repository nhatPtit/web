// https://www.vang.today/vi/api?utm_source=chatgpt.com
const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const url1 = 'https://www.vang.today/api/prices?type=SJL1L10&days=30';
        const url2 = 'https://www.vang.today/api/prices?type=BT9999NTT&days=30';

        const response1 = await fetch(url1);
        const response2 = await fetch(url2);

        const data1 = await response1.json();
        const data2 = await response2.json();
        // 2. Bóc tách dữ liệu và đảo ngược mảng (để vẽ từ ngày cũ -> ngày mới)
        const historySJC = data1.history.reverse();
        const historyNhan = data2.history.reverse();

        // 3. Tạo mảng trục X (Ngày tháng)
        let xValues = historySJC.map(item => item.date);
        xValues = xValues.map(date => {
            const parts = date.split('-'); // Cắt ["2026", "08", "28"]
            return `${parts[2]}/${parts[1]}`; // Ghép lại thành "28/08"
        });
        // 4. Tạo các mảng trục Y (Giá vàng)
        const sjcBuy = historySJC.map(item => item.prices.SJL1L10.buy);
        const sjcSell = historySJC.map(item => item.prices.SJL1L10.sell);

        const nhanBuy = historyNhan.map(item => item.prices.BT9999NTT.buy);
        const nhanSell = historyNhan.map(item => item.prices.BT9999NTT.sell);

        res.json({
            xValues: xValues,
            sjcBuy: sjcBuy,
            sjcSell: sjcSell,
            nhanBuy: nhanBuy,
            nhanSell: nhanSell
        });

    } catch (error) {
        res.status(500).json({
            message: 'Lỗi kết nối API giá vàng'
        });
    }
});

module.exports = router;