import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import BorrowCalendarView from '../BorrowCalendarView.vue';

// ตรึงวันนี้เป็น 16 กันยายน 2026 เพื่อให้ผลทดสอบคงที่
const FIXED_NOW = new Date('2026-09-16T10:00:00+07:00');

const asset = {
  id: 10,
  assetCode: 'IT-001',
  name: 'โน้ตบุ๊ก Dell',
};

const buildRecord = (overrides = {}) => ({
  id: 1,
  assetId: 10,
  assetCode: 'IT-001',
  assetName: 'โน้ตบุ๊ก Dell',
  borrowerCid: 'CID-001',
  borrowerName: 'สมชาย ใจดี',
  department: 'ฝ่ายคอมพิวเตอร์',
  purpose: 'ออกหน่วยบริการ',
  borrowedAt: '2026-09-10 09:00:00',
  dueAt: '2026-09-18 17:00:00',
  returnedAt: null,
  status: 'Active',
  ...overrides,
});

const mountView = (borrowRecords = [], assets = [asset]) => mount(BorrowCalendarView, {
  props: { assets, borrowRecords },
});

const dayButtonTexts = (wrapper) => wrapper
  .findAll('button')
  .map(button => button.findAll('span').map(span => span.text()))
  .filter(texts => /^\d{1,2}$/.test(texts[0] || ''));

const dayCell = (wrapper, day) => wrapper
  .findAll('button')
  .find(button => button.findAll('span').some(span => span.text() === String(day)));

const cellText = (wrapper, day) => dayCell(wrapper, day)?.text() || '';

const clickDay = async (wrapper, day) => {
  const button = dayCell(wrapper, day);

  expect(button, `ไม่พบช่องวันที่ ${day}`).toBeTruthy();

  await button.trigger('click');
};

describe('BorrowCalendarView.vue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('แสดงเดือนปัจจุบันเป็นกันยายน 2569 และมีหัวคอลัมน์ 7 วัน', () => {
    const wrapper = mountView();
    const text = wrapper.text();

    expect(text).toContain('กันยายน 2569');
    expect(text).toContain('ปฏิทินการยืมครุภัณฑ์');

    ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'].forEach((label) => {
      expect(text).toContain(label);
    });
  });

  it('แสดงจำนวนวันของเดือนกันยายนให้ครบ 30 วัน', () => {
    const wrapper = mountView();

    const dayNumbers = dayButtonTexts(wrapper).map(texts => texts[0]);

    expect(dayNumbers).toContain('1');
    expect(dayNumbers).toContain('30');
    expect(dayNumbers).not.toContain('31');
  });

  it('แสดงรายชื่อผู้ยืมในช่องวันของช่วงที่ยืม', () => {
    const wrapper = mountView([buildRecord()]);

    expect(cellText(wrapper, 10)).toContain('สมชาย ใจดี');
    expect(cellText(wrapper, 11)).toContain('สมชาย ใจดี');
    expect(cellText(wrapper, 13)).toContain('สมชาย ใจดี');
    expect(cellText(wrapper, 18)).toContain('สมชาย ใจดี');
    expect(cellText(wrapper, 19)).not.toContain('สมชาย ใจดี');
  });

  it('แสดงรายละเอียดของวันที่เลือกไว้ในแผงด้านขวา', () => {
    const wrapper = mountView([buildRecord()]);
    const text = wrapper.text();

    // ค่าเริ่มต้นเลือกวันนี้ (16 กันยายน 2026) ซึ่งอยู่ในช่วงที่ยืมอยู่
    expect(text).toContain('รายชื่อผู้ยืมวันที่ 16 กันยายน 2569 (วันนี้)');
    expect(text).toContain('ผู้ยืม: สมชาย ใจดี');
    expect(text).toContain('งาน/โครงการ: ออกหน่วยบริการ');
    expect(text).toContain('กำหนดคืน 2026-09-18');
  });

  it('คลิกวันที่อื่นแล้วแผงรายละเอียดเปลี่ยนตามวันที่นั้น', async () => {
    const wrapper = mountView([buildRecord()]);

    await clickDay(wrapper, 11);

    expect(wrapper.text()).toContain('รายชื่อผู้ยืมวันที่ 11 กันยายน 2569');
  });

  it('ย้อนกลับไปเดือนก่อนและเดือนถัดไปได้', async () => {
    const wrapper = mountView();

    const previous = wrapper.findAll('button').find(b => b.text().includes('ก่อนหน้า'));
    await previous.trigger('click');
    expect(wrapper.text()).toContain('สิงหาคม 2569');

    const next = wrapper.findAll('button').find(b => b.text().includes('ถัดไป'));
    await next.trigger('click');
    expect(wrapper.text()).toContain('กันยายน 2569');
  });

  it('สรุปจำนวนวัน/รายการยืม และรายการที่เลยกำหนดคืนของเดือนปัจจุบัน', () => {
    const wrapper = mountView([
      // 10–18 ก.ย. = 9 วัน
      buildRecord({ id: 1, borrowerName: 'สมชาย', borrowedAt: '2026-09-10 09:00:00' }),
      // วันครบกำหนดอยู่ก่อนวันยืม => ถูกจำกัดให้เหลือวันเดียว (20 ก.ย.)
      buildRecord({
        id: 2,
        borrowerName: 'สมหญิง',
        borrowedAt: '2026-09-20 09:00:00',
        dueAt: '2026-09-18 17:00:00',
      }),
      // 1–5 ก.ย. ยังไม่คืน และเลยกำหนดแล้ว
      buildRecord({
        id: 3,
        borrowerName: 'สมปอง',
        borrowedAt: '2026-09-01 09:00:00',
        dueAt: '2026-09-05 17:00:00',
      }),
    ]);

    const text = wrapper.text();

    expect(text).toMatch(/วันที่มีการยืมในเดือนนี้\s*3\s*วัน/);
    expect(text).toMatch(/รายการยืม \(วัน-รายการ\)\s*15\s*รายการ/);
    expect(text).toMatch(/เลยกำหนดคืนในเดือนนี้\s*1\s*รายการ/);
  });

  it('กรองตามครุภัณฑ์ที่เลือกได้', async () => {
    const wrapper = mountView(
      [
        buildRecord({ id: 1, assetId: 10, borrowerName: 'สมชาย' }),
        buildRecord({
          id: 2,
          assetId: 20,
          assetCode: 'IT-002',
          assetName: 'โปรเจกเตอร์',
          borrowerName: 'สมหญิง',
        }),
      ],
      [asset, { id: 20, assetCode: 'IT-002', name: 'โปรเจกเตอร์' }],
    );

    // ค่าเริ่มต้น (ยังไม่กรอง) วันที่ 11 ต้องมีทั้งสองคน
    expect(cellText(wrapper, 11)).toContain('สมชาย');
    expect(cellText(wrapper, 11)).toContain('สมหญิง');

    const assetSelect = wrapper.findAll('select')[0];
    await assetSelect.setValue('20');

    expect(cellText(wrapper, 11)).toContain('สมหญิง');
    expect(cellText(wrapper, 11)).not.toContain('สมชาย');
    expect(wrapper.text()).not.toContain('ผู้ยืม: สมชาย');
  });

  it('กรองเฉพาะวันที่รับครุภัณฑ์ไป (pickedUp) ได้', async () => {
    const wrapper = mountView([buildRecord()]);

    // วันที่ 10 ก.ย. = วันรับของ
    expect(cellText(wrapper, 10)).toContain('สมชาย ใจดี');
    expect(cellText(wrapper, 11)).toContain('สมชาย ใจดี');

    const statusSelect = wrapper.findAll('select')[1];
    await statusSelect.setValue('pickedUp');

    expect(cellText(wrapper, 10)).toContain('สมชาย ใจดี');
    expect(cellText(wrapper, 11)).not.toContain('สมชาย ใจดี');
  });

  it('กรองเฉพาะวันที่ใกล้/ครบกำหนดคืน (dueSoon) ได้', async () => {
    const wrapper = mountView([buildRecord({ dueAt: '2026-09-17 17:00:00' })]);

    // วันนี้ 16 ก.ย. และกำหนดคืน 17 ก.ย. จึงยังไม่ใช่ "ใกล้กำหนด" ในวันนี้
    expect(cellText(wrapper, 16)).toContain('สมชาย ใจดี');
    expect(cellText(wrapper, 17)).toContain('สมชาย ใจดี');

    const statusSelect = wrapper.findAll('select')[1];
    await statusSelect.setValue('dueSoon');

    expect(cellText(wrapper, 16)).not.toContain('สมชาย ใจดี');
    expect(cellText(wrapper, 17)).toContain('สมชาย ใจดี');
  });

  it('กรองเฉพาะวันที่มีครุภัณฑ์อยู่กับผู้ยืม (active) ได้', async () => {
    const wrapper = mountView([
      buildRecord({ id: 1, borrowerName: 'สมชาย', dueAt: '2026-09-13 17:00:00' }),
    ]);

    const statusSelect = wrapper.findAll('select')[1];
    await statusSelect.setValue('active');

    // ยังไม่คืน (เลยกำหนดแล้ว) => วันที่ 13 ก.ย. ยังนับว่าครุภัณฑ์อยู่กับผู้ยืม
    expect(cellText(wrapper, 13)).toContain('สมชาย');
    expect(cellText(wrapper, 14)).not.toContain('สมชาย');
  });

  it('แสดงข้อความว่าไม่มีรายการ เมื่อวันที่เลือกไม่มีข้อมูลยืม', async () => {
    const wrapper = mountView([
      buildRecord({ borrowedAt: '2026-09-01 09:00:00', dueAt: '2026-09-02 09:00:00' }),
    ]);

    await clickDay(wrapper, 20);

    expect(wrapper.text()).toContain('ไม่มีรายการยืมในวันนี้');
  });

  it('ส่ง event return-asset เมื่อกดปุ่มบันทึกคืนอุปกรณ์', async () => {
    const wrapper = mountView([buildRecord()]);

    const returnButton = wrapper.findAll('button').find(b => b.text() === 'บันทึกคืนอุปกรณ์');
    expect(returnButton).toBeTruthy();

    await returnButton.trigger('click');

    const emitted = wrapper.emitted('return-asset');
    expect(emitted).toBeTruthy();
    expect(emitted[0][0].id).toBe(1);
  });

  it('ปุ่มกลับไปเดือนปัจจุบันพากลับมาที่เดือนของวันนี้', async () => {
    const wrapper = mountView();

    const previous = wrapper.findAll('button').find(b => b.text().includes('ก่อนหน้า'));
    await previous.trigger('click');
    expect(wrapper.text()).toContain('สิงหาคม 2569');

    const todayButton = wrapper.findAll('button').find(b => b.text().includes('กลับไปเดือนปัจจุบัน'));
    await todayButton.trigger('click');

    expect(wrapper.text()).toContain('กันยายน 2569');
    expect(wrapper.text()).toContain('รายชื่อผู้ยืมวันที่ 16 กันยายน 2569 (วันนี้)');
  });

  it('ไม่แสดงปุ่มคืนอุปกรณ์สำหรับรายการที่คืนแล้ว', async () => {
    const wrapper = mountView([
      buildRecord({ returnedAt: '2026-09-12 10:00:00', status: 'Returned' }),
    ]);

    // วันนี้ (16 ก.ย.) อยู่นอกช่วงที่ยืม จึงต้องคลิกวันที่ 11 เพื่อดูรายละเอียด
    await clickDay(wrapper, 11);

    expect(wrapper.text()).toContain('คืนแล้ว 2026-09-12');
    expect(wrapper.findAll('button').find(b => b.text() === 'บันทึกคืนอุปกรณ์')).toBeFalsy();
  });
});
