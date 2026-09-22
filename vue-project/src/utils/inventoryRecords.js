/**
 * ตัวช่วย normalize ข้อมูลที่รับมาจาก API/ฐานข้อมูลให้เป็นรูปแบบเดียว
 *
 * รองรับ:
 * - ตาราง inventory_assets ของ MariaDB
 * - ตาราง borrow_return ของ MariaDB
 * - API ที่ส่งค่า snake_case เช่น borrower_name, borrowed_at
 * - Vue/UI ที่ใช้งาน camelCase เช่น borrowerName, borrowedAt
 * - แบบฟอร์ม A6-1: ยืมออกนอกพื้นที่
 * - แบบฟอร์ม A6-2: ยืมภายในโรงพยาบาล
 */

/* =========================================================
   สถานะครุภัณฑ์และสถานะการยืม
   ========================================================= */

/**
 * สถานะที่ UI ใช้:
 * Available | Borrowed | Maintenance | Retired
 *
 * key คือค่าที่อาจพบจาก database/API/form
 */
const ASSET_STATUS_MAP = {
  AVAILABLE: 'Available',
  BORROWED: 'Borrowed',
  REPAIR: 'Maintenance',
  DISPOSED: 'Retired',

  // ค่าที่ API บางเวอร์ชันส่งมาแบบผสม
  BORROW: 'Borrowed',
  INUSE: 'Borrowed',
  IN_USE: 'Borrowed',
  MAINTENANCE: 'Maintenance',
  REPAIRING: 'Maintenance',
  RETIRED: 'Retired',
  ARCHIVED: 'Retired',
  DELETED: 'Retired',
  DISPOSE: 'Retired',
};

/**
 * สถานะการยืมที่ UI ใช้:
 * Active | Returned
 *
 * หมายเหตุ:
 * ตาราง borrow_return ของคุณไม่มี column status โดยตรง
 * จึงใช้ returned_at เป็นหลักในการดูว่าคืนแล้วหรือยัง
 */
const BORROW_STATUS_MAP = {
  ACTIVE: 'Active',
  BORROWED: 'Active',
  OPEN: 'Active',
  PENDING: 'Active',
  LENT: 'Active',
  RETURNED: 'Returned',
  CLOSED: 'Returned',
  COMPLETED: 'Returned',
  DONE: 'Returned',
};

/* =========================================================
   Form types A6-1 / A6-2
   ========================================================= */

export const OUT_OF_AREA_FORM_TYPE = 'OUT_OF_AREA';
export const IN_HOSPITAL_FORM_TYPE = 'IN_HOSPITAL';

const CARRIER_TOKENS = [
  'out of area',
  'outside',
  'off site',
  'offsite',
  'external',
  'field',
  'mobile',
  'outdoor',
  'นอกพื้นที่',
  'นอกสถานที่',
  'ออกนอก',
  'ออกหน่วย',
  'ภายนอก',
  'ต่างจังหวัด',
  'ภาคสนาม',
  'เคลื่อนที่',
];

const IN_HOSPITAL_TOKENS = [
  'in hospital',
  'inhouse',
  'in house',
  'on site',
  'onsite',
  'internal',
  'ภายใน',
  'ในโรงพยาบาล',
  'ในสถานที่',
  'ในพื้นที่',
];

/* =========================================================
   Helper functions
   ========================================================= */

/**
 * คืน object ว่างเมื่อ input ไม่ใช่ object
 */
const asRecord = (value) => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {}
);

/**
 * ตรวจว่าค่ามีข้อมูลจริง
 *
 * 0 และ false ถือว่าเป็นค่าที่มีข้อมูล
 */
const hasValue = (value) => (
  value !== null
  && value !== undefined
  && !(typeof value === 'string' && value.trim() === '')
);

/**
 * เลือกค่าตัวแรกที่มีข้อมูล
 *
 * @param {...any} values รายการค่าที่เป็นไปได้
 * @returns {any|null} ค่าแรกที่มีข้อมูล หรือ null
 */
const firstDefined = (...values) => {
  for (const value of values) {
    if (hasValue(value)) return value;
  }

  return null;
};

/**
 * แปลงค่าเป็นข้อความและตัด space หน้า/หลัง
 */
const toText = (value) => {
  const picked = firstDefined(value);

  if (picked === null) return '';

  return String(picked).trim();
};

/**
 * แปลงค่าเป็นตัวเลขแบบปลอดภัย
 */
const toNumber = (value, fallback = 0) => {
  const picked = firstDefined(value);

  if (picked === null) return fallback;

  const number = Number(picked);

  return Number.isFinite(number) ? number : fallback;
};

/**
 * แปลง boolean ที่ API อาจส่งเป็น 1/0, true/false, yes/no
 */
const toBoolean = (value, fallback = false) => {
  const picked = firstDefined(value);

  if (picked === null) return fallback;

  if (typeof picked === 'boolean') return picked;

  const text = String(picked).trim().toLowerCase();

  if (['1', 'true', 'yes', 'y', 'on', 'oui', 'ใช่'].includes(text)) {
    return true;
  }

  if (['0', 'false', 'no', 'n', 'off', 'non', 'ไม่'].includes(text)) {
    return false;
  }

  return fallback;
};

/**
 * แปลง date/time ให้อยู่ในรูปแบบ:
 *
 * YYYY-MM-DD
 * หรือ
 * YYYY-MM-DD HH:mm:ss
 *
 * ข้อมูล MariaDB DATETIME เช่น:
 * 2026-09-22 14:46:39
 *
 * จะถูกคืนกลับโดยไม่แปลง timezone
 */
export const toDateString = (value) => {
  const picked = firstDefined(value);

  if (picked === null) return '';

  if (picked instanceof Date) {
    return Number.isNaN(picked.getTime())
      ? ''
      : picked.toISOString().slice(0, 19);
  }

  if (typeof picked === 'number' && Number.isFinite(picked)) {
    const milliseconds = String(Math.trunc(Math.abs(picked))).length <= 10
      ? picked * 1000
      : picked;

    const date = new Date(milliseconds);

    return Number.isNaN(date.getTime())
      ? ''
      : date.toISOString().slice(0, 19);
  }

  const text = String(picked).trim();

  if (!text) return '';

  // กรณี API serializer เติม Z มา แต่เวลาใน DB เดิมเป็น Asia/Bangkok
  const withoutUtcMark = text.endsWith('Z')
    ? text.slice(0, -1)
    : text;

  const match = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}(?::\d{2})?))?/
    .exec(withoutUtcMark);

  if (!match) return '';

  return match[2]
    ? `${match[1]} ${match[2]}`
    : match[1];
};

/**
 * คำนวณจำนวนวันระหว่างวันเริ่มต้นและวันสิ้นสุด
 */
const calculateDays = (from, to) => {
  if (!from || !to) return 0;

  const start = new Date(from.replace(' ', 'T')).getTime();
  const end = new Date(to.replace(' ', 'T')).getTime();

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return 0;
  }

  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.max(
    0,
    Math.ceil((end - start) / millisecondsPerDay),
  );
};

/* =========================================================
   Asset status functions
   ========================================================= */

/**
 * แปลงสถานะใน DB/API ให้เป็นชื่อสถานะที่ UI ใช้
 *
 * @param {*} status เช่น AVAILABLE, BORROWED, REPAIR
 * @returns {string} Available | Borrowed | Maintenance | Retired
 */
export const uiStatusFromDb = (status) => {
  const text = toText(status);

  if (!text) return '';

  const key = text.replace(/[\s-]+/g, '_').toUpperCase();

  return ASSET_STATUS_MAP[key] || text;
};

/**
 * แปลงสถานะ UI กลับเป็นค่าที่ MariaDB inventory_assets.status ใช้
 *
 * @param {*} status เช่น Available, Borrowed
 * @returns {string} AVAILABLE | BORROWED | REPAIR | DISPOSED
 */
export const dbStatusFromUi = (status) => {
  const uiStatus = uiStatusFromDb(status);

  const reverseMap = {
    Available: 'AVAILABLE',
    Borrowed: 'BORROWED',
    Maintenance: 'REPAIR',
    Retired: 'DISPOSED',
  };

  return reverseMap[uiStatus] || uiStatus;
};

/* =========================================================
   Form type A6-1 / A6-2
   ========================================================= */

/**
 * ระบุชนิดของแบบฟอร์มยืม
 *
 * A6-1:
 * OUT_OF_AREA = ยืมออกนอกพื้นที่โรงพยาบาล
 *
 * A6-2:
 * IN_HOSPITAL = ยืมภายในโรงพยาบาล
 *
 * ปกติระบบใหม่ควรมี record.form_type มาอยู่แล้ว
 * ฟังก์ชันนี้ใช้เดาสำหรับข้อมูลเก่าที่ยังไม่มี form_type
 */
export const normalizeBorrowFormType = (recordInput) => {
  const record = asRecord(recordInput);

  const placeText = [
    record.borrowFormType,
    record.formType,
    record.form_type,
    record.borrowType,
    record.borrow_type,
    record.purpose,
    record.jobTask,
    record.job_task,
    record.location,
    record.useLocation,
    record.use_location,
    record.outOfAreaNote,
    record.out_of_area_note,
    record.note,
  ]
    .filter(hasValue)
    .join(' ')
    .toLowerCase();

  if (CARRIER_TOKENS.some((token) => placeText.includes(token))) {
    return OUT_OF_AREA_FORM_TYPE;
  }

  if (IN_HOSPITAL_TOKENS.some((token) => placeText.includes(token))) {
    return IN_HOSPITAL_FORM_TYPE;
  }

  /**
   * สำคัญ:
   * ไม่ใช้ "มีเบอร์โทรศัพท์" เป็นเงื่อนไขของ OUT_OF_AREA
   * เพราะ A6-2 หรือแบบยืมภายในก็ต้องมีเบอร์โทรได้
   */

  // หากมี note ระบุการออกนอกพื้นที่ชัดเจน ให้ใช้ A6-1
  if (toText(firstDefined(
    record.outOfAreaNote,
    record.out_of_area_note,
    record.computerUsageDetail,
    record.computer_usage_detail,
  ))) {
    return OUT_OF_AREA_FORM_TYPE;
  }

  // default ของ table borrow_return คือ IN_HOSPITAL
  return IN_HOSPITAL_FORM_TYPE;
};

/* =========================================================
   inventory_assets normalizer
   ========================================================= */

/**
 * สร้างข้อมูลครุภัณฑ์ที่ normalize แล้ว
 *
 * รองรับ:
 * - inventory_assets จาก MariaDB
 * - API snake_case
 * - Vue camelCase
 *
 * @param {object} assetInput ระเบียน inventory_assets หรือ asset จาก API
 * @returns {object} object ครุภัณฑ์ที่ component ใช้ได้ทันที
 */
export const normalizeAsset = (assetInput) => {
  const asset = asRecord(assetInput);

  const assetCode = toText(firstDefined(
    asset.assetCode,
    asset.asset_code,
    asset.code,
    asset.inventoryCode,
    asset.inventory_code,
  ));

  const name = toText(firstDefined(
    asset.name,
    asset.assetName,
    asset.asset_name,
    asset.itemName,
    asset.item_name,
  ));

  const hasCategoryId = hasValue(asset.categoryId)
    || hasValue(asset.category_id);

  const serialNumber = toText(firstDefined(
    asset.serialNumber,
    asset.serial_number,
  ));

  const statusDb = toText(firstDefined(
    asset.status,
    asset.assetStatus,
    asset.asset_status,
  )).toUpperCase();

  const archivedAt = toDateString(firstDefined(
    asset.archivedAt,
    asset.archived_at,
  ));

  return {
    ...asset,

    // ---------- Primary key ----------
    id: toNumber(asset.id),

    // ---------- รหัสและชื่อครุภัณฑ์ ----------
    assetCode: assetCode || name,
    asset_code: assetCode || name,

    name: name || assetCode,
    assetName: name || assetCode,
    asset_name: name || assetCode,

    // ---------- หมวดหมู่ ----------
    categoryId: hasCategoryId
      ? toNumber(firstDefined(asset.categoryId, asset.category_id))
      : null,

    category_id: hasCategoryId
      ? toNumber(firstDefined(asset.categoryId, asset.category_id))
      : null,

    // ---------- รายละเอียด ----------
    brand: toText(asset.brand),
    model: toText(asset.model),

    serialNumber,
    serial_number: serialNumber,

    location: toText(firstDefined(
      asset.location,
      asset.department,
    )),

    department: toText(firstDefined(
      asset.department,
      asset.location,
    )),

    note: toText(firstDefined(
      asset.note,
      asset.remark,
      asset.remarks,
    )),

    // ---------- สถานะ ----------
    status: uiStatusFromDb(statusDb),
    statusDb,

    // ---------- ฟิลด์เพิ่มเติมที่อาจพบจาก API ----------
    repairTicket: toText(firstDefined(
      asset.repairTicket,
      asset.repair_ticket,
      asset.repairTicketNo,
      asset.repair_ticket_no,
      asset.workOrderNo,
      asset.work_order_no,
    )),

    computerSetType: toText(firstDefined(
      asset.computerSetType,
      asset.computer_set_type,
      asset.deviceSetType,
      asset.device_set_type,
    )),

    // inventory_assets ปัจจุบันไม่มี quantity ใน schema
    // ถ้า API ส่งมาก็ใช้ได้; ถ้าไม่มีให้เป็น 0
    quantity: toNumber(firstDefined(
      asset.quantity,
      asset.totalQuantity,
      asset.total_quantity,
    ), 0),

    // inventory_assets ปัจจุบันไม่มี unit ใน schema
    // ฟอร์มจะใช้ "เครื่อง" เป็นค่า default
    unit: toText(asset.unit) || 'เครื่อง',

    borrowedBy: toText(firstDefined(
      asset.borrowedBy,
      asset.borrowed_by,
      asset.borrowerName,
      asset.borrower_name,
    )),

    borrowedByName: toText(firstDefined(
      asset.borrowedByName,
      asset.borrowed_by_name,
      asset.borrower_name,
    )),

    // ---------- Archive ----------
    archivedAt,

    isArchived: toBoolean(
      firstDefined(asset.isArchived, asset.is_archived),
      Boolean(archivedAt),
    ),

    is_archived: toBoolean(
      firstDefined(asset.isArchived, asset.is_archived),
      Boolean(archivedAt),
    ),

    // ---------- Audit ----------
    createdAt: toDateString(firstDefined(
      asset.createdAt,
      asset.created_at,
    )),

    updatedAt: toDateString(firstDefined(
      asset.updatedAt,
      asset.updated_at,
    )),
  };
};

/* =========================================================
   borrow_return normalizer
   ========================================================= */

/**
 * สร้างข้อมูลการยืม–คืนที่ normalize แล้ว
 *
 * ตาราง borrow_return ของ MariaDB:
 *
 * id
 * asset_id
 * quantity
 * borrower_cid
 * borrower_name
 * borrower_phone
 * borrower_position
 * department
 * purpose
 * use_location
 * form_type
 * out_of_area_note
 * borrowed_at
 * due_at
 * returned_at
 * received_by_cid
 * return_note
 * created_at
 *
 * @param {object} recordInput ข้อมูล borrow_return จาก API/DB
 * @param {object} [options] ข้อมูล fallback ของครุภัณฑ์
 * @param {string} [options.assetCode] รหัสครุภัณฑ์
 * @param {string} [options.assetName] ชื่อครุภัณฑ์
 * @param {number|string} [options.assetId] ID ครุภัณฑ์
 * @returns {object} ข้อมูลพร้อมใช้ใน Vue/UI/Print form
 */
export const normalizeBorrow = (recordInput, options = {}) => {
  const record = asRecord(recordInput);

  /**
   * รองรับได้ทั้ง API ที่ส่ง asset nested object:
   *
   * {
   *   ...borrow,
   *   asset: { asset_code, name, brand, model }
   * }
   *
   * และ API ที่ SQL JOIN มาเป็น flat object:
   *
   * {
   *   ...borrow,
   *   asset_code,
   *   asset_name
   * }
   */
  const asset = asRecord(
    record.asset
    || record.assetInfo
    || record.asset_info,
  );

  const hasAssetId = hasValue(record.assetId)
    || hasValue(record.asset_id);

  const assetIdFallback = hasValue(options.assetId)
    ? options.assetId
    : null;

  // ---------- วันและเวลา ----------
  const borrowedAt = toDateString(firstDefined(
    record.borrowedAt,
    record.borrowed_at,
    record.borrowDate,
    record.borrow_date,
    record.startDate,
    record.start_date,
    record.startAt,
    record.start_at,
    record.borrowedDate,
    record.borrowed_date,
  ));

  const dueAt = toDateString(firstDefined(
    record.dueAt,
    record.due_at,
    record.dueDate,
    record.due_date,
    record.returnDueDate,
    record.return_due_date,
    record.expectedReturnDate,
    record.expected_return_date,
    record.endDate,
    record.end_date,
    record.endAt,
    record.end_at,
  ));

  const returnedAt = toDateString(firstDefined(
    record.returnedAt,
    record.returned_at,
    record.returnDate,
    record.return_date,
    record.returnedDate,
    record.returned_date,
    record.actualReturnDate,
    record.actual_return_date,
  ));

  // ---------- สถานะการยืม ----------
  const statusText = toText(firstDefined(
    record.status,
    record.borrowStatus,
    record.borrow_status,
  ))
    .replace(/[\s-]+/g, '_')
    .toUpperCase();

  /**
   * borrow_return ไม่มี status:
   * - returned_at มีค่า = คืนแล้ว
   * - returned_at ว่าง = กำลังยืมอยู่
   */
  const isReturned = Boolean(returnedAt)
    || BORROW_STATUS_MAP[statusText] === 'Returned';

  // ---------- ข้อมูลครุภัณฑ์ ----------
  const assetCode = toText(firstDefined(
    record.assetCode,
    record.asset_code,
    asset.assetCode,
    asset.asset_code,
    options.assetCode,
  ));

  const assetName = toText(firstDefined(
    record.assetName,
    record.asset_name,
    asset.name,
    asset.assetName,
    asset.asset_name,
    options.assetName,
  ));

  const hasQuantity = hasValue(record.quantity)
    || hasValue(record.borrowQuantity)
    || hasValue(record.borrow_quantity)
    || hasValue(record.qty);

  const quantity = toNumber(firstDefined(
    record.quantity,
    record.borrowQuantity,
    record.borrow_quantity,
    record.qty,
  ), 1);

  // ---------- ข้อมูลผู้ยืม ----------
  const borrowerCid = toText(firstDefined(
    record.borrowerCid,
    record.borrower_cid,
  ));

  const borrowerName = toText(firstDefined(
    record.borrowerName,
    record.borrower_name,
    record.borrowedByName,
    record.borrowed_by_name,
    record.borrowedBy,
    record.borrowed_by,
  ));

  const borrowerPhone = toText(firstDefined(
    record.borrowerPhone,
    record.borrower_phone,
    record.phone,
    record.phoneNumber,
    record.phone_number,
    record.contactPhone,
    record.contact_phone,
    record.tel,
  ));

  const borrowerPosition = toText(firstDefined(
    record.borrowerPosition,
    record.borrower_position,
    record.position,
  ));

  const department = toText(firstDefined(
    record.department,
    record.departmentName,
    record.department_name,
    record.borrowerDepartment,
    record.borrower_department,
    record.section,
    record.division,
  ));

  // ---------- จุดประสงค์และสถานที่ ----------
  const purpose = toText(firstDefined(
    record.purpose,
    record.jobTask,
    record.job_task,
    record.objective,
    record.reason,
  ));

  const useLocation = toText(firstDefined(
    record.useLocation,
    record.use_location,
    record.location,
  ));

  // ---------- A6-1 / A6-2 ----------
  const rawFormType = toText(firstDefined(
    record.borrowFormType,
    record.formType,
    record.form_type,
  ));

  const formTypeCandidate = rawFormType
    ? rawFormType.replace(/[\s-]+/g, '_').toUpperCase()
    : normalizeBorrowFormType(record);

  const formType = formTypeCandidate === OUT_OF_AREA_FORM_TYPE
    ? OUT_OF_AREA_FORM_TYPE
    : IN_HOSPITAL_FORM_TYPE;

  const outOfAreaNote = toText(firstDefined(
    record.outOfAreaNote,
    record.out_of_area_note,
    record.computerUsageDetail,
    record.computer_usage_detail,
  ));

  // ---------- ข้อมูลคืน ----------
  const receivedByCid = toText(firstDefined(
    record.receivedByCid,
    record.received_by_cid,
  ));

  const returnNote = toText(firstDefined(
    record.returnNote,
    record.return_note,
  ));

  // ---------- วันที่สร้าง ----------
  const createdAt = toDateString(firstDefined(
    record.createdAt,
    record.created_at,
  ));

  return {
    ...record,

    // ======================================================
    // ID และครุภัณฑ์
    // ======================================================

    id: toNumber(record.id),

    assetId: hasAssetId
      ? toNumber(firstDefined(record.assetId, record.asset_id), null)
      : (
        assetIdFallback === null
          ? null
          : toNumber(assetIdFallback, null)
      ),

    // alias snake_case เพื่อรองรับ component/API เดิม
    asset_id: hasAssetId
      ? toNumber(firstDefined(record.assetId, record.asset_id), null)
      : (
        assetIdFallback === null
          ? null
          : toNumber(assetIdFallback, null)
      ),

    assetCode,
    asset_code: assetCode,

    assetName,
    asset_name: assetName,

    quantity: hasQuantity ? quantity : 1,

    // ======================================================
    // ผู้ยืม
    // ======================================================

    borrowerCid,
    borrower_cid: borrowerCid,

    borrowerName,
    borrower_name: borrowerName,

    borrowerPhone,
    borrower_phone: borrowerPhone,

    // alias รองรับ component เดิม
    phone: borrowerPhone,

    borrowerPosition,
    borrower_position: borrowerPosition,

    department,
    departmentName: department,
    department_name: department,

    // ======================================================
    // รายละเอียดการยืม
    // ======================================================

    purpose,

    jobTask: toText(firstDefined(
      record.jobTask,
      record.job_task,
      record.purpose,
    )),

    useLocation,
    use_location: useLocation,

    // alias สำหรับ component เดิม
    location: useLocation || department,

    // ======================================================
    // ประเภทเอกสาร
    // ======================================================

    formType,
    form_type: formType,

    outOfAreaNote,
    out_of_area_note: outOfAreaNote,

    // ======================================================
    // วันและเวลา
    // ======================================================

    borrowedAt,
    borrowed_at: borrowedAt,

    dueAt,
    due_at: dueAt,

    returnedAt,
    returned_at: returnedAt,

    // alias สำหรับ component ที่เรียกชื่อวันต่างกัน
    borrowDate: borrowedAt,
    dueDate: dueAt,
    returnedDate: returnedAt,

    // ======================================================
    // สถานะ
    // ======================================================

    status: isReturned ? 'Returned' : 'Active',
    isReturned,

    // ======================================================
    // การคำนวณ
    // ======================================================

    totalDays: calculateDays(borrowedAt, dueAt),

    lateDays: isReturned && dueAt
      ? calculateDays(dueAt, returnedAt)
      : 0,

    // ======================================================
    // ข้อมูลการคืน
    // ======================================================

    receivedByCid,
    received_by_cid: receivedByCid,

    returnNote,
    return_note: returnNote,

    // ======================================================
    // Audit
    // ======================================================

    createdAt,
    created_at: createdAt,
  };
};

export default normalizeBorrow;