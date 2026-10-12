const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { connectDB } = require('../db');

// Route API: GET /api/theloai?id_tl=...&offset=...
router.get('/', async (req, res) => {
    try {
        // Lấy ID thể loại từ URL query (ví dụ: ?id_tl=1)
        const idTl = req.query.id_tl;

        // Lấy offset, mặc định là 0 nếu tải lần đầu
        const offset = parseInt(req.query.offset) || 0;
        const limit = 5; // Số bài mỗi lần tải

        if (!idTl) {
            return res.status(400).json({ message: 'Thiếu ID thể loại!' });
        }

        const pool = await connectDB();

        // Truy vấn lấy danh sách bài báo thuộc thể loại, kèm ảnh bìa
        const query = `
            SELECT 
                BaiBao.ID_BB, 
                BaiBao.TieuDe, 
                BaiBao.TomTat, 
                BaiBao.NgayDang,
                (
                    SELECT TOP 1 Anh.URL 
                    FROM Anh 
                    WHERE Anh.ID_BB = BaiBao.ID_BB AND Anh.ViTriTrongBai = 1
                ) AS AnhBia
            FROM 
                BaiBao
            WHERE 
                TrangThai = 2 AND ID_TL = @id_tl
            ORDER BY 
                BaiBao.NgayDang DESC
            OFFSET @offset ROWS 
            FETCH NEXT @limit ROWS ONLY;
        `;

        const result = await pool.request()
            .input('id_tl', sql.Int, idTl)
            .input('offset', sql.Int, offset)
            .input('limit', sql.Int, limit)
            .query(query);

        // Trả về mảng các bài báo
        res.status(200).json(result.recordset);

    } catch (error) {
        console.error('Lỗi khi lấy danh sách bài báo theo thể loại:', error);
        res.status(500).json({ message: 'Lỗi server khi tải danh sách bài báo!' });
    }
});

module.exports = router;