<script setup>
const props = defineProps({
    assets: { type: Array, required: true },
    borrowRecords: { type: Array, required: true },
    clearAllBorrowLogs: { type: Function, required: false }, //Dev Mode
});

const emits = defineEmits(['open-borrow-modal', 'return-asset']);
</script>

<template>
    <section class="space-y-6 max-w-6xl mx-auto">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <h2 class="text-2xl font-bold tracking-tight text-slate-900">
                    ระบบบันทึกการยืม–คืนอุปกรณ์
                </h2>

                <button v-if="clearAllBorrowLogs" @click="clearAllBorrowLogs"
                    class="px-3 py-1 bg-rose-100 text-rose-600 rounded-lg text-xs hover:bg-rose-200">
                    ลบประวัติยืม–คืนทั้งหมด (DEV)
                </button>
            </div>
            <button @click="$emit('open-borrow-modal')"
                class="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 shadow-sm transition">
                บันทึกการยืมอุปกรณ์
            </button>
        </div>

        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table class="w-full text-left text-sm">
                <thead class="bg-slate-100 text-slate-600 uppercase text-xs">
                    <tr>
                        <th class="p-3">อุปกรณ์</th>
                        <th class="p-3">ผู้ยืม</th>
                        <th class="p-3">สถานที่</th>
                        <th class="p-3">ช่วงวันที่ยืม</th>
                        <th class="p-3">งาน/โครงการ</th>
                        <th class="p-3">สถานะ</th>
                        <th class="p-3 text-right">การดำเนินการ</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                    <tr v-for="rec in borrowRecords" :key="rec.id" class="hover:bg-slate-50 transition">
                        <td class="p-3 font-medium">
                            {{assets.find(a => a.id === rec.assetId)?.name || 'ไม่พบอุปกรณ์'}}
                        </td>
                        <td class="p-3">{{ rec.borrowerName }}</td>
                        <td class="p-3">
                            <span class="text-xs text-slate-600">
                                {{ rec.location || '-' }}
                            </span>
                        </td>
                        <td class="p-3 text-xs">
                            <div>
                                {{ rec.borrowDate || '-' }} → {{ rec.dueDate || '-' }}
                            </div>
                            <div v-if="rec.totalDays" class="text-slate-500">
                                รวม {{ rec.totalDays }} วัน
                                <span v-if="rec.status === 'Returned' && rec.lateDays > 0"
                                    class="text-rose-600 font-semibold">
                                    (คืนช้า {{ rec.lateDays }} วัน)
                                </span>
                                <span v-else-if="rec.status === 'Returned'" class="text-emerald-600">
                                    (คืนตรงเวลา)
                                </span>
                            </div>
                            <div v-else class="text-slate-400">
                                -
                            </div>
                        </td>
                        <td class="p-3">
                            <span class="px-2.5 py-1 rounded-full text-xs font-semibold" :class="rec.status === 'Active'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'">
                                {{ rec.status === 'Active' ? 'กำลังยืมใช้งาน' : 'คืนแล้ว' }}
                            </span>
                        </td>
                        <td class="p-3 text-right">
                            <button v-if="rec.status === 'Active'" @click="$emit('return-asset', rec)"
                                class="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs hover:bg-emerald-700 transition">
                                บันทึกคืนอุปกรณ์
                            </button>
                            <span v-else class="text-slate-400 text-xs">
                                เสร็จสิ้น
                            </span>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </section>
</template>