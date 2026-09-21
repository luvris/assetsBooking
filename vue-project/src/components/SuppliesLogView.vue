<script setup>
import { computed } from 'vue';
import usePagination from '../composables/usePagination.js';
import PaginationBar from '../components/PaginationBar.vue';

const props = defineProps({
    logs: {
        type: Array,
        required: true,
    },
    clearAllSupplyLogs: {
        type: Function,
        required: false,
    },
});

const {
    currentPage,
    totalItems,
    totalPages,
    startIndex,
    endIndex,
    paginatedItems: paginatedLogs,
    goToPage,
} = usePagination(computed(() => props.logs), {
    perPage: 5,
});
</script>

<template>
    <section class="mx-auto max-w-6xl space-y-6">
        <div class="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
                <h2 class="text-2xl font-bold tracking-tight text-slate-900">
                    ประวัติการเบิก/เติมวัสดุสิ้นเปลือง
                </h2>
            </div>

            <!-- <button v-if="clearAllSupplyLogs" type="button"
                class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100 sm:text-sm"
                @click="clearAllSupplyLogs">
                ลบประวัติการเบิก/เติมทั้งหมด (DEV)
            </button> -->
        </div>

        <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div class="overflow-x-auto">
                <table class="w-full min-w-[1050px] text-left text-sm">
                    <thead class="bg-slate-100 text-xs uppercase text-slate-600">
                        <tr>
                            <th class="p-3">วันที่</th>
                            <th class="p-3">ชื่อวัสดุ</th>
                            <th class="p-3">หมวดหมู่</th>
                            <th class="p-3 text-right">จำนวน</th>
                            <th class="p-3">ผู้เบิก</th>
                            <th class="p-3">หน่วยงาน / แผนก</th>
                            <th class="p-3">หมายเลขใบงานซ่อม</th>
                            <th class="p-3">หมายเหตุ</th>
                        </tr>
                    </thead>

                    <tbody class="divide-y divide-slate-100">
                        <tr v-for="log in paginatedLogs" :key="log.id" class="transition hover:bg-slate-50">
                            <td class="p-3 text-xs text-slate-500">
                                {{ log.timestamp || '-' }}
                            </td>

                            <td class="p-3">
                                <div class="font-medium text-slate-800">
                                    {{ log.supplyName || '-' }}
                                </div>

                                <div v-if="log.itemCode" class="mt-0.5 text-xs font-medium text-emerald-600">
                                    รหัสวัสดุ: {{ log.itemCode }}
                                </div>

                                <div class="text-xs text-slate-500">
                                    หน่วย: {{ log.unit || '-' }}
                                </div>
                            </td>

                            <td class="p-3 text-sm text-slate-700">
                                {{ log.categoryName || '-' }}
                            </td>

                            <td class="p-3 text-right">
                                <span
                                    class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold"
                                    :class="log.type === 'IN'
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                        : 'border-rose-200 bg-rose-50 text-rose-700'
                                        ">
                                    <span v-if="log.type === 'IN'">
                                        +{{ log.quantity }}
                                    </span>

                                    <span v-else>
                                        -{{ log.quantity }}
                                    </span>

                                    <span v-if="log.unit" class="ml-1 text-[11px]">
                                        {{ log.unit }}
                                    </span>
                                </span>
                            </td>

                            <td class="p-3">
                                <span class="text-sm text-slate-800">
                                    {{ log.requesterName || '-' }}
                                </span>
                            </td>

                            <td class="p-3">
                                <span class="text-xs text-slate-600">
                                    {{ log.department || '-' }}
                                </span>
                            </td>

                            <td class="p-3">
                                <span class="text-xs text-slate-600">
                                    {{ log.workOrderNo || '-' }}
                                </span>
                            </td>

                            <td class="p-3">
                                <span class="text-xs text-slate-600">
                                    {{ log.note || '-' }}
                                </span>
                            </td>
                        </tr>

                        <tr v-if="totalItems === 0">
                            <td colspan="8" class="p-6 text-center text-slate-400">
                                ยังไม่มีประวัติการเบิก/เติมวัสดุ
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <PaginationBar :current-page="currentPage" :total-pages="totalPages" :total-items="totalItems"
                :start-index="startIndex" :end-index="endIndex" item-label="รายการเบิก/เติม"
                @update:current-page="goToPage" />
        </div>
    </section>
</template>