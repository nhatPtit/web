const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;

app.use(cors());
require('dotenv').config();

const giaVang2Route = require('./routes/giaVang2');
const giaXangRoute = require('./routes/giaXang');
const { luuGiaXang } = require('./routes/luuGiaXang');
const layHomeDBRoute = require('./routes/LayHomeDB');
const layBodyDB5Route = require('./routes/LayBodyDB5');
const chiTietRoute = require('./routes/chi-tiet');
const theLoaiRoute = require('./routes/the-loai');
const thoiTietRouter = require('./routes/thoiTiet');



app.use('/api/gia-vang2', giaVang2Route);
app.use('/api/gia-Xang', giaXangRoute);
app.use('/api/lay-home-db', layHomeDBRoute);
app.use('/api/lay-body-db5', layBodyDB5Route);
app.use('/api/chitietbaibao', chiTietRoute);
app.use('/api/the-loai', theLoaiRoute);
app.use('/api/thoi-tiet', thoiTietRouter);
app.get('/api/luu-gia-Xang', async (req, res) => {
  await luuGiaXang();
  res.json({ message: "Đã chạy lệnh kiểm tra và lưu giá xăng" });
});

app.listen(PORT, () => {
  console.log(`Backend PTEWS đang chạy tại cổng ${PORT}`);
});

setInterval(() => {
  luuGiaXang();
}, 5 * 60 * 60 * 1000);