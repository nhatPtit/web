const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sql = require('mssql');
const { connectDB } = require('../db');

// Thư mục lưu trữ các file backup .bak
const BACKUP_DIR = path.resolve(__dirname, '../backups');
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Cấu hình kết nối vào database master (dành riêng cho tác vụ Restore an toàn)
function getMasterConfig() {
    return {
        server: process.env.DB_SERVER || 'localhost',
        port: parseInt(process.env.DB_PORT, 10) || 1433,
        database: 'master',
        user: process.env.DB_USER || 'sa',
        password: process.env.DB_PASSWORD,
        options: {
            encrypt: false,
            trustServerCertificate: true
        }
    };
}

// Hàm định dạng kích thước bytes thành KB / MB
function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * GET /api/admin/backup/list
 * Lấy danh sách các bản sao lưu .bak hiện có trong thư mục
 */
router.get('/list', (req, res) => {
    try {
        if (!fs.existsSync(BACKUP_DIR)) {
            return res.status(200).json({ success: true, data: [] });
        }

        const files = fs.readdirSync(BACKUP_DIR);
        const backupFiles = files
            .filter(file => file.toLowerCase().endsWith('.bak'))
            .map(file => {
                const fullPath = path.join(BACKUP_DIR, file);
                const stats = fs.statSync(fullPath);
                return {
                    filename: file,
                    size_bytes: stats.size,
                    size_formatted: formatFileSize(stats.size),
                    created_at: stats.mtime
                };
            })
            // Sắp xếp bản mới nhất lên đầu
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        return res.status(200).json({
            success: true,
            message: 'Tải danh sách bản sao lưu thành công!',
            data: backupFiles
        });

    } catch (error) {
        console.error('Lỗi khi lấy danh sách backup:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi máy chủ khi đọc danh sách bản sao lưu!'
        });
    }
});

/**
 * POST /api/admin/backup/create
 * Thực thi lệnh sao lưu database WebBao ra file .bak
 */
router.post('/create', async (req, res) => {
    try {
        const pool = await connectDB();
        if (!pool) {
            return res.status(500).json({
                success: false,
                message: 'Không thể kết nối cơ sở dữ liệu!'
            });
        }

        const dbName = process.env.DB_NAME || 'WebBao';

        // Tạo tên file backup với mốc thời gian chi tiết
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        const filename = `${dbName}_backup_${timestamp}.bak`;
        const diskPath = path.join(BACKUP_DIR, filename).replace(/\\/g, '/');

        const backupQuery = `
            BACKUP DATABASE [${dbName}]
            TO DISK = N'${diskPath}'
            WITH FORMAT, INIT, NAME = N'${dbName} Full Backup ${timestamp}', STATS = 10;
        `;

        await pool.request().query(backupQuery);

        if (!fs.existsSync(diskPath)) {
            return res.status(500).json({
                success: false,
                message: 'Lệnh sao lưu đã chạy nhưng không tìm thấy file xuất ra!'
            });
        }

        const stats = fs.statSync(diskPath);

        return res.status(201).json({
            success: true,
            message: `Tạo bản sao lưu thành công: ${filename}`,
            data: {
                filename,
                size_bytes: stats.size,
                size_formatted: formatFileSize(stats.size),
                created_at: stats.mtime
            }
        });

    } catch (error) {
        console.error('Lỗi khi tạo bản sao lưu:', error);
        return res.status(500).json({
            success: false,
            message: `Lỗi máy chủ khi thực hiện sao lưu: ${error.message}`
        });
    }
});

/**
 * POST /api/admin/backup/restore
 * Khôi phục cơ sở dữ liệu từ file .bak (Yêu cầu xác thực mật khẩu Admin)
 */
router.post('/restore', async (req, res) => {
    try {
        const { filename, admin_password } = req.body || {};

        if (!filename) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng chọn bản sao lưu cần khôi phục!'
            });
        }

        if (!admin_password) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập mật khẩu Quản trị viên để xác thực thao tác khôi phục dữ liệu!'
            });
        }

        // 1. Kiểm tra an toàn tên file (chống path traversal)
        const safeFilename = path.basename(filename);
        if (!safeFilename.toLowerCase().endsWith('.bak')) {
            return res.status(400).json({
                success: false,
                message: 'Định dạng file sao lưu không hợp lệ (bắt buộc phải là file .bak)!'
            });
        }

        const diskPath = path.join(BACKUP_DIR, safeFilename).replace(/\\/g, '/');
        if (!fs.existsSync(diskPath)) {
            return res.status(404).json({
                success: false,
                message: `Không tìm thấy file sao lưu "${safeFilename}" trên máy chủ!`
            });
        }

        // 2. Xác thực mật khẩu Admin
        const pool = await connectDB();
        if (!pool) {
            return res.status(500).json({
                success: false,
                message: 'Không thể kết nối cơ sở dữ liệu để xác thực quyền quản trị!'
            });
        }

        const hashedPassword = crypto.createHash('sha256').update(admin_password).digest('hex');

        const adminCheckRes = await pool.request()
            .input('pwd', sql.NVarChar(255), admin_password)
            .input('hPwd', sql.NVarChar(255), hashedPassword)
            .query(`
                SELECT TOP 1 id, username, full_name, VaiTro
                FROM dbo.users
                WHERE VaiTro = 'AD' AND TrangThai = 'HoatDong'
                  AND (password = @pwd OR password = @hPwd);
            `);

        if (adminCheckRes.recordset.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Mật khẩu xác nhận Quản trị viên không chính xác! Thao tác khôi phục bị từ chối vì lý do an toàn.'
            });
        }

        const adminUser = adminCheckRes.recordset[0];
        console.log(`[RESTORE] Quản trị viên "${adminUser.username}" đã xác thực để khôi phục từ file: ${safeFilename}`);

        // 3. Thực thi khôi phục Database qua kết nối master
        const dbName = process.env.DB_NAME || 'WebBao';
        const masterPool = await sql.connect(getMasterConfig());

        const restoreQuery = `
            USE master;
            ALTER DATABASE [${dbName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
            RESTORE DATABASE [${dbName}] FROM DISK = N'${diskPath}' WITH REPLACE;
            ALTER DATABASE [${dbName}] SET MULTI_USER;
        `;

        await masterPool.request().query(restoreQuery);
        await masterPool.close();

        return res.status(200).json({
            success: true,
            message: `Khôi phục cơ sở dữ liệu thành công từ bản sao lưu "${safeFilename}"! Toàn bộ dữ liệu hệ thống đã được hoàn trả về trạng thái tại thời điểm sao lưu.`,
            restored_file: safeFilename
        });

    } catch (error) {
        console.error('Lỗi khi khôi phục cơ sở dữ liệu:', error);

        // Đảm bảo đưa database về lại MULTI_USER nếu có lỗi giữa chừng
        try {
            const dbName = process.env.DB_NAME || 'WebBao';
            const recoveryPool = await sql.connect(getMasterConfig());
            await recoveryPool.request().query(`ALTER DATABASE [${dbName}] SET MULTI_USER;`);
            await recoveryPool.close();
        } catch (ignore) {}

        return res.status(500).json({
            success: false,
            message: `Lỗi máy chủ khi khôi phục dữ liệu: ${error.message}`
        });
    }
});

/**
 * DELETE /api/admin/backup/:filename
 * Xóa một bản sao lưu .bak cũ để giải phóng dung lượng ổ đĩa
 */
router.delete('/:filename', (req, res) => {
    try {
        const { filename } = req.params;
        const safeFilename = path.basename(filename);

        if (!safeFilename.toLowerCase().endsWith('.bak')) {
            return res.status(400).json({
                success: false,
                message: 'Tên file không hợp lệ!'
            });
        }

        const fullPath = path.join(BACKUP_DIR, safeFilename);
        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy file bản sao lưu cần xóa!'
            });
        }

        fs.unlinkSync(fullPath);

        return res.status(200).json({
            success: true,
            message: `Đã xóa bản sao lưu "${safeFilename}" thành công!`
        });

    } catch (error) {
        console.error('Lỗi khi xóa file backup:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi máy chủ khi xóa file bản sao lưu!'
        });
    }
});

module.exports = router;
