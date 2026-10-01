// Lấy giá xăng từ web giaxanghomnay.com
const sql = require('mssql');
const { connectDB } = require('../db');

async function luuGiaXang() {
    try {
        const today = new Date().toISOString().slice(0, 10);

        const response = await fetch(
            `https://giaxanghomnay.com/api/pvdate/${today}`
        );

        const apiData = await response.json();

        let ron95 = null;

        for (const group of apiData) {
            if (!Array.isArray(group)) continue;

            const found = group.find(
                item => item.title === 'X\u0103ng E10 RON 95 M\u1ee9c 3'
            );

            if (found) {
                ron95 = found;
                break;
            }
        }

        if (!ron95) {
            console.log('Không tìm thấy Xăng E10 RON 95-III');
            return;
        }
        // console.log(ron95);
        const pool = await connectDB();

        const dateOnly = ron95.date.slice(0, 10);

        const check = await pool.request()
            .input('date', sql.Date, dateOnly)
            .query(`
        SELECT TOP 1 [Date], [Price]
        FROM [WebBaoDB].[dbo].[N95III]
        WHERE [Date] = @date
    `);

        if (check.recordset.length > 0) {
            const oldPrice = check.recordset[0].Price;

            if (Number(oldPrice) === Number(ron95.zone1_price)) {
                console.log(`Ngày ${dateOnly} đã có giá ${ron95.zone1_price}, không cần cập nhật.`);
                return;
            }

            // Ngày đã có nhưng giá khác → cập nhật giá mới
            await pool.request()
                .input('date', sql.Date, dateOnly)
                .input('price', sql.Decimal(18, 0), ron95.zone1_price)
                .query(`
            UPDATE [WebBaoDB].[dbo].[N95III]
            SET [Price] = @price
            WHERE [Date] = @date
        `);

            console.log(
                `Đã cập nhật giá xăng ngày ${dateOnly}: ${oldPrice} → ${ron95.zone1_price}`
            );

            return;
        }

        // Ngày chưa có → thêm dữ liệu mới
        await pool.request()
            .input('date', sql.Date, dateOnly)
            .input('price', sql.Decimal(18, 0), ron95.zone1_price)
            .query(`
            INSERT INTO [WebBaoDB].[dbo].[N95III]
                ([Date], [Price])
            VALUES
                (@date, @price)
        `);

        console.log(
            `Đã thêm giá Xăng E10 RON 95-III: ${dateOnly} - ${ron95.zone1_price}`
        );

    } catch (error) {
        console.error('Lỗi lưu giá xăng:', error);
    }
}

module.exports = { luuGiaXang };