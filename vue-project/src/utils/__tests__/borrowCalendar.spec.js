import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildBorrowCalendarIndex,
  buildMonthGrid,
  dateKeyToDate,
  formatMonthLabel,
  monthDateKeys,
  shiftDateKey,
  shiftMonthKey,
  todayDateKey,
  todayMonthKey,
  weekdayLabels,
} from '../borrowCalendar.js';

// ตรึง "วันนี้" ให้เป็น 16 กันยายน 2026 (เวลาไทย) เพื่อให้ผลทดสอบคงที่
const FIXED_NOW = new Date('2026-09-16T10:00:00+07:00');

const freezeToday = () => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
};

/** วันนี้แบบ dateKey ของเวลาที่กำหนด (คำนวณตรง ๆ ไม่พึ่ง fake timers) */
const dateKeyOf = (value) => {
  const date = value;

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
};

const bangkokDateKey = (isoString) => {
  const shifted = new Date(new Date(isoString).getTime() + 7 * 60 * 60 * 1000);

  return dateKeyOf(shifted);
};

const borrowRecord = (overrides = {}) => ({
  id: 1,
  assetId: 10,
  assetCode: 'IT-001',
  assetName: 'โน้ตบุ๊ก Dell',
  borrowerName: 'สมชาย ใจดี',
  department: 'ฝ่ายคอมพิวเตอร์',
  purpose: 'ออกหน่วยบริการ',
  borrowedAt: '2026-09-10 09:00:00',
  dueAt: '2026-09-12 17:00:00',
  returnedAt: null,
  ...overrides,
});

describe('borrowCalendar utility', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('date helpers', () => {
    it('todayDateKey คืนค่าวันที่ตามเขตเวลาไทย', () => {
      // 22:30 UTC ของวันที่ 15 = 05:30 ของวันที่ 16 ตามเวลาไทย
      expect(todayDateKey(new Date('2026-09-15T22:30:00Z'))).toBe('2026-09-16');
      expect(todayDateKey(new Date('2026-09-15T10:00:00Z'))).toBe('2026-09-15');
    });

    it('todayMonthKey คืนค่าเดือนตามเขตเวลาไทย', () => {
      expect(todayMonthKey(new Date('2026-09-30T20:00:00Z'))).toBe('2026-10');
    });

    it('dateKeyToDate อ่านวันที่เป็นเวลาไทยเที่ยงวัน', () => {
      const date = dateKeyToDate('2026-09-16');

      expect(date).not.toBeNull();
      expect(date.toISOString()).toBe('2026-09-16T05:00:00.000Z');
      expect(dateKeyToDate('ไม่ใช่วันที่')).toBeNull();
    });

    it('shiftDateKey ข้ามเดือน/ข้ามปีได้ถูกต้อง', () => {
      expect(shiftDateKey('2026-09-30', 1)).toBe('2026-10-01');
      expect(shiftDateKey('2026-01-01', -1)).toBe('2025-12-31');
      expect(shiftDateKey('2026-12-31', 1)).toBe('2027-01-01');
      expect(shiftDateKey('bad-key', 1)).toBe('');
    });

    it('monthDateKeys คืนจำนวนวันของเดือน และเดือนกุมภาพันธ์ปีอธิกสุรทิน', () => {
      expect(monthDateKeys('2026-09')).toHaveLength(30);
      expect(monthDateKeys('2026-02')).toHaveLength(28);
      expect(monthDateKeys('2024-02')).toHaveLength(29);
      expect(monthDateKeys('2026-13')).toEqual([]);
      expect(monthDateKeys('')).toEqual([]);
    });

    it('shiftMonthKey เดินหน้า/ถอยหลังข้ามปีได้', () => {
      expect(shiftMonthKey('2026-09', 1)).toBe('2026-10');
      expect(shiftMonthKey('2026-01', -1)).toBe('2025-12');
      expect(shiftMonthKey('2026-12', 1)).toBe('2027-01');
      expect(shiftMonthKey('bad', 1)).toBe('');
    });

    it('formatMonthLabel แสดงเดือนไทยและปี พ.ศ.', () => {
      expect(formatMonthLabel('2026-09')).toBe('กันยายน 2569');
      expect(formatMonthLabel('2026-01')).toBe('มกราคม 2569');
      expect(formatMonthLabel('bad')).toBe('');
    });

    it('weekdayLabels เริ่มจากวันอาทิตย์และมี 7 วัน', () => {
      expect(weekdayLabels()).toEqual(['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']);
    });
  });

  describe('buildMonthGrid', () => {
    it('สร้างตาราง 7 คอลัมน์ และเติมช่องว่างหัว/ท้ายเดือน', () => {
      const cells = buildMonthGrid('2026-09');

      // 1 ก.ย. 2026 เป็นวันอังคาร -> มีช่องว่าง 2 ช่อง (อา., จ.)
      expect(cells.length % 7).toBe(0);
      expect(cells[0]).toEqual({
        dateKey: '', day: null, isCurrentMonth: false, isToday: false,
      });
      expect(cells[2].dateKey).toBe('2026-09-01');
      expect(cells[2].day).toBe(1);
      expect(cells[2].isCurrentMonth).toBe(true);

      const currentMonthCells = cells.filter(cell => cell.isCurrentMonth);
      expect(currentMonthCells).toHaveLength(30);
      expect(currentMonthCells[29].dateKey).toBe('2026-09-30');
    });

    it('ทำเครื่องหมาย isToday ให้ช่องของวันนี้', () => {
      freezeToday();

      const cells = buildMonthGrid('2026-09');
      const todayCells = cells.filter(cell => cell.isToday);

      expect(todayCells).toHaveLength(1);
      expect(todayCells[0].dateKey).toBe('2026-09-16');
    });

    it('คืนค่า [] เมื่อรูปแบบเดือนไม่ถูกต้อง', () => {
      expect(buildMonthGrid('2026/09')).toEqual([]);
    });
  });

  describe('buildBorrowCalendarIndex', () => {
    it('กระจายช่วงการยืมออกเป็นรายวันตามจำนวนวันจริง', () => {
      const { events, listByDate } = buildBorrowCalendarIndex([borrowRecord()]);

      const [event] = events;

      expect(event.dayKeys).toEqual([
        '2026-09-10',
        '2026-09-11',
        '2026-09-12',
      ]);
      expect(event.totalDays).toBe(3);
      expect(event.returnedKey).toBe('');
      expect(event.isReturned).toBe(false);

      expect(listByDate['2026-09-10']).toHaveLength(1);
      expect(listByDate['2026-09-12']).toHaveLength(1);
      expect(listByDate['2026-09-13']).toBeUndefined();
    });

    it('เก็บหลายรายการที่ยืมวันเดียวกันไว้ด้วยกัน (ใครยืมวันไหน)', () => {
      const { listByDate } = buildBorrowCalendarIndex([
        borrowRecord({ id: 1, borrowerName: 'สมชาย' }),
        borrowRecord({ id: 2, borrowerName: 'สมหญิง' }),
      ]);

      const sameDay = listByDate['2026-09-11'];

      expect(sameDay).toHaveLength(2);
      expect(sameDay.map(item => item.borrowerName)).toEqual(['สมชาย', 'สมหญิง']);
    });

    it('ใช้ช่วงถึงวันที่คืนจริง เมื่อคืนก่อนกำหนด', () => {
      const { events, listByDate } = buildBorrowCalendarIndex([
        borrowRecord({
          borrowedAt: '2026-09-10 09:00:00',
          dueAt: '2026-09-20 17:00:00',
          returnedAt: '2026-09-11 15:00:00',
        }),
      ]);

      expect(events[0].endKey).toBe('2026-09-11');
      expect(listByDate['2026-09-12']).toBeUndefined();
    });

    it('กันไม่ให้วันที่คืนจริงที่กรอกก่อนวันยืมทำให้ช่วงติดลบ', () => {
      const { events } = buildBorrowCalendarIndex([
        borrowRecord({
          borrowedAt: '2026-09-10 09:00:00',
          dueAt: '2026-09-12 17:00:00',
          returnedAt: '2026-09-09 09:00:00',
        }),
      ]);

      expect(events[0].endKey).toBe('2026-09-10');
      expect(events[0].totalDays).toBe(1);
    });

    it('ตีความ dueAt ที่ลงท้ายด้วย Z เป็นเวลาไทย (ไม่เพี้ยน +7 ชั่วโมง)', () => {
      const { events } = buildBorrowCalendarIndex([
        borrowRecord({
          borrowedAt: '2026-09-10T09:00:00.000Z',
          dueAt: '2026-09-10T16:00:00.000Z',
          returnedAt: null,
        }),
      ]);

      expect(events[0].startKey).toBe('2026-09-10');
      expect(events[0].dueKey).toBe('2026-09-10');
      expect(events[0].totalDays).toBe(1);
    });

    it('จัดกลุ่มตามสถานะของแต่ละวัน (รับไป/ยังไม่คืน/ใกล้ครบกำหนด)', () => {
      freezeToday();

      const { activeByDateList, pickedUpByDateList, dueSoonByDateList } =
        buildBorrowCalendarIndex([
          borrowRecord({ dueAt: '2026-09-18 17:00:00' }),
        ]);

      // 16 ก.ย. = วันนี้ -> ยังไม่คืน และวันครบกำหนดอยู่ในช่วง 3 วัน
      expect(activeByDateList['2026-09-16']).toHaveLength(1);
      expect(dueSoonByDateList['2026-09-18']).toHaveLength(1);
      expect(dueSoonByDateList['2026-09-16']).toBeUndefined();
      expect(pickedUpByDateList['2026-09-10']).toHaveLength(1);
    });

    it('ไม่นับรายการที่คืนแล้วเป็นงานค้างในวันของวันนี้', () => {
      freezeToday();

      const { activeByDateList, dueSoonByDateList } = buildBorrowCalendarIndex([
        borrowRecord({ returnedAt: '2026-09-12 10:00:00' }),
      ]);

      expect(activeByDateList['2026-09-16']).toBeUndefined();
      expect(dueSoonByDateList['2026-09-12']).toBeUndefined();
    });

    it('ไม่แสดงวันรับครุภัณฑ์ล่วงหน้าในอนาคต', () => {
      freezeToday();

      const { pickedUpByDateList } = buildBorrowCalendarIndex([
        borrowRecord({
          borrowedAt: '2026-09-20 09:00:00',
          dueAt: '2026-09-25 17:00:00',
        }),
      ]);

      expect(pickedUpByDateList['2026-09-20']).toBeUndefined();
    });

    it('ข้ามรายการที่ไม่มีวันยืม และคืนค่า range ของข้อมูลทั้งหมด', () => {
      const index = buildBorrowCalendarIndex([
        borrowRecord({ id: 1, borrowedAt: '' }),
        borrowRecord({ id: 2, borrowedAt: '2026-09-05 09:00:00', dueAt: '2026-09-06 09:00:00' }),
      ]);

      expect(index.skippedCount).toBe(1);
      expect(index.events).toHaveLength(1);
      expect(index.range).toEqual({
        firstDateKey: '2026-09-05',
        lastDateKey: '2026-09-06',
      });
    });

    it('คืนค่าเริ่มต้นที่ปลอดภัยเมื่อไม่ได้ส่งข้อมูลมา', () => {
      const index = buildBorrowCalendarIndex();

      expect(index.events).toEqual([]);
      expect(index.listByDate).toEqual({});
      expect(index.range).toEqual({ firstDateKey: '', lastDateKey: '' });
      expect(index.skippedCount).toBe(0);
    });
  });
});
