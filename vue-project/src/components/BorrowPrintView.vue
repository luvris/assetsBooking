<script setup>
import { computed } from 'vue';

import {
  normalizeAsset,
  normalizeBorrow,
} from '../utils/inventoryRecords.js';

import { buildBorrowPrintData } from '../utils/buildBorrowPrintData.js';
import BorrowFormA62 from './print/BorrowFormA62.vue';

const props = defineProps({
  borrowRecord: {
    type: Object,
    required: true,
  },

  assets: {
    type: Array,
    required: true,
  },
});

const emit = defineEmits(['back']);

/**
 * หา asset จากรายการ assets ที่ App.vue โหลดไว้แล้ว
 * borrowRecord มี assetId / asset_id
 */
const assetRecord = computed(() => {
  const borrow = props.borrowRecord || {};

  const assetId = Number(
    borrow.assetId
    ?? borrow.asset_id,
  );

  return props.assets.find(
    (asset) => Number(asset.id) === assetId,
  ) || null;
});

/**
 * เปลี่ยน borrow record ให้ใช้ชื่อ field กลาง เช่น:
 * borrowerName, borrowedAt, dueAt, formType
 */
const borrow = computed(() => {
  const selectedAsset = assetRecord.value;

  return normalizeBorrow(props.borrowRecord, {
    assetId: selectedAsset?.id,
    assetCode: selectedAsset?.assetCode,
    assetName: selectedAsset?.name,
  });
});

/**
 * เปลี่ยน asset เป็นรูปแบบกลาง
 */
const asset = computed(() => (
  assetRecord.value
    ? normalizeAsset(assetRecord.value)
    : null
));

/**
 * Object ที่แบบฟอร์ม A6-2 รับไปแสดง
 */
const printData = computed(() => (
  buildBorrowPrintData(
    borrow.value,
    asset.value
      ? [{
        ...asset.value,
        quantity: borrow.value.quantity || 1,
        unit: asset.value.unit || 'เครื่อง',
      }]
      : [],
  )
));

const printForm = () => {
  window.print();
};

const goBack = () => {
  emit('back');
};
</script>

<template>
  <main class="min-h-screen bg-slate-200 py-6">
    <!-- ปุ่ม toolbar: เห็นใน browser แต่ไม่ติดใน PDF -->
    <div class="no-print mx-auto mb-4 flex w-[210mm] items-center justify-between">
      <button type="button"
        class="rounded-lg bg-slate-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
        @click="goBack">
        กลับหน้ารายการยืม
      </button>

      <button type="button"
        class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        @click="printForm">
        พิมพ์ / บันทึกเป็น PDF
      </button>
    </div>

    <!-- ตอนนี้แสดง A6-2 ก่อน -->
    <BorrowFormA62 :data="printData" />
  </main>
</template>