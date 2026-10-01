const { connectDB } = require('../db');

async function test() {
    try {
        const pool = await connectDB();

        const result = await pool.request().query(`
            SELECT DB_NAME() AS database_name
        `);

        console.log('Database hiện tại:', result.recordset);

        process.exit(0);
    } catch (error) {
        console.error('Test thất bại:', error);
        process.exit(1);
    }
}

test();