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

app.get('/api/borrows', async (req, res) => {
  let conn;

  try {
    conn = await pool.getConnection();

    const rows = await conn.query(`
      SELECT
        br.id,
        br.asset_id AS assetId,
        a.asset_code AS assetCode,
        a.name AS assetName,
        br.borrower_cid AS borrowerCid,
        br.borrower_name AS borrowerName,
        br.department,
        br.purpose,
        br.borrowed_at AS borrowedAt,
        br.due_at AS dueAt,
        br.returned_at AS returnedAt,
        br.received_by_cid AS receivedByCid,
        br.return_note AS returnNote,
        br.created_at AS createdAt
      FROM borrow_return AS br
      INNER JOIN inventory_assets AS a
        ON a.id = br.asset_id
      ORDER BY br.borrowed_at DESC
    `);

    res.json(rows.map((row) => ({
      ...row,
      id: Number(row.id),
      assetId: Number(row.assetId),
    })));
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
  const assetId = Number(req.body.assetId);
  const borrowerCid = String(req.body.borrowerCid || '').trim();
  const borrowerName = String(req.body.borrowerName || '').trim();
  const department = String(req.body.department || '').trim() || null;
  const purpose = String(req.body.purpose || '').trim() || null;
  const dueAt = req.body.dueAt ? new Date(req.body.dueAt) : null;

  if (!Number.isInteger(assetId) || assetId <= 0) {
    return res.status(400).json({
      message: 'รหัสครุภัณฑ์ไม่ถูกต้อง',
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

  if (dueAt && Number.isNaN(dueAt.getTime())) {
    return res.status(400).json({
      message: 'วันครบกำหนดคืนไม่ถูกต้อง',
    });
  }

  let conn;
  let transactionStarted = false;

  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    transactionStarted = true;

    const assetRows = await conn.query(
      `SELECT id, asset_code, name, status
       FROM inventory_assets
       WHERE id = ?
       FOR UPDATE`,
      [assetId],
    );

    const asset = assetRows[0];

    if (!asset) {
      await conn.rollback();
      transactionStarted = false;

      return res.status(404).json({
        message: 'ไม่พบครุภัณฑ์',
      });
    }

    if (asset.status !== 'AVAILABLE') {
      await conn.rollback();
      transactionStarted = false;

      return res.status(409).json({
        message: 'ครุภัณฑ์นี้ไม่พร้อมให้ยืม',
      });
    }

    const insertResult = await conn.query(
      `INSERT INTO borrow_return (
        asset_id,
        borrower_cid,
        borrower_name,
        department,
        purpose,
        due_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        assetId,
        borrowerCid,
        borrowerName,
        department,
        purpose,
        dueAt,
      ],
    );

    await conn.query(
      `UPDATE inventory_assets
       SET status = 'BORROWED'
       WHERE id = ?`,
      [assetId],
    );

    await conn.commit();
    transactionStarted = false;

    res.status(201).json({
      id: Number(insertResult.insertId),
      assetId,
      assetCode: asset.asset_code,
      assetName: asset.name,
      borrowerCid,
      borrowerName,
      department,
      purpose,
      dueAt,
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
        br.id,
        br.asset_id,
        br.borrower_cid,
        br.borrower_name,
        br.returned_at,
        a.asset_code,
        a.name AS asset_name,
        a.status AS asset_status
      FROM borrow_return AS br
      INNER JOIN inventory_assets AS a
        ON a.id = br.asset_id
      WHERE br.id = ?
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
       WHERE id = ?`,
      [borrow.asset_id],
    );

    await conn.commit();
    transactionStarted = false;

    res.json({
      id: borrowId,
      assetId: Number(borrow.asset_id),
      assetCode: borrow.asset_code,
      assetName: borrow.asset_name,
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

  // ยังไม่มี Keycloak middleware
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
    console.log(`Backend API is running at http://localhost:${process.env.PORT || 3000}`);
});