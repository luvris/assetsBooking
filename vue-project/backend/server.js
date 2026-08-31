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

app.get('/api/assets', async (req, res) => {
  let conn;

  try {
    conn = await pool.getConnection();

    const rows = await conn.query(`
      SELECT
        a.id,
        a.asset_code AS assetCode,
        a.name,
        a.category_id AS categoryId,
        c.name AS categoryName,
        a.brand,
        a.model,
        a.serial_number AS serialNumber,
        a.location,
        a.status,
        a.note,
        a.created_at AS createdAt,
        a.updated_at AS updatedAt
      FROM inventory_assets AS a
      LEFT JOIN categories AS c
        ON c.id = a.category_id
      ORDER BY a.asset_code
    `);

    res.json(rows.map((row) => ({
      ...row,
      id: Number(row.id),
      categoryId: row.categoryId === null ? null : Number(row.categoryId),
    })));
  } catch (error) {
    console.error('Get assets failed:', error.message);

    res.status(500).json({
      message: 'ไม่สามารถโหลดรายการครุภัณฑ์ได้',
    });
  } finally {
    if (conn) conn.release();
  }
});

app.post('/api/assets', async (req, res) => {
  const assetCode = String(req.body.assetCode || '').trim();
  const name = String(req.body.name || '').trim();
  const categoryId = Number(req.body.categoryId);

  const brand = String(req.body.brand || '').trim() || null;
  const model = String(req.body.model || '').trim() || null;
  const serialNumber = String(req.body.serialNumber || '').trim() || null;
  const location = String(req.body.location || '').trim() || null;
  const note = String(req.body.note || '').trim() || null;

  const status = String(req.body.status || 'AVAILABLE')
    .trim()
    .toUpperCase();

  const validStatuses = ['AVAILABLE', 'BORROWED', 'REPAIR', 'DISPOSED'];

  if (!assetCode) {
    return res.status(400).json({
      message: 'กรุณาระบุรหัสครุภัณฑ์',
    });
  }

  if (!name) {
    return res.status(400).json({
      message: 'กรุณาระบุชื่อครุภัณฑ์',
    });
  }

  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return res.status(400).json({
      message: 'กรุณาเลือกหมวดหมู่ครุภัณฑ์',
    });
  }

  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      message: 'สถานะครุภัณฑ์ไม่ถูกต้อง',
    });
  }

  let conn;

  try {
    conn = await pool.getConnection();

    const categoryRows = await conn.query(
      `SELECT id
       FROM categories
       WHERE id = ?
         AND type = 'ASSET'`,
      [categoryId],
    );

    if (categoryRows.length === 0) {
      return res.status(400).json({
        message: 'ไม่พบหมวดหมู่ครุภัณฑ์ที่เลือก',
      });
    }

    const result = await conn.query(
      `INSERT INTO inventory_assets (
        asset_code,
        name,
        category_id,
        brand,
        model,
        serial_number,
        location,
        status,
        note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        assetCode,
        name,
        categoryId,
        brand,
        model,
        serialNumber,
        location,
        status,
        note,
      ],
    );

    res.status(201).json({
      id: Number(result.insertId),
      assetCode,
      name,
      categoryId,
      brand,
      model,
      serialNumber,
      location,
      status,
      note,
      message: 'เพิ่มครุภัณฑ์สำเร็จ',
    });
  } catch (error) {
    console.error('Create asset failed:', error.message);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        message: 'รหัสครุภัณฑ์นี้มีอยู่แล้ว',
      });
    }

    res.status(500).json({
      message: 'ไม่สามารถเพิ่มครุภัณฑ์ได้',
    });
  } finally {
    if (conn) conn.release();
  }
});

app.listen(Number(process.env.PORT || 3000), () => {
    console.log(`Backend API is running at http://localhost:${process.env.PORT || 3000}`);
});