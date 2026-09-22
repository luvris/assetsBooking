-- ============================================================
--  seed.sql — ข้อมูลตัวอย่างสำหรับ development
--  ปลอดภัย: ไม่มีข้อมูลส่วนบุคคล (ไม่มีชื่อ/เลขบัตรประชาชนของบุคลากรจริง)
--  ใช้เฉพาะเครื่อง dev เท่านั้น  ห้ามใช้กับฐานข้อมูล production
-- ============================================================
--  วิธี import (ต้องรัน schema.sql ให้เสร็จก่อน)
--
--  PowerShell (ไม่รองรับ < จึงใช้ source ผ่าน -e):
--    & 'C:\Program Files\MariaDB 10.6\bin\mariadb.exe' `
--      --host=127.0.0.1 --port=3309 --user=assets_api --password `
--      --default-character-set=utf8mb4 `
--      -e "source C:/path/to/vue-project/database/seed.sql"
--
--  Git Bash / WSL / Linux / macOS:
--    mariadb -h 127.0.0.1 -P 3309 -u assets_api -p \
--      --default-character-set=utf8mb4 < database/seed.sql
-- ============================================================

-- 1) หมวดหมู่ (master data จำเป็น เพราะหน้า "เพิ่มครุภัณฑ์/วัสดุ" เลือกหมวดหมู่ไม่ได้ถ้าไม่มีข้อมูล)
INSERT IGNORE INTO categories (name, type) VALUES
  ('คอมพิวเตอร์', 'ASSET'),
  ('โน้ตบุ๊ก', 'ASSET'),
  ('จอภาพ', 'ASSET'),
  ('เครื่องพิมพ์', 'ASSET'),
  ('LAN', 'SUPPLY'),
  ('หมึกพิมพ์', 'SUPPLY'),
  ('กระดาษ A4', 'SUPPLY');

-- 2) ครุภัณฑ์ตัวอย่าง
INSERT IGNORE INTO inventory_assets
  (asset_code, name, category_id, brand, model, serial_number, location, status, note)
SELECT
  'DEMO-ASSET-001', 'โน้ตบุ๊กสำหรับยืม', c.id, 'Dell', 'Latitude 5420',
  'SN-DEMO-0001', 'ห้อง IT', 'AVAILABLE', 'ข้อมูลตัวอย่างสำหรับ dev'
FROM categories AS c
WHERE c.name = 'โน้ตบุ๊ก' AND c.type = 'ASSET';

INSERT IGNORE INTO inventory_assets
  (asset_code, name, category_id, brand, model, serial_number, location, status, note)
SELECT
  'DEMO-ASSET-002', 'จอภาพสำหรับยืม', c.id, 'LG', '24MP400',
  'SN-DEMO-0002', 'ห้อง IT', 'AVAILABLE', 'ข้อมูลตัวอย่างสำหรับ dev'
FROM categories AS c
WHERE c.name = 'จอภาพ' AND c.type = 'ASSET';

-- 3) วัสดุสิ้นเปลืองตัวอย่าง
INSERT IGNORE INTO supplies_stock
  (item_code, name, category_id, unit, quantity, minimum_quantity, location, note)
SELECT
  'DEMO-SUP-001', 'หมึกพิมพ์ HP 85A', c.id, 'ตลับ', 5.00, 2.00,
  'ห้องเก็บของ IT', 'ข้อมูลตัวอย่างสำหรับ dev'
FROM categories AS c
WHERE c.name = 'หมึกพิมพ์' AND c.type = 'SUPPLY';

INSERT IGNORE INTO supplies_stock
  (item_code, name, category_id, unit, quantity, minimum_quantity, location, note)
SELECT
  'DEMO-SUP-002', 'กระดาษ A4 80 แกรม', c.id, 'รีม', 20.00, 5.00,
  'ห้องเก็บของ IT', 'ข้อมูลตัวอย่างสำหรับ dev'
FROM categories AS c
WHERE c.name = 'กระดาษ A4' AND c.type = 'SUPPLY';
