const sql = require('mssql');

const config = {
    server: 'localhost',
    port: 1433,
    database: 'WebBaoDB',
    user: 'sa',
    password: 'Sa@123456',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function connectDB() {
    try {
        const pool = await sql.connect(config);
        console.log('Đã kết nối SQL Server');
        return pool;
    } catch (error) {
        console.error('Lỗi kết nối SQL Server:', error);
    }
}

module.exports = { sql, connectDB };