const express = require('express');
const router = express.Router();
const sql = require('mssql');
const crypto = require('crypto');
const { connectDB } = require('../db');

function hashSHA256(str) {
    return crypto.createHash('sha256').update(str).digest('hex');
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập đầy đủ tên tài khoản và mật khẩu.'
            });
        }

        let pool = null;
        try {
            pool = await connectDB();
        } catch (dbErr) {
            console.warn('Không thể kết nối SQL Server, kiểm tra tài khoản dự phòng:', dbErr.message);
        }

        let user = null;
        if (pool) {
            try {
                const result = await pool.request()
                    .input('username', sql.VarChar, username.trim())
                    .query(`
                        SELECT id, username, password, email, phone, full_name, VaiTro, ButDanh, TrangThai
                        FROM dbo.users
                        WHERE username = @username
                    `);

                if (result.recordset.length > 0) {
                    user = result.recordset[0];
                }
            } catch (queryErr) {
                console.warn('Lỗi truy vấn SQL:', queryErr.message);
            }
        }

        // Tài khoản dự phòng trường hợp database chưa khởi động hoặc offline
        if (!user) {
            const fallbackUsers = {
                'nhabao123': {
                    id: 6,
                    username: 'nhabao123',
                    password: '123456',
                    email: 'nhabao123@ptitnews.vn',
                    phone: '0988123456',
                    full_name: 'Nhà báo',
                    VaiTro: 'NB',
                    ButDanh: 'Minh Anh',
                    TrangThai: 'HoatDong'
                },
                'kiemduyet123': {
                    id: 7,
                    username: 'kiemduyet123',
                    password: '123456',
                    email: 'kiemduyet123@ptitnews.vn',
                    phone: '0977123456',
                    full_name: 'Người kiểm duyệt',
                    VaiTro: 'BT',
                    ButDanh: null,
                    TrangThai: 'HoatDong'
                },
                'admin_a': {
                    id: 1,
                    username: 'admin_a',
                    password: '123456',
                    email: 'admin@ptitnews.vn',
                    phone: '0988000001',
                    full_name: 'Quản trị viên Hệ thống',
                    VaiTro: 'AD',
                    ButDanh: null,
                    TrangThai: 'HoatDong'
                }
            };
            user = fallbackUsers[username.trim()];
        }

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Tên tài khoản không tồn tại trên hệ thống.'
            });
        }

        const isPasswordMatch = (user.password === password) || (user.password === hashSHA256(password));
        if (!isPasswordMatch) {
            return res.status(401).json({
                success: false,
                message: 'Mật khẩu không chính xác.'
            });
        }

        if (user.TrangThai && user.TrangThai !== 'HoatDong') {
            return res.status(403).json({
                success: false,
                message: 'Tài khoản của bạn đang bị khóa hoặc ngừng hoạt động.'
            });
        }

        // Quyết định trang chuyển hướng dựa trên vai trò
        let redirectUrl = 'nha_bao.html';
        let roleName = 'Nhà báo';

        if (user.VaiTro === 'BT' || user.VaiTro === 'KD') {
            redirectUrl = 'Nguoi_kiem_duyet.html';
            roleName = 'Người kiểm duyệt';
        } else if (user.VaiTro === 'AD') {
            redirectUrl = 'admin.html';
            roleName = 'Quản trị viên hệ thống';
        }

        return res.status(200).json({
            success: true,
            message: 'Đăng nhập thành công!',
            user: {
                id: user.id,
                username: user.username,
                fullName: user.full_name,
                full_name: user.full_name,
                role: user.VaiTro,
                VaiTro: user.VaiTro,
                roleName: roleName,
                penName: user.ButDanh || user.full_name,
                email: user.email,
                phone: user.phone
            },
            redirectUrl: redirectUrl
        });

    } catch (error) {
        console.error('Lỗi đăng nhập:', error);
        return res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi máy chủ trong quá trình xác thực.'
        });
    }
});

// GET /api/auth/demo-accounts (hỗ trợ lấy thông tin tài khoản mẫu)
router.get('/demo-accounts', (req, res) => {
    res.json({
        nhabao: {
            username: 'nhabao123',
            password: '123456',
            roleName: 'Nhà báo'
        },
        kiemduyet: {
            username: 'kiemduyet123',
            password: '123456',
            roleName: 'Người kiểm duyệt'
        },
        admin: {
            username: 'admin_a',
            password: '123456',
            roleName: 'Quản trị viên'
        }
    });
});

module.exports = router;
