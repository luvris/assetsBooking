export const CALENDAR_TIME_ZONE = 'Asia/Bangkok';

const DATE_DAY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: CALENDAR_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const DAY_LABELS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

const MONTH_LABELS = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];

// กันข้อมูลผิดปกติที่ทำให้ช่วงการยืมยาวเกินจริง
const MAX_RANGE_DAYS = 366;

const pad2 = (value) => String(value).padStart(2, '0');

/**
 * แปลงค่าจาก API เป็น Date
 * - ถ้าเป็น 'YYYY-MM-DD' หรือ 'YYYY-MM-DD HH:mm:ss' ให้ตีความเป็นเวลาไทย (+07:00) โดยตรง
 * - ถ้าลงท้ายด้วย 'Z' มักเป็น serializer ที่แปลงเวลาไทยเป็น UTC ทำให้เพี้ยน +7 ชั่วโมง
 *   จึงตัด 'Z' ออกแล้วตีความเป็นเวลาไทย
 */
const parseDateValue = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  let text = String(value).trim();

  if (!text) return null;

  if (text.endsWith('Z')) {
    text = text.slice(0, -1);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    text = `${text} 00:00:00`;
  }

  const normalized = text.includes('T') ? text : text.replace(' ', 'T');
  const hasOffset = /[+-]\d{2}:\d{2}$/.test(normalized);
  const date = new Date(hasOffset ? normalized : `${normalized}+07:00`);

  return Number.isNaN(date.getTime()) ? null : date;
};

const hasDayKey = (dateKey) => /^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ''));

const toDateKey = (date) => DATE_DAY_FORMATTER.format(date);

/** วันที่ของวันนี้ (เขตเวลาไทย) ในรูปแบบ YYYY-MM-DD */
export const todayDateKey = (now = new Date()) => {
  const date = now instanceof Date ? now : new Date(now);

  return Number.isNaN(date.getTime()) ? '' : toDateKey(date);
};

/** แปลง 'YYYY-MM-DD' เป็น Date อ้างอิงเที่ยงวันเขตเวลาไทย (ปลอดภัยจาก DST/offset) */
export const dateKeyToDate = (dateKey) => {
  if (!hasDayKey(dateKey)) return null;

  const date = new Date(`${String(dateKey).trim()}T12:00:00+07:00`);

  return Number.isNaN(date.getTime()) ? null : date;
};

/** เลื่อนวันที่จาก dateKey ไป deltaDays วัน แล้วคืนค่าเป็น dateKey */
export const shiftDateKey = (dateKey, deltaDays) => {
  const date = dateKeyToDate(dateKey);

  if (!date) return '';

  date.setUTCDate(date.getUTCDate() + Number(deltaDays || 0));

  return toDateKey(date);
};

/** รายชื่อวัน (dateKey) ของเดือน YYYY-MM */
export const monthDateKeys = (monthKey) => {
  const match = /^(\d{4})-(\d{2})$/.exec(String(monthKey || '').trim());

  if (!match) return [];

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (month < 1 || month > 12) return [];

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return Array.from(
    { length: daysInMonth },
    (_, index) => `${year}-${pad2(month)}-${pad2(index + 1)}`,
  );
};

/** เดือนของวันนี้ (เขตเวลาไทย) ในรูปแบบ YYYY-MM */
export const todayMonthKey = (now = new Date()) => todayDateKey(now).slice(0, 7);

/** เพิ่ม/ลดเดือนจาก monthKey แล้วคืนค่าเป็น monthKey */
export const shiftMonthKey = (monthKey, deltaMonths) => {
  const match = /^(\d{4})-(\d{2})$/.exec(String(monthKey || '').trim());

  if (!match) return '';

  const totalMonths = Number(match[1]) * 12
    + (Number(match[2]) - 1)
    + Number(deltaMonths || 0);

  const year = Math.floor(totalMonths / 12);
  const month = ((totalMonths % 12) + 12) % 12 + 1;

  return `${year}-${pad2(month)}`;
};

/** ชื่อเดือนภาษาไทยพร้อมปี พ.ศ. เช่น "กันยายน 2569" */
export const formatMonthLabel = (monthKey) => {
  const match = /^(\d{4})-(\d{2})$/.exec(String(monthKey || '').trim());

  if (!match) return '';

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (month < 1 || month > 12) return '';

  return `${MONTH_LABELS[month - 1]} ${year + 543}`;
};

/** วันในสัปดาห์แบบไทยย่อ เริ่มจากวันอาทิตย์ */
export const weekdayLabels = () => [...DAY_LABELS];

/**
 * สร้างช่อง (cell) ทั้งหมดของเดือน สำหรับแสดงเป็นตาราง 7 คอลัมน์
 * เติมช่องว่างหัว/ท้ายเดือนด้วย cell ที่ isCurrentMonth = false
 */
export const buildMonthGrid = (monthKey) => {
  const keys = monthDateKeys(monthKey);

  if (keys.length === 0) return [];

  const firstDate = dateKeyToDate(keys[0]);
  const leadingBlanks = firstDate ? firstDate.getUTCDay() : 0;
  const totalCells = Math.ceil((leadingBlanks + keys.length) / 7) * 7;
  const today = todayDateKey();

  const cells = [];

  for (let index = 0; index < leadingBlanks; index += 1) {
    cells.push({
      dateKey: '',
      day: null,
      isCurrentMonth: false,
      isToday: false,
    });
  }

  keys.forEach((dateKey, index) => {
    cells.push({
      dateKey,
      day: index + 1,
      isCurrentMonth: true,
      isToday: dateKey === today,
    });
  });

  while (cells.length < totalCells) {
    cells.push({
      dateKey: '',
      day: null,
      isCurrentMonth: false,
      isToday: false,
    });
  }

  return cells;
};

const isWithinRange = (dateKey, startKey, endKey) => (
  Boolean(dateKey) && Boolean(startKey) && Boolean(endKey)
  && dateKey >= startKey
  && dateKey <= endKey
);

const emptyBucketMap = () => ({});

/**
 * สร้าง index ของการยืมรายวัน จากช่วงการยืมที่มีในระบบ
 *
 * @param {Array} records รายการยืม (ต้องมี borrowedAt, dueAt, returnedAt)
 * @returns {{
 *   events: Array<Object>,
 *   listByDate: Object<string, Array<Object>>,
 *   activeByDateList: Object<string, Array<Object>>,
 *   pickedUpByDateList: Object<string, Array<Object>>,
 *   dueSoonByDateList: Object<string, Array<Object>>,
 *   range: { firstDateKey: string, lastDateKey: string },
 *   skippedCount: number,
 * }}
 */
export const buildBorrowCalendarIndex = (records) => {
  const list = Array.isArray(records) ? records : [];

  const events = [];
  const listByDate = emptyBucketMap();
  const activeByDateList = emptyBucketMap();
  const pickedUpByDateList = emptyBucketMap();
  const dueSoonByDateList = emptyBucketMap();

  const todayKey = todayDateKey();
  const dueSoonLimitKey = shiftDateKey(todayKey, 3);

  let skippedCount = 0;
  let firstDateKey = '';
  let lastDateKey = '';

  list.forEach((record, index) => {
    const startDate = parseDateValue(record?.borrowedAt);
    const startKey = startDate ? toDateKey(startDate) : '';

    if (!startKey) {
      skippedCount += 1;
      return;
    }

    const returnedAt = parseDateValue(record?.returnedAt);
    const dueAt = parseDateValue(record?.dueAt);
    const isReturned = Boolean(returnedAt);

    const dueKey = dueAt ? toDateKey(dueAt) : '';
    const returnedKey = returnedAt ? toDateKey(returnedAt) : '';

    // ช่วงที่แสดงบนปฏิทิน: วันที่ยืม -> (วันที่คืนจริง หรือ วันครบกำหนด)
    const rawEndKey = returnedKey || dueKey;
    const endKey = rawEndKey && rawEndKey > startKey ? rawEndKey : startKey;

    const dayKeys = [];
    let cursorKey = startKey;

    while (cursorKey && cursorKey <= endKey && dayKeys.length < MAX_RANGE_DAYS) {
      dayKeys.push(cursorKey);

      const nextKey = shiftDateKey(cursorKey, 1);

      if (!nextKey || nextKey <= cursorKey) break;

      cursorKey = nextKey;
    }

    const event = {
      id: record?.id ?? `borrow-${index}`,
      record,
      assetId: record?.assetId ?? null,
      assetName: record?.assetName || '',
      assetCode: record?.assetCode || '',
      borrowerName: record?.borrowerName || '',
      department: record?.department || '',
      purpose: record?.purpose || '',
      startKey,
      endKey,
      dueKey: dueKey || endKey,
      returnedKey,
      isReturned,
      isOverdue: !isReturned && Boolean(dueKey) && dueKey < todayKey,
      dayKeys,
      totalDays: dayKeys.length,
    };

    events.push(event);

    if (!firstDateKey || startKey < firstDateKey) firstDateKey = startKey;
    if (!lastDateKey || endKey > lastDateKey) lastDateKey = endKey;

    dayKeys.forEach((dateKey) => {
      (listByDate[dateKey] ||= []).push(event);

      // วันที่ยังไม่คืน = วันนั้นเป็นเจ้าของครุภัณฑ์อยู่
      if (!isReturned && isWithinRange(dateKey, startKey, endKey)) {
        (activeByDateList[dateKey] ||= []).push(event);
      }

      // วันแรกของช่วง = วันที่รับครุภัณฑ์ไป (ไม่แสดงถ้าเป็นวันในอนาคต)
      if (dateKey === startKey && (!todayKey || dateKey <= todayKey)) {
        (pickedUpByDateList[dateKey] ||= []).push(event);
      }

      // ใกล้ถึงกำหนดคืน: วันครบกำหนดอยู่ในช่วงวันนี้..+3 วัน และยังไม่คืน
      if (!isReturned && dueKey && dateKey === dueKey
        && dateKey >= todayKey && dateKey <= dueSoonLimitKey) {
        (dueSoonByDateList[dateKey] ||= []).push(event);
      }
    });
  });

  return {
    events,
    listByDate,
    activeByDateList,
    pickedUpByDateList,
    dueSoonByDateList,
    range: { firstDateKey, lastDateKey },
    skippedCount,
  };
};

export default buildBorrowCalendarIndex;
