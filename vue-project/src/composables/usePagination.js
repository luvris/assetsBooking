import { computed, ref, watch } from 'vue';

/**
 * แบ่งข้อมูลเป็นหน้า ๆ (pagination) ฝั่ง client
 *
 * @param {import('vue').Ref<Array>|import('vue').ComputedRef<Array>} source ข้อมูลต้นทาง
 * @param {Object} [options]
 * @param {number|import('vue').Ref<number>} [options.perPage=5] จำนวนรายการต่อหน้า
 * @param {Array} [options.resetKeys=[]] ค่าที่เมื่อเปลี่ยนแล้วให้กลับไปหน้าแรก (เช่น คำค้นหา / ฟิลเตอร์)
 * @returns {{
 *   currentPage: import('vue').Ref<number>,
 *   perPage: import('vue').Ref<number>,
 *   totalItems: import('vue').ComputedRef<number>,
 *   totalPages: import('vue').ComputedRef<number>,
 *   startIndex: import('vue').ComputedRef<number>,
 *   endIndex: import('vue').ComputedRef<number>,
 *   paginatedItems: import('vue').ComputedRef<Array>,
 *   pageNumbers: import('vue').ComputedRef<Array>,
 *   hasPreviousPage: import('vue').ComputedRef<boolean>,
 *   hasNextPage: import('vue').ComputedRef<boolean>,
 *   goToPage: Function,
 *   nextPage: Function,
 *   previousPage: Function,
 *   resetPage: Function,
 * }}
 */
export function usePagination(source, options = {}) {
  const { perPage: perPageOption = 5, resetKeys = [] } = options;

  const initialPerPage = typeof perPageOption === 'object' && perPageOption !== null
    ? perPageOption.value
    : perPageOption;

  const perPage = ref(Number(initialPerPage) > 0 ? Number(initialPerPage) : 5);
  const currentPage = ref(1);

  const totalItems = computed(() => {
    const items = source?.value;

    return Array.isArray(items) ? items.length : 0;
  });

  const totalPages = computed(() => {
    if (totalItems.value === 0) return 1;

    return Math.max(1, Math.ceil(totalItems.value / perPage.value));
  });

  const startIndex = computed(() => (currentPage.value - 1) * perPage.value);

  const endIndex = computed(() => Math.min(startIndex.value + perPage.value, totalItems.value));

  const paginatedItems = computed(() => {
    const items = source?.value;

    if (!Array.isArray(items)) return [];

    return items.slice(startIndex.value, endIndex.value);
  });

  const pageNumbers = computed(() => (
    Array.from({ length: totalPages.value }, (_, index) => index + 1)
  ));

  const hasPreviousPage = computed(() => currentPage.value > 1);

  const hasNextPage = computed(() => currentPage.value < totalPages.value);

  const goToPage = (page) => {
    const target = Number(page);

    if (!Number.isFinite(target)) return;

    currentPage.value = Math.min(Math.max(1, Math.trunc(target)), totalPages.value);
  };

  const nextPage = () => goToPage(currentPage.value + 1);

  const previousPage = () => goToPage(currentPage.value - 1);

  const resetPage = () => {
    currentPage.value = 1;
  };

  // ข้อมูลหายไปหรือมีจำนวนหน้าลดลง ให้ดึงกลับมาอยู่ในหน้าที่ถูกต้องเสมอ
  watch([totalPages, totalItems], () => {
    if (currentPage.value > totalPages.value) {
      currentPage.value = totalPages.value;
    }
  });

  // ค้นหา/ฟิลเตอร์เปลี่ยน ให้กลับไปหน้าแรก
  if (Array.isArray(resetKeys) && resetKeys.length > 0) {
    watch(resetKeys, () => {
      resetPage();
    });
  }

  return {
    currentPage,
    perPage,
    totalItems,
    totalPages,
    startIndex,
    endIndex,
    paginatedItems,
    pageNumbers,
    hasPreviousPage,
    hasNextPage,
    goToPage,
    nextPage,
    previousPage,
    resetPage,
  };
}

export default usePagination;
