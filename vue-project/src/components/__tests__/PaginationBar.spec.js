import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import PaginationBar from '../PaginationBar.vue';

describe('PaginationBar.vue', () => {
  const defaultProps = {
    currentPage: 1,
    totalPages: 3,
    totalItems: 12,
    startIndex: 0,
    endIndex: 5,
  };

  it('shows the item range text based on startIndex, endIndex and totalItems', () => {
    const wrapper = mount(PaginationBar, { props: defaultProps });

    expect(wrapper.text()).toContain('แสดง 1-5 จากทั้งหมด 12 รายการ');
  });

  it('uses the custom item label when provided', () => {
    const wrapper = mount(PaginationBar, {
      props: { ...defaultProps, itemLabel: 'รายการวัสดุ' },
    });

    expect(wrapper.text()).toContain('แสดง 1-5 จากทั้งหมด 12 รายการวัสดุ');
  });

  it('renders nothing when there are no items', () => {
    const wrapper = mount(PaginationBar, {
      props: {
        currentPage: 1,
        totalPages: 1,
        totalItems: 0,
        startIndex: 0,
        endIndex: 0,
      },
    });

    expect(wrapper.find('button').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('ก่อนหน้า');
  });

  it('hides the page navigation but keeps the summary when there is only one page', () => {
    const wrapper = mount(PaginationBar, {
      props: {
        currentPage: 1,
        totalPages: 1,
        totalItems: 3,
        startIndex: 0,
        endIndex: 3,
      },
    });

    expect(wrapper.text()).toContain('แสดง 1-3 จากทั้งหมด 3 รายการ');
    expect(wrapper.findAll('button')).toHaveLength(0);
  });

  it('renders a page button per page when pages are few', () => {
    const wrapper = mount(PaginationBar, { props: defaultProps });

    const pageButtons = wrapper.findAll('button').filter(b => /^\d+$/.test(b.text()));
    expect(pageButtons.map(b => b.text())).toEqual(['1', '2', '3']);
  });

  it('shows at most 5 numbered page buttons when there are many pages', () => {
    const wrapper = mount(PaginationBar, {
      props: { ...defaultProps, currentPage: 10, totalPages: 20, totalItems: 100 },
    });

    const pageButtons = wrapper.findAll('button').filter(b => /^\d+$/.test(b.text()));
    expect(pageButtons.map(b => b.text())).toEqual(['8', '9', '10', '11', '12']);
  });

  it('disables the previous button on the first page', () => {
    const wrapper = mount(PaginationBar, { props: defaultProps });

    const prevButton = wrapper.findAll('button').find(b => b.text() === 'ก่อนหน้า');
    expect(prevButton.attributes('disabled')).toBeDefined();
  });

  it('disables the next button on the last page', () => {
    const wrapper = mount(PaginationBar, {
      props: { ...defaultProps, currentPage: 3, startIndex: 10, endIndex: 12 },
    });

    const nextButton = wrapper.findAll('button').find(b => b.text() === 'ถัดไป');
    expect(nextButton.attributes('disabled')).toBeDefined();
  });

  it('emits update:currentPage when a page number is clicked', async () => {
    const wrapper = mount(PaginationBar, { props: defaultProps });

    const pageTwo = wrapper.findAll('button').find(b => b.text() === '2');
    await pageTwo.trigger('click');

    expect(wrapper.emitted('update:currentPage')).toBeTruthy();
    expect(wrapper.emitted('update:currentPage')[0]).toEqual([2]);
  });

  it('emits update:currentPage with the next page when "ถัดไป" is clicked', async () => {
    const wrapper = mount(PaginationBar, { props: defaultProps });

    const nextButton = wrapper.findAll('button').find(b => b.text() === 'ถัดไป');
    await nextButton.trigger('click');

    expect(wrapper.emitted('update:currentPage')[0]).toEqual([2]);
  });

  it('emits update:currentPage with the previous page when "ก่อนหน้า" is clicked', async () => {
    const wrapper = mount(PaginationBar, {
      props: { ...defaultProps, currentPage: 2, startIndex: 5, endIndex: 10 },
    });

    const prevButton = wrapper.findAll('button').find(b => b.text() === 'ก่อนหน้า');
    await prevButton.trigger('click');

    expect(wrapper.emitted('update:currentPage')[0]).toEqual([1]);
  });

  it('does not emit when clicking the currently active page', async () => {
    const wrapper = mount(PaginationBar, { props: defaultProps });

    const pageOne = wrapper.findAll('button').find(b => b.text() === '1');
    await pageOne.trigger('click');

    expect(wrapper.emitted('update:currentPage')).toBeFalsy();
  });

  it('does not emit when trying to page beyond the last page', async () => {
    const wrapper = mount(PaginationBar, {
      props: { ...defaultProps, currentPage: 3, startIndex: 10, endIndex: 12 },
    });

    const nextButton = wrapper.findAll('button').find(b => b.text() === 'ถัดไป');
    await nextButton.trigger('click');

    expect(wrapper.emitted('update:currentPage')).toBeFalsy();
  });
});
