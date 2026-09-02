<script setup>
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

defineEmits([
  'open-borrow-modal',
  'return-asset',
]);

const getAssetName = (assetId) => {
  const asset = props.assets.find(item => item.id === assetId);

  if (!asset) return '-';

  return asset.name || asset.assetCode || '-';
};

const getAssetCode = (assetId) => {
  const asset = props.assets.find(item => item.id === assetId);

  return asset?.assetCode || '';
};

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
</script>

<template>
  <section class="space-y-6 max-w-7xl mx-auto">
    <!-- หัวข้อ + ปุ่ม -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h2 class="text-2xl font-bold tracking-tight text-slate-900">
          ระบบบันทึกการยืม–คืนอุปกรณ์
        </h2>

        <button v-if="clearAllBorrowLogs" @click="clearAllBorrowLogs"
          class="mt-2 px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-medium hover:bg-rose-100">
          ลบประวัติยืม–คืนทั้งหมด (DEV)
        </button>
      </div>

      <button @click="$emit('open-borrow-modal')"
        class="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium shadow-sm hover:bg-indigo-700 transition">
        บันทึกการยืมอุปกรณ์
      </button>
    </div>

    <!-- ตาราง -->
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
      <table class="w-full min-w-[1100px] text-left text-sm">
        <thead class="bg-slate-100 text-slate-600 text-xs">
          <tr>
            <th class="p-4 font-semibold">อุปกรณ์</th>
            <th class="p-4 font-semibold">ผู้ยืม</th>
            <th class="p-4 font-semibold">สถานที่</th>
            <th class="p-4 font-semibold">ช่วงวันที่ยืม</th>
            <th class="p-4 font-semibold">งาน/โครงการ</th>
            <th class="p-4 font-semibold">สถานะ</th>
            <th class="p-4 font-semibold text-right">การดำเนินการ</th>
          </tr>
        </thead>

        <tbody class="divide-y divide-slate-100">
          <tr v-for="record in borrowRecords" :key="record.id" class="hover:bg-slate-50 transition">
            <!-- 1. อุปกรณ์ -->
              <td class="p-4">
                <div class="font-medium text-slate-800">
                  {{ record.assetName || '-' }}
                </div>

                <div v-if="record.assetCode" class="mt-0.5 text-xs text-slate-400">
                  {{ record.assetCode }}
                </div>
              </td>

              <!-- 2. ผู้ยืม -->
              <td class="p-4 text-slate-700">
                {{ record.borrowerName || '-' }}
              </td>

              <!-- 3. สถานที่ -->
              <td class="p-4 text-slate-700">
                {{ record.location || '-' }}
              </td>

              <!-- 4. ช่วงวันที่ยืม -->
              <td class="p-4 text-slate-700 whitespace-nowrap">
                <div>
                  {{ record.borrowDate || '-' }} → {{ record.dueDate || '-' }}
                </div>

                <div class="mt-0.5 text-xs text-slate-400">
                  รวม {{ record.totalDays || 0 }} วัน
                </div>
              </td>

              <!-- 5. งาน/โครงการ -->
              <td class="p-4 text-slate-700">
                {{ record.jobTask || '-' }}
              </td>

              <!-- 6. สถานะ -->
              <td class="p-4">
                <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
                  :class="getStatusClass(record.status)">
                  {{ getStatusText(record.status) }}
                </span>

                <div v-if="record.status === 'Returned' && record.lateDays > 0" class="mt-1 text-xs text-rose-600">
                  เกินกำหนด {{ record.lateDays }} วัน
                </div>
              </td>

              <!-- 7. การดำเนินการ -->
              <td class="p-4 text-right">
                <button v-if="record.status === 'Active'" @click="$emit('return-asset', record)"
                  class="px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition whitespace-nowrap">
                  บันทึกคืนอุปกรณ์
                </button>

                <span v-else class="text-xs text-slate-400">
                  ดำเนินการแล้ว
                </span>
              </td>
          </tr>

          <!-- กรณียังไม่มีรายการ -->
          <tr v-if="borrowRecords.length === 0">
            <td colspan="7" class="p-8 text-center text-slate-400">
              ยังไม่มีประวัติการยืม–คืนอุปกรณ์
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>