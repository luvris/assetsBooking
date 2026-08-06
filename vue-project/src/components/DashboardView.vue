<script setup>

import { computed } from 'vue';

const props = defineProps({
    stats: { type: Object, required: true },
    assets: { type: Array, required: true },
    borrowRecords: { type: Array, required: true },
    supplies: { type: Array, required: true },
    suppliesUsageByCategory: { type: Array, required: true },
    suppliesUsageByItem: { type: Array, required: true },
    assetSummaryByCategory: { type: Array, required: true },
    suppliesUsageSummary: { type: Object, required: true },
    getStatusBadge: { type: Function, required: true },
    getCategoryName: { type: Function, required: true },
    getBorrowRowStatus: { type: Function, required: true },
});

const emits = defineEmits(['return-asset']);

const groupSuppliesByCategory = computed(() => {
    const groups = {};

    // ใช้ props.suppliesUsageByItem (อย่าลืม props.)
    for (const item of props.suppliesUsageByItem) {
        const catId = item.categoryId || 'uncategorized';
        if (!groups[catId]) {
            groups[catId] = {
                categoryId: catId,
                categoryName: item.categoryName || 'ไม่มีหมวดหมู่',
                items: [],
            };
        }
        groups[catId].items.push(item);
    }

    return Object.values(groups).map(group => {
        group.items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        return group;
    }).sort((a, b) => (a.categoryName || '').localeCompare(b.categoryName || ''));
});

</script>

<template>
    <section class="space-y-6 max-w-6xl mx-auto">
        <h2 class="text-2xl font-bold tracking-tight text-slate-900">
            ภาพรวมอุปกรณ์
        </h2>

        <!-- Stats -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                <p class="text-xs font-semibold uppercase text-slate-500">จำนวนครุภัณฑ์ทั้งหมด</p>
                <p class="text-3xl font-extrabold text-slate-800 mt-2">{{ stats.totalAssets }}</p>
            </div>
            <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                <p class="text-xs font-semibold uppercase text-emerald-600">พร้อมใช้งาน</p>
                <p class="text-3xl font-extrabold text-emerald-600 mt-2">{{ stats.availableAssets }}</p>
            </div>
            <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                <p class="text-xs font-semibold uppercase text-amber-600">กำลังถูกยืมใช้งาน</p>
                <p class="text-3xl font-extrabold text-amber-600 mt-2">{{ stats.borrowedAssets }}</p>
            </div>
            <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                <p class="text-xs font-semibold uppercase text-rose-600">อยู่ระหว่างซ่อมบำรุง</p>
                <p class="text-3xl font-extrabold text-rose-600 mt-2">{{ stats.maintenanceAssets }}</p>
            </div>
            <div class="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                <p class="text-xs font-semibold uppercase text-purple-600">วัสดุใกล้ถึงจุดแจ้งเตือน</p>
                <p class="text-3xl font-extrabold text-purple-600 mt-2">{{ stats.lowSupplies }}</p>
            </div>
        </div>

        <!-- Active Borrows + Low Stock -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <!-- Active borrow -->
            <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 class="text-lg font-bold text-slate-800 mb-4">รายการยืมอุปกรณ์ที่ยังไม่คืน</h3>
                <div class="overflow-x-auto">
                    <table class="w-full text-left text-sm">
                        <thead class="bg-slate-100 text-slate-600 uppercase text-xs">
                            <tr>
                                <th class="p-3">อุปกรณ์</th>
                                <th class="p-3">ผู้ยืม</th>
                                <th class="p-3">งาน/โครงการ</th>
                                <th class="p-3">การดำเนินการ</th>
                                <th class="p-3">สถานะการคืน</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            <tr v-for="rec in borrowRecords.filter(r => r.status === 'Active')" :key="rec.id"
                                class="hover:bg-slate-50 transition">
                                <td class="p-3 font-medium">
                                    {{assets.find(a => a.id === rec.assetId)?.name || 'ไม่พบอุปกรณ์'}}
                                </td>

                                <td class="p-3">
                                    {{ rec.borrowerName }}
                                </td>

                                <td class="p-3">
                                    <span class="text-indigo-600 font-medium">
                                        {{ rec.jobTask }}
                                    </span>
                                </td>

                                <td class="p-3">
                                    <button @click="$emit('return-asset', rec)"
                                        class="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs hover:bg-emerald-700 transition">
                                        บันทึกคืนอุปกรณ์
                                    </button>
                                </td>

                                <td class="p-3">
                                    <span v-if="getBorrowRowStatus(rec).type === 'near'"
                                        class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                                        ใกล้ถึงกำหนดคืน (อีก {{ getBorrowRowStatus(rec).daysLeft }} วัน)
                                    </span>

                                    <span v-else-if="getBorrowRowStatus(rec).type === 'overdue'"
                                        class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-100">
                                        เลยกำหนดคืนแล้ว
                                        <span v-if="getBorrowRowStatus(rec).daysLeft !== null">
                                            (ช้า {{ Math.abs(getBorrowRowStatus(rec).daysLeft) }} วัน)
                                        </span>
                                    </span>

                                    <span v-else
                                        class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-50 text-slate-500 border border-slate-100">
                                        กำหนดคืน: {{ rec.dueDate || '-' }}
                                    </span>
                                </td>
                            </tr>

                            <tr v-if="borrowRecords.filter(r => r.status === 'Active').length === 0">
                                <td colspan="5" class="p-4 text-center text-slate-400">
                                    ขณะนี้ไม่มีรายการยืมอุปกรณ์ที่ยังไม่คืน
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Low stock -->
            <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 class="text-lg font-bold text-slate-800 mb-4">วัสดุที่ใกล้ถึงระดับแจ้งเตือน</h3>
                <div class="overflow-x-auto">
                    <table class="w-full text-left text-sm">
                        <thead class="bg-slate-100 text-slate-600 uppercase text-xs">
                            <tr>
                                <th class="p-3">ชื่อวัสดุ</th>
                                <th class="p-3">หมวดหมู่</th>
                                <th class="p-3">จำนวนคงเหลือ</th>
                                <th class="p-3">ระดับขั้นต่ำ</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            <tr v-for="sup in supplies.filter(s => s.quantity <= s.minThreshold)" :key="sup.id">
                                <td class="p-3 font-medium">{{ sup.name }}</td>
                                <td class="p-3">{{ getCategoryName(sup.categoryId) }}</td>
                                <td class="p-3 text-rose-600 font-bold">
                                    {{ sup.quantity }} {{ sup.unit }}
                                </td>
                                <td class="p-3 text-slate-500">
                                    {{ sup.minThreshold }} {{ sup.unit }}
                                </td>
                            </tr>
                            <tr v-if="supplies.filter(s => s.quantity <= s.minThreshold).length === 0">
                                <td colspan="4" class="p-4 text-center text-slate-400">
                                    ระดับสต็อกของวัสดุทุกชิ้นยังคงเหลือมากกว่าระดับขั้นต่ำ
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Summary ครุภัณฑ์/อุปกรณ์ไอที ตามหมวดหมู่ -->
        <section class="mt-6 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div>
                    <h3 class="text-lg font-bold text-slate-800">
                        ภาพรวมครุภัณฑ์/อุปกรณ์ไอทีตามหมวดหมู่
                    </h3>
                </div>
            </div>

            <div v-if="props.assetSummaryByCategory.length === 0" class="text-sm text-slate-400">
                ยังไม่มีข้อมูลครุภัณฑ์ในระบบ
            </div>

            <div v-else class="space-y-4">
                <div v-for="group in props.assetSummaryByCategory" :key="group.categoryId"
                    class="border border-slate-100 rounded-xl">
                    <!-- header หมวด -->
                    <div class="px-4 py-2 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                        <div>
                            <span class="font-semibold text-slate-800">
                                {{ group.categoryName || 'ไม่มีหมวดหมู่' }}
                            </span>
                            <span class="text-xs text-slate-400 ml-2">
                                (ทั้งหมด {{ group.total }} รายการ)
                            </span>
                        </div>
                        <div class="text-xs text-slate-500 space-x-2">
                            <span v-if="group.available">
                                <span class="text-emerald-600 font-semibold">{{ group.available }}</span> พร้อมใช้งาน
                            </span>
                            <span v-if="group.borrowed">
                                · <span class="text-amber-600 font-semibold">{{ group.borrowed }}</span> กำลังยืม
                            </span>
                            <span v-if="group.maintenance">
                                · <span class="text-rose-600 font-semibold">{{ group.maintenance }}</span> ซ่อมบำรุง
                            </span>
                            <span v-if="group.retired">
                                · <span class="text-slate-500 font-semibold">{{ group.retired }}</span> จำหน่าย
                            </span>
                        </div>
                    </div>

                    <!-- รายการอุปกรณ์ในหมวด -->
                    <div class="divide-y divide-slate-100">
                        <div v-for="item in group.items" :key="item.id"
                            class="px-4 py-2 flex justify-between items-center text-sm">
                            <div>
                                <div class="text-slate-800 font-medium">
                                    {{ item.name || '-' }}
                                </div>
                                <div class="text-xs text-slate-500">
                                    {{ item.brand || '' }}
                                </div>
                            </div>
                            <div class="text-right">
                                <div class="text-xs text-slate-400">
                                    เลขครุภัณฑ์: <span class="font-mono text-slate-600">{{ item.assetCode }}</span>
                                </div>
                                <div class="mt-1">
                                    <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                                        :class="getStatusBadge(item.status)">
                                        {{
                                            item.status === 'Available' ? 'พร้อมใช้งาน' :
                                                item.status === 'Borrowed' ? 'กำลังถูกยืม' :
                                                    item.status === 'Maintenance' ? 'อยู่ระหว่างซ่อมบำรุง' :
                                                        item.status === 'Retired' ? 'จำหน่าย/เลิกใช้งาน' :
                                        'ไม่ทราบสถานะ'
                                        }}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- Usage log by item per category -->
        <section class="mt-6 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 class="text-lg font-bold text-slate-800 mb-3">
                รายการวัสดุสิ้นเปลืองในแต่ละหมวด (คงเหลือ / ทั้งหมด)
            </h3>

            <div v-if="groupSuppliesByCategory.length === 0" class="text-sm text-slate-400">
                ยังไม่มีข้อมูลวัสดุในคลัง
            </div>

            <div v-else class="space-y-4">
                <div v-for="(group, index) in groupSuppliesByCategory" :key="group.categoryId || index"
                    class="border border-slate-100 rounded-xl">
                    <div class="px-4 py-2 bg-slate-50 border-b border-slate-100">
                        <span class="font-semibold text-slate-800">
                            {{ group.categoryName || 'ไม่มีหมวดหมู่' }}
                        </span>
                        <span class="text-xs text-slate-400 ml-2">
                            ({{ group.items.length }} รายการ)
                        </span>
                    </div>

                    <div class="divide-y divide-slate-100">
                        <div v-for="item in group.items" :key="item.supplyId"
                            class="px-4 py-2 flex justify-between items-center text-sm">
                            <div class="text-slate-700">
                                {{ item.name || '-' }}
                            </div>
                            <div class="text-right">
                                <span class="font-semibold text-emerald-600">
                                    {{ item.currentQty.toLocaleString() }}
                                </span>
                                <span class="text-slate-400 text-xs ml-1">
                                    / {{ (item.currentQty + item.used).toLocaleString() }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    </section>
</template>