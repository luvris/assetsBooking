import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import CategoriesView from '../CategoriesView.vue';

describe('CategoriesView.vue', () => {
  const mockCategories = [
    { id: 'cat-1', name: 'คอมพิวเตอร์และอุปกรณ์', type: 'asset' },
    { id: 'cat-2', name: 'เครื่องเขียนสำนักงาน', type: 'supply' },
  ];

  it('renders category rows and formats type correctly for asset and supply', () => {
    const wrapper = mount(CategoriesView, {
      props: {
        categories: mockCategories,
      },
    });

    const rows = wrapper.findAll('tbody tr');
    expect(rows).toHaveLength(2);

    expect(rows[0].text()).toContain('คอมพิวเตอร์และอุปกรณ์');
    expect(rows[0].text()).toContain('ครุภัณฑ์/อุปกรณ์');

    expect(rows[1].text()).toContain('เครื่องเขียนสำนักงาน');
    expect(rows[1].text()).toContain('วัสดุสิ้นเปลือง');
  });

  it('shows empty state message when categories array is empty', () => {
    const wrapper = mount(CategoriesView, {
      props: {
        categories: [],
      },
    });

    expect(wrapper.text()).toContain('ยังไม่มีหมวดหมู่ โปรดเพิ่มหมวดหมู่ใหม่');
  });

  it('emits open-category-modal when "เพิ่มหมวดหมู่" button is clicked', async () => {
    const wrapper = mount(CategoriesView, {
      props: {
        categories: [],
      },
    });

    const addButton = wrapper.find('button');
    expect(addButton.text()).toBe('เพิ่มหมวดหมู่');

    await addButton.trigger('click');

    expect(wrapper.emitted('open-category-modal')).toBeTruthy();
    expect(wrapper.emitted('open-category-modal')).toHaveLength(1);
  });

  it('emits delete-category with category id when "ลบหมวดหมู่" button is clicked', async () => {
    const wrapper = mount(CategoriesView, {
      props: {
        categories: mockCategories,
      },
    });

    const deleteButtons = wrapper.findAll('button').filter(b => b.text().includes('ลบหมวดหมู่'));
    expect(deleteButtons).toHaveLength(2);

    await deleteButtons[0].trigger('click');
    expect(wrapper.emitted('delete-category')).toBeTruthy();
    expect(wrapper.emitted('delete-category')[0]).toEqual(['cat-1']);

    await deleteButtons[1].trigger('click');
    expect(wrapper.emitted('delete-category')[1]).toEqual(['cat-2']);
  });
});
