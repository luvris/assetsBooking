<script setup>
const props = defineProps({
  assets: { type: Array, required: true },
  assetSearch: { type: String, required: true },
  assetStatusFilter: { type: String, required: true },
  categories: { type: Array, required: true },
  getCategoryName: { type: Function, required: true },
  getStatusBadge: { type: Function, required: true },
});

const emits = defineEmits([
  'update-asset-search',
  'update-asset-status-filter',
  'open-asset-modal',
  'delete-asset',
]);
</script>

<template>
  <section class="space-y-6 max-w-6xl mx-auto">
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h2 class="text-2xl font-bold tracking-tight text-slate-900">
          ครุภัณฑ์/อุปกรณ์ไอที
        </h2>
      </div>
      <button
        @click="$emit('open-asset-modal')"
        class="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 shadow-sm transition"
      >
        เพิ่มครุภัณฑ์/อุปกรณ์ใหม่
      </button>
    </div>

    <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row gap-4 justify-between">
      <input
        :value="assetSearch"
        @input="$emit('update-asset-search', $event.target.value)"
        type="text"
        placeholder="ค้นหาตามชื่อ เลขครุภัณฑ์ หรือหมายเลขซีเรียล..."
        class="w-full sm:w-80 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <select
        :value="assetStatusFilter"
        @change="$emit('update-asset-status-filter', $event.target.value)"
        class="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <option value="">ทุกสถานะ</option>
        <option value="Available">พร้อมใช้งาน</option>
        <option value="Borrowed">กำลังถูกยืม</option>
        <option value="Maintenance">อยู่ระหว่างซ่อมบำรุง</option>
        <option value="Retired">จำหน่าย/เลิกใช้งาน</option>
      </select>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <table class="w-full text-left text-sm">
        <thead class="bg-slate-100 text-slate-600 uppercase text-xs">
          <tr>
            <th class="p-3">เลขครุภัณฑ์</th>
            <th class="p-3">ชื่ออุปกรณ์ / ยี่ห้อ</th>
            <th class="p-3">หมวดหมู่</th>
            <th class="p-3">หมายเลขซีเรียล</th>
            <th class="p-3">หมายเลขใบงานซ่อม</th>
            <th class="p-3">สถานะ</th>
            <th class="p-3 text-right">การดำเนินการ</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr
            v-for="item in assets"
            :key="item.id"
            class="hover:bg-slate-50 transition"
          >
            <td class="p-3 font-semibold text-slate-900">
              {{ item.assetCode }}
            </td>
            <td class="p-3">
              <div class="font-medium text-slate-800">{{ item.name }}</div>
              <div class="text-xs text-slate-500">{{ item.brand }}</div>
            </td>
            <td class="p-3">
              {{ getCategoryName(item.categoryId) }}
            </td>
            <td class="p-3 font-mono text-xs text-slate-600">
              {{ item.serialNumber }}
            </td>
            <td class="p-3">
              <span
                v-if="item.repairTicket"
                class="text-rose-600 font-medium bg-rose-50 px-2 py-1 rounded text-xs"
              >
                {{ item.repairTicket }}
              </span>
              <span v-else class="text-slate-400 text-xs">-</span>
            </td>
            <td class="p-3">
              <span
                class="px-2.5 py-1 rounded-full text-xs font-semibold"
                :class="getStatusBadge(item.status)"
              >
                {{
                  item.status === 'Available' ? 'พร้อมใช้งาน' :
                  item.status === 'Borrowed' ? 'กำลังถูกยืม' :
                  item.status === 'Maintenance' ? 'อยู่ระหว่างซ่อมบำรุง' :
                  item.status === 'Retired' ? 'จำหน่าย/เลิกใช้งาน' :
                  'ไม่ทราบสถานะ'
                }}
              </span>
            </td>
            <td class="p-3 text-right space-x-2">
              <button
                @click="$emit('open-asset-modal', item)"
                class="text-indigo-600 hover:underline text-xs font-medium"
              >
                แก้ไข
              </button>
              <button
                @click="$emit('delete-asset', item.id)"
                class="text-rose-600 hover:underline text-xs font-medium"
              >
                ลบ
              </button>
            </td>
          </tr>
          <tr v-if="assets.length === 0">
            <td colspan="7" class="p-8 text-center text-slate-400">
              ไม่พบครุภัณฑ์/อุปกรณ์ที่ตรงกับเงื่อนไขการค้นหา
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>