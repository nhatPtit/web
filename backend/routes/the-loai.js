const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { connectDB } = require('../db');

// Route API: GET /api/theloai?id_tl=...&offset=...
// Route API: GET /api/the-loai/danh-sach -> Lấy toàn bộ danh mục từ bảng categories
router.get('/danh-sach', async (req, res) => {
    try {
        const pool = await connectDB();
        const result = await pool.request().query(`
            SELECT id, name, description 
            FROM dbo.categories 
            ORDER BY id ASC;
        `);
        res.status(200).json({
            success: true,
            data: result.recordset
        });
    } catch (error) {
        console.error('Lỗi khi lấy danh sách thể loại:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi tải danh mục thể loại!' });
    }
});

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
                b.Id AS ID_BB, 
                b.Id,
                b.title AS TieuDe, 
                b.sapo AS TomTat, 
                b.published_at AS NgayDang,
                (
                    SELECT TOP 1 a.image_url 
                    FROM dbo.AnhBaiViet a 
                    WHERE a.id_BB = b.Id AND a.display_order = 1
                ) AS AnhBia
            FROM 
                dbo.BaiViet b
            WHERE 
                b.status = 'published' AND b.category_id = @id_tl
            ORDER BY 
                b.published_at DESC
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