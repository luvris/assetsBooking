<script setup>
const props = defineProps({
    logs: { type: Array, required: true },
    clearAllSupplyLogs: { type: Function, required: false },
});
</script>

<template>
    <section class="space-y-6 max-w-6xl mx-auto">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <h2 class="text-2xl font-bold tracking-tight text-slate-900">
                    ประวัติการเบิก/เติมวัสดุสิ้นเปลือง
                </h2>
            </div>

            <div class="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                <button v-if="clearAllSupplyLogs" @click="clearAllSupplyLogs"
                    class="px-3 py-2 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs sm:text-sm font-medium hover:bg-rose-100">
                    ลบประวัติการเบิก/เติมทั้งหมด (DEV)
                </button>
            </div>
        </div>

        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table class="w-full text-left text-sm">
                <thead class="bg-slate-100 text-slate-600 uppercase text-xs">
                    <tr>
                        <th class="p-3">วันที่</th>
                        <th class="p-3">ชื่อวัสดุ</th>
                        <th class="p-3">หมวดหมู่</th>
                        <th class="p-3 text-right">จำนวน</th>
                        <th class="p-3">ผู้เบิก</th>
                        <th class="p-3">หน่วยงาน / แผนก</th>
                        <th class="p-3">หมายเหตุ</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                    <tr v-for="log in logs" :key="log.id" class="hover:bg-slate-50 transition">
                        <!-- วันที่ -->
                        <td class="p-3 text-xs text-slate-500">
                            <div v-if="log.timestamp && log.timestamp.toDate">
                                {{ log.timestamp.toDate().toLocaleDateString('th-TH') }}
                            </div>
                            <div v-else>
                                -
                            </div>
                        </td>

                        <!-- ชื่อวัสดุ -->
                        <td class="p-3">
                            <div class="font-medium text-slate-800">
                                {{ log.supplyName || '-' }}
                            </div>
                            <div class="text-xs text-slate-400" v-if="log.unit">
                                หน่วย: {{ log.unit }}
                            </div>
                        </td>

                        <!-- หมวดหมู่ -->
                        <td class="p-3 text-sm text-slate-700">
                            {{ log.categoryName || '-' }}
                        </td>

                        <!-- จำนวน (IN/OUT) -->
                        <td class="p-3 text-right">
                            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border"
                                :class="log.type === 'IN'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-rose-50 text-rose-700 border-rose-200'">
                                <span v-if="log.type === 'IN'">+{{ log.quantity }}</span>
                                <span v-else>-{{ log.quantity }}</span>
                                <span v-if="log.unit" class="ml-1 text-[11px]">
                                    {{ log.unit }}
                                </span>
                            </span>
                        </td>

                        <!-- ผู้เบิก -->
                        <td class="p-3">
                            <span class="text-sm text-slate-800">
                                {{ log.requesterName || '-' }}
                            </span>
                        </td>

                        <!-- หน่วยงาน -->
                        <td class="p-3">
                            <span class="text-xs text-slate-600">
                                {{ log.department || '-' }}
                            </span>
                        </td>

                        <!-- หมายเหตุ -->
                        <td class="p-3">
                            <span class="text-xs text-slate-600">
                                {{ log.note || '-' }}
                            </span>
                        </td>
                    </tr>

                    <tr v-if="logs.length === 0">
                        <td colspan="7" class="p-6 text-center text-slate-400">
                            ยังไม่มีประวัติการเบิก/เติมวัสดุ
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </section>
</template>