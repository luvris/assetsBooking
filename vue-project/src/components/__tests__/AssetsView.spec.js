import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import AssetsView from '../AssetsView.vue';

const buildAssets = (count) => Array.from({ length: count }, (_, index) => ({
  id: index + 1,
  assetCode: `AST-${String(index + 1).padStart(3, '0')}`,
  name: `อุปกรณ์ ${index + 1}`,
  brand: 'TestBrand',
  serialNumber: `SN-${index + 1}`,
  categoryId: 1,
  status: 'Available',
  repairTicket: '',
}));

const mountView = (assets, overrides = {}) => mount(AssetsView, {
  props: {
    assets,
    assetSearch: '',
    assetStatusFilter: '',
    categories: [],
    getCategoryName: vi.fn(() => 'หมวดหมู่'),
    getStatusBadge: vi.fn(() => 'bg-emerald-100 text-emerald-800'),
    ...overrides,
  },
  global: {
    stubs: { PaginationBar: false },
  },
});

describe('AssetsView.vue pagination', () => {
  it('shows only 5 rows on the first page when there are 12 assets', () => {
    const wrapper = mountView(buildAssets(12));

    const dataRows = wrapper.findAll('tbody tr').filter(row => row.text().includes('AST-'));
    expect(dataRows).toHaveLength(5);
    expect(dataRows[0].text()).toContain('AST-001');
    expect(dataRows[4].text()).toContain('AST-005');
  });

  it('renders pagination summary with the correct total', () => {
    const wrapper = mountView(buildAssets(12));

    expect(wrapper.text()).toContain('แสดง 1-5 จากทั้งหมด 12 รายการครุภัณฑ์');
  });

  it('renders the next page rows after clicking "ถัดไป"', async () => {
    const wrapper = mountView(buildAssets(12));

    const nextButton = wrapper.findAll('button').find(b => b.text() === 'ถัดไป');
    await nextButton.trigger('click');

    const dataRows = wrapper.findAll('tbody tr').filter(row => row.text().includes('AST-'));
    expect(dataRows).toHaveLength(5);
    expect(dataRows[0].text()).toContain('AST-006');
    expect(dataRows[4].text()).toContain('AST-010');
    expect(wrapper.text()).toContain('แสดง 6-10 จากทั้งหมด 12 รายการครุภัณฑ์');
  });

  it('shows the remaining rows on the last partial page', async () => {
    const wrapper = mountView(buildAssets(12));

    const pageThree = wrapper.findAll('button').find(b => b.text() === '3');
    await pageThree.trigger('click');

    const dataRows = wrapper.findAll('tbody tr').filter(row => row.text().includes('AST-'));
    expect(dataRows).toHaveLength(2);
    expect(wrapper.text()).toContain('แสดง 11-12 จากทั้งหมด 12 รายการครุภัณฑ์');
  });

  it('does not show pagination bar when there is no data', () => {
    const wrapper = mountView([]);

    expect(wrapper.text()).toContain('ไม่พบครุภัณฑ์/อุปกรณ์ที่ตรงกับเงื่อนไขการค้นหา');
    expect(wrapper.text()).not.toContain('ก่อนหน้า');
  });

  it('shows all rows without page navigation when total items fit in a single page', () => {
    const wrapper = mountView(buildAssets(3));

    const dataRows = wrapper.findAll('tbody tr').filter(row => row.text().includes('AST-'));
    expect(dataRows).toHaveLength(3);
    expect(wrapper.text()).toContain('แสดง 1-3 จากทั้งหมด 3 รายการครุภัณฑ์');

    // มีหน้าเดียว จึงไม่แสดงปุ่มเลขหน้า รวมทั้งปุ่มก่อนหน้า/ถัดไป
    const pageButtons = wrapper.findAll('button').filter(b => /^\d+$/.test(b.text()));
    expect(pageButtons).toHaveLength(0);
    expect(wrapper.text()).not.toContain('ก่อนหน้า');
    expect(wrapper.text()).not.toContain('ถัดไป');
  });

  it('returns to the first page when the search term changes', async () => {
    const wrapper = mountView(buildAssets(12));

    const pageThree = wrapper.findAll('button').find(b => b.text() === '3');
    await pageThree.trigger('click');
    expect(wrapper.text()).toContain('แสดง 11-12 จากทั้งหมด 12 รายการครุภัณฑ์');

    await wrapper.setProps({ assetSearch: 'คอม' });

    expect(wrapper.text()).toContain('แสดง 1-5 จากทั้งหมด 12 รายการครุภัณฑ์');
  });

  it('returns to the first page when the status filter changes', async () => {
    const wrapper = mountView(buildAssets(12));

    const pageTwo = wrapper.findAll('button').find(b => b.text() === '2');
    await pageTwo.trigger('click');
    expect(wrapper.text()).toContain('แสดง 6-10 จากทั้งหมด 12 รายการครุภัณฑ์');

    await wrapper.setProps({ assetStatusFilter: 'Available' });

    expect(wrapper.text()).toContain('แสดง 1-5 จากทั้งหมด 12 รายการครุภัณฑ์');
  });

  it('moves back to the last available page when the list shrinks', async () => {
    const wrapper = mountView(buildAssets(12));

    const pageThree = wrapper.findAll('button').find(b => b.text() === '3');
    await pageThree.trigger('click');
    expect(wrapper.text()).toContain('แสดง 11-12 จากทั้งหมด 12 รายการครุภัณฑ์');

    await wrapper.setProps({ assets: buildAssets(7) });

    expect(wrapper.text()).toContain('แสดง 6-7 จากทั้งหมด 7 รายการครุภัณฑ์');
  });

  it('still emits delete-asset with the correct id from a paginated row', async () => {
    const wrapper = mountView(buildAssets(12));

    const pageTwo = wrapper.findAll('button').find(b => b.text() === '2');
    await pageTwo.trigger('click');

    const deleteButton = wrapper.findAll('button').find(b => b.text() === 'ลบ');
    await deleteButton.trigger('click');

    expect(wrapper.emitted('delete-asset')).toBeTruthy();
    expect(wrapper.emitted('delete-asset')[0]).toEqual([6]);
  });
});
