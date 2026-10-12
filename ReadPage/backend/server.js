const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(cors());
// Phục vụ toàn bộ giao diện Frontend (HTML, CSS, JS, Ảnh) từ thư mục ReadPage
app.use(express.static(path.join(__dirname, '..')));//path.join(__dirname, '..') sẽ trỏ ra thư mục cha của server.js
//__dirname lưu path tới server.js
//express.static(...) Nó biến thư mục được truyền vào (ở đây là thư mục cha) thành một kho lưu trữ file tĩnh.
//mặc định tìm kiếm file có tên là index.html khi người dùng truy cập vào thư mục gốc

require('dotenv').config();

const giaVang2Route = require('./routes/giaVang2');
const giaXangRoute = require('./routes/giaXang');
const { luuGiaXang } = require('./routes/luuGiaXang');
const layHomeDBRoute = require('./routes/LayHomeDB');
const layBodyDB5Route = require('./routes/LayBodyDB5');
const chiTietRoute = require('./routes/chi-tiet');
const theLoaiRoute = require('./routes/the-loai');
const thoiTietRouter = require('./routes/thoiTiet');
const timKiemRoute = require('./routes/tim-kiem');



app.use('/api/gia-vang2', giaVang2Route);
app.use('/api/gia-Xang', giaXangRoute);
app.use('/api/lay-home-db', layHomeDBRoute);
app.use('/api/lay-body-db5', layBodyDB5Route);
app.use('/api/chitietbaibao', chiTietRoute);
app.use('/api/the-loai', theLoaiRoute);
app.use('/api/thoi-tiet', thoiTietRouter);
app.use('/api/tim-kiem', timKiemRoute);
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