const express = require('express');
const router = express.Router();
const sql = require('mssql');
const path = require('path');
const { connectDB } = require('../db');

// 1. API ĐĂNG NHẬP DOANH NGHIỆP: POST /api/auth-doanhnghiep/login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body || {};

        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu!' });
        }

        const pool = await connectDB();
        const result = await pool.request()
            .input('username', sql.VarChar(50), username.trim())
            .query(`
                SELECT id, username, password, email, phone, full_name, VaiTro, 
                       company_name, chucdanh, TrangThai, violation_count
                FROM dbo.users
                WHERE username = @username;
            `);

        const user = result.recordset[0];

        // Kiểm tra tài khoản tồn tại và đúng mật khẩu
        if (!user || user.password !== password) {
            return res.status(401).json({ success: false, message: 'Tên đăng nhập hoặc mật khẩu không chính xác!' });
        }

        // Kiểm tra xem có đúng là khách hàng doanh nghiệp có company_name không
        if (!user.company_name || user.company_name.trim() === '' || user.VaiTro !== 'DN') {
            return res.status(403).json({
                success: false,
                message: 'Tài khoản này không phải là khách hàng doanh nghiệp quảng cáo!'
            });
        }

        // Kiểm tra trạng thái tài khoản
        if (user.TrangThai === 'Cam') {
            return res.status(403).json({
                success: false,
                message: 'Tài khoản doanh nghiệp của bạn hiện đang bị khóa. Vui lòng liên hệ ban quản trị tòa soạn!'
            });
        }

        // Đăng nhập thành công
        const { password: _, ...userInfo } = user;
        return res.status(200).json({
            success: true,
            message: 'Đăng nhập thành công!',
            user: userInfo,
            redirectUrl: 'portal-doanhnghiep.html'
        });

    } catch (err) {
        console.error('Lỗi khi đăng nhập doanh nghiệp:', err);
        return res.status(500).json({ success: false, message: 'Lỗi hệ thống khi đăng nhập, vui lòng thử lại sau!' });
    }
});

// 2. API ĐĂNG KÝ DOANH NGHIỆP: POST /api/auth-doanhnghiep/register
router.post('/register', async (req, res) => {
    try {
        const {
            username,
            password,
            email,
            phone,
            full_name,
            company_name,
            chucdanh
        } = req.body || {};

        // 1. Kiểm tra các trường bắt buộc
        if (!username || !password || !email || !phone || !full_name || !company_name || !chucdanh) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng điền đầy đủ tất cả các thông tin bắt buộc!'
            });
        }

        const trimmedUser = username.trim();
        const trimmedEmail = email.trim();
        const trimmedPhone = phone.trim();
        const trimmedCompany = company_name.trim();
        const trimmedFullName = full_name.trim();
        const trimmedChucDanh = chucdanh.trim();

        // 2. Kiểm tra định dạng cơ bản
        if (trimmedUser.length < 3) {
            return res.status(400).json({ success: false, message: 'Tên đăng nhập phải có ít nhất 3 ký tự!' });
        }
        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'Mật khẩu phải có độ dài từ 6 ký tự trở lên!' });
        }

        const pool = await connectDB();

        // 3. Kiểm tra trùng lặp: username / email / phone / company_name
        const checkQuery = `
            SELECT 
                (SELECT COUNT(*) FROM dbo.users WHERE username = @username) AS count_username,
                (SELECT COUNT(*) FROM dbo.users WHERE email = @email) AS count_email,
                (SELECT COUNT(*) FROM dbo.users WHERE phone = @phone) AS count_phone,
                (SELECT COUNT(*) FROM dbo.users WHERE company_name = @company_name) AS count_company;
        `;

        const checkResult = await pool.request()
            .input('username', sql.VarChar(50), trimmedUser)
            .input('email', sql.VarChar(100), trimmedEmail)
            .input('phone', sql.VarChar(20), trimmedPhone)
            .input('company_name', sql.NVarChar(150), trimmedCompany)
            .query(checkQuery);

        const check = checkResult.recordset[0];

        if (check.count_username > 0) {
            return res.status(409).json({ success: false, message: `Tên đăng nhập "${trimmedUser}" đã tồn tại. Vui lòng chọn tên khác!` });
        }
        if (check.count_email > 0) {
            return res.status(409).json({ success: false, message: `Email "${trimmedEmail}" đã được sử dụng bởi một tài khoản khác!` });
        }
        if (check.count_phone > 0) {
            return res.status(409).json({ success: false, message: `Số điện thoại "${trimmedPhone}" đã được đăng ký trên hệ thống!` });
        }
        if (check.count_company > 0) {
            return res.status(409).json({ success: false, message: `Doanh nghiệp "${trimmedCompany}" đã tồn tại trên hệ thống!` });
        }

        // 4. Thực hiện thêm mới người dùng doanh nghiệp (VaiTro = 'DN', ButDanh = NULL)
        const insertQuery = `
            INSERT INTO dbo.users (
                username, password, email, phone, full_name,
                VaiTro, ButDanh, TrangThai, company_name, chucdanh,
                violation_count, created_at
            )
            VALUES (
                @username, @password, @email, @phone, @full_name,
                'DN', NULL, 'HoatDong', @company_name, @chucdanh,
                0, SYSDATETIME()
            );

            SELECT SCOPE_IDENTITY() AS new_id;
        `;

        const insertResult = await pool.request()
            .input('username', sql.VarChar(50), trimmedUser)
            .input('password', sql.NVarChar(255), password)
            .input('email', sql.VarChar(100), trimmedEmail)
            .input('phone', sql.VarChar(20), trimmedPhone)
            .input('full_name', sql.NVarChar(100), trimmedFullName)
            .input('company_name', sql.NVarChar(150), trimmedCompany)
            .input('chucdanh', sql.NVarChar(100), trimmedChucDanh)
            .query(insertQuery);

        const newId = insertResult.recordset[0]?.new_id;

        return res.status(201).json({
            success: true,
            message: 'Đăng ký tài khoản doanh nghiệp thành công! Bạn có thể đăng nhập ngay bây giờ.',
            userId: newId
        });

    } catch (err) {
        console.error('Lỗi khi đăng ký doanh nghiệp:', err);
        return res.status(500).json({ success: false, message: 'Lỗi server khi đăng ký tài khoản: ' + err.message });
    }
});

// 3. API LẤY DANH SÁCH BẢNG GIÁ VỊ TRÍ QUẢNG CÁO: GET /api/auth-doanhnghiep/ad-positions
router.get('/ad-positions', async (req, res) => {
    try {
        const pool = await connectDB();
        const result = await pool.request().query(`
            SELECT Id, Name, price_per_day, description 
            FROM dbo.ad_positions
            ORDER BY Id ASC;
        `);
        return res.status(200).json({
            success: true,
            data: result.recordset
        });
    } catch (err) {
        console.error('Lỗi khi lấy danh sách vị trí quảng cáo:', err);
        return res.status(500).json({ success: false, message: 'Lỗi server khi lấy dữ liệu bảng giá' });
    }
});

// Cấu hình lưu trữ tệp tải lên (ảnh/video banner)
const multer = require('multer');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../ReadPage/AD_file/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'ad-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// 4. API LẤY CÁC NGÀY ĐÃ ĐƯỢC THUÊ THEO VỊ TRÍ: GET /api/auth-doanhnghiep/booked-dates/:positionId
router.get('/booked-dates/:positionId', async (req, res) => {
    try {
        const { positionId } = req.params;
        const pool = await connectDB();
        // Lấy các yêu cầu đang Chờ duyệt (cho_duyet) hoặc Đã duyệt (da_duyet/active/approved)
        const result = await pool.request()
            .input('position_id', sql.Int, parseInt(positionId, 10))
            .query(`
                SELECT start_date, end_date, status
                FROM dbo.ad_requests
                WHERE position_id = @position_id
                  AND status IN ('dathanhtoan', 'da_thanh_toan', 'active');
            `);

        return res.status(200).json({
            success: true,
            data: result.recordset
        });
    } catch (err) {
        console.error('Lỗi khi lấy danh sách ngày đã đặt:', err);
        return res.status(500).json({ success: false, message: 'Lỗi server khi lấy lịch trống' });
    }
});

// 5. API TẠO YÊU CẦU QUẢNG CÁO MỚI: POST /api/auth-doanhnghiep/create-request
router.post('/create-request', upload.single('media_file'), async (req, res) => {
    // Hàm phụ trợ xóa file vừa upload nếu quá trình tạo đơn thất bại
    const cleanupUploadedFile = () => {
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (unlinkErr) {
                console.error('Không thể xóa file upload tạm thời:', unlinkErr);
            }
        }
    };

    try {
        const {
            advertiser_id,
            position_id,
            target_url,
            start_date,
            end_date,
            total_amount
        } = req.body;

        if (!advertiser_id || !position_id || !target_url || !start_date || !end_date) {
            cleanupUploadedFile();
            return res.status(400).json({
                success: false,
                message: 'Vui lòng cung cấp đầy đủ thông tin: vị trí, liên kết đích, ngày bắt đầu và kết thúc!'
            });
        }

        let media_url = '';
        if (req.file) {
            media_url = 'AD_file/uploads/' + req.file.filename;
        } else if (req.body.media_url) {
            media_url = req.body.media_url;
        } else {
            cleanupUploadedFile();
            return res.status(400).json({
                success: false,
                message: 'Vui lòng tải lên tệp Banner/Video quảng cáo!'
            });
        }

        const pool = await connectDB();

        // Kiểm tra xem khoảng ngày này có bị trùng với ai đã đặt không
        const overlapCheck = await pool.request()
            .input('position_id', sql.Int, parseInt(position_id, 10))
            .input('start_date', sql.Date, start_date)
            .input('end_date', sql.Date, end_date)
            .query(`
                SELECT Id 
                FROM dbo.ad_requests
                WHERE position_id = @position_id
                  AND status IN ('dathanhtoan', 'da_thanh_toan', 'active')
                  AND (
                      (start_date <= @end_date AND end_date >= @start_date)
                  );
            `);

        if (overlapCheck.recordset.length > 0) {
            cleanupUploadedFile();
            return res.status(400).json({
                success: false,
                message: 'Khoảng thời gian bạn chọn đã có ngày bị người khác thuê trước. Vui lòng chọn ngày khác!'
            });
        }

        // Tạo yêu cầu mới (dùng SCOPE_IDENTITY() vì bảng có Trigger AFTER INSERT)
        const insertResult = await pool.request()
            .input('advertiser_id', sql.Int, parseInt(advertiser_id, 10))
            .input('position_id', sql.Int, parseInt(position_id, 10))
            .input('media_url', sql.NVarChar(500), media_url)
            .input('target_url', sql.NVarChar(500), target_url.trim())
            .input('start_date', sql.Date, start_date)
            .input('end_date', sql.Date, end_date)
            .input('total_amount', sql.Decimal(18, 2), parseFloat(total_amount) || 0)
            .input('status', sql.VarChar(30), 'chuaduyet')
            .input('views_count', sql.Int, 0)
            .query(`
                INSERT INTO dbo.ad_requests 
                    (advertiser_id, position_id, media_url, target_url, start_date, end_date, total_amount, status, views_count, created_at)
                VALUES 
                    (@advertiser_id, @position_id, @media_url, @target_url, @start_date, @end_date, @total_amount, @status, @views_count, SYSDATETIME());
                
                SELECT SCOPE_IDENTITY() AS Id;
            `);

        const newRequestId = insertResult.recordset[0]?.Id;

        return res.status(201).json({
            success: true,
            message: 'Tạo yêu cầu đặt quảng cáo thành công!',
            requestId: newRequestId
        });

    } catch (err) {
        cleanupUploadedFile();
        console.error('Lỗi khi nộp đơn quảng cáo:', err);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server khi nộp đơn: ' + err.message
        });
    }
});

// 6. API LẤY QUẢNG CÁO ĐANG HOẠT ĐỘNG THEO VỊ TRÍ (Active Ads cho ReadPage): GET /api/auth-doanhnghiep/active-ads
router.get('/active-ads', async (req, res) => {
    try {
        const pool = await connectDB();
        const query = `
            WITH RankedAds AS (
                SELECT 
                    r.Id,
                    r.position_id,
                    r.media_url,
                    r.target_url,
                    r.start_date,
                    r.end_date,
                    r.status,
                    ROW_NUMBER() OVER (
                        PARTITION BY r.position_id 
                        ORDER BY r.created_at DESC, r.Id DESC
                    ) AS rn
                FROM dbo.ad_requests r
                WHERE (r.status IN ('daduyet', 'dathanhtoan', 'da_duyet', 'active', 'approved', 'da_thanh_toan', 'hoat_dong') 
                       OR r.status = 'Active')
                  AND CAST(SYSDATETIME() AS DATE) BETWEEN r.start_date AND r.end_date
            )
            SELECT position_id, media_url, target_url, start_date, end_date
            FROM RankedAds
            WHERE rn = 1;
        `;

        const result = await pool.request().query(query);

        // Trả về dạng map { 1: { media_url, target_url }, 2: { ... }, 3: { ... } }
        const adsMap = {};
        result.recordset.forEach(ad => {
            adsMap[ad.position_id] = {
                media_url: ad.media_url,
                target_url: ad.target_url
            };
        });

        return res.status(200).json({
            success: true,
            data: adsMap
        });
    } catch (err) {
        console.error('Lỗi khi lấy quảng cáo đang hoạt động:', err);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy dữ liệu quảng cáo',
            data: {}
        });
    }
});

// 7. API LẤY LỊCH SỬ YÊU CẦU QUẢNG CÁO THEO DOANH NGHIỆP: GET /api/auth-doanhnghiep/my-requests
router.get('/my-requests', async (req, res) => {
    try {
        const { advertiser_id } = req.query;

        if (!advertiser_id || isNaN(parseInt(advertiser_id, 10))) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu hoặc không hợp lệ mã doanh nghiệp (advertiser_id)!'
            });
        }

        const pool = await connectDB();

        // 1. Tự động cập nhật các đơn quảng cáo quá hạn theo các luồng quy định:
        // Luồng 1: chuaduyet -> daduyet -> choxacnhan -> dathanhtoan -> quahan (hết hạn ngày chạy)
        // Luồng 2: Chuaduyet -> tuchoi -> quahan (bị từ chối và qua ngày kết thúc)
        // Luồng 3: chuaduyet -> daduyet -> quahan (duyệt rồi nhưng không thanh toán, qua ngày bắt đầu)
        await pool.request()
            .input('adv_id', sql.Int, parseInt(advertiser_id, 10))
            .query(`
                -- Đơn đã thanh toán/đang chạy hết thời gian hiển thị
                UPDATE dbo.ad_requests
                SET status = 'hoanthanh'
                WHERE advertiser_id = @adv_id
                  AND status IN ('dathanhtoan', 'Active', 'active')
                  AND CAST(SYSDATETIME() AS DATE) > end_date;

                -- Đơn đã duyệt nhưng không thanh toán, để qua ngày bắt đầu
                UPDATE dbo.ad_requests
                SET status = 'hoanthanh'
                WHERE advertiser_id = @adv_id
                  AND status IN ('daduyet')
                  AND CAST(SYSDATETIME() AS DATE) > start_date;

                -- Đơn bị từ chối mẫu hoặc chờ duyệt mà đã qua ngày kết thúc
                UPDATE dbo.ad_requests
                SET status = 'hoanthanh'
                WHERE advertiser_id = @adv_id
                  AND status IN ('tuchoi', 'tu_choi', 'chuaduyet', 'cho_duyet', 'pending')
                  AND CAST(SYSDATETIME() AS DATE) > end_date;
            `);

        // 2. Truy vấn danh sách lịch sử yêu cầu của doanh nghiệp
        const query = `
            SELECT 
                r.Id,
                r.advertiser_id,
                r.position_id,
                p.Name AS position_name,
                r.media_url,
                r.target_url,
                CONVERT(VARCHAR(10), r.start_date, 23) AS start_date,
                CONVERT(VARCHAR(10), r.end_date, 23) AS end_date,
                r.total_amount,
                r.status,
                r.rejection_reason,
                r.views_count,
                r.created_at
            FROM dbo.ad_requests r
            JOIN dbo.ad_positions p ON r.position_id = p.Id
            WHERE r.advertiser_id = @adv_id
            ORDER BY r.created_at DESC, r.Id DESC;
        `;

        const result = await pool.request()
            .input('adv_id', sql.Int, parseInt(advertiser_id, 10))
            .query(query);

        return res.status(200).json({
            success: true,
            message: 'Tải lịch sử yêu cầu quảng cáo thành công!',
            data: result.recordset
        });

    } catch (err) {
        console.error('Lỗi khi lấy lịch sử yêu cầu quảng cáo:', err);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server khi lấy lịch sử quảng cáo: ' + err.message
        });
    }
});

// 8. API LẤY THÔNG TIN TÀI KHOẢN NGÂN HÀNG THANH TOÁN: GET /api/auth-doanhnghiep/payment-info
router.get('/payment-info', (req, res) => {
    try {
        const bankId = process.env.BANK_ID || 'MB';
        const accountNo = process.env.BANK_ACCOUNT_NO || '0123456789';
        const accountName = process.env.BANK_ACCOUNT_NAME || 'TOA SOAN PTEWS';
        const template = process.env.BANK_TEMPLATE || 'compact2';

        return res.status(200).json({
            success: true,
            data: {
                bank_id: bankId,
                account_no: accountNo,
                account_name: accountName,
                template: template
            }
        });
    } catch (err) {
        console.error('Lỗi khi lấy thông tin ngân hàng:', err);
        return res.status(500).json({ success: false, message: 'Lỗi server khi lấy thông tin thanh toán' });
    }
});

// 9. API XÁC NHẬN ĐÃ CHUYỂN KHOẢN (ĐỔI TRẠNG THÁI SANG choxacnhan): POST /api/auth-doanhnghiep/confirm-payment
router.post('/confirm-payment', async (req, res) => {
    try {
        const { request_id, advertiser_id } = req.body;

        if (!request_id) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu mã yêu cầu quảng cáo (request_id)!'
            });
        }

        const pool = await connectDB();

        // Chỉ cho phép chuyển sang choxacnhan nếu đơn đang ở trạng thái daduyet
        const result = await pool.request()
            .input('req_id', sql.Int, parseInt(request_id, 10))
            .input('adv_id', sql.Int, advertiser_id ? parseInt(advertiser_id, 10) : null)
            .query(`
                UPDATE dbo.ad_requests
                SET status = 'choxacnhan'
                WHERE Id = @req_id
                  AND status IN ('daduyet', 'da_duyet', 'approved')
                  AND (@adv_id IS NULL OR advertiser_id = @adv_id);

                SELECT @@ROWCOUNT AS affectedRows;
            `);

        const affected = result.recordset[0]?.affectedRows || 0;
        if (affected === 0) {
            return res.status(400).json({
                success: false,
                message: 'Không tìm thấy yêu cầu hợp lệ đang chờ thanh toán để xác nhận!'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Đã gửi thông báo thanh toán thành công! Trạng thái đơn chuyển sang Chờ xác nhận.'
        });

    } catch (err) {
        console.error('Lỗi khi xác nhận thanh toán:', err);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server khi cập nhật trạng thái thanh toán: ' + err.message
        });
    }
});

module.exports = router;


