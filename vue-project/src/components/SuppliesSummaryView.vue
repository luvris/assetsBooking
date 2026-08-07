<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
    monthlySummary: {
        type: Object,
        required: true, // { months: [...], summary: [...] }
    },
});

const selectedMonth = ref('');

// ตั้งค่าเริ่มต้นเป็นเดือนล่าสุดที่มีข้อมูล
watch(
    () => props.monthlySummary.months,
    (months) => {
        if (months && months.length && !selectedMonth.value) {
            selectedMonth.value = months[0];
        }
    },
    { immediate: true }
);

const currentMonthData = computed(() => {
    if (!selectedMonth.value) return null;
    const found = props.monthlySummary.summary.find(
        item => item.month === selectedMonth.value
    );
    return found || null;
});
</script>

<template>
    <section class="space-y-6 max-w-5xl mx-auto">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <h2 class="text-2xl font-bold tracking-tight text-slate-900">
                    สรุปยอดใช้วัสดุสิ้นเปลืองรายเดือน
                </h2>
            </div>

            <div class="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                <div>
                    <label class="block text-xs text-slate-600 mb-1">เลือกเดือน</label>
                    <select v-model="selectedMonth"
                        class="px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white">
                        <option v-for="m in monthlySummary.months" :key="m" :value="m">
                            {{ m }}
                        </option>
                    </select>
                </div>
            </div>
        </div>

        <!-- ไม่มีข้อมูลเลย -->
        <div v-if="!monthlySummary.months || monthlySummary.months.length === 0"
            class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-center text-slate-400">
            ยังไม่มีประวัติการเบิก/เติมวัสดุสำหรับสรุป
        </div>

        <!-- ยังไม่ได้เลือกเดือน -->
        <div v-else-if="!currentMonthData"
            class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-center text-slate-400">
            กรุณาเลือกเดือนที่ต้องการดูสรุป
        </div>

        <!-- แสดงข้อมูลของเดือนที่เลือก -->
        <div v-else class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                    <div class="text-xs font-semibold text-emerald-700 uppercase">
                        นำเข้าในเดือนนี้ (IN)
                    </div>
                    <div class="mt-2 text-2xl font-bold text-emerald-900">
                        {{ currentMonthData.totalIn }}
                    </div>
                    <div class="text-xs text-emerald-700 mt-1">
                        หน่วย (รวมทุกแผนก)
                    </div>
                </div>

                <div class="bg-rose-50 border border-rose-200 rounded-xl p-4">
                    <div class="text-xs font-semibold text-rose-700 uppercase">
                        ใช้ไปในเดือนนี้ (OUT)
                    </div>
                    <div class="mt-2 text-2xl font-bold text-rose-900">
                        {{ currentMonthData.totalOut }}
                    </div>
                    <div class="text-xs text-rose-700 mt-1">
                        หน่วย (รวมทุกแผนก)
                    </div>
                </div>
            </div>

            <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div class="px-4 py-3 bg-slate-100 flex items-center justify-between">
                    <div class="font-semibold text-slate-800">
                        การใช้วัสดุแยกตามหน่วยงาน/แผนก ในเดือน {{ currentMonthData.month }}
                    </div>
                    <div class="text-xs text-slate-500">
                        รวมทั้งหมด {{ currentMonthData.totalOut }} หน่วย
                    </div>
                </div>

                <table class="w-full text-left text-sm">
                    <thead class="bg-slate-50 text-slate-600 uppercase text-xs">
                        <tr>
                            <th class="p-3">หน่วยงาน / แผนก</th>
                            <th class="p-3 text-right">จำนวนที่ใช้ (OUT)</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        <template v-for="dept in currentMonthData.departments" :key="dept.department">
                            <!-- แถวหัวข้อแผนก + ยอดรวมของแผนก -->
                            <tr class="bg-white">
                                <td class="p-3 text-sm font-medium text-slate-800">
                                    {{ dept.department }}
                                </td>

                                <td class="p-3 text-right text-sm font-semibold text-slate-800">
                                    {{ dept.totalOut }}
                                </td>
                            </tr>

                            <!-- แถวรายการวัสดุของแต่ละแผนก -->
                            <tr v-for="item in dept.items" :key="`${dept.department}-${item.supplyId}`"
                                class="bg-slate-50/50">
                                <td class="px-3 pb-2 pl-7 text-xs text-slate-600">
                                    • {{ item.name }}
                                </td>

                                <td class="px-3 pb-2 text-right text-xs font-medium text-slate-800 whitespace-nowrap">
                                    {{ item.totalQty }} {{ item.unit }}
                                </td>
                            </tr>
                        </template>

                        <tr v-if="currentMonthData.departments.length === 0">
                            <td colspan="2" class="p-4 text-center text-slate-400">
                                ยังไม่มีการเบิกใช้ (OUT) ในเดือนนี้
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </section>
</template>