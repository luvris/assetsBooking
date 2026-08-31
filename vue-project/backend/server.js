require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mariadb = require('mariadb');

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
}));

app.use(express.json());

const pool = mariadb.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3309),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 5,
});

app.get('/api/health', async (req, res) => {
  let conn;

  try {
    conn = await pool.getConnection();
    const rows = await conn.query('SELECT 1 AS ok');

    res.json({
      api: 'ok',
      database: rows[0].ok === 1 ? 'ok' : 'unknown',
    });
  } catch (error) {
    console.error('Database connection failed:', error.message);

    res.status(500).json({
      api: 'ok',
      database: 'error',
      message: 'เชื่อมต่อ MariaDB ไม่สำเร็จ',
    });
  } finally {
    if (conn) conn.release();
  }
});

app.listen(Number(process.env.PORT || 3000), () => {
  console.log('Backend API: http://localhost:3000');
});