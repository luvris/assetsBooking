import { describe, it, expect } from 'vitest';
import { computed, nextTick, ref } from 'vue';
import { usePagination } from '../usePagination';

describe('usePagination composable', () => {
  it('defaults to 5 items per page', () => {
    const source = ref(Array.from({ length: 12 }, (_, i) => i + 1));
    const { perPage, totalItems, totalPages } = usePagination(source);

    expect(perPage.value).toBe(5);
    expect(totalItems.value).toBe(12);
    expect(totalPages.value).toBe(3);
  });

  it('slices the source into the requested page', () => {
    const source = ref(Array.from({ length: 12 }, (_, i) => i + 1));
    const { paginatedItems, currentPage, goToPage } = usePagination(source);

    expect(paginatedItems.value).toEqual([1, 2, 3, 4, 5]);

    goToPage(2);
    expect(currentPage.value).toBe(2);
    expect(paginatedItems.value).toEqual([6, 7, 8, 9, 10]);

    goToPage(3);
    expect(paginatedItems.value).toEqual([11, 12]);
  });

  it('calculates totalPages rounding up the last partial page', () => {
    const source = ref(Array.from({ length: 11 }, (_, i) => i + 1));
    const { totalPages } = usePagination(source);

    expect(totalPages.value).toBe(3);
  });

  it('reports totalPages as 1 for an empty list and returns no items', () => {
    const source = ref([]);
    const { totalPages, paginatedItems, totalItems } = usePagination(source);

    expect(totalItems.value).toBe(0);
    expect(totalPages.value).toBe(1);
    expect(paginatedItems.value).toEqual([]);
  });

  it('computes startIndex and endIndex for the item range text', () => {
    const source = ref(Array.from({ length: 12 }, (_, i) => i + 1));
    const { startIndex, endIndex, goToPage } = usePagination(source);

    expect(startIndex.value).toBe(0);
    expect(endIndex.value).toBe(5);

    goToPage(3);
    expect(startIndex.value).toBe(10);
    expect(endIndex.value).toBe(12);
  });

  it('clamps goToPage within the valid page range', () => {
    const source = ref(Array.from({ length: 12 }, (_, i) => i + 1));
    const { currentPage, goToPage } = usePagination(source);

    goToPage(99);
    expect(currentPage.value).toBe(3);

    goToPage(-5);
    expect(currentPage.value).toBe(1);

    goToPage('abc');
    expect(currentPage.value).toBe(1);
  });

  it('supports nextPage, previousPage and resetPage helpers', () => {
    const source = ref(Array.from({ length: 12 }, (_, i) => i + 1));
    const { currentPage, nextPage, previousPage, resetPage, hasNextPage, hasPreviousPage } = usePagination(source);

    expect(hasPreviousPage.value).toBe(false);

    nextPage();
    expect(currentPage.value).toBe(2);
    expect(hasPreviousPage.value).toBe(true);
    expect(hasNextPage.value).toBe(true);

    nextPage();
    expect(currentPage.value).toBe(3);
    expect(hasNextPage.value).toBe(false);

    previousPage();
    expect(currentPage.value).toBe(2);

    resetPage();
    expect(currentPage.value).toBe(1);
  });

  it('exposes a list of page numbers to render', () => {
    const source = ref(Array.from({ length: 23 }, (_, i) => i + 1));
    const { pageNumbers } = usePagination(source);

    expect(pageNumbers.value).toEqual([1, 2, 3, 4, 5]);
  });

  it('supports a custom perPage option', () => {
    const source = ref(Array.from({ length: 10 }, (_, i) => i + 1));
    const { perPage, totalPages, paginatedItems } = usePagination(source, { perPage: 3 });

    expect(perPage.value).toBe(3);
    expect(totalPages.value).toBe(4);
    expect(paginatedItems.value).toEqual([1, 2, 3]);
  });

  it('falls back to 5 per page when given an invalid perPage', () => {
    const source = ref([1, 2, 3]);
    const { perPage } = usePagination(source, { perPage: 0 });

    expect(perPage.value).toBe(5);
  });

  it('works with a computed source and reacts to source changes', async () => {
    const items = ref(Array.from({ length: 12 }, (_, i) => i + 1));
    const filtered = computed(() => items.value.filter(v => v % 2 === 0));
    const { paginatedItems, totalPages } = usePagination(filtered);

    expect(totalPages.value).toBe(2);
    expect(paginatedItems.value).toEqual([2, 4, 6, 8, 10]);

    items.value = [1, 2, 3];
    await nextTick();

    expect(totalPages.value).toBe(1);
    expect(paginatedItems.value).toEqual([2]);
  });

  it('moves back to the last available page when the source shrinks', async () => {
    const source = ref(Array.from({ length: 12 }, (_, i) => i + 1));
    const { currentPage, goToPage, paginatedItems } = usePagination(source);

    goToPage(3);
    expect(currentPage.value).toBe(3);

    source.value = Array.from({ length: 6 }, (_, i) => i + 1);
    await nextTick();

    expect(currentPage.value).toBe(2);
    expect(paginatedItems.value).toEqual([6]);
  });

  it('resets to the first page when a resetKey changes', async () => {
    const source = ref(Array.from({ length: 12 }, (_, i) => i + 1));
    const search = ref('');
    const { currentPage, goToPage } = usePagination(source, { resetKeys: [search] });

    goToPage(3);
    expect(currentPage.value).toBe(3);

    search.value = 'คอม';
    await nextTick();

    expect(currentPage.value).toBe(1);
  });

  it('handles a non-array source defensively', () => {
    const source = ref(null);
    const { totalItems, totalPages, paginatedItems } = usePagination(source);

    expect(totalItems.value).toBe(0);
    expect(totalPages.value).toBe(1);
    expect(paginatedItems.value).toEqual([]);
  });
});
