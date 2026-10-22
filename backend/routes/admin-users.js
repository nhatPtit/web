const express = require('express');
const router = express.Router();
const sql = require('mssql');
const crypto = require('crypto');
const { connectDB } = require('../db');

/**
 * POST /api/admin/login
 * Xác thực đăng nhập tài khoản Quản trị viên (Admin - VaiTro = 'AD')
 */
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body || {};

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu!'
            });
        }

        const pool = await connectDB();
        if (!pool) {
            return res.status(500).json({
                success: false,
                message: 'Không thể kết nối cơ sở dữ liệu!'
            });
        }

        const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

        const result = await pool.request()
            .input('username', sql.VarChar(50), username.trim())
            .input('password', sql.NVarChar(255), password)
            .input('hashedPassword', sql.NVarChar(255), hashedPassword)
            .query(`
                SELECT TOP 1
                    id,
                    username,
                    email,
                    phone,
                    full_name,
                    VaiTro,
                    TrangThai,
                    ButDanh
                FROM dbo.users
                WHERE username = @username AND (password = @password OR password = @hashedPassword);
            `);

        const user = result.recordset[0];

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Tên đăng nhập hoặc mật khẩu không chính xác!'
            });
        }

        // Cho phép các tài khoản thuộc phân hệ Tác nghiệp & Quản lý (AD: Quản trị, BT: Biên tập/Kiểm duyệt, NB: Nhà báo)
        const allowedRoles = ['AD', 'BT', 'NB'];
        if (!allowedRoles.includes(user.VaiTro)) {
            return res.status(403).json({
                success: false,
                message: 'Quyền truy cập bị từ chối: Tài khoản của bạn không có quyền truy cập Cổng tác nghiệp tòa soạn!'
            });
        }

        if (user.TrangThai !== 'HoatDong') {
            return res.status(403).json({
                success: false,
                message: `Tài khoản đang ở trạng thái "${user.TrangThai}". Không thể đăng nhập! Vui lòng liên hệ Quản trị viên.`
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Đăng nhập thành công!',
            user: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                email: user.email,
                VaiTro: user.VaiTro,
                ButDanh: user.ButDanh || null
            }
        });

    } catch (error) {
        console.error('Lỗi API admin login:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi máy chủ khi xử lý đăng nhập!'
        });
    }
});

/**
 * GET /api/admin/users
 * Lấy danh sách tài khoản Nhà báo ('NB') và Doanh nghiệp ('DN')
 * Hỗ trợ tìm kiếm theo từ khóa, lọc theo vai trò và trạng thái
 */
router.get('/users', async (req, res) => {
    try {
        const keyword = req.query.q ? req.query.q.trim() : '';
        const role = req.query.role ? req.query.role.trim() : 'ALL';
        const status = req.query.status ? req.query.status.trim() : 'ALL';

        const pool = await connectDB();
        if (!pool) {
            return res.status(500).json({
                success: false,
                message: 'Không thể kết nối cơ sở dữ liệu!'
            });
        }

        const request = pool.request();
        request.input('keyword', sql.NVarChar(100), keyword);
        request.input('keywordLike', sql.NVarChar(102), `%${keyword}%`);
        request.input('role', sql.VarChar(10), role);
        request.input('status', sql.VarChar(20), status);

        const query = `
            SELECT 
                u.id,
                u.username,
                u.email,
                u.phone,
                u.full_name,
                u.VaiTro,
                u.ButDanh,
                u.TrangThai,
                u.company_name,
                u.contact_person,
                u.violation_count,
                u.created_at
            FROM dbo.users u
            WHERE u.VaiTro IN ('NB', 'BT', 'DN')
              AND (@role = 'ALL' OR u.VaiTro = @role)
              AND (@status = 'ALL' OR u.TrangThai = @status)
              AND (
                  @keyword = ''
                  OR u.username LIKE @keywordLike
                  OR u.full_name COLLATE SQL_Latin1_General_CP1_CI_AI LIKE @keywordLike
                  OR u.email LIKE @keywordLike
                  OR u.phone LIKE @keywordLike
                  OR u.ButDanh COLLATE SQL_Latin1_General_CP1_CI_AI LIKE @keywordLike
                  OR u.company_name COLLATE SQL_Latin1_General_CP1_CI_AI LIKE @keywordLike
                  OR u.contact_person COLLATE SQL_Latin1_General_CP1_CI_AI LIKE @keywordLike
              )
            ORDER BY u.created_at DESC, u.id DESC;
        `;

        const result = await request.query(query);

        return res.status(200).json({
            success: true,
            total: result.recordset.length,
            data: result.recordset
        });

    } catch (error) {
        console.error('Lỗi API lấy danh sách tài khoản:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi máy chủ khi truy vấn danh sách tài khoản!'
        });
    }
});

/**
 * POST /api/admin/users
 * Tạo tài khoản mới cho Nhà báo ('NB'), Người kiểm duyệt ('BT') hoặc Doanh nghiệp ('DN')
 */
router.post('/users', async (req, res) => {
    try {
        const {
            username,
            password,
            full_name,
            email,
            phone,
            role,
            but_danh,
            company_name,
            contact_person
        } = req.body || {};

        // 1. Kiểm tra các trường chung bắt buộc
        if (!username || !username.trim()) {
            return res.status(400).json({ success: false, message: 'Tên đăng nhập không được để trống!' });
        }
        if (!password || password.length < 6) {
            return res.status(400).json({ success: false, message: 'Mật khẩu phải có độ dài tối thiểu 6 ký tự!' });
        }
        if (!full_name || !full_name.trim()) {
            return res.status(400).json({ success: false, message: 'Họ và tên không được để trống!' });
        }
        if (!email || !email.trim()) {
            return res.status(400).json({ success: false, message: 'Email không được để trống!' });
        }
        if (!phone || !phone.trim()) {
            return res.status(400).json({ success: false, message: 'Số điện thoại không được để trống!' });
        }
        if (!role || !role.trim()) {
            return res.status(400).json({ success: false, message: 'Vui lòng chọn vai trò cho tài khoản!' });
        }

        const cleanUsername = username.trim();
        const cleanFullName = full_name.trim();
        const cleanEmail = email.trim().toLowerCase();
        const cleanPhone = phone.trim();
        const cleanRole = role.trim().toUpperCase();

        // 2. Kiểm tra định dạng dữ liệu
        const usernameRegex = /^[a-zA-Z0-9_]{3,50}$/;
        if (!usernameRegex.test(cleanUsername)) {
            return res.status(400).json({
                success: false,
                message: 'Tên đăng nhập chỉ được chứa chữ cái, số, dấu gạch dưới và có độ dài từ 3 đến 50 ký tự!'
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(cleanEmail)) {
            return res.status(400).json({
                success: false,
                message: 'Địa chỉ email không đúng định dạng!'
            });
        }

        const phoneRegex = /^[0-9+()\-.\s]{9,20}$/;
        if (!phoneRegex.test(cleanPhone)) {
            return res.status(400).json({
                success: false,
                message: 'Số điện thoại không hợp lệ (tối thiểu 9 ký tự số)!'
            });
        }

        // 3. Kiểm tra vai trò hợp lệ (CHỈ cho phép 'NB', 'BT', 'DN' - TUYỆT ĐỐI CẤM 'AD')
        const allowedRoles = ['NB', 'BT', 'DN'];
        if (!allowedRoles.includes(cleanRole)) {
            return res.status(400).json({
                success: false,
                message: 'Vai trò không hợp lệ! Chỉ được phép tạo tài khoản Nhà báo (NB), Người kiểm duyệt (BT) hoặc Doanh nghiệp (DN).'
            });
        }

        // 4. Kiểm tra các ràng buộc trường riêng theo vai trò (CK_users_role_fields)
        let finalButDanh = null;
        let finalCompanyName = null;
        let finalContactPerson = null;

        if (cleanRole === 'NB') {
            if (!but_danh || !but_danh.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Tài khoản Nhà báo bắt buộc phải có Bút danh!'
                });
            }
            finalButDanh = but_danh.trim();
        } else if (cleanRole === 'DN') {
            if (!company_name || !company_name.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Tài khoản Doanh nghiệp bắt buộc phải có Tên công ty/doanh nghiệp!'
                });
            }
            if (!contact_person || !contact_person.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Tài khoản Doanh nghiệp bắt buộc phải có Tên người liên hệ!'
                });
            }
            finalCompanyName = company_name.trim();
            finalContactPerson = contact_person.trim();
        } else if (cleanRole === 'BT') {
            // Đối với BT: ButDanh, company_name, contact_person bắt buộc là NULL
            finalButDanh = null;
            finalCompanyName = null;
            finalContactPerson = null;
        }

        const pool = await connectDB();
        if (!pool) {
            return res.status(500).json({
                success: false,
                message: 'Không thể kết nối cơ sở dữ liệu!'
            });
        }

        // 5. Kiểm tra trùng lặp username hoặc email trong database
        const checkDuplicate = await pool.request()
            .input('username', sql.VarChar(50), cleanUsername)
            .input('email', sql.VarChar(100), cleanEmail)
            .query(`
                SELECT TOP 1
                    CASE 
                        WHEN username = @username THEN 'username'
                        WHEN email = @email THEN 'email'
                    END AS duplicate_field
                FROM dbo.users
                WHERE username = @username OR email = @email;
            `);

        if (checkDuplicate.recordset.length > 0) {
            const dupField = checkDuplicate.recordset[0].duplicate_field;
            if (dupField === 'username') {
                return res.status(409).json({
                    success: false,
                    message: `Tên đăng nhập "${cleanUsername}" đã tồn tại trên hệ thống. Vui lòng chọn tên khác!`
                });
            } else {
                return res.status(409).json({
                    success: false,
                    message: `Địa chỉ email "${cleanEmail}" đã được sử dụng bởi một tài khoản khác!`
                });
            }
        }

        // 6. Băm mật khẩu bằng crypto built-in (SHA-256) để không lưu plain-text
        const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

        // 7. Thực hiện INSERT có tham số hóa
        const insertResult = await pool.request()
            .input('username', sql.VarChar(50), cleanUsername)
            .input('password', sql.NVarChar(255), hashedPassword)
            .input('email', sql.VarChar(100), cleanEmail)
            .input('phone', sql.VarChar(20), cleanPhone)
            .input('full_name', sql.NVarChar(100), cleanFullName)
            .input('role', sql.VarChar(10), cleanRole)
            .input('butDanh', sql.NVarChar(100), finalButDanh)
            .input('companyName', sql.NVarChar(150), finalCompanyName)
            .input('contactPerson', sql.NVarChar(100), finalContactPerson)
            .query(`
                INSERT INTO dbo.users (
                    username,
                    password,
                    email,
                    phone,
                    full_name,
                    VaiTro,
                    ButDanh,
                    TrangThai,
                    company_name,
                    contact_person,
                    violation_count,
                    created_at
                )
                OUTPUT 
                    INSERTED.id,
                    INSERTED.username,
                    INSERTED.full_name,
                    INSERTED.email,
                    INSERTED.phone,
                    INSERTED.VaiTro,
                    INSERTED.ButDanh,
                    INSERTED.TrangThai,
                    INSERTED.company_name,
                    INSERTED.contact_person,
                    INSERTED.violation_count,
                    INSERTED.created_at
                VALUES (
                    @username,
                    @password,
                    @email,
                    @phone,
                    @full_name,
                    @role,
                    @butDanh,
                    'HoatDong',
                    @companyName,
                    @contactPerson,
                    0,
                    SYSDATETIME()
                );
            `);

        const newUser = insertResult.recordset[0];

        return res.status(201).json({
            success: true,
            message: 'Tạo tài khoản mới thành công!',
            data: newUser
        });

    } catch (error) {
        console.error('Lỗi khi tạo tài khoản mới:', error);

        // Bắt lỗi vi phạm ràng buộc SQL Server
        if (error.number === 2627 || error.number === 2601) {
            return res.status(409).json({
                success: false,
                message: 'Tên đăng nhập hoặc email đã tồn tại trong cơ sở dữ liệu!'
            });
        }
        if (error.number === 547) {
            return res.status(400).json({
                success: false,
                message: 'Dữ liệu không thỏa mãn ràng buộc toàn vẹn của hệ thống!'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Lỗi máy chủ khi tạo tài khoản!'
        });
    }
});

/**
 * PUT /api/admin/users/:id
 * Cập nhật thông tin tài khoản (Chỉnh sửa: Họ tên, email, SĐT, bút danh/công ty)
 * Bảo toàn username và VaiTro không bị thay đổi.
 */
router.put('/users/:id', async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        if (!userId || isNaN(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Mã định danh tài khoản không hợp lệ!'
            });
        }

        const pool = await connectDB();
        if (!pool) {
            return res.status(500).json({
                success: false,
                message: 'Không thể kết nối cơ sở dữ liệu!'
            });
        }

        // Lấy thông tin user hiện tại
        const existingRes = await pool.request()
            .input('id', sql.Int, userId)
            .query(`
                SELECT TOP 1 id, username, email, phone, full_name, VaiTro, ButDanh, TrangThai, company_name, contact_person
                FROM dbo.users
                WHERE id = @id;
            `);

        const currentUser = existingRes.recordset[0];
        if (!currentUser) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy tài khoản trong hệ thống!'
            });
        }

        const { full_name, email, phone, but_danh, company_name, contact_person } = req.body || {};

        // 1. Kiểm tra thông tin chung
        if (!full_name || !email || !phone) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng cung cấp đầy đủ họ tên, email và số điện thoại!'
            });
        }

        const trimmedFullName = full_name.trim();
        const trimmedEmail = email.trim();
        const trimmedPhone = phone.trim();

        if (trimmedFullName.length < 2 || trimmedFullName.length > 100) {
            return res.status(400).json({
                success: false,
                message: 'Họ và tên phải có độ dài từ 2 đến 100 ký tự!'
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedEmail)) {
            return res.status(400).json({
                success: false,
                message: 'Địa chỉ email không đúng định dạng!'
            });
        }

        const phoneRegex = /^[0-9+()\-.\s]{9,20}$/;
        if (!phoneRegex.test(trimmedPhone)) {
            return res.status(400).json({
                success: false,
                message: 'Số điện thoại không hợp lệ (từ 9 đến 20 ký tự)!'
            });
        }

        // Kiểm tra email không được trùng với tài khoản khác
        const dupEmailRes = await pool.request()
            .input('email', sql.VarChar(100), trimmedEmail)
            .input('id', sql.Int, userId)
            .query('SELECT TOP 1 id FROM dbo.users WHERE email = @email AND id != @id;');

        if (dupEmailRes.recordset.length > 0) {
            return res.status(409).json({
                success: false,
                message: `Địa chỉ email "${trimmedEmail}" đã được sử dụng bởi một tài khoản khác!`
            });
        }

        // 2. Validate theo vai trò hiện tại (VaiTro giữ nguyên không đổi)
        let finalButDanh = null;
        let finalCompanyName = null;
        let finalContactPerson = null;

        if (currentUser.VaiTro === 'NB') {
            if (!but_danh || !but_danh.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Tài khoản Nhà báo bắt buộc phải có Bút danh tác nghiệp!'
                });
            }
            finalButDanh = but_danh.trim();
        } else if (currentUser.VaiTro === 'DN') {
            if (!company_name || !company_name.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Tài khoản Doanh nghiệp bắt buộc phải có Tên công ty / Doanh nghiệp!'
                });
            }
            if (!contact_person || !contact_person.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Tài khoản Doanh nghiệp bắt buộc phải có Tên người đại diện liên hệ!'
                });
            }
            finalCompanyName = company_name.trim();
            finalContactPerson = contact_person.trim();
        }

        // 3. Thực thi UPDATE
        const updateRes = await pool.request()
            .input('id', sql.Int, userId)
            .input('full_name', sql.NVarChar(100), trimmedFullName)
            .input('email', sql.VarChar(100), trimmedEmail)
            .input('phone', sql.VarChar(20), trimmedPhone)
            .input('butDanh', sql.NVarChar(100), finalButDanh)
            .input('companyName', sql.NVarChar(150), finalCompanyName)
            .input('contactPerson', sql.NVarChar(100), finalContactPerson)
            .query(`
                UPDATE dbo.users
                SET
                    full_name = @full_name,
                    email = @email,
                    phone = @phone,
                    ButDanh = @butDanh,
                    company_name = @companyName,
                    contact_person = @contactPerson
                OUTPUT
                    INSERTED.id,
                    INSERTED.username,
                    INSERTED.full_name,
                    INSERTED.email,
                    INSERTED.phone,
                    INSERTED.VaiTro,
                    INSERTED.ButDanh,
                    INSERTED.TrangThai,
                    INSERTED.company_name,
                    INSERTED.contact_person,
                    INSERTED.violation_count,
                    INSERTED.created_at
                WHERE id = @id;
            `);

        const updatedUser = updateRes.recordset[0];

        return res.status(200).json({
            success: true,
            message: `Cập nhật thông tin tài khoản "${currentUser.username}" thành công!`,
            data: updatedUser
        });

    } catch (error) {
        console.error('Lỗi API cập nhật tài khoản:', error);
        if (error.number === 2627 || error.number === 2601) {
            return res.status(409).json({
                success: false,
                message: 'Email đã tồn tại trong hệ thống!'
            });
        }
        if (error.number === 547) {
            return res.status(400).json({
                success: false,
                message: 'Dữ liệu không thỏa mãn ràng buộc toàn vẹn của hệ thống!'
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Lỗi máy chủ khi cập nhật thông tin tài khoản!'
        });
    }
});

/**
 * PATCH /api/admin/users/:id/status
 * Khóa & Mở khóa tài khoản: Chuyển đổi trạng thái nhanh (HoatDong <-> HanChe <-> Cam)
 */
router.patch('/users/:id/status', async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        const { status } = req.body || {};

        if (!userId || isNaN(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Mã tài khoản không hợp lệ!'
            });
        }

        const validStatuses = ['HoatDong', 'HanChe', 'Cam'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Trạng thái không hợp lệ! Chỉ chấp nhận: ${validStatuses.join(', ')}.`
            });
        }

        const pool = await connectDB();
        if (!pool) {
            return res.status(500).json({
                success: false,
                message: 'Không thể kết nối cơ sở dữ liệu!'
            });
        }

        // Kiểm tra user tồn tại
        const checkUserRes = await pool.request()
            .input('id', sql.Int, userId)
            .query('SELECT TOP 1 id, username, full_name, VaiTro, TrangThai FROM dbo.users WHERE id = @id;');

        const targetUser = checkUserRes.recordset[0];
        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy tài khoản!'
            });
        }

        // Cập nhật trạng thái
        const updateRes = await pool.request()
            .input('id', sql.Int, userId)
            .input('status', sql.VarChar(20), status)
            .query(`
                UPDATE dbo.users
                SET TrangThai = @status
                OUTPUT
                    INSERTED.id,
                    INSERTED.username,
                    INSERTED.full_name,
                    INSERTED.VaiTro,
                    INSERTED.TrangThai
                WHERE id = @id;
            `);

        const updated = updateRes.recordset[0];
        const statusMap = {
            'HoatDong': 'Hoạt động',
            'HanChe': 'Hạn chế',
            'Cam': 'Bị cấm'
        };

        return res.status(200).json({
            success: true,
            message: `Đã đổi trạng thái tài khoản "${updated.username}" sang "${statusMap[status] || status}"!`,
            data: updated
        });

    } catch (error) {
        console.error('Lỗi API đổi trạng thái tài khoản:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi máy chủ khi cập nhật trạng thái tài khoản!'
        });
    }
});

/**
 * PATCH /api/admin/users/:id/violations
 * Theo dõi & Cập nhật số lần vi phạm của Doanh nghiệp
 * Tự động khóa / hạn chế nếu vi phạm vượt ngưỡng (>= 3 lần)
 */
router.patch('/users/:id/violations', async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        const { action, count, reason } = req.body || {};

        if (!userId || isNaN(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Mã tài khoản không hợp lệ!'
            });
        }

        const pool = await connectDB();
        if (!pool) {
            return res.status(500).json({
                success: false,
                message: 'Không thể kết nối cơ sở dữ liệu!'
            });
        }

        const userRes = await pool.request()
            .input('id', sql.Int, userId)
            .query('SELECT TOP 1 id, username, company_name, VaiTro, violation_count, TrangThai FROM dbo.users WHERE id = @id;');

        const user = userRes.recordset[0];
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy tài khoản!'
            });
        }

        if (user.VaiTro !== 'DN') {
            return res.status(400).json({
                success: false,
                message: 'Chức năng theo dõi vi phạm chỉ áp dụng cho tài khoản Doanh nghiệp (DN)!'
            });
        }

        let newCount = user.violation_count;
        if (action === 'increment') {
            newCount += 1;
        } else if (action === 'reset') {
            newCount = 0;
        } else if (action === 'set') {
            const parsedCount = parseInt(count, 10);
            if (isNaN(parsedCount) || parsedCount < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Số lần vi phạm phải là số nguyên không âm (>= 0)!'
                });
            }
            newCount = parsedCount;
        } else {
            return res.status(400).json({
                success: false,
                message: 'Hành động không hợp lệ (hỗ trợ: increment, reset, set)!'
            });
        }

        // Quy tắc tự động hạn chế/khóa khi vi phạm vượt ngưỡng (>= 3 lần)
        let autoRestricted = false;
        let newStatus = user.TrangThai;

        if (newCount >= 3 && user.TrangThai === 'HoatDong') {
            newStatus = 'HanChe';
            autoRestricted = true;
        } else if (newCount >= 5 && user.TrangThai !== 'Cam') {
            newStatus = 'Cam';
            autoRestricted = true;
        }

        const updateRes = await pool.request()
            .input('id', sql.Int, userId)
            .input('count', sql.Int, newCount)
            .input('status', sql.VarChar(20), newStatus)
            .query(`
                UPDATE dbo.users
                SET
                    violation_count = @count,
                    TrangThai = @status
                OUTPUT
                    INSERTED.id,
                    INSERTED.username,
                    INSERTED.company_name,
                    INSERTED.violation_count,
                    INSERTED.TrangThai
                WHERE id = @id;
            `);

        const updated = updateRes.recordset[0];
        let message = `Đã cập nhật số lần vi phạm của "${updated.company_name || updated.username}" thành ${newCount}.`;
        if (autoRestricted) {
            message += ` Do vi phạm từ 3 lần trở lên, hệ thống đã tự động chuyển tài khoản sang trạng thái [${newStatus === 'HanChe' ? 'Hạn chế' : 'Bị cấm'}]!`;
        }

        return res.status(200).json({
            success: true,
            message,
            autoRestricted,
            data: updated
        });

    } catch (error) {
        console.error('Lỗi API cập nhật vi phạm:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi máy chủ khi cập nhật vi phạm doanh nghiệp!'
        });
    }
});

/**
 * DELETE /api/admin/users/:id
 * Xóa tài khoản an toàn (Bảo toàn dữ liệu):
 * - Nếu tài khoản đã có dữ liệu liên kết (bài viết, quảng cáo, ghim): Chặn xóa cứng, tự động chuyển sang [Bị cấm]
 * - Chỉ cho phép xóa cứng khi tài khoản chưa phát sinh dữ liệu liên kết nào trong hệ thống.
 */
router.delete('/users/:id', async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        if (!userId || isNaN(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Mã tài khoản không hợp lệ!'
            });
        }

        const pool = await connectDB();
        if (!pool) {
            return res.status(500).json({
                success: false,
                message: 'Không thể kết nối cơ sở dữ liệu!'
            });
        }

        // Lấy thông tin user cần xóa
        const userRes = await pool.request()
            .input('id', sql.Int, userId)
            .query('SELECT TOP 1 id, username, full_name, VaiTro, TrangThai FROM dbo.users WHERE id = @id;');

        const user = userRes.recordset[0];
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy tài khoản cần xóa!'
            });
        }

        // Không cho phép tự xóa tài khoản Admin
        if (user.VaiTro === 'AD') {
            return res.status(403).json({
                success: false,
                message: 'Không được phép xóa tài khoản Quản trị viên hệ thống (Admin)!'
            });
        }

        // 1. Kiểm tra các dữ liệu liên kết trong hệ thống
        // - Số bài báo đã viết hoặc duyệt
        const articlesRes = await pool.request()
            .input('id', sql.Int, userId)
            .query(`
                SELECT
                    SUM(CASE WHEN author_id = @id THEN 1 ELSE 0 END) AS count_authored,
                    SUM(CASE WHEN editor_id = @id THEN 1 ELSE 0 END) AS count_edited
                FROM dbo.BaiViet
                WHERE author_id = @id OR editor_id = @id;
            `);

        const countAuthored = articlesRes.recordset[0]?.count_authored || 0;
        const countEdited = articlesRes.recordset[0]?.count_edited || 0;
        const totalArticles = countAuthored + countEdited;

        // - Số yêu cầu quảng cáo (doanh nghiệp đăng ký hoặc được duyệt)
        const adsRes = await pool.request()
            .input('id', sql.Int, userId)
            .query(`
                SELECT
                    SUM(CASE WHEN advertiser_id = @id THEN 1 ELSE 0 END) AS count_advertiser,
                    SUM(CASE WHEN approved_by = @id THEN 1 ELSE 0 END) AS count_approver
                FROM dbo.ad_requests
                WHERE advertiser_id = @id OR approved_by = @id;
            `);

        const countAdvertiser = adsRes.recordset[0]?.count_advertiser || 0;
        const countApprover = adsRes.recordset[0]?.count_approver || 0;
        const totalAds = countAdvertiser + countApprover;

        // - Số lượt ghim tin bài
        const pinsRes = await pool.request()
            .input('id', sql.Int, userId)
            .query('SELECT COUNT(*) AS count_pins FROM dbo.pin_position WHERE Id_editor = @id;');

        const totalPins = pinsRes.recordset[0]?.count_pins || 0;

        const totalLinkedRecords = totalArticles + totalAds + totalPins;

        // 2. XỬ LÝ THEO QUY TẮC BẢO TOÀN DỮ LIỆU
        if (totalLinkedRecords > 0) {
            // Đã phát sinh dữ liệu -> CHẶN XÓA CỨNG, CHUYỂN SANG TRẠNG THÁI 'Cam' (VÔ HIỆU HÓA)
            await pool.request()
                .input('id', sql.Int, userId)
                .query("UPDATE dbo.users SET TrangThai = 'Cam' WHERE id = @id;");

            const details = [];
            if (countAuthored > 0) details.push(`${countAuthored} bài viết đã soạn`);
            if (countEdited > 0) details.push(`${countEdited} bài viết đã duyệt`);
            if (countAdvertiser > 0) details.push(`${countAdvertiser} yêu cầu quảng cáo`);
            if (countApprover > 0) details.push(`${countApprover} quảng cáo đã duyệt`);
            if (totalPins > 0) details.push(`${totalPins} bài viết đã ghim`);

            return res.status(200).json({
                success: true,
                softDeleted: true,
                message: `Tài khoản "${user.username}" đã phát sinh dữ liệu liên kết (${details.join(', ')}). Để bảo toàn lịch sử dữ liệu tòa soạn, hệ thống đã chặn xóa cứng và tự động chuyển tài khoản sang trạng thái [Bị cấm].`,
                data: {
                    id: user.id,
                    username: user.username,
                    TrangThai: 'Cam',
                    linked_records: {
                        articles: totalArticles,
                        ads: totalAds,
                        pins: totalPins
                    }
                }
            });
        }

        // 3. Chưa phát sinh dữ liệu liên kết nào -> CHO PHÉP XÓA CỨNG AN TOÀN
        await pool.request()
            .input('id', sql.Int, userId)
            .query('DELETE FROM dbo.users WHERE id = @id;');

        return res.status(200).json({
            success: true,
            softDeleted: false,
            message: `Đã xóa hoàn toàn tài khoản "${user.username}" khỏi hệ thống thành công (do tài khoản chưa phát sinh dữ liệu liên kết).`,
            data: { id: user.id, username: user.username }
        });

    } catch (error) {
        console.error('Lỗi API xóa tài khoản:', error);
        // Bắt lỗi ràng buộc khóa ngoại nếu có
        if (error.number === 547) {
            return res.status(400).json({
                success: false,
                message: 'Không thể xóa tài khoản do vẫn còn ràng buộc dữ liệu khóa ngoại!'
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Lỗi máy chủ khi xóa tài khoản!'
        });
    }
});

module.exports = router;

