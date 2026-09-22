<script setup>
import { computed, onMounted, ref } from 'vue';

import {
  normalizeAsset,
  normalizeBorrow,
  OUT_OF_AREA_FORM_TYPE,
} from '../utils/inventoryRecords.js';

import { buildBorrowPrintData } from '../utils/buildBorrowPrintData.js';

// import BorrowFormA61 from './print/BorrowFormA61.vue';
import BorrowFormA62 from './print/BorrowFormA62.vue';

const props = defineProps({
  borrowId: {
    type: [Number, String],
    required: true,
  },
});

const emit = defineEmits(['back']);

const loading = ref(true);
const error = ref('');

const borrowRecord = ref(null);
const assetRecord = ref(null);

/**
 * แปลงวันใน format MariaDB:
 * YYYY-MM-DD HH:mm:ss
 *
 * เป็นวันที่ไทยสำหรับวางลงในแบบฟอร์ม
 */
const formatThaiDate = (value) => {
  if (!value) {
    return '........................................';
  }

  const date = new Date(String(value).replace(' ', 'T'));

  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }

  return new Intl.DateTimeFormat('th-TH', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
};

/**
 * normalize ข้อมูลรายการยืมจาก borrow_return
 */
const borrow = computed(() => {
  if (!borrowRecord.value) {
    return null;
  }

  const rawAsset = assetRecord.value || {};

  return normalizeBorrow(borrowRecord.value, {
    assetId: rawAsset.id,
    assetCode: rawAsset.asset_code || rawAsset.assetCode,
    assetName: rawAsset.name || rawAsset.asset_name || rawAsset.assetName,
  });
});

/**
 * normalize ข้อมูลครุภัณฑ์จาก inventory_assets
 */
const asset = computed(() => {
  if (!assetRecord.value) {
    return null;
  }

  return normalizeAsset(assetRecord.value);
});

/**
 * ข้อมูลรูปแบบเดียวที่ BorrowFormA61 และ BorrowFormA62 ใช้
 */
const printData = computed(() => {
  if (!borrow.value) {
    return null;
  }

  const normalizedAsset = asset.value;

  return buildBorrowPrintData(
    borrow.value,
    normalizedAsset
      ? [{
        ...normalizedAsset,
        quantity: borrow.value.quantity || 1,
        unit: normalizedAsset.unit || 'เครื่อง',
      }]
      : [],
  );
});

/**
 * โหลดข้อมูลใบยืมและครุภัณฑ์
 *
 * endpoint ฝั่ง backend ต้องส่งข้อมูลรูปแบบ:
 *
 * {
 *   "borrow": { ...ข้อมูล borrow_return... },
 *   "asset": { ...ข้อมูล inventory_assets... }
 * }
 */
const loadPrintData = async () => {
  try {
    loading.value = true;
    error.value = '';

    const response = await fetch(
      `/api/borrow-return/${props.borrowId}/print`,
    );

    if (!response.ok) {
      throw new Error('ไม่สามารถโหลดข้อมูลใบยืมสำหรับพิมพ์ได้');
    }

    const payload = await response.json();

    if (!payload?.borrow) {
      throw new Error('API ไม่ได้ส่งข้อมูลรายการยืมกลับมา');
    }

    borrowRecord.value = payload.borrow;
    assetRecord.value = payload.asset || null;
  } catch (err) {
    console.error(err);

    error.value = err?.message
      || 'เกิดข้อผิดพลาดขณะโหลดข้อมูลใบยืม';
  } finally {
    loading.value = false;
  }
};

/**
 * เปิด Browser Print Dialog
 *
 * ผู้ใช้เลือก:
 * - Save to PDF
 * - Microsoft Print to PDF
 * - เครื่องพิมพ์จริง
 */
const printForm = () => {
  window.print();
};

/**
 * กลับไปหน้าระบบยืม-คืน
 *
 * App.vue จะรับ event @back แล้วเปลี่ยน currentView เป็น borrow
 */
const goBack = () => {
  emit('back');
};

onMounted(loadPrintData);
</script>

<template>
  <main class="min-h-screen bg-slate-200 py-6">
    <!-- Loading -->
    <div v-if="loading" class="no-print mx-auto w-[210mm] rounded-xl bg-white p-8 text-center text-slate-600 shadow-sm">
      กำลังโหลดข้อมูลใบยืมสำหรับสร้างเอกสาร...
    </div>

    <!-- Error -->
    <div v-else-if="error"
      class="no-print mx-auto w-[210mm] rounded-xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-700 shadow-sm">
      <p class="font-semibold">
        ไม่สามารถเปิดหน้าเอกสารได้
      </p>

      <p class="mt-2 text-sm">
        {{ error }}
      </p>

      <button type="button"
        class="mt-5 rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        @click="goBack">
        กลับหน้ารายการยืม
      </button>
    </div>

    <!-- Print preview -->
    <template v-else-if="printData">
      <!-- Toolbar: เห็นบนหน้าจอ แต่ไม่ติดตอน Print/PDF -->
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

      <!-- A6-1: ยืมออกนอกพื้นที่ -->
      <BorrowFormA61 v-if="printData.formType === OUT_OF_AREA_FORM_TYPE" :data="printData" />

      <!-- A6-2: ยืมภายในโรงพยาบาล -->
      <BorrowFormA62 v-else :data="printData" />
    </template>

    <!-- กรณีไม่มีข้อมูล -->
    <div v-else class="no-print mx-auto w-[210mm] rounded-xl bg-white p-8 text-center text-slate-500 shadow-sm">
      ไม่พบข้อมูลสำหรับสร้างใบยืม

      <button type="button"
        class="mt-5 rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        @click="goBack">
        กลับหน้ารายการยืม
      </button>
    </div>
  </main>
</template>