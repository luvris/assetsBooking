<script setup>
import { computed } from 'vue';
import usePagination from '../composables/usePagination.js';
import PaginationBar from './PaginationBar.vue';

const props = defineProps({
  supplies: {
    type: Array,
    required: true,
  },
  categories: {
    type: Array,
    required: true,
  },
  supplySearch: {
    type: String,
    required: true,
  },
  getCategoryName: {
    type: Function,
    required: true,
  },
  monthlySummary: {
    type: Object,
    required: true,
  },
});

defineEmits([
  'update-supply-search',
  'open-supply-modal',
  'open-supply-tx-modal',
]);

const {
  currentPage,
  totalItems,
  totalPages,
  startIndex,
  endIndex,
  paginatedItems: paginatedSupplies,
  goToPage,
} = usePagination(computed(() => props.supplies), {
  perPage: 5,
  resetKeys: [() => props.supplySearch],
});

const getTotalReceived = (item) => {
  const value =
    item.totalReceived ??
    item.totalQuantity ??
    item.initialQuantity ??
    item.quantity ??
    0;

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
};

const isLowStock = (item) => {
  return Number(item.quantity ?? 0) <= Number(item.minThreshold ?? 0);
};
</script>

<template>
  <section class="mx-auto max-w-6xl space-y-6">
    <!-- หัวข้อและปุ่มเพิ่ม -->
    <div class="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h2 class="text-2xl font-bold tracking-tight text-slate-900">
          คลังวัสดุสิ้นเปลือง
        </h2>
      </div>

      <button type="button"
        class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
        @click="$emit('open-supply-modal')">
        เพิ่มรายการวัสดุ
      </button>
    </div>

    <!-- ช่องค้นหา -->
    <div
      class="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row">
      <input :value="supplySearch" type="text" placeholder="ค้นหาตามชื่อวัสดุ..."
        class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:w-80"
        @input="$emit('update-supply-search', $event.target.value)">
    </div>

    <!-- ตาราง -->
    <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[850px] text-left text-sm">
          <thead class="bg-slate-100 text-xs uppercase text-slate-600">
            <tr>
              <th class="p-3">ชื่อวัสดุ</th>
              <th class="p-3">หมวดหมู่</th>
              <th class="p-3">คงเหลือ / รับเข้ารวม</th>
              <th class="p-3">ระดับแจ้งเตือนขั้นต่ำ</th>
              <th class="p-3 text-right">การดำเนินการสต็อก</th>
            </tr>
          </thead>

          <tbody class="divide-y divide-slate-100">
            <tr v-for="item in paginatedSupplies" :key="item.id" class="transition hover:bg-slate-50">

              <td class="p-3">
                <div class="font-medium text-slate-800">
                  {{ item.name || '-' }}
                </div>

                <div v-if="item.itemCode" class="mt-0.5 text-xs text-emerald-600">
                  {{ item.itemCode }}
                </div>
              </td>

              <!-- หมวดหมู่ -->
              <td class="p-3">
                {{ getCategoryName(item.categoryId) }}
              </td>

              <!-- จำนวนคงเหลือ / รับเข้ารวม -->
              <td class="p-3">
                <span class="font-bold" :class="isLowStock(item)
                  ? 'text-rose-600'
                  : 'text-emerald-600'
                  ">
                  {{ item.quantity }}
                </span>

                <span class="text-slate-400">
                  / {{ getTotalReceived(item) }}
                </span>

                <span class="ml-1 text-xs text-slate-500">
                  {{ item.unit }}
                </span>
              </td>

              <!-- ระดับแจ้งเตือนขั้นต่ำ -->
              <td class="p-3 text-slate-500">
                {{ item.minThreshold }} {{ item.unit }}
              </td>

              <!-- การดำเนินการ -->
              <td class="space-x-2 p-3 text-right">
                <button type="button"
                  class="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                  @click="$emit('open-supply-tx-modal', { id: item.id, type: 'IN' })">
                  เติมสต็อก
                </button>

                <button type="button"
                  class="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                  @click="$emit('open-supply-tx-modal', { id: item.id, type: 'OUT' })">
                  เบิกใช้
                </button>

                <button type="button" class="ml-2 text-xs font-medium text-indigo-600 hover:underline"
                  @click="$emit('open-supply-modal', item)">
                  แก้ไข
                </button>
              </td>
            </tr>

            <!-- ไม่พบรายการ -->
            <tr v-if="totalItems === 0">
              <td colspan="5" class="p-8 text-center text-slate-400">
                ไม่พบรายการวัสดุที่ตรงกับเงื่อนไขการค้นหา
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <PaginationBar :current-page="currentPage" :total-pages="totalPages" :total-items="totalItems"
        :start-index="startIndex" :end-index="endIndex" item-label="รายการวัสดุ" @update:current-page="goToPage" />
    </div>
  </section>
</template>