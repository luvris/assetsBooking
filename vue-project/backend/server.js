require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mariadb = require('mariadb');

const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
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
        console.error('Database health check failed:', error.message);

        res.status(500).json({
            api: 'ok',
            database: 'error',
            message: 'เชื่อมต่อ MariaDB ไม่สำเร็จ',
        });
    } finally {
        if (conn) conn.release();
    }
});

app.get('/api/categories', async (req, res) => {
    let conn;

    try {
        conn = await pool.getConnection();

        const rows = await conn.query(`
      SELECT
        id,
        name,
        type
      FROM categories
      ORDER BY type, name
    `);

        res.json(rows.map((row) => ({
            ...row,
            id: Number(row.id),
        })));
    } catch (error) {
        console.error('Get categories failed:', error.message);

        res.status(500).json({
            message: 'ไม่สามารถโหลดหมวดหมู่ได้',
        });
    } finally {
        if (conn) conn.release();
    }
});


app.post('/api/categories', async (req, res) => {
    const name = String(req.body.name || '').trim();
    const type = String(req.body.type || '').trim().toUpperCase();

    if (!name) {
        return res.status(400).json({
            message: 'กรุณาระบุชื่อหมวดหมู่',
        });
    }

    if (!['ASSET', 'SUPPLY'].includes(type)) {
        return res.status(400).json({
            message: 'ประเภทหมวดหมู่ต้องเป็น ASSET หรือ SUPPLY',
        });
    }

    let conn;

    try {
        conn = await pool.getConnection();

        const result = await conn.query(
            'INSERT INTO categories (name, type) VALUES (?, ?)',
            [name, type],
        );

        res.status(201).json({
            id: Number(result.insertId),
            name,
            type,
            message: 'เพิ่มหมวดหมู่สำเร็จ',
        });
    } catch (error) {
        console.error('Create category failed:', error.message);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                message: 'มีหมวดหมู่ชื่อนี้ในประเภทเดียวกันอยู่แล้ว',
            });
        }

        res.status(500).json({
            message: 'ไม่สามารถเพิ่มหมวดหมู่ได้',
        });
    } finally {
        if (conn) conn.release();
    }
});

app.listen(Number(process.env.PORT || 3000), () => {
    console.log(`Backend API is running at http://localhost:${process.env.PORT || 3000}`);
});