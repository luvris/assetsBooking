# ฐานข้อมูล (Database)

โฟลเดอร์นี้เก็บสคริปต์ SQL สำหรับตั้งฐานข้อมูลของระบบ `assets_booking` (MariaDB 10.6, ชุดอักขระ `utf8mb4`)

| ไฟล์ | เนื้อหา | มีข้อมูลหรือไม่ |
| --- | --- | --- |
| `schema.sql` | โครงสร้างตาราง 5 ตาราง พร้อม index / foreign key / check constraint | **ไม่มีข้อมูล** (export ด้วย `--no-data`) |
| `seed.sql` | ข้อมูลตัวอย่างสำหรับ dev (หมวดหมู่ + ครุภัณฑ์ + วัสดุ อย่างละ 2 รายการ) | มีข้อมูลปลอม ไม่มีข้อมูลบุคคล |

## ตารางที่มีในระบบ

| ตาราง | ใช้ทำอะไร |
| --- | --- |
| `categories` | หมวดหมู่ แยกเป็น `ASSET` (ครุภัณฑ์) และ `SUPPLY` (วัสดุสิ้นเปลือง) |
| `inventory_assets` | ทะเบียนครุภัณฑ์ (ยืม–คืน) + คอลัมน์ `is_archived` สำหรับซ่อนรายการ |
| `supplies_stock` | สต็อกวัสดุสิ้นเปลือง + `minimum_quantity` |
| `borrow_return` | รายการยืม–คืนครุภัณฑ์ |
| `supplies_transactions` | ประวัติรับเข้า/เบิกออกของวัสดุ (`IN` / `OUT`) |

## 1) สร้างฐานข้อมูลและผู้ใช้

รันด้วยผู้ใช้ที่มีสิทธิ์ `CREATE` (โดยทั่วไปคือ `root`)

```sql
CREATE DATABASE assets_booking
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- ให้ backend (Express) ใช้งาน
CREATE USER 'assets_api'@'%' IDENTIFIED BY 'เปลี่ยนรหัสตรงนี้';
GRANT SELECT, INSERT, UPDATE, DELETE ON assets_booking.* TO 'assets_api'@'%';
FLUSH PRIVILEGES;
```

> **ทำไมต้องเป็น `'assets_api'@'%'` ไม่ใช่ `'assets_api'@'localhost'`**
> ถ้าใช้ `@'localhost'` ผู้ใช้จะเชื่อมต่อได้เฉพาะจากเครื่องเดียวกัน
> แต่ตัว backend ที่รันใน Docker จะเชื่อมมาจาก IP ของ Docker network (เช่น `172.17.0.1`)
> จึงต้องอนุญาตจาก host อื่นด้วย มิฉะนั้นจะได้ `Access denied for user 'assets_api'@'172.x.x.x'`

## 2) นำเข้าโครงสร้างตาราง

### Windows / PowerShell

PowerShell ไม่รองรับ `<` (redirection) จึงใช้ `source` ผ่าน `-e` แทน

```powershell
& 'C:\Program Files\MariaDB 10.6\bin\mariadb.exe' `
  --host=127.0.0.1 --port=3309 --user=root --password `
  --default-character-set=utf8mb4 `
  -e "source C:/path/to/vue-project/database/schema.sql"
```

### Git Bash / WSL / Linux / macOS

```sh
mariadb -h 127.0.0.1 -P 3309 -u root -p \
  --default-character-set=utf8mb4 \
  assets_booking < database/schema.sql
```

> ไฟล์ `schema.sql` ไม่มีคำสั่ง `CREATE DATABASE` / `USE` จึงต้องสร้าง DB (ข้อ 1) และระบุชื่อ DB (หรือใช้ `source` หลัง `USE`) เองก่อน

### Windows ที่ใช้ cmd

```bat
"C:\Program Files\MariaDB 10.6\bin\mariadb.exe" -h 127.0.0.1 -P 3309 -u root -p --default-character-set=utf8mb4 assets_booking < database\schema.sql
```

## 3) ใส่ข้อมูลตัวอย่าง (ไม่บังคับ)

```powershell
& 'C:\Program Files\MariaDB 10.6\bin\mariadb.exe' `
  --host=127.0.0.1 --port=3309 --user=assets_api --password `
  --default-character-set=utf8mb4 `
  -e "source C:/path/to/vue-project/database/seed.sql"
```

## 4) ตรวจว่าสำเร็จ

```powershell
& 'C:\Program Files\MariaDB 10.6\bin\mariadb.exe' `
  --host=127.0.0.1 --port=3309 --user=assets_api --password `
  -e "USE assets_booking; SHOW TABLES; SELECT COUNT(*) AS categories FROM categories;"
```

ต้องเห็นตาราง 5 ตาราง และถ้า import `seed.sql` แล้วจะมีหมวดหมู่ 7 รายการ

จากนั้นทดสอบระบบด้วย `http://localhost:3000/api/health` ต้องได้

```json
{ "api": "ok", "database": "ok" }
```

## 5) วิธี export schema ใหม่ (เมื่อแก้โครงสร้างตาราง)

สคริปต์ `schema.sql` ถูกสร้างด้วยคำสั่งนี้

```powershell
& 'C:\Program Files\MariaDB 10.6\bin\mysqldump.exe' `
  --host=127.0.0.1 --port=3309 --user=assets_api --password `
  --no-data --default-character-set=utf8mb4 `
  --skip-lock-tables --single-transaction --skip-triggers --no-tablespaces `
  --routines=0 --events=0 `
  --result-file="C:\path\to\vue-project\database\schema.sql" `
  assets_booking
```

คำอธิบาย flag ที่จำเป็น

| Flag | เหตุผล |
| --- | --- |
| `--no-data` | เอาเฉพาะโครงสร้าง ไม่เอาข้อมูลจริงออกมา (กันข้อมูลส่วนบุคคลหลุด) |
| `--skip-lock-tables`, `--single-transaction` | ผู้ใช้ทั่วไปมักไม่มีสิทธิ์ `LOCK TABLES` ถ้าไม่ใส่จะได้ error `1044 Access denied ... when using LOCK TABLES` |
| `--default-character-set=utf8mb4` | รักษาข้อความภาษาไทย |
| `--result-file` | **ห้ามใช้ `>` ของ PowerShell 5.1** เพราะไฟล์จะถูกเขียนเป็น UTF-16 และภาษาไทยเพี้ยน |
| `--skip-triggers`, `--routines=0`, `--events=0`, `--no-tablespaces` | ลดปัญหาเรื่องสิทธิ์ และกันคำสั่ง `DEFINER=` ของ root ติดมาทำให้ import ไม่ผ่าน |

## ⚠️ ข้อควรระวัง

- **ห้าม export ข้อมูลจริง (ไม่มี `--no-data`) ขึ้น GitHub** เพราะตาราง `borrow_return` และ `supplies_transactions` มีชื่อ, แผนก และ `*_cid` (เลขบัตรประชาชน) ของบุคลากรจริง
- ต้องสร้าง DB ด้วย collation `utf8mb4_unicode_ci` ให้ตรงกับที่ dump มา มิฉะนั้นการเรียง/เทียบข้อความไทยจะไม่เหมือนต้นฉบับ
- สิทธิ์ของ `assets_api` ที่ให้ไว้มีเพียง `SELECT, INSERT, UPDATE, DELETE` **ไม่รวม `CREATE` / `ALTER` / `INDEX`** จึง import `schema.sql` เองไม่ได้ ต้องให้ผู้ใช้ที่มีสิทธิ์สูงกว่าทำให้
