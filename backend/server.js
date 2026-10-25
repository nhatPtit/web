const express = require('express');
const cors = require('cors');
const path = require('path');
const READ_PORT = 3000;
const UPLOAD_PORT = 3001;

// Cổng 3000: Dành riêng cho ReadPage
const readApp = express();
readApp.use(cors());
readApp.use(express.json());
readApp.use(express.urlencoded({ extended: true }));
readApp.use('/Anh-BB', express.static(path.join(__dirname, '../ReadPage/Anh-BB')));
readApp.use('/', express.static(path.join(__dirname, '../ReadPage')));

// Cổng 3001: Dành riêng cho UploadPage
const uploadApp = express();
uploadApp.use(cors());
uploadApp.use(express.json());
uploadApp.use(express.urlencoded({ extended: true }));
uploadApp.use('/Anh-BB', express.static(path.join(__dirname, '../ReadPage/Anh-BB')));
uploadApp.use('/AD_file', express.static(path.join(__dirname, '../ReadPage/AD_file')));
uploadApp.use('/portal-doanhnghiep.html', (req, res) => res.sendFile(path.join(__dirname, '../ReadPage/portal-doanhnghiep.html')));
uploadApp.use('/connect-to-ad.html', (req, res) => res.sendFile(path.join(__dirname, '../ReadPage/connect-to-ad.html')));
uploadApp.use('/preview-ad.html', (req, res) => res.sendFile(path.join(__dirname, '../ReadPage/preview-ad.html')));
uploadApp.use('/', express.static(path.join(__dirname, '../UploadPage')));

require('dotenv').config({ path: path.join(__dirname, '.env') });

const giaVang2Route = require('./routes/giaVang2');
const giaXangRoute = require('./routes/giaXang');
const { luuGiaXang } = require('./routes/luuGiaXang');
const layHomeDBRoute = require('./routes/LayHomeDB');
const layBodyDB5Route = require('./routes/LayBodyDB5');
const chiTietRoute = require('./routes/chi-tiet');
const theLoaiRoute = require('./routes/the-loai');
const thoiTietRouter = require('./routes/thoiTiet');
const timKiemRoute = require('./routes/tim-kiem');
const authRoute = require('./routes/auth');
const authDoanhNghiepRoute = require('./routes/authDoanhNghiep');
const adminUsersRoute = require('./routes/admin-users');
const adminAdsRoute = require('./routes/admin-ads');
const adminBackupRoute = require('./routes/admin-backup');
const nhabaoRoute = require('./routes/nhabao');
const kiemduyetRoute = require('./routes/kiemduyet');

// Gắn các API dùng chung cho cả 2 ứng dụng
[readApp, uploadApp].forEach(instance => {
  instance.use('/api/auth', authRoute);
  instance.use('/api', authRoute); // Cho phép gọi trực tiếp /api/login
  instance.use('/api/nhabao', nhabaoRoute);
  instance.use('/api/kiemduyet', kiemduyetRoute);
  instance.use('/api/gia-vang2', giaVang2Route);
  instance.use('/api/gia-Xang', giaXangRoute);
  instance.use('/api/lay-home-db', layHomeDBRoute);
  instance.use('/api/lay-body-db5', layBodyDB5Route);
  instance.use('/api/chitietbaibao', chiTietRoute);
  instance.use('/api/the-loai', theLoaiRoute);
  instance.use('/api/thoi-tiet', thoiTietRouter);
  instance.use('/api/tim-kiem', timKiemRoute);
  instance.use('/api/auth-doanhnghiep', authDoanhNghiepRoute);
  instance.get('/api/luu-gia-Xang', async (req, res) => {
    await luuGiaXang();
    res.json({ message: "Đã chạy lệnh kiểm tra và lưu giá xăng" });
  });
});

// API Quản trị hệ thống (Chỉ gắn riêng cho UploadPage, không gắn vào ReadPage)
uploadApp.use('/api/admin', adminUsersRoute);
uploadApp.use('/api/admin/ads', adminAdsRoute);
uploadApp.use('/api/admin/backup', adminBackupRoute);


// Khởi chạy cổng 3000 cho ReadPage
readApp.listen(READ_PORT, () => {
  console.log(`[ReadPage] : http://localhost:${READ_PORT}`);
});

// Khởi chạy cổng 3001 cho UploadPage
uploadApp.listen(UPLOAD_PORT, () => {
  console.log(`[UploadPage] : http://localhost:${UPLOAD_PORT}`);
});

// 1. Tự động kiểm tra và cập nhật giá xăng PVOIL ngay khi vừa bật server
//luuGiaXang();

// 2. Tự động kiểm tra và cào giá xăng mới định kỳ mỗi ngày (mỗi 6 giờ kiểm tra một lần)
setInterval(() => {
  luuGiaXang();
}, 6 * 60 * 60 * 1000);