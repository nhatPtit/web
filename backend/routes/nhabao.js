const express = require('express');
const router = express.Router();
const sql = require('mssql');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { connectDB } = require('../db');

// Cấu hình thư mục lưu ảnh bài báo
const uploadDir = path.join(__dirname, '../../ReadPage/Anh-BB');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.webp';
        const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e6);
        cb(null, `${baseName}-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // Tối đa 10MB
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Chỉ chấp nhận tệp hình ảnh.'));
        }
        cb(null, true);
    }
});

// 1. API tải ảnh lên cho nhà báo: POST /api/nhabao/upload
router.post('/upload', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Vui lòng chọn tệp ảnh để tải lên.' });
        }

        const relativeUrl = `/Anh-BB/${req.file.filename}`;
        return res.status(200).json({
            success: true,
            url: relativeUrl,
            name: req.file.filename,
            message: 'Tải ảnh lên thành công!'
        });
    } catch (err) {
        console.error('Lỗi khi tải ảnh nhà báo:', err);
        return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tải ảnh lên.' });
    }
});

// 2. API lấy danh mục bài viết: GET /api/nhabao/categories
router.get('/categories', async (req, res) => {
    try {
        const pool = await connectDB();
        const result = await pool.request().query('SELECT id, name, description FROM dbo.categories ORDER BY id ASC');
        return res.status(200).json({ success: true, categories: result.recordset });
    } catch (err) {
        console.error('Lỗi lấy danh mục:', err);
        return res.status(500).json({ success: false, message: 'Lỗi tải danh mục từ CSDL.' });
    }
});

// 2b. API kiểm tra trạng thái tài khoản nhà báo từ CSDL: GET /api/nhabao/user-status?author_id=...
router.get('/user-status', async (req, res) => {
    try {
        const authorId = parseInt(req.query.author_id, 10);
        if (!authorId || isNaN(authorId)) {
            return res.status(400).json({ success: false, message: 'Thiếu author_id hợp lệ.' });
        }
        const pool = await connectDB();
        const userRes = await pool.request()
            .input('id', sql.Int, authorId)
            .query('SELECT TOP 1 id, username, full_name, ButDanh, TrangThai, VaiTro FROM dbo.users WHERE id = @id;');
        
        if (!userRes.recordset || userRes.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản.' });
        }
        const u = userRes.recordset[0];
        return res.status(200).json({
            success: true,
            user: {
                id: u.id,
                username: u.username,
                fullName: u.full_name,
                penName: u.ButDanh || u.full_name,
                TrangThai: u.TrangThai || 'HoatDong',
                VaiTro: u.VaiTro
            }
        });
    } catch (err) {
        console.error('Lỗi lấy trạng thái nhà báo:', err);
        return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi kiểm tra trạng thái.' });
    }
});

// Helper chuyển status DB sang code số cho FE
function mapStatusToCode(status) {
    if (!status) return 0;
    const s = String(status).toLowerCase();
    if (s === 'draft' || s === 'nhap') return 0; // Nháp
    if (s === 'pending' || s === 'choduyet') return 1; // Chờ duyệt
    if (s === 'published' || s === 'daduyet') return 2; // Đã duyệt
    if (s === 'rejected' || s === 'bitralai') return 3; // Bị trả lại
    return 0;
}

function mapCodeToStatus(code) {
    if (code === 1 || code === 'pending') return 'pending';
    if (code === 2 || code === 'published') return 'published';
    if (code === 3 || code === 'rejected') return 'rejected';
    return 'draft';
}

function formatDateVN(date) {
    if (!date) return new Date().toLocaleDateString('vi-VN');
    const d = new Date(date);
    return isNaN(d.getTime()) ? new Date().toLocaleDateString('vi-VN') : d.toLocaleDateString('vi-VN');
}

// 3. API lấy danh sách bài viết CỦA CHÍNH NHÀ BÁO ĐÓ: GET /api/nhabao/articles?author_id=...
router.get('/articles', async (req, res) => {
    try {
        const authorId = parseInt(req.query.author_id, 10);
        if (!authorId || isNaN(authorId)) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu hoặc sai mã tác giả (author_id).'
            });
        }

        const pool = await connectDB();

        // Chỉ lấy bài báo của chính tác giả này
        const result = await pool.request()
            .input('author_id', sql.Int, authorId)
            .query(`
                SELECT 
                    b.Id,
                    b.title,
                    b.sapo,
                    b.Content,
                    b.category_id,
                    c.name AS category_name,
                    b.author_id,
                    b.editor_id,
                    b.status,
                    b.editor_note,
                    b.published_at,
                    b.views_count
                FROM dbo.BaiViet b
                LEFT JOIN dbo.categories c ON b.category_id = c.id
                WHERE b.author_id = @author_id
                ORDER BY b.Id DESC;

                SELECT 
                    a.Id,
                    a.id_BB,
                    a.image_url,
                    a.caption,
                    a.display_order
                FROM dbo.AnhBaiViet a
                INNER JOIN dbo.BaiViet b ON a.id_BB = b.Id
                WHERE b.author_id = @author_id
                ORDER BY a.id_BB ASC, a.display_order ASC;
            `);

        const articles = result.recordsets[0] || [];
        const allImages = result.recordsets[1] || [];

        const imageMap = {};
        allImages.forEach(img => {
            if (!imageMap[img.id_BB]) imageMap[img.id_BB] = [];
            imageMap[img.id_BB].push({
                url: img.image_url,
                cap: img.caption || '',
                name: path.basename(img.image_url || ''),
                order: img.display_order
            });
        });

        const formattedArticles = articles.map(b => ({
            id: b.Id,
            t: b.title,
            sum: b.sapo,
            body: b.Content,
            c: b.category_name || 'Thời sự',
            category_id: b.category_id,
            s: mapStatusToCode(b.status),
            statusText: b.status,
            why: b.editor_note || '',
            d: formatDateVN(b.published_at),
            views: b.views_count || 0,
            imgs: imageMap[b.Id] || []
        }));

        return res.status(200).json({
            success: true,
            articles: formattedArticles
        });
    } catch (err) {
        console.error('Lỗi khi lấy danh sách bài báo của nhà báo:', err);
        return res.status(500).json({ success: false, message: 'Lỗi truy vấn CSDL bài viết.' });
    }
});

// 4. API lấy chi tiết 1 bài báo kèm KIỂM TRA QUYỀN SỞ HỮU: GET /api/nhabao/articles/:id?author_id=...
router.get('/articles/:id', async (req, res) => {
    try {
        const articleId = parseInt(req.params.id, 10);
        const authorId = parseInt(req.query.author_id, 10);

        if (!articleId || isNaN(articleId)) {
            return res.status(400).json({ success: false, message: 'Mã bài báo không hợp lệ.' });
        }
        if (!authorId || isNaN(authorId)) {
            return res.status(400).json({ success: false, message: 'Thiếu mã tác giả xác thực (author_id).' });
        }

        const pool = await connectDB();

        // 1. Kiểm tra bài viết tồn tại
        const articleRes = await pool.request()
            .input('id', sql.Int, articleId)
            .query(`
                SELECT 
                    b.Id,
                    b.title,
                    b.sapo,
                    b.Content,
                    b.category_id,
                    c.name AS category_name,
                    b.author_id,
                    b.editor_id,
                    b.status,
                    b.editor_note,
                    b.published_at,
                    b.views_count
                FROM dbo.BaiViet b
                LEFT JOIN dbo.categories c ON b.category_id = c.id
                WHERE b.Id = @id;
            `);

        if (articleRes.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                message: `Không tìm thấy bài báo mang ID ${articleId}.`
            });
        }

        const b = articleRes.recordset[0];

        // 2. KIỂM TRA BẢN QUYỀN: BÀI NÀY CÓ PHẢI CỦA NHÀ BÁO ĐANG ĐĂNG NHẬP KHÔNG?
        if (b.author_id !== authorId) {
            return res.status(403).json({
                success: false,
                isNotOwner: true,
                message: `Bạn không có quyền chỉnh sửa bài báo này vì bài báo này không phải do bạn viết (thuộc tác giả khác).`
            });
        }

        // Lấy danh sách ảnh của bài
        const imgRes = await pool.request()
            .input('id_bb', sql.Int, articleId)
            .query(`
                SELECT image_url, caption, display_order 
                FROM dbo.AnhBaiViet 
                WHERE id_BB = @id_bb 
                ORDER BY display_order ASC;
            `);

        const imgs = imgRes.recordset.map(img => ({
            url: img.image_url,
            cap: img.caption || '',
            name: path.basename(img.image_url || ''),
            order: img.display_order
        }));

        return res.status(200).json({
            success: true,
            article: {
                id: b.Id,
                t: b.title,
                sum: b.sapo,
                body: b.Content,
                c: b.category_name || 'Thời sự',
                category_id: b.category_id,
                s: mapStatusToCode(b.status),
                statusText: b.status,
                why: b.editor_note || '',
                d: formatDateVN(b.published_at),
                views: b.views_count || 0,
                imgs: imgs
            }
        });
    } catch (err) {
        console.error('Lỗi khi tải chi tiết bài báo:', err);
        return res.status(500).json({ success: false, message: 'Lỗi server khi tải bài viết.' });
    }
});

// 5. API tạo bài báo mới: POST /api/nhabao/articles
router.post('/articles', async (req, res) => {
    try {
        const { author_id, title, sapo, Content, category_name, category_id, status, imgs } = req.body;

        const authorId = parseInt(author_id, 10);
        if (!authorId || isNaN(authorId)) {
            return res.status(400).json({ success: false, message: 'Thiếu thông tin tác giả bài viết.' });
        }
        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, message: 'Tiêu đề bài viết không được để trống.' });
        }

        const pool = await connectDB();

        // Xác định category_id
        let catId = parseInt(category_id, 10);
        if (!catId || isNaN(catId)) {
            if (category_name) {
                const catRes = await pool.request()
                    .input('cname', sql.NVarChar, category_name.trim())
                    .query('SELECT TOP 1 id FROM dbo.categories WHERE name = @cname');
                if (catRes.recordset.length > 0) {
                    catId = catRes.recordset[0].id;
                }
            }
        }
        if (!catId) catId = 1; // Mặc định 'Thời sự'

        const dbStatus = mapCodeToStatus(status);

        // Lưu bài báo
        const insertRes = await pool.request()
            .input('title', sql.NVarChar, title.trim())
            .input('sapo', sql.NVarChar, sapo ? sapo.trim() : '')
            .input('Content', sql.NVarChar, Content || '')
            .input('category_id', sql.Int, catId)
            .input('author_id', sql.Int, authorId)
            .input('status', sql.VarChar, dbStatus)
            .query(`
                INSERT INTO dbo.BaiViet (title, sapo, Content, category_id, author_id, status, published_at, views_count)
                VALUES (@title, @sapo, @Content, @category_id, @author_id, @status, NULL, 0);
                SELECT SCOPE_IDENTITY() AS Id;
            `);

        const newId = insertRes.recordset[0].Id;

        // Lưu danh sách ảnh nếu có
        if (Array.isArray(imgs) && imgs.length > 0) {
            for (let i = 0; i < imgs.length; i++) {
                const img = imgs[i];
                if (img && img.url) {
                    await pool.request()
                        .input('id_bb', sql.Int, newId)
                        .input('image_url', sql.NVarChar, img.url)
                        .input('caption', sql.NVarChar, img.cap || '')
                        .input('display_order', sql.Int, i + 1)
                        .query(`
                            INSERT INTO dbo.AnhBaiViet (id_BB, image_url, caption, display_order)
                            VALUES (@id_bb, @image_url, @caption, @display_order);
                        `);
                }
            }
        }

        return res.status(201).json({
            success: true,
            id: newId,
            message: dbStatus === 'draft' ? `Đã lưu bản nháp thành công (ID ${newId}).` : `Đã gửi bài báo (ID ${newId}) chờ duyệt thành công!`
        });

    } catch (err) {
        console.error('Lỗi khi tạo bài báo mới:', err);
        return res.status(500).json({ success: false, message: 'Lỗi CSDL khi lưu bài báo mới: ' + err.message });
    }
});

// 6. API cập nhật bài báo: PUT /api/nhabao/articles/:id
router.put('/articles/:id', async (req, res) => {
    try {
        const articleId = parseInt(req.params.id, 10);
        const { author_id, title, sapo, Content, category_name, category_id, status, imgs } = req.body;

        const authorId = parseInt(author_id, 10);
        if (!articleId || isNaN(articleId)) {
            return res.status(400).json({ success: false, message: 'Mã bài báo không hợp lệ.' });
        }
        if (!authorId || isNaN(authorId)) {
            return res.status(400).json({ success: false, message: 'Thiếu thông tin tác giả để xác thực quyền sửa.' });
        }
        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, message: 'Tiêu đề không được để trống.' });
        }

        const pool = await connectDB();

        // 1. Kiểm tra bài viết tồn tại và KIỂM TRA QUYỀN SỞ HỮU
        const checkRes = await pool.request()
            .input('id', sql.Int, articleId)
            .query('SELECT author_id, status FROM dbo.BaiViet WHERE Id = @id');

        if (checkRes.recordset.length === 0) {
            return res.status(404).json({ success: false, message: `Không tìm thấy bài báo mang ID ${articleId}.` });
        }

        const existing = checkRes.recordset[0];
        if (existing.author_id !== authorId) {
            return res.status(403).json({
                success: false,
                isNotOwner: true,
                message: `Lỗi phân quyền: Bạn không có quyền sửa bài báo ID ${articleId} vì bài báo này không thuộc quyền tác giả của bạn!`
            });
        }

        // Xác định category_id
        let catId = parseInt(category_id, 10);
        if (!catId || isNaN(catId)) {
            if (category_name) {
                const catRes = await pool.request()
                    .input('cname', sql.NVarChar, category_name.trim())
                    .query('SELECT TOP 1 id FROM dbo.categories WHERE name = @cname');
                if (catRes.recordset.length > 0) {
                    catId = catRes.recordset[0].id;
                }
            }
        }
        if (!catId) catId = 1;

        const dbStatus = mapCodeToStatus(status);

        // Cập nhật bảng BaiViet
        await pool.request()
            .input('id', sql.Int, articleId)
            .input('title', sql.NVarChar, title.trim())
            .input('sapo', sql.NVarChar, sapo ? sapo.trim() : '')
            .input('Content', sql.NVarChar, Content || '')
            .input('category_id', sql.Int, catId)
            .input('status', sql.VarChar, dbStatus)
            .query(`
                UPDATE dbo.BaiViet
                SET title = @title,
                    sapo = @sapo,
                    Content = @Content,
                    category_id = @category_id,
                    status = @status,
                    editor_note = NULL
                WHERE Id = @id;
            `);

        // Xóa ảnh cũ và ghi đè danh sách ảnh mới
        await pool.request()
            .input('id_bb', sql.Int, articleId)
            .query('DELETE FROM dbo.AnhBaiViet WHERE id_BB = @id_bb');

        if (Array.isArray(imgs) && imgs.length > 0) {
            for (let i = 0; i < imgs.length; i++) {
                const img = imgs[i];
                if (img && img.url) {
                    await pool.request()
                        .input('id_bb', sql.Int, articleId)
                        .input('image_url', sql.NVarChar, img.url)
                        .input('caption', sql.NVarChar, img.cap || '')
                        .input('display_order', sql.Int, i + 1)
                        .query(`
                            INSERT INTO dbo.AnhBaiViet (id_BB, image_url, caption, display_order)
                            VALUES (@id_bb, @image_url, @caption, @display_order);
                        `);
                }
            }
        }

        return res.status(200).json({
            success: true,
            id: articleId,
            message: dbStatus === 'draft' ? `Đã lưu cập nhật bản nháp (ID ${articleId}) thành công.` : `Đã lưu và gửi bài (ID ${articleId}) chờ duyệt lại thành công!`
        });

    } catch (err) {
        console.error('Lỗi khi cập nhật bài báo:', err);
        return res.status(500).json({ success: false, message: 'Lỗi CSDL khi cập nhật bài báo: ' + err.message });
    }
});

module.exports = router;
