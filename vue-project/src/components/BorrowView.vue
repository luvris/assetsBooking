<script setup>
import { computed } from 'vue';
import usePagination from '../composables/usePagination.js';
import PaginationBar from './PaginationBar.vue';

const props = defineProps({
  assets: {
    type: Array,
    required: true,
  },

  borrowRecords: {
    type: Array,
    required: true,
  },

  clearAllBorrowLogs: {
    type: Function,
    required: false,
  },
});

const emit = defineEmits([
  'open-borrow-modal',
  'return-asset',
  'print-borrow',
]);

const {
  currentPage,
  totalItems,
  totalPages,
  startIndex,
  endIndex,
  paginatedItems: paginatedBorrowRecords,
  goToPage,
} = usePagination(computed(() => props.borrowRecords), {
  perPage: 5,
});

const getStatusClass = (status) => {
  return status === 'Active'
    ? 'bg-amber-100 text-amber-800'
    : 'bg-emerald-100 text-emerald-800';
};

const getStatusText = (status) => {
  return status === 'Active'
    ? 'กำลังยืมใช้งาน'
    : 'คืนแล้ว';
};

/**
 * ส่ง ID ของรายการ borrow_return ไปยัง App.vue
 * App.vue จะเปลี่ยน currentView เป็น borrow-print
 * แล้วเปิด BorrowPrintView.vue
 */
const openPrintForm = (record) => {
  if (!record?.id) {
    window.alert('ไม่พบรหัสรายการยืมสำหรับสร้างเอกสาร');
    return;
  }

  emit('print-borrow', record.id);
};
</script>

<template>
  <section class="mx-auto max-w-7xl space-y-6">
    <div class="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h2 class="text-2xl font-bold tracking-tight text-slate-900">
          ระบบบันทึกการยืม–คืนอุปกรณ์
        </h2>

        <button
          v-if="clearAllBorrowLogs"
          type="button"
          class="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
          @click="clearAllBorrowLogs"
        >
          ลบประวัติยืม–คืนทั้งหมด (DEV)
        </button>
      </div>

      <button
        type="button"
        class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
        @click="$emit('open-borrow-modal')"
      >
        บันทึกการยืมอุปกรณ์
      </button>
    </div>

    <div class="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table class="w-full min-w-[1400px] text-left text-sm">
        <thead class="bg-slate-100 text-xs text-slate-600">
          <tr>
            <th class="p-4 font-semibold">อุปกรณ์</th>
            <th class="p-4 font-semibold">ผู้ยืม</th>
            <th class="p-4 font-semibold">สถานที่</th>
            <th class="p-4 font-semibold">
              วันยืม / กำหนดคืน / คืนจริง
            </th>
            <th class="p-4 font-semibold">งาน/โครงการ</th>
            <th class="p-4 font-semibold">สถานะ</th>

            <!-- คอลัมน์ใหม่ -->
            <th class="p-4 text-center font-semibold">
              เอกสาร
            </th>

            <th class="p-4 text-right font-semibold">
              การดำเนินการ
            </th>
          </tr>
        </thead>

        <tbody class="divide-y divide-slate-100">
          <tr
            v-for="record in paginatedBorrowRecords"
            :key="record.id"
            class="transition hover:bg-slate-50"
          >
            <!-- อุปกรณ์ -->
            <td class="p-4">
              <div class="font-medium text-slate-800">
                {{ record.assetName || '-' }}
              </div>

              <div
                v-if="record.assetCode"
                class="mt-0.5 text-xs text-slate-400"
              >
                {{ record.assetCode }}
              </div>
            </td>

            <!-- ผู้ยืม -->
            <td class="p-4 text-slate-700">
              {{ record.borrowerName || '-' }}
            </td>

            <!-- สถานที่ -->
            <td class="p-4 text-slate-700">
              {{ record.location || '-' }}
            </td>

            <!-- วันยืม / กำหนดคืน / คืนจริง -->
            <td class="whitespace-nowrap p-4">
              <div class="space-y-1 text-xs">
                <div>
                  <span class="font-medium text-slate-500">
                    ยืม:
                  </span>

                  <span class="text-slate-800">
                    {{ record.borrowDate || '-' }}
                  </span>
                </div>

                <div>
                  <span class="font-medium text-amber-600">
                    กำหนดคืน:
                  </span>

                  <span class="text-slate-800">
                    {{ record.dueDate || '-' }}
                  </span>
                </div>

                <div>
                  <span class="font-medium text-emerald-600">
                    คืนจริง:
                  </span>

                  <span
                    :class="record.returnedDate
                      ? 'text-slate-800'
                      : 'text-slate-400'"
                  >
                    {{ record.returnedDate || 'ยังไม่คืน' }}
                  </span>
                </div>

                <div class="pt-0.5 text-slate-400">
                  รวม {{ record.totalDays || 0 }} วัน
                </div>
              </div>
            </td>

            <!-- งาน/โครงการ -->
            <td class="p-4 text-slate-700">
              {{ record.jobTask || record.purpose || '-' }}
            </td>

            <!-- สถานะ -->
            <td class="p-4">
              <span
                class="inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold"
                :class="getStatusClass(record.status)"
              >
                {{ getStatusText(record.status) }}
              </span>

              <div
                v-if="record.status === 'Returned' && record.lateDays > 0"
                class="mt-1 text-xs text-rose-600"
              >
                เกินกำหนด {{ record.lateDays }} วัน
              </div>
            </td>

            <!-- เอกสาร: คอลัมน์ใหม่ -->
            <td class="p-4 text-center">
              <button
                type="button"
                class="whitespace-nowrap rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-indigo-700"
                @click="openPrintForm(record)"
              >
                พิมพ์ใบยืม
              </button>
            </td>

            <!-- การดำเนินการ -->
            <td class="p-4 text-right">
              <button
                v-if="record.status === 'Active'"
                type="button"
                class="whitespace-nowrap rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-emerald-700"
                @click="$emit('return-asset', record)"
              >
                บันทึกคืนอุปกรณ์
              </button>

              <span
                v-else
                class="text-xs text-slate-400"
              >
                ดำเนินการแล้ว
              </span>
            </td>
          </tr>

          <tr v-if="totalItems === 0">
            <td
              colspan="8"
              class="p-8 text-center text-slate-400"
            >
              ยังไม่มีประวัติการยืม–คืนอุปกรณ์
            </td>
          </tr>
        </tbody>
      </table>

      <PaginationBar
        :current-page="currentPage"
        :total-pages="totalPages"
        :total-items="totalItems"
        :start-index="startIndex"
        :end-index="endIndex"
        item-label="รายการยืม–คืน"
        @update:current-page="goToPage"
      />
    </div>
  </section>
</template>