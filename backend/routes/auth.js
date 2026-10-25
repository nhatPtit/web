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
                        SELECT id, username, password, email, phone, full_name, VaiTro, ButDanh, TrangThai, company_name, chucdanh
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
        // Tài khoản dự phòng trường hợp database chưa khởi động hoặc offline
        if (!user) {
            const fallbackUsers = {
                'duyet_b': {
                    id: 3,
                    username: 'duyet_b',
                    password: '123456',
                    email: 'kiemduyet@webbao.com',
                    phone: '0912345678',
                    full_name: 'Trần Thị B',
                    VaiTro: 'BT',
                    ButDanh: null,
                    TrangThai: 'HoatDong'
                },
                'adNhat': {
                    id: 11,
                    username: 'adNhat',
                    password: '123456',
                    email: 'adnhat@gmail.com',
                    phone: '0911108627',
                    full_name: 'Nguyễn Duy Nhất',
                    VaiTro: 'BT',
                    ButDanh: null,
                    TrangThai: 'HoatDong'
                },
                'phongvien_c': {
                    id: 2,
                    username: 'phongvien_c',
                    password: '123456',
                    email: 'nhabao@webbao.com',
                    phone: '0988123456',
                    full_name: 'Lê Văn C',
                    VaiTro: 'NB',
                    ButDanh: 'Minh Anh',
                    TrangThai: 'HoatDong'
                },
                'admin_a': {
                    id: 1,
                    username: 'admin_a',
                    password: '123456',
                    email: 'admin@ptitnews.vn',
                    phone: '0988000001',
                    full_name: 'Nguyễn Văn A',
                    VaiTro: 'AD',
                    ButDanh: null,
                    TrangThai: 'HoatDong'
                },
                'kiemduyet123': {
                    id: 3,
                    username: 'kiemduyet123',
                    password: '123456',
                    email: 'kiemduyet@webbao.com',
                    phone: '0977123456',
                    full_name: 'Trần Thị B',
                    VaiTro: 'BT',
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

        if (user.TrangThai === 'Cam') {
            return res.status(403).json({
                success: false,
                message: 'Tài khoản của bạn đã bị CẤM hoạt động trên hệ thống. Vui lòng liên hệ Quản trị viên để được hỗ trợ!'
            });
        }

        // Quyết định trang chuyển hướng chuẩn xác dựa trên vai trò trong CSDL
        const cleanRole = (user.VaiTro || '').trim().toUpperCase();
        let redirectUrl = 'nha_bao.html';
        let roleName = 'Nhà báo';

        if (cleanRole === 'BT' || cleanRole === 'KD' || cleanRole === 'KIEMDUYET') {
            redirectUrl = 'Nguoi_kiem_duyet.html';
            roleName = 'Kiểm duyệt viên';
        } else if (cleanRole === 'AD') {
            redirectUrl = 'admin.html';
            roleName = 'Quản trị viên hệ thống';
        } else if (cleanRole === 'DN') {
            redirectUrl = 'http://localhost:3000/portal-doanhnghiep.html';
            roleName = 'Doanh nghiệp quảng cáo';
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
                company_name: user.company_name || 'Doanh nghiệp',
                chucdanh: user.chucdanh || 'Đại diện',
                email: user.email,
                phone: user.phone,
                TrangThai: user.TrangThai || 'HoatDong',
                status: user.TrangThai || 'HoatDong'
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

// GET /api/auth/demo-accounts (hỗ trợ lấy thông tin tài khoản mẫu đã đăng ký trong CSDL)
router.get('/demo-accounts', (req, res) => {
    res.json({
        nhabao: {
            username: 'phongvien_c',
            password: '123456',
            roleName: 'Nhà báo (Lê Văn C)'
        },
        kiemduyet: {
            username: 'duyet_b',
            password: '123456',
            roleName: 'Kiểm duyệt viên (Trần Thị B)'
        },
        kiemduyet2: {
            username: 'adNhat',
            password: '123456',
            roleName: 'Kiểm duyệt viên (Nguyễn Duy Nhất)'
        },
        admin: {
            username: 'admin_a',
            password: '123456',
            roleName: 'Quản trị viên (Nguyễn Văn A)'
        }
    });
});

module.exports = router;
