<script setup>
const props = defineProps({
  categories: { type: Array, required: true },
});

const emits = defineEmits(['open-category-modal', 'delete-category']);
</script>

<template>
  <section class="space-y-6 max-w-4xl mx-auto">
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h2 class="text-2xl font-bold tracking-tight text-slate-900">
          จัดการหมวดหมู่
        </h2>
      </div>
      <button
        @click="$emit('open-category-modal')"
        class="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 shadow-sm transition"
      >
        เพิ่มหมวดหมู่
      </button>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <table class="w-full text-left text-sm">
        <thead class="bg-slate-100 text-slate-600 uppercase text-xs">
          <tr>
            <th class="p-3">ชื่อหมวดหมู่</th>
            <th class="p-3">ประเภท</th>
            <th class="p-3 text-right">การดำเนินการ</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr
            v-for="cat in categories"
            :key="cat.id"
            class="hover:bg-slate-50 transition"
          >
            <td class="p-3 font-medium text-slate-800">
              {{ cat.name }}
            </td>
            <td class="p-3 uppercase text-xs font-bold text-slate-500">
              {{ cat.type === 'asset' ? 'ครุภัณฑ์/อุปกรณ์' : 'วัสดุสิ้นเปลือง' }}
            </td>
            <td class="p-3 text-right">
              <button
                @click="$emit('delete-category', cat.id)"
                class="text-rose-600 hover:underline text-xs font-medium"
              >
                ลบหมวดหมู่
              </button>
            </td>
          </tr>
          <tr v-if="categories.length === 0">
            <td colspan="3" class="p-6 text-center text-slate-400">
              ยังไม่มีหมวดหมู่ โปรดเพิ่มหมวดหมู่ใหม่
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>