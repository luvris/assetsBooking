import { describe, it, expect } from 'vitest';

import {
  dbStatusFromUi,
  normalizeAsset,
  normalizeBorrow,
  normalizeBorrowFormType,
  uiStatusFromDb,
} from '../inventoryRecords.js';

describe('status helpers', () => {
  it('maps DB status values to UI labels', () => {
    expect(uiStatusFromDb('AVAILABLE')).toBe('Available');
    expect(uiStatusFromDb('borrow')).toBe('Borrowed');
    expect(uiStatusFromDb('repairing')).toBe('Maintenance');
    expect(uiStatusFromDb('deleted')).toBe('Retired');
  });

  it('keeps unknown values unchanged and tolerates empty input', () => {
    expect(uiStatusFromDb('Weird')).toBe('Weird');
    expect(uiStatusFromDb('')).toBe('');
    expect(uiStatusFromDb(null)).toBe('');
  });

  it('maps UI labels back to DB values', () => {
    expect(dbStatusFromUi('Available')).toBe('AVAILABLE');
    expect(dbStatusFromUi('Borrowed')).toBe('BORROWED');
    expect(dbStatusFromUi('Maintenance')).toBe('REPAIR');
    expect(dbStatusFromUi('Retired')).toBe('DISPOSED');
  });
});

describe('normalizeBorrowFormType', () => {
  it('detects out-of-area requests from Thai keywords', () => {
    expect(normalizeBorrowFormType({ purpose: 'ออกหน่วยตรวจสุขภาพ' })).toBe('OUT_OF_AREA');
    expect(normalizeBorrowFormType({ location: 'ใช้ภายนอกโรงพยาบาล' })).toBe('OUT_OF_AREA');
  });

  it('detects in-hospital requests from keywords', () => {
    expect(normalizeBorrowFormType({ purpose: 'ใช้งานในโรงพยาบาล' })).toBe('IN_HOSPITAL');
  });

  it('falls back to A6-1 when a contact phone is present', () => {
    expect(normalizeBorrowFormType({ phone: '081-234-5678' })).toBe('OUT_OF_AREA');
  });

  it('defaults to in-hospital when nothing points outside', () => {
    expect(normalizeBorrowFormType({})).toBe('IN_HOSPITAL');
  });
});

describe('normalizeAsset', () => {
  it('reads snake_case columns from the database', () => {
    const asset = normalizeAsset({
      id: '7',
      asset_code: 'COM-007',
      asset_name: 'คอมพิวเตอร์ตั้งโต๊ะ',
      category_id: '3',
      asset_status: 'BORROWED',
      repair_ticket: 'WO-1',
    });

    expect(asset.id).toBe(7);
    expect(asset.assetCode).toBe('COM-007');
    expect(asset.name).toBe('คอมพิวเตอร์ตั้งโต๊ะ');
    expect(asset.categoryId).toBe(3);
    expect(asset.status).toBe('Borrowed');
    expect(asset.repairTicket).toBe('WO-1');
  });

  it('falls back between code and name so the UI always shows something', () => {
    expect(normalizeAsset({ asset_code: 'COM-009' }).name).toBe('COM-009');
    expect(normalizeAsset({ asset_name: 'โปรเจกเตอร์' }).assetCode).toBe('โปรเจกเตอร์');
  });

  it('never throws on empty/malformed input', () => {
    expect(() => normalizeAsset(null)).not.toThrow();
    expect(() => normalizeAsset(undefined)).not.toThrow();
    expect(normalizeAsset(null).assetCode).toBe('');
    expect(normalizeAsset([]).name).toBe('');
  });

  it('keeps an empty category as an empty string, not 0', () => {
    expect(normalizeAsset({ asset_code: 'X' }).categoryId).toBe('');
  });
});

describe('normalizeBorrow', () => {
  const rawRecord = {
    id: 1,
    asset_id: 12,
    borrower_name: 'สมชาย',
    department: 'IT',
    borrowed_at: '2024-01-01 09:00:00',
    due_at: '2024-01-05 17:00:00',
    returned_at: '2024-01-06 10:00:00',
  };

  it('normalizes snake_case borrow records', () => {
    const borrow = normalizeBorrow(rawRecord);

    expect(borrow.assetId).toBe(12);
    expect(borrow.borrowerName).toBe('สมชาย');
    expect(borrow.borrowedAt).toBe('2024-01-01 09:00:00');
    expect(borrow.status).toBe('Returned');
    expect(borrow.totalDays).toBe(5);
    expect(borrow.lateDays).toBe(1);
  });

  it('uses asset fallbacks when the record has no asset info', () => {
    const borrow = normalizeBorrow(
      { id: 2, borrowed_at: '2024-02-01 08:00:00' },
      { assetId: 99, assetCode: 'COM-099', assetName: 'โน้ตบุ๊ก' },
    );

    expect(borrow.assetId).toBe(99);
    expect(borrow.assetCode).toBe('COM-099');
    expect(borrow.assetName).toBe('โน้ตบุ๊ก');
    expect(borrow.status).toBe('Active');
  });

  it('does not coerce an asset code into a numeric assetId', () => {
    const borrow = normalizeBorrow({ id: 3, asset_id: 'COM-003' });

    expect(borrow.assetId).toBeNull();
  });

  it('merges asset info from a nested asset object', () => {
    const borrow = normalizeBorrow({
      id: 4,
      asset: { assetCode: 'COM-004', name: 'เครื่องพิมพ์' },
    });

    expect(borrow.assetCode).toBe('COM-004');
    expect(borrow.assetName).toBe('เครื่องพิมพ์');
  });

  it('treats department and location as interchangeable', () => {
    expect(normalizeBorrow({ id: 5, location: 'ห้อง LAB' }).department).toBe('ห้อง LAB');
    expect(normalizeBorrow({ id: 6, department: 'งานพัสดุ' }).location).toBe('งานพัสดุ');
  });

  it('never throws on empty/malformed input', () => {
    expect(() => normalizeBorrow(null)).not.toThrow();
    expect(normalizeBorrow(undefined).assetCode).toBe('');
    expect(normalizeBorrow([]).status).toBe('Active');
    expect(normalizeBorrow(null).totalDays).toBe(0);
  });
});
