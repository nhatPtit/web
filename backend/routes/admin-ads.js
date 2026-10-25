const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { connectDB } = require('../db');

/**
 * 3 Vị trí quảng cáo chuẩn theo đặc tả hệ thống PTIT News (a.docx)
 */
const DEFAULT_POSITIONS = [
    {
        name: 'Banner Top',
        price_per_day: 500000,
        description: 'Vị trí banner đầu trang báo (1200x120px) — Xuất hiện trên trang chủ và toàn bộ bài viết, độ hiển thị cao nhất.'
    },
    {
        name: 'Sidebar',
        price_per_day: 300000,
        description: 'Vị trí banner cột bên phải (300x600px) — Hiển thị cố định dọc trang khi độc giả cuộn đọc tin tức.'
    },
    {
        name: 'Trong bài viết',
        price_per_day: 200000,
        description: 'Vị trí banner chèn giữa nội dung bài báo (728x90px) — Xuất hiện tự nhiên trong các bài đọc chi tiết.'
    }
];

/**
 * Hàm khởi tạo 3 vị trí quảng cáo mặc định nếu bảng ad_positions đang rỗng
 */
async function ensureDefaultPositions(pool) {
    const countRes = await pool.request().query('SELECT COUNT(*) AS total FROM dbo.ad_positions;');
    if (countRes.recordset[0].total === 0) {
        for (const pos of DEFAULT_POSITIONS) {
            await pool.request()
                .input('name', sql.NVarChar(100), pos.name)
                .input('price', sql.Decimal(18, 2), pos.price_per_day)
                .input('desc', sql.NVarChar(255), pos.description)
                .query(`
                    INSERT INTO dbo.ad_positions (Name, price_per_day, description)
                    VALUES (@name, @price, @desc);
                `);
        }
    }
}

/**
 * GET /api/admin/ads/positions
 * Lấy danh sách 3 vị trí quảng cáo và đơn giá theo ngày hiện hành
 */
router.get('/positions', async (req, res) => {
    try {
        const pool = await connectDB();
        if (!pool) {
            return res.status(500).json({
                success: false,
                message: 'Không thể kết nối cơ sở dữ liệu!'
            });
        }

        // Tự động khởi tạo nếu bảng rỗng
        await ensureDefaultPositions(pool);

        const query = `
            SELECT
                p.Id,
                p.Name,
                p.price_per_day,
                p.description,
                COUNT(r.Id) AS total_requests,
                SUM(CASE WHEN r.status = 'Active' THEN 1 ELSE 0 END) AS active_requests,
                COALESCE(SUM(r.total_amount), 0) AS total_revenue_recorded
            FROM dbo.ad_positions p
            LEFT JOIN dbo.ad_requests r ON p.Id = r.position_id
            GROUP BY p.Id, p.Name, p.price_per_day, p.description
            ORDER BY p.Id ASC;
        `;

        const result = await pool.request().query(query);

        return res.status(200).json({
            success: true,
            message: 'Tải danh sách vị trí quảng cáo thành công!',
            data: result.recordset
        });

    } catch (error) {
        console.error('Lỗi API lấy vị trí quảng cáo:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi máy chủ khi lấy dữ liệu vị trí quảng cáo!'
        });
    }
});

/**
 * PUT /api/admin/ads/positions/:id
 * Cập nhật báo giá đơn giá theo ngày (price_per_day) và mô tả vị trí quảng cáo.
 * QUY TẮC CỐT LÕI: Việc cập nhật đơn giá mới chỉ áp dụng cho các yêu cầu tạo mới;
 * toàn bộ chi phí (total_amount) của các yêu cầu quảng cáo đã ghi nhận trước đó được bảo toàn 100%.
 */
router.put('/positions/:id', async (req, res) => {
    try {
        const positionId = parseInt(req.params.id, 10);
        const { price_per_day, description } = req.body || {};

        if (!positionId || isNaN(positionId)) {
            return res.status(400).json({
                success: false,
                message: 'Mã vị trí quảng cáo không hợp lệ!'
            });
        }

        const newPrice = parseFloat(price_per_day);
        if (isNaN(newPrice) || newPrice <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Đơn giá quảng cáo theo ngày phải là số dương lớn hơn 0 (VNĐ)!'
            });
        }

        const pool = await connectDB();
        if (!pool) {
            return res.status(500).json({
                success: false,
                message: 'Không thể kết nối cơ sở dữ liệu!'
            });
        }

        // Lấy thông tin vị trí hiện tại
        const currentRes = await pool.request()
            .input('id', sql.Int, positionId)
            .query('SELECT TOP 1 * FROM dbo.ad_positions WHERE Id = @id;');

        const currentPos = currentRes.recordset[0];
        if (!currentPos) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy vị trí quảng cáo!'
            });
        }

        const updatedDesc = description ? description.trim() : currentPos.description;

        // Cập nhật đơn giá mới cho vị trí (Bảng ad_requests giữ nguyên total_amount)
        const updateRes = await pool.request()
            .input('id', sql.Int, positionId)
            .input('price', sql.Decimal(18, 2), newPrice)
            .input('desc', sql.NVarChar(255), updatedDesc)
            .query(`
                UPDATE dbo.ad_positions
                SET
                    price_per_day = @price,
                    description = @desc
                OUTPUT
                    INSERTED.Id,
                    INSERTED.Name,
                    INSERTED.price_per_day,
                    INSERTED.description
                WHERE Id = @id;
            `);

        const updated = updateRes.recordset[0];

        // Đếm số lượng đơn quảng cáo lịch sử đang được bảo toàn
        const countRes = await pool.request()
            .input('id', sql.Int, positionId)
            .query('SELECT COUNT(*) AS total_past_requests FROM dbo.ad_requests WHERE position_id = @id;');

        const pastCount = countRes.recordset[0]?.total_past_requests || 0;

        return res.status(200).json({
            success: true,
            message: `Cập nhật báo giá cho vị trí "${updated.Name}" thành công!`,
            data: updated,
            past_requests_protected: pastCount,
            note: 'Báo giá mới sẽ được áp dụng cho các yêu cầu quảng cáo đăng ký mới. Toàn bộ các yêu cầu quảng cáo đã ghi nhận trước đó được bảo toàn nguyên vẹn chi phí lịch sử.'
        });

    } catch (error) {
        console.error('Lỗi API cập nhật báo giá quảng cáo:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi máy chủ khi cập nhật báo giá quảng cáo!'
        });
    }
});

/**
 * GET /api/admin/ads/requests
 * Lấy danh sách các yêu cầu quảng cáo từ doanh nghiệp để đối soát chi phí lịch sử
 */
router.get('/requests', async (req, res) => {
    try {
        const pool = await connectDB();
        if (!pool) {
            return res.status(500).json({
                success: false,
                message: 'Không thể kết nối cơ sở dữ liệu!'
            });
        }

        const query = `
            SELECT TOP 100
                r.Id,
                r.advertiser_id,
                u.company_name,
                u.phone AS advertiser_phone,
                u.email AS advertiser_email,
                r.position_id,
                p.Name AS position_name,
                p.price_per_day AS current_position_price,
                r.media_url,
                r.target_url,
                r.start_date,
                r.end_date,
                DATEDIFF(day, r.start_date, r.end_date) + 1 AS total_days,
                r.total_amount,
                r.status,
                r.created_at
            FROM dbo.ad_requests r
            JOIN dbo.ad_positions p ON r.position_id = p.Id
            JOIN dbo.users u ON r.advertiser_id = u.id
            ORDER BY r.created_at DESC;
        `;

        const result = await pool.request().query(query);

        return res.status(200).json({
            success: true,
            message: 'Tải danh sách yêu cầu quảng cáo thành công!',
            data: result.recordset
        });

    } catch (error) {
        console.error('Lỗi API lấy yêu cầu quảng cáo:', error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi máy chủ khi lấy danh sách yêu cầu quảng cáo!'
        });
    }
});

module.exports = router;
