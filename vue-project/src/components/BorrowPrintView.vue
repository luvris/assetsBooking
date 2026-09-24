<script setup>
import { computed, nextTick } from 'vue';

import {
  normalizeAsset,
} from '../utils/inventoryRecords.js';

import { buildBorrowPrintData } from '../utils/buildBorrowPrintData.js';
import BorrowFormA62 from './print/BorrowFormA62.vue';
import BorrowFormA61 from './print/BorrowFormA61.vue';

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
 * รองรับทั้งรายการเดียว (assetId) และหลายรายการ (assets[])
 */
const assetRecords = computed(() => {
  const borrow = props.borrowRecord || {};
  const listedAssets = Array.isArray(borrow.assets) ? borrow.assets : [];

  if (listedAssets.length > 0) {
    return listedAssets.map((item) => {
      const matched = props.assets.find(
        (asset) => Number(asset.id) === Number(item.id),
      );

      return matched
        ? {
          ...matched,
          quantity: item.quantity || 1,
          unit: matched.unit || 'เครื่อง',
        }
        : {
          ...item,
          name: item.name || item.assetName,
          quantity: item.quantity || 1,
          unit: item.unit || 'เครื่อง',
        };
    });
  }

  const assetId = Number(borrow.assetId ?? borrow.asset_id);
  const matched = props.assets.find(
    (asset) => Number(asset.id) === assetId,
  );

  return matched
    ? [{
      ...matched,
      quantity: borrow.quantity || 1,
      unit: matched.unit || 'เครื่อง',
    }]
    : [];
});

/**
 * Object ที่แบบฟอร์ม A6-1/A6-2 รับไปแสดง
 */
const printData = computed(() => (
  buildBorrowPrintData(
    props.borrowRecord,
    assetRecords.value.map((item) => ({
      ...normalizeAsset(item),
      quantity: item.quantity || 1,
      unit: item.unit || 'เครื่อง',
    })),
  )
));

const printForm = async () => {
  await nextTick();

  const documentElement = document.getElementById('borrow-print-document');

  if (!documentElement) {
    window.alert('ไม่พบเนื้อหาเอกสารสำหรับพิมพ์');
    return;
  }

  const printWindow = window.open('', '_blank', 'width=900,height=1000');

  if (!printWindow) {
    window.alert(
      'ไม่สามารถเปิดหน้าต่างพิมพ์ได้ กรุณาอนุญาต Pop-up สำหรับเว็บไซต์นี้',
    );
    return;
  }

  const styles = Array.from(
    document.querySelectorAll('link[rel="stylesheet"], style'),
  )
    .map((styleElement) => styleElement.outerHTML)
    .join('\n');

  const documentHtml = documentElement.outerHTML;

  printWindow.document.open();

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="th">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>แบบฟอร์มขอยืมครุภัณฑ์ A6-2</title>

        ${styles}

        <style>
          @page {
            size: A4 portrait;
            margin: 0;
          }

          html,
          body {
            margin: 0;
            padding: 0;
            background: #ffffff;
          }

          #borrow-print-document {
            box-sizing: border-box;
            width: 210mm;
            min-height: 297mm;
            margin: 0;
            padding: 10mm 12mm;
            background: #ffffff;
          }

          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        </style>
      </head>

      <body>
        ${documentHtml}
      </body>
    </html>
  `);

  printWindow.document.close();

  printWindow.focus();

  // รอให้ HTML/CSS ใน popup render ก่อน แล้วเปิด print dialog
  window.setTimeout(() => {
    printWindow.print();
  }, 500);
};

const goBack = () => {
  emit('back');
};
</script>

<template>
  <main class="print-page-root min-h-screen bg-slate-200 py-6">
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

    <BorrowFormA61 v-if="printData.formType === 'OUT_OF_AREA'" :data="printData" />

    <BorrowFormA62 v-else :data="printData" />
  </main>
</template>