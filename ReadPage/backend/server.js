// File: server.js
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;

app.use(cors());

// 1. Nhập (Import) các module chức năng từ thư mục routes
const giaVangRoute = require('./routes/giaVang');
const giaVang2Route = require('./routes/giaVang2');
// 2. Phân luồng: Nếu có ai gọi API nào, đẩy việc cho file tương ứng xử lý
//khai báo prefix cho router ở đây là /api/gia-vang
app.use('/api/gia-vang', giaVangRoute);
app.use('/api/gia-vang2', giaVang2Route);

app.listen(PORT, () => {
  console.log(`Backend PTEWS đang chạy tại cổng ${PORT}`);
});


