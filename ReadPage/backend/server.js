// File: server.js
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;

app.use(cors());

// 1. Nhập (Import) các module chức năng từ thư mục routes
const giaVangRoute = require('./routes/giaVang');

// 2. Phân luồng: Nếu có ai gọi API nào, đẩy việc cho file tương ứng xử lý
//khai báo prefix cho router ở đây là /api/gia-vang
app.use('/api/gia-vang', giaVangRoute);

app.listen(PORT, () => {
    console.log(`Backend PTEWS đang chạy tại cổng ${PORT}`);
});

let file = "fetch.txt";

// Fetch a file
fetch(file)
  .then(function(response) {
    return response.text();
  })
  .then(function(data) {
    myDisplayer(data);
  });

// Function to display any text
function myDisplayer(text) {
  document.getElementById("demo").innerHTML = text;
}




