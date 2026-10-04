const express = require('express');
const router = express.Router();
const sql = require('mssql'); // Nhớ require thêm mssql để dùng tham số (chống SQL Injection)
const { connectDB } = require('../db');

// Route API: GET /api/baibao/chitiet?id=...
router.get('/chitiet', async (req, res) => {
    try {
        // Lấy ID từ URL query (req.query.id)
        const articleId = req.query.id; 

        if (!articleId) {
            return res.status(400).json({ message: 'Thiếu ID bài viết!' });
        }

        const pool = await connectDB();
        
        // Dùng .input để truyền biến vào SQL một cách an toàn
        const result = await pool.request()
            .input('id_bb', sql.Int, articleId) // Giả sử ID_BB kiểu số nguyên (Int). Nếu là chuỗi, dùng sql.VarChar
            .query(`
                SELECT *
                FROM [WebBaoDB].[dbo].[BaiBao]
                WHERE ID_BB = @id_bb
            `);

        // Nếu không tìm thấy bài báo nào
        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy bài viết' });
        }

        // Trả về object chứa thông tin bài báo đầu tiên tìm được
        res.status(200).json(result.recordset[0]);

    } catch (error) {
        console.error('Lỗi khi lấy chi tiết bài báo:', error);
        res.status(500).json({ message: 'Lỗi server khi tải nội dung bài viết!' });
    }
});

module.exports = router;