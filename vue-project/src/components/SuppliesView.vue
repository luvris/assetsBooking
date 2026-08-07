<script setup>
const props = defineProps({
  supplies: { type: Array, required: true },
  categories: { type: Array, required: true },
  supplySearch: { type: String, required: true },
  getCategoryName: { type: Function, required: true },
  monthlySummary: { type: Object, required: true, },
});

const emits = defineEmits([
  'update-supply-search',
  'open-supply-modal',
  'open-supply-tx-modal',
]);
</script>

<template>
  <section class="space-y-6 max-w-6xl mx-auto">
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h2 class="text-2xl font-bold tracking-tight text-slate-900">
          คลังวัสดุสิ้นเปลือง
        </h2>
      </div>
      <button @click="$emit('open-supply-modal')"
        class="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 shadow-sm transition">
        เพิ่มรายการวัสดุ
      </button>
    </div>

    <div
      class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row gap-4 justify-between">
      <input :value="supplySearch" @input="$emit('update-supply-search', $event.target.value)" type="text"
        placeholder="ค้นหาตามชื่อวัสดุ..."
        class="w-full sm:w-80 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <table class="w-full text-left text-sm">
        <thead class="bg-slate-100 text-slate-600 uppercase text-xs">
          <tr>
            <th class="p-3">ชื่อวัสดุ</th>
            <th class="p-3">หมวดหมู่</th>
            <th class="p-3">จำนวนคงเหลือ</th>
            <th class="p-3">ระดับแจ้งเตือนขั้นต่ำ</th>
            <th class="p-3 text-right">การดำเนินการสต็อก</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="item in supplies" :key="item.id" class="hover:bg-slate-50 transition">
            <td class="p-3 font-medium text-slate-800">
              {{ item.name }}
            </td>
            <td class="p-3">
              {{ getCategoryName(item.categoryId) }}
            </td>
            <td class="p-3">
              <span class="font-bold"
                :class="item.quantity <= item.minThreshold ? 'text-rose-600' : 'text-emerald-600'">
                {{ item.quantity }} {{ item.unit }}
              </span>
            </td>
            <td class="p-3 text-slate-500">
              {{ item.minThreshold }} {{ item.unit }}
            </td>
            <td class="p-3 text-right space-x-2">
              <button @click="$emit('open-supply-tx-modal', { id: item.id, type: 'IN' })"
                class="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-xs font-semibold hover:bg-emerald-100">
                เติมสต็อก
              </button>
              <button @click="$emit('open-supply-tx-modal', { id: item.id, type: 'OUT' })"
                class="px-2 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded text-xs font-semibold hover:bg-rose-100">
                เบิกใช้
              </button>
              <button @click="$emit('open-supply-modal', item)"
                class="text-indigo-600 hover:underline text-xs font-medium ml-2">
                แก้ไข
              </button>
            </td>
          </tr>
          <tr v-if="supplies.length === 0">
            <td colspan="5" class="p-8 text-center text-slate-400">
              ไม่พบรายการวัสดุที่ตรงกับเงื่อนไขการค้นหา
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>