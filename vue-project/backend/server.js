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
  charset: 'utf8mb4',
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

app.delete('/api/categories/:id', async (req, res) => {
  const categoryId = Number(req.params.id);

  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return res.status(400).json({
      message: 'รหัสหมวดหมู่ไม่ถูกต้อง',
    });
  }

  try {
    const rows = await pool.execute(
      `
        SELECT
          (SELECT COUNT(*) FROM inventory_assets WHERE category_id = ?) AS asset_count,
          (SELECT COUNT(*) FROM supplies_stock WHERE category_id = ?) AS supply_count
      `,
      [categoryId, categoryId],
    );

    const usage = rows[0] || {};
    const assetCount = Number(usage.asset_count || 0);
    const supplyCount = Number(usage.supply_count || 0);

    if (assetCount > 0 || supplyCount > 0) {
      return res.status(409).json({
        message:
          'ไม่สามารถลบหมวดหมู่นี้ได้ เพราะยังมีครุภัณฑ์หรือวัสดุสิ้นเปลืองอ้างอิงอยู่',
      });
    }

    const result = await pool.execute(
      'DELETE FROM categories WHERE id = ?',
      [categoryId],
    );

    if (!result || result.affectedRows === 0) {
      return res.status(404).json({
        message: 'ไม่พบหมวดหมู่ที่ต้องการลบ',
      });
    }

    return res.status(200).json({
      message: 'ลบหมวดหมู่เรียบร้อยแล้ว',
    });
  } catch (error) {
    console.error('Delete category error:', error);

    return res.status(500).json({
      message: 'เกิดข้อผิดพลาดในการลบหมวดหมู่',
    });
  }
});

app.put('/api/assets/:id', async (req, res) => {
  const assetId = Number(req.params.id);

  const assetCode = String(req.body.assetCode || '').trim();
  const name = String(req.body.name || '').trim();
  const categoryId = Number(req.body.categoryId);

  const brand = String(req.body.brand || '').trim() || null;
  const model = String(req.body.model || '').trim() || null;
  const serialNumber = String(req.body.serialNumber || '').trim() || null;
  const location = String(req.body.location || '').trim() || null;
  const note = String(req.body.note || '').trim() || null;

  const validStatuses = ['AVAILABLE', 'BORROWED', 'REPAIR', 'DISPOSED'];

  if (!Number.isInteger(assetId) || assetId <= 0) {
    return res.status(400).json({
      message: 'รหัสครุภัณฑ์ไม่ถูกต้อง',
    });
  }

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

  let conn;
  let transactionStarted = false;

  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    transactionStarted = true;

    const assetRows = await conn.query(
      `SELECT id, status, is_archived
       FROM inventory_assets
       WHERE id = ?
       FOR UPDATE`,
      [assetId],
    );

    const asset = assetRows[0];

    if (!asset || Number(asset.is_archived) === 1) {
      await conn.rollback();
      transactionStarted = false;

      return res.status(404).json({
        message: 'ไม่พบครุภัณฑ์ หรือครุภัณฑ์ถูกนำออกจากรายการแล้ว',
      });
    }

    const requestedStatus = String(req.body.status || '')
      .trim()
      .toUpperCase();

    const status = requestedStatus || asset.status;
    if (requestedStatus === 'BORROWED') {
      await conn.rollback();
      transactionStarted = false;

      return res.status(400).json({
        message: 'สถานะ “กำลังถูกยืมใช้งาน” จะถูกกำหนดจากรายการยืม–คืนเท่านั้น',
      });
    }

    if (!validStatuses.includes(status)) {
      await conn.rollback();
      transactionStarted = false;

      return res.status(400).json({
        message: 'สถานะครุภัณฑ์ไม่ถูกต้อง',
      });
    }

    if (asset.status === 'BORROWED') {
      await conn.rollback();
      transactionStarted = false;

      return res.status(409).json({
        message: 'ไม่สามารถแก้ไขครุภัณฑ์ขณะกำลังถูกยืมอยู่',
      });
    }

    const categoryRows = await conn.query(
      `SELECT id
       FROM categories
       WHERE id = ?
         AND type = 'ASSET'`,
      [categoryId],
    );

    if (categoryRows.length === 0) {
      await conn.rollback();
      transactionStarted = false;

      return res.status(400).json({
        message: 'ไม่พบหมวดหมู่ครุภัณฑ์ที่เลือก',
      });
    }

    await conn.query(
      `UPDATE inventory_assets
       SET
         asset_code = ?,
         name = ?,
         category_id = ?,
         brand = ?,
         model = ?,
         serial_number = ?,
         location = ?,
         status = ?,
         note = ?
       WHERE id = ?`,
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
        assetId,
      ],
    );

    await conn.commit();
    transactionStarted = false;

    res.json({
      id: assetId,
      assetCode,
      name,
      categoryId,
      brand,
      model,
      serialNumber,
      location,
      status,
      note,
      message: 'แก้ไขครุภัณฑ์สำเร็จ',
    });
  } catch (error) {
    if (conn && transactionStarted) {
      await conn.rollback();
    }

    console.error('Update asset failed:', error.message);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        message: 'รหัสครุภัณฑ์นี้มีอยู่แล้ว',
      });
    }

    res.status(500).json({
      message: 'ไม่สามารถแก้ไขครุภัณฑ์ได้',
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
      WHERE a.is_archived = 0
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

app.delete('/api/assets/:id', async (req, res) => {
  const assetId = Number(req.params.id);

  if (!Number.isInteger(assetId) || assetId <= 0) {
    return res.status(400).json({
      message: 'รหัสครุภัณฑ์ไม่ถูกต้อง',
    });
  }

  let conn;
  let transactionStarted = false;

  try {
    conn = await pool.getConnection();

    await conn.beginTransaction();
    transactionStarted = true;

    const assetRows = await conn.query(
      `SELECT id, asset_code, name, status, is_archived
       FROM inventory_assets
       WHERE id = ?
       FOR UPDATE`,
      [assetId],
    );

    const asset = assetRows[0];

    if (!asset || Number(asset.is_archived) === 1) {
      await conn.rollback();
      transactionStarted = false;

      return res.status(404).json({
        message: 'ไม่พบครุภัณฑ์ที่ต้องการลบ หรือรายการถูกนำออกไปแล้ว',
      });
    }

    const activeBorrowRows = await conn.query(
      `SELECT id
       FROM borrow_return
       WHERE asset_id = ?
         AND returned_at IS NULL
       LIMIT 1`,
      [assetId],
    );

    if (activeBorrowRows.length > 0) {
      await conn.rollback();
      transactionStarted = false;

      return res.status(409).json({
        message: 'ไม่สามารถนำครุภัณฑ์ออกจากรายการได้ เนื่องจากกำลังถูกยืมอยู่',
      });
    }

    await conn.query(
      `UPDATE inventory_assets
       SET
         is_archived = 1,
         archived_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [assetId],
    );

    await conn.commit();
    transactionStarted = false;

    res.json({
      id: assetId,
      message: 'นำครุภัณฑ์ออกจากรายการใช้งานสำเร็จ',
    });
  } catch (error) {
    if (conn && transactionStarted) {
      await conn.rollback();
    }

    console.error('Archive asset failed:', error.message);

    res.status(500).json({
      message: 'ไม่สามารถนำครุภัณฑ์ออกจากรายการได้',
    });
  } finally {
    if (conn) conn.release();
  }
});

app.get('/api/supplies', async (req, res) => {
  let conn;

  try {
    conn = await pool.getConnection();

    const rows = await conn.query(`
      SELECT
        s.id,
        s.item_code AS itemCode,
        s.name,
        s.category_id AS categoryId,
        c.name AS categoryName,
        s.unit,
        s.quantity,
        s.minimum_quantity AS minimumQuantity,
        s.location,
        s.note,
        s.created_at AS createdAt,
        s.updated_at AS updatedAt
      FROM supplies_stock AS s
      LEFT JOIN categories AS c
        ON c.id = s.category_id
      ORDER BY s.item_code
    `);

    res.json(rows.map((row) => ({
      ...row,
      id: Number(row.id),
      categoryId: row.categoryId === null ? null : Number(row.categoryId),
      quantity: Number(row.quantity),
      minimumQuantity: Number(row.minimumQuantity),
    })));
  } catch (error) {
    console.error('Get supplies failed:', error.message);

    res.status(500).json({
      message: 'ไม่สามารถโหลดรายการวัสดุสิ้นเปลืองได้',
    });
  } finally {
    if (conn) conn.release();
  }
});

app.post('/api/supplies', async (req, res) => {
  const itemCode = String(req.body.itemCode || '').trim();
  const name = String(req.body.name || '').trim();
  const categoryId = Number(req.body.categoryId);
  const unit = String(req.body.unit || '').trim();

  const quantity = Number(req.body.quantity ?? 0);
  const minimumQuantity = Number(req.body.minimumQuantity ?? 0);

  const location = String(req.body.location || '').trim() || null;
  const note = String(req.body.note || '').trim() || null;

  if (!itemCode) {
    return res.status(400).json({
      message: 'กรุณาระบุรหัสวัสดุ',
    });
  }

  if (!name) {
    return res.status(400).json({
      message: 'กรุณาระบุชื่อวัสดุ',
    });
  }

  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return res.status(400).json({
      message: 'กรุณาเลือกหมวดหมู่วัสดุ',
    });
  }

  if (!unit) {
    return res.status(400).json({
      message: 'กรุณาระบุหน่วยนับ',
    });
  }

  if (!Number.isFinite(quantity) || quantity < 0) {
    return res.status(400).json({
      message: 'จำนวนคงเหลือต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป',
    });
  }

  if (!Number.isFinite(minimumQuantity) || minimumQuantity < 0) {
    return res.status(400).json({
      message: 'จำนวนขั้นต่ำต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป',
    });
  }

  let conn;

  try {
    conn = await pool.getConnection();

    const categoryRows = await conn.query(
      `SELECT id
       FROM categories
       WHERE id = ?
         AND type = 'SUPPLY'`,
      [categoryId],
    );

    if (categoryRows.length === 0) {
      return res.status(400).json({
        message: 'ไม่พบหมวดหมู่วัสดุที่เลือก',
      });
    }

    const result = await conn.query(
      `INSERT INTO supplies_stock (
        item_code,
        name,
        category_id,
        unit,
        quantity,
        minimum_quantity,
        location,
        note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        itemCode,
        name,
        categoryId,
        unit,
        quantity,
        minimumQuantity,
        location,
        note,
      ],
    );

    res.status(201).json({
      id: Number(result.insertId),
      itemCode,
      name,
      categoryId,
      unit,
      quantity,
      minimumQuantity,
      location,
      note,
      message: 'เพิ่มวัสดุสิ้นเปลืองสำเร็จ',
    });
  } catch (error) {
    console.error('Create supply failed:', error.message);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        message: 'รหัสวัสดุนี้มีอยู่แล้ว',
      });
    }

    res.status(500).json({
      message: 'ไม่สามารถเพิ่มวัสดุสิ้นเปลืองได้',
    });
  } finally {
    if (conn) conn.release();
  }
});

app.put('/api/supplies/:id', async (req, res) => {
  const supplyId = Number(req.params.id);

  const itemCode = String(req.body.itemCode || '').trim();
  const name = String(req.body.name || '').trim();
  const categoryId = Number(req.body.categoryId);
  const unit = String(req.body.unit || '').trim();

  const minimumQuantity = Number(req.body.minimumQuantity ?? 0);
  const location = String(req.body.location || '').trim() || null;
  const note = String(req.body.note || '').trim() || null;

  if (!Number.isInteger(supplyId) || supplyId <= 0) {
    return res.status(400).json({
      message: 'รหัสวัสดุไม่ถูกต้อง',
    });
  }

  if (!itemCode) {
    return res.status(400).json({
      message: 'กรุณาระบุรหัสวัสดุ',
    });
  }

  if (!name) {
    return res.status(400).json({
      message: 'กรุณาระบุชื่อวัสดุ',
    });
  }

  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return res.status(400).json({
      message: 'กรุณาเลือกหมวดหมู่วัสดุ',
    });
  }

  if (!unit) {
    return res.status(400).json({
      message: 'กรุณาระบุหน่วยนับ',
    });
  }

  if (!Number.isFinite(minimumQuantity) || minimumQuantity < 0) {
    return res.status(400).json({
      message: 'จำนวนขั้นต่ำต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป',
    });
  }

  let conn;
  let transactionStarted = false;

  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    transactionStarted = true;

    const supplyRows = await conn.query(
      `SELECT id, quantity
       FROM supplies_stock
       WHERE id = ?
       FOR UPDATE`,
      [supplyId],
    );

    const supply = supplyRows[0];

    if (!supply) {
      await conn.rollback();
      transactionStarted = false;

      return res.status(404).json({
        message: 'ไม่พบรายการวัสดุที่ต้องการแก้ไข',
      });
    }

    const categoryRows = await conn.query(
      `SELECT id
       FROM categories
       WHERE id = ?
         AND type = 'SUPPLY'`,
      [categoryId],
    );

    if (categoryRows.length === 0) {
      await conn.rollback();
      transactionStarted = false;

      return res.status(400).json({
        message: 'ไม่พบหมวดหมู่วัสดุที่เลือก',
      });
    }

    await conn.query(
      `UPDATE supplies_stock
       SET
         item_code = ?,
         name = ?,
         category_id = ?,
         unit = ?,
         minimum_quantity = ?,
         location = ?,
         note = ?
       WHERE id = ?`,
      [
        itemCode,
        name,
        categoryId,
        unit,
        minimumQuantity,
        location,
        note,
        supplyId,
      ],
    );

    await conn.commit();
    transactionStarted = false;

    res.json({
      id: supplyId,
      itemCode,
      name,
      categoryId,
      unit,
      quantity: Number(supply.quantity),
      minimumQuantity,
      location,
      note,
      message: 'แก้ไขวัสดุสิ้นเปลืองสำเร็จ',
    });
  } catch (error) {
    if (conn && transactionStarted) {
      await conn.rollback();
    }

    console.error('Update supply failed:', error.message);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        message: 'รหัสวัสดุนี้มีอยู่แล้ว',
      });
    }

    res.status(500).json({
      message: 'ไม่สามารถแก้ไขวัสดุสิ้นเปลืองได้',
    });
  } finally {
    if (conn) conn.release();
  }
});

/** จำนวนอุปกรณ์สูงสุดที่ยืมได้ใน 1 รายการ */
const MAX_BORROW_ASSETS_PER_REQUEST = 3;

function normalizeAssetIds(body) {
  const rawIds = Array.isArray(body.assetIds)
    ? body.assetIds
    : [body.assetId];

  return [...new Set(
    rawIds
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0),
  )];
}

function mapBorrowAssets(rows) {
  const byBorrowId = new Map();

  for (const row of rows) {
    const borrowId = Number(row.id);

    if (!byBorrowId.has(borrowId)) {
      byBorrowId.set(borrowId, {
        id: borrowId,
        assetId: row.assetId === null ? null : Number(row.assetId),
        assetCode: row.assetCode || null,
        assetName: row.assetName || null,
        quantity: Number(row.quantity || 1),

        borrowerCid: row.borrowerCid,
        borrowerName: row.borrowerName,
        borrowerPhone: row.borrowerPhone,
        borrowerPosition: row.borrowerPosition,

        department: row.department,
        purpose: row.purpose,
        useLocation: row.useLocation,

        formType: row.formType,
        outOfAreaNote: row.outOfAreaNote,

        borrowedAt: row.borrowedAt,
        dueAt: row.dueAt,
        returnedAt: row.returnedAt,

        receivedByCid: row.receivedByCid,
        returnNote: row.returnNote,
        createdAt: row.createdAt,

        assets: [],
      });
    }

    const borrow = byBorrowId.get(borrowId);

    if (row.itemAssetId !== null && row.itemAssetId !== undefined) {
      borrow.assets.push({
        id: Number(row.itemAssetId),
        assetCode: row.itemAssetCode,
        name: row.itemAssetName,
        brand: row.itemBrand || null,
        model: row.itemModel || null,
        quantity: Number(row.itemQuantity || 1),
      });
    }
  }

  return [...byBorrowId.values()].map((borrow) => {
    if (borrow.assets.length === 0 && borrow.assetId) {
      borrow.assets = [{
        id: borrow.assetId,
        assetCode: borrow.assetCode,
        name: borrow.assetName,
        quantity: borrow.quantity,
      }];
    }

    if (borrow.assets.length > 0) {
      borrow.assetId = borrow.assets[0].id;
      borrow.assetCode = borrow.assets[0].assetCode;
      borrow.assetName = borrow.assets[0].name;
      borrow.quantity = borrow.assets[0].quantity;
    }

    return borrow;
  });
}

app.get('/api/borrows', async (req, res) => {
  let conn;

  try {
    conn = await pool.getConnection();

    const rows = await conn.query(`
      SELECT
        br.id,

        br.asset_id AS assetId,
        legacy_asset.asset_code AS assetCode,
        legacy_asset.name AS assetName,
        br.quantity,

        br.borrower_cid AS borrowerCid,
        br.borrower_name AS borrowerName,
        br.borrower_phone AS borrowerPhone,
        br.borrower_position AS borrowerPosition,

        br.department,
        br.purpose,
        br.use_location AS useLocation,

        br.form_type AS formType,
        br.out_of_area_note AS outOfAreaNote,

        br.borrowed_at AS borrowedAt,
        br.due_at AS dueAt,
        br.returned_at AS returnedAt,

        br.received_by_cid AS receivedByCid,
        br.return_note AS returnNote,
        br.created_at AS createdAt,

        bri.asset_id AS itemAssetId,
        item_asset.asset_code AS itemAssetCode,
        item_asset.name AS itemAssetName,
        item_asset.brand AS itemBrand,
        item_asset.model AS itemModel,
        bri.quantity AS itemQuantity

      FROM borrow_return AS br

      LEFT JOIN inventory_assets AS legacy_asset
        ON legacy_asset.id = br.asset_id

      LEFT JOIN borrow_return_items AS bri
        ON bri.borrow_return_id = br.id

      LEFT JOIN inventory_assets AS item_asset
        ON item_asset.id = bri.asset_id

      ORDER BY br.created_at DESC, br.id DESC, bri.id ASC
    `);

    res.json(mapBorrowAssets(rows));
  } catch (error) {
    console.error('Get borrows failed:', error.message);

    res.status(500).json({
      message: 'ไม่สามารถโหลดประวัติยืม–คืนได้',
    });
  } finally {
    if (conn) conn.release();
  }
});

app.post('/api/borrows', async (req, res) => {
  console.log('POST /api/borrows body:', req.body);

  const assetIds = normalizeAssetIds(req.body);

  const borrowerCid = String(req.body.borrowerCid || '').trim();
  const borrowerName = String(req.body.borrowerName || '').trim();

  const borrowerPhone = String(
    req.body.borrowerPhone
    ?? req.body.borrower_phone
    ?? req.body.phone
    ?? '',
  ).trim() || null;

  const borrowerPosition = String(
    req.body.borrowerPosition
    ?? req.body.borrower_position
    ?? req.body.position
    ?? '',
  ).trim() || null;

  const department = String(req.body.department || '').trim() || null;
  const purpose = String(req.body.purpose || '').trim() || null;

  const useLocation = String(
    req.body.useLocation
    ?? req.body.use_location
    ?? req.body.location
    ?? '',
  ).trim() || null;

  const formType = String(
    req.body.formType
    ?? req.body.form_type
    ?? 'IN_HOSPITAL',
  ).trim() || 'IN_HOSPITAL';

  const outOfAreaNote = String(
    req.body.outOfAreaNote
    ?? req.body.out_of_area_note
    ?? '',
  ).trim() || null;

  const borrowedAt = req.body.borrowedAt
    ? new Date(req.body.borrowedAt)
    : new Date();

  const dueAt = req.body.dueAt
    ? new Date(req.body.dueAt)
    : null;

  const note = String(req.body.note || '').trim() || null;

  if (assetIds.length === 0) {
    return res.status(400).json({
      message: 'กรุณาเลือกครุภัณฑ์อย่างน้อย 1 รายการ',
    });
  }

  if (assetIds.length > MAX_BORROW_ASSETS_PER_REQUEST) {
    return res.status(400).json({
      message: `ยืมครุภัณฑ์ได้สูงสุด ${MAX_BORROW_ASSETS_PER_REQUEST} อุปกรณ์ต่อครั้ง`,
    });
  }

  if (!borrowerCid) {
    return res.status(400).json({
      message: 'กรุณาระบุ CID ผู้ยืม',
    });
  }

  if (!borrowerName) {
    return res.status(400).json({
      message: 'กรุณาระบุชื่อผู้ยืม',
    });
  }

  if (Number.isNaN(borrowedAt.getTime())) {
    return res.status(400).json({
      message: 'วันที่ยืมไม่ถูกต้อง',
    });
  }

  if (dueAt && Number.isNaN(dueAt.getTime())) {
    return res.status(400).json({
      message: 'วันครบกำหนดคืนไม่ถูกต้อง',
    });
  }

  if (dueAt && dueAt < borrowedAt) {
    return res.status(400).json({
      message: 'วันครบกำหนดคืนต้องไม่ก่อนวันที่ยืม',
    });
  }

  let conn;
  let transactionStarted = false;

  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    transactionStarted = true;

    const placeholders = assetIds.map(() => '?').join(', ');

    const assetRows = await conn.query(
      `SELECT
        id,
        asset_code,
        name,
        brand,
        model,
        status,
        is_archived
      FROM inventory_assets
      WHERE id IN (${placeholders})
      FOR UPDATE`,
      assetIds,
    );

    if (assetRows.length !== assetIds.length) {
      await conn.rollback();
      transactionStarted = false;

      return res.status(404).json({
        message: 'พบครุภัณฑ์บางรายการไม่อยู่ในระบบ',
      });
    }

    const unavailableAssets = assetRows.filter(
      (asset) => Number(asset.is_archived) === 1 || asset.status !== 'AVAILABLE',
    );

    if (unavailableAssets.length > 0) {
      await conn.rollback();
      transactionStarted = false;

      const names = unavailableAssets
        .map((asset) => `${asset.asset_code} - ${asset.name}`)
        .join(', ');

      return res.status(409).json({
        message: `ครุภัณฑ์บางรายการไม่พร้อมให้ยืม: ${names}`,
      });
    }

    const assetById = new Map(
      assetRows.map((asset) => [Number(asset.id), asset]),
    );

    const primaryAssetId = assetIds[0];

    const insertResult = await conn.query(
      `INSERT INTO borrow_return (
        asset_id,
        quantity,

        borrower_cid,
        borrower_name,
        borrower_phone,
        borrower_position,

        department,
        purpose,
        use_location,

        form_type,
        out_of_area_note,

        borrowed_at,
        due_at,

        return_note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        primaryAssetId,
        assetIds.length,

        borrowerCid,
        borrowerName,
        borrowerPhone,
        borrowerPosition,

        department,
        purpose,
        useLocation,

        formType,
        outOfAreaNote,

        borrowedAt,
        dueAt,

        note,
      ],
    );

    const borrowId = Number(insertResult.insertId);

    for (const assetId of assetIds) {
      await conn.query(
        `INSERT INTO borrow_return_items (
          borrow_return_id,
          asset_id,
          quantity
        ) VALUES (?, ?, ?)`,
        [borrowId, assetId, 1],
      );
    }

    await conn.query(
      `UPDATE inventory_assets
      SET status = 'BORROWED'
      WHERE id IN (${placeholders})`,
      assetIds,
    );

    await conn.commit();
    transactionStarted = false;

    const assets = assetIds.map((assetId) => {
      const asset = assetById.get(assetId);

      return {
        id: assetId,
        assetCode: asset.asset_code,
        name: asset.name,
        brand: asset.brand || null,
        model: asset.model || null,
        quantity: 1,
      };
    });

    res.status(201).json({
      id: borrowId,

      assetId: primaryAssetId,
      assetCode: assets[0].assetCode,
      assetName: assets[0].name,
      quantity: assets.length,
      assets,

      borrowerCid,
      borrowerName,
      borrowerPhone,
      borrowerPosition,

      department,
      purpose,
      useLocation,

      formType,
      outOfAreaNote,

      borrowedAt,
      dueAt,

      note,
      status: 'BORROWED',
      message: 'บันทึกการยืมครุภัณฑ์สำเร็จ',
    });
  } catch (error) {
    if (conn && transactionStarted) {
      await conn.rollback();
    }

    console.error('Create borrow failed:', error.message);

    res.status(500).json({
      message: 'ไม่สามารถบันทึกการยืมครุภัณฑ์ได้',
    });
  } finally {
    if (conn) conn.release();
  }
});

app.post('/api/borrows/:id/return', async (req, res) => {
  const borrowId = Number(req.params.id);
  const receivedByCid = String(req.body.receivedByCid || '').trim() || null;
  const returnNote = String(req.body.returnNote || '').trim() || null;

  if (!Number.isInteger(borrowId) || borrowId <= 0) {
    return res.status(400).json({
      message: 'รหัสรายการยืมไม่ถูกต้อง',
    });
  }

  let conn;
  let transactionStarted = false;

  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    transactionStarted = true;

    const borrowRows = await conn.query(
      `SELECT
        id,
        asset_id,
        borrower_cid,
        borrower_name,
        returned_at
      FROM borrow_return
      WHERE id = ?
      FOR UPDATE`,
      [borrowId],
    );

    const borrow = borrowRows[0];

    if (!borrow) {
      await conn.rollback();
      transactionStarted = false;

      return res.status(404).json({
        message: 'ไม่พบรายการยืม',
      });
    }

    if (borrow.returned_at) {
      await conn.rollback();
      transactionStarted = false;

      return res.status(409).json({
        message: 'รายการนี้ถูกคืนแล้ว',
      });
    }

    const itemRows = await conn.query(
      `SELECT
        bri.asset_id AS assetId,
        a.asset_code AS assetCode,
        a.name AS assetName,
        a.brand,
        bri.quantity
      FROM borrow_return_items AS bri
      INNER JOIN inventory_assets AS a
        ON a.id = bri.asset_id
      WHERE bri.borrow_return_id = ?
      ORDER BY bri.id ASC
      FOR UPDATE`,
      [borrowId],
    );

    const assets = itemRows.length > 0
      ? itemRows.map((item) => ({
        id: Number(item.assetId),
        assetCode: item.assetCode,
        name: item.assetName,
        brand: item.brand || null,
        quantity: Number(item.quantity || 1),
      }))
      : [{
        id: Number(borrow.asset_id),
        assetCode: null,
        name: null,
        brand: null,
        quantity: 1,
      }];

    const assetIds = assets.map((asset) => asset.id);
    const placeholders = assetIds.map(() => '?').join(', ');

    await conn.query(
      `UPDATE borrow_return
      SET
        returned_at = CURRENT_TIMESTAMP,
        received_by_cid = ?,
        return_note = ?
      WHERE id = ?`,
      [receivedByCid, returnNote, borrowId],
    );

    await conn.query(
      `UPDATE inventory_assets
      SET status = 'AVAILABLE'
      WHERE id IN (${placeholders})`,
      assetIds,
    );

    await conn.commit();
    transactionStarted = false;

    res.json({
      id: borrowId,
      assetId: assets[0].id,
      assetCode: assets[0].assetCode,
      assetName: assets[0].name,
      assets,

      borrowerCid: borrow.borrower_cid,
      borrowerName: borrow.borrower_name,
      receivedByCid,
      returnNote,

      status: 'AVAILABLE',
      message: 'บันทึกการคืนครุภัณฑ์สำเร็จ',
    });
  } catch (error) {
    if (conn && transactionStarted) {
      await conn.rollback();
    }

    console.error('Return borrow failed:', error.message);

    res.status(500).json({
      message: 'ไม่สามารถบันทึกการคืนครุภัณฑ์ได้',
    });
  } finally {
    if (conn) conn.release();
  }
});

app.get('/api/supply-transactions', async (req, res) => {
  let conn;

  try {
    conn = await pool.getConnection();

    const rows = await conn.query(`
      SELECT
        st.id,
        st.supply_id AS supplyId,
        s.item_code AS itemCode,
        s.name AS supplyName,
        s.unit,
        st.transaction_type AS transactionType,
        st.quantity,
        st.work_order_no AS workOrderNo,
        st.requester_name AS requesterName,
        st.department,
        st.note,
        st.created_by_cid AS createdByCid,
        st.created_at AS createdAt
      FROM supplies_transactions AS st
      INNER JOIN supplies_stock AS s
        ON s.id = st.supply_id
      ORDER BY st.created_at DESC, st.id DESC
    `);

    res.json(rows.map((row) => ({
      ...row,
      id: Number(row.id),
      supplyId: Number(row.supplyId),
      quantity: Number(row.quantity),
    })));
  } catch (error) {
    console.error('Get supply transactions failed:', error.message);

    res.status(500).json({
      message: 'ไม่สามารถโหลดประวัติรับเข้า/เบิกวัสดุได้',
    });
  } finally {
    if (conn) conn.release();
  }
});

app.post('/api/supplies/:id/transactions', async (req, res) => {
  const supplyId = Number(req.params.id);
  const transactionType = String(req.body.transactionType || '')
    .trim()
    .toUpperCase();

  const quantity = Number(req.body.quantity);
  const workOrderNo = String(req.body.workOrderNo || '').trim() || null;
  const requesterName = String(req.body.requesterName || '').trim() || null;
  const department = String(req.body.department || '').trim() || null;
  const note = String(req.body.note || '').trim() || null;

  const createdByCid = String(req.body.createdByCid || '').trim();

  if (!Number.isInteger(supplyId) || supplyId <= 0) {
    return res.status(400).json({
      message: 'รหัสวัสดุไม่ถูกต้อง',
    });
  }

  if (!['IN', 'OUT'].includes(transactionType)) {
    return res.status(400).json({
      message: 'ประเภทรายการต้องเป็น IN หรือ OUT',
    });
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return res.status(400).json({
      message: 'จำนวนต้องเป็นตัวเลขมากกว่า 0',
    });
  }

  if (transactionType === 'OUT' && !workOrderNo) {
    return res.status(400).json({
      message: 'กรุณาระบุหมายเลขใบงานสำหรับการเบิกวัสดุ',
    });
  }

  if (!createdByCid) {
    return res.status(400).json({
      message: 'กรุณาระบุ CID ผู้บันทึกรายการ',
    });
  }

  let conn;
  let transactionStarted = false;

  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    transactionStarted = true;

    const supplyRows = await conn.query(
      `SELECT id, item_code, name, quantity
       FROM supplies_stock
       WHERE id = ?
       FOR UPDATE`,
      [supplyId],
    );

    const supply = supplyRows[0];

    if (!supply) {
      await conn.rollback();
      transactionStarted = false;

      return res.status(404).json({
        message: 'ไม่พบรายการวัสดุ',
      });
    }

    const currentQuantity = Number(supply.quantity);

    if (transactionType === 'OUT' && currentQuantity < quantity) {
      await conn.rollback();
      transactionStarted = false;

      return res.status(409).json({
        message: `วัสดุคงเหลือไม่เพียงพอ (คงเหลือ ${currentQuantity})`,
      });
    }

    const quantityChange = transactionType === 'IN'
      ? quantity
      : -quantity;

    const newQuantity = currentQuantity + quantityChange;

    await conn.query(
      `UPDATE supplies_stock
       SET quantity = ?
       WHERE id = ?`,
      [newQuantity, supplyId],
    );

    const insertResult = await conn.query(
      `INSERT INTO supplies_transactions (
        supply_id,
        transaction_type,
        quantity,
        work_order_no,
        requester_name,
        department,
        note,
        created_by_cid
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        supplyId,
        transactionType,
        quantity,
        workOrderNo,
        requesterName,
        department,
        note,
        createdByCid,
      ],
    );

    await conn.commit();
    transactionStarted = false;

    res.status(201).json({
      id: Number(insertResult.insertId),
      supplyId,
      itemCode: supply.item_code,
      supplyName: supply.name,
      transactionType,
      quantity,
      previousQuantity: currentQuantity,
      currentQuantity: newQuantity,
      workOrderNo,
      requesterName,
      department,
      note,
      createdByCid,
      message: transactionType === 'IN'
        ? 'บันทึกรับวัสดุสำเร็จ'
        : 'บันทึกการเบิกวัสดุสำเร็จ',
    });
  } catch (error) {
    if (conn && transactionStarted) {
      await conn.rollback();
    }

    console.error('Create supply transaction failed:', error.message);

    res.status(500).json({
      message: 'ไม่สามารถบันทึกรายการวัสดุได้',
    });
  } finally {
    if (conn) conn.release();
  }
});

app.listen(Number(process.env.PORT || 3000), () => {
  console.log(
    `Backend API is running at http://localhost:${process.env.PORT || 3000}`,
  );
});