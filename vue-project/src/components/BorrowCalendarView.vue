<script setup>
import { computed, ref } from 'vue';
import {
  buildBorrowCalendarIndex,
  buildMonthGrid,
  formatMonthLabel,
  shiftMonthKey,
  todayDateKey,
  todayMonthKey,
  weekdayLabels,
} from '../utils/borrowCalendar.js';

const props = defineProps({
  assets: {
    type: Array,
    required: true,
  },
  borrowRecords: {
    type: Array,
    required: true,
  },
});

defineEmits(['return-asset']);

const calendarMonth = ref(todayMonthKey());
const selectedDateKey = ref(todayDateKey());
const selectedAssetId = ref('');
const statusFilter = ref('all');

const weekdays = weekdayLabels();

const calendarIndex = computed(() => buildBorrowCalendarIndex(props.borrowRecords));

const monthCells = computed(() => buildMonthGrid(calendarMonth.value));

const monthLabel = computed(() => formatMonthLabel(calendarMonth.value));

// ตัวเลือกครุภัณฑ์: ใช้ assetCode/ชื่อจากรายการยืมก่อน ถ้าไม่มีค่อยหาในทะเบียนครุภัณฑ์
const assetOptions = computed(() => {
  const map = new Map();

  props.borrowRecords.forEach((record) => {
    if (record?.assetId === null || record?.assetId === undefined) return;

    const key = String(record.assetId);

    if (map.has(key)) return;

    map.set(key, {
      id: key,
      label: record.assetCode
        ? `${record.assetCode} - ${record.assetName || '-'}`
        : record.assetName || `รหัส ${key}`,
    });
  });

  props.assets.forEach((asset) => {
    const key = String(asset.id);

    if (map.has(key)) return;

    map.set(key, {
      id: key,
      label: asset.assetCode
        ? `${asset.assetCode} - ${asset.name || '-'}`
        : asset.name || `รหัส ${key}`,
    });
  });

  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'th'));
});

const matchesAssetFilter = (event) => (
  !selectedAssetId.value || String(event.assetId) === String(selectedAssetId.value)
);

const listOfDate = (dateKey) => calendarIndex.value.listByDate[dateKey] || [];

const pickedUpListOfDate = (dateKey) => calendarIndex.value.pickedUpByDateList[dateKey] || [];

const activeListOfDate = (dateKey) => calendarIndex.value.activeByDateList[dateKey] || [];

const dueSoonListOfDate = (dateKey) => calendarIndex.value.dueSoonByDateList[dateKey] || [];

const passesStatusFilter = (dateKey, event) => {
  switch (statusFilter.value) {
    case 'active':
      return activeListOfDate(dateKey).includes(event);
    case 'pickedUp':
      return pickedUpListOfDate(dateKey).includes(event);
    case 'dueSoon':
      return dueSoonListOfDate(dateKey).includes(event);
    default:
      return true;
  }
};

const matchesFilters = (dateKey, event) => (
  Boolean(dateKey) && matchesAssetFilter(event) && passesStatusFilter(dateKey, event)
);

const dayList = (dateKey) => listOfDate(dateKey).filter(event => matchesFilters(dateKey, event));

const dayCount = (dateKey) => dayList(dateKey).length;

const monthStats = computed(() => {
  const inMonth = (dateKey) => Boolean(dateKey) && dateKey.startsWith(calendarMonth.value);

  let borrowDays = 0;
  let borrowEvents = 0;
  let overdueEvents = 0;

  calendarIndex.value.events.forEach((event) => {
    if (!matchesAssetFilter(event)) return;

    let matchedThisMonth = false;

    event.dayKeys.forEach((dateKey) => {
      if (!inMonth(dateKey)) return;
      if (!passesStatusFilter(dateKey, event)) return;

      borrowEvents += 1;
      matchedThisMonth = true;
    });

    if (matchedThisMonth) {
      borrowDays += 1;
    }

    if (event.isOverdue && inMonth(event.dueKey)) {
      overdueEvents += 1;
    }
  });

  return {
    borrowDays,
    borrowEvents,
    overdueEvents,
    totalRecords: calendarIndex.value.events.length,
  };
});

const selectedDateEvents = computed(() => {
  if (!selectedDateKey.value) return [];

  return listOfDate(selectedDateKey.value)
    .filter(event => matchesAssetFilter(event))
    .map(event => ({
      ...event,
      isPickedUpToday: selectedDateKey.value === event.startKey,
    }))
    .sort((a, b) => a.borrowerName.localeCompare(b.borrowerName, 'th'));
});

const selectedDateLabel = computed(() => {
  if (!selectedDateKey.value) return '';

  const cell = monthCells.value.find(item => item.dateKey === selectedDateKey.value);
  const day = Number(selectedDateKey.value.split('-')[2] || 0);

  return `${day} ${monthLabel.value}${cell?.isToday ? ' (วันนี้)' : ''}`;
});

const statusBadgeClass = (event) => {
  if (event.isOverdue) return 'bg-rose-50 text-rose-700 border-rose-100';
  if (event.isReturned) return 'bg-slate-100 text-slate-600 border-slate-200';

  return 'bg-amber-50 text-amber-700 border-amber-100';
};

const statusBadgeText = (event) => {
  if (event.isOverdue) return `เลยกำหนดคืน (${event.dueKey})`;
  if (event.isReturned) return `คืนแล้ว ${event.returnedKey}`;

  return `กำหนดคืน ${event.dueKey}`;
};

const formatShortDate = (dateKey) => {
  if (!dateKey) return '-';

  const [year, month, day] = dateKey.split('-');

  if (!year || !month || !day) return '-';

  return `${Number(day)}/${Number(month)}/${String(Number(year) + 543).slice(-2)}`;
};

const shiftCalendarMonth = (delta) => {
  const nextMonth = shiftMonthKey(calendarMonth.value, delta);

  if (!nextMonth) return;

  calendarMonth.value = nextMonth;

  if (!selectedDateKey.value.startsWith(nextMonth)) {
    selectedDateKey.value = todayMonthKey() === nextMonth
      ? todayDateKey()
      : `${nextMonth}-01`;
  }
};

const goToCurrentMonth = () => {
  calendarMonth.value = todayMonthKey();
  selectedDateKey.value = todayDateKey();
};

const selectDate = (cell) => {
  if (!cell?.dateKey) return;

  selectedDateKey.value = cell.dateKey;
};

const clearFilters = () => {
  selectedAssetId.value = '';
  statusFilter.value = 'all';
};
</script>

<template>
  <section class="space-y-6 max-w-7xl mx-auto">
    <!-- หัวข้อ + ตัวกรอง -->
    <div class="flex flex-col gap-4">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 class="text-2xl font-bold tracking-tight text-slate-900">
            ปฏิทินการยืมครุภัณฑ์
          </h2>

          <p class="mt-1 text-sm text-slate-500">
            ดูว่าแต่ละวันมีใครยืมครุภัณฑ์ไปบ้าง (แต่ละแถบคือช่วงวันที่ครุภัณฑ์ถูกยืม)
          </p>
        </div>

        <button @click="goToCurrentMonth"
          class="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium shadow-sm hover:bg-indigo-700 transition">
          กลับไปเดือนปัจจุบัน
        </button>
      </div>

      <div class="flex flex-wrap items-end gap-3 bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div class="min-w-[220px]">
          <label class="block text-xs font-medium text-slate-600 mb-1">
            ครุภัณฑ์
          </label>
          <select v-model="selectedAssetId"
            class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">ทั้งหมด</option>
            <option v-for="option in assetOptions" :key="option.id" :value="option.id">
              {{ option.label }}
            </option>
          </select>
        </div>

        <div class="min-w-[200px]">
          <label class="block text-xs font-medium text-slate-600 mb-1">
            สถานะ
          </label>
          <select v-model="statusFilter"
            class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="all">ทั้งหมด</option>
            <option value="pickedUp">วันที่รับครุภัณฑ์ไป</option>
            <option value="active">ยังไม่คืน (วันนั้นยังถืออยู่)</option>
            <option value="dueSoon">ใกล้/ครบกำหนดคืน (ภายใน 3 วัน)</option>
          </select>
        </div>

        <button v-if="selectedAssetId || statusFilter !== 'all'" @click="clearFilters"
          class="px-3 py-2 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-200">
          ล้างตัวกรอง
        </button>
      </div>
    </div>

    <!-- สรุปเดือน -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <p class="text-xs text-slate-500">วันที่มีการยืมในเดือนนี้</p>
        <p class="mt-1 text-2xl font-bold text-slate-900">
          {{ monthStats.borrowDays }} <span class="text-sm font-medium text-slate-500">วัน</span>
        </p>
      </div>

      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <p class="text-xs text-slate-500">รายการยืม (วัน-รายการ)</p>
        <p class="mt-1 text-2xl font-bold text-slate-900">
          {{ monthStats.borrowEvents }} <span class="text-sm font-medium text-slate-500">รายการ</span>
        </p>
      </div>

      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <p class="text-xs text-slate-500">เลยกำหนดคืนในเดือนนี้</p>
        <p class="mt-1 text-2xl font-bold"
          :class="monthStats.overdueEvents > 0 ? 'text-rose-600' : 'text-slate-900'">
          {{ monthStats.overdueEvents }} <span class="text-sm font-medium text-slate-500">รายการ</span>
        </p>
      </div>
    </div>

    <!-- ปฏิทิน + รายละเอียดของวันที่เลือก -->
    <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <!-- ปฏิทิน -->
      <div class="xl:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200">
          <button @click="shiftCalendarMonth(-1)"
            class="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-600 hover:bg-slate-50">
            ‹ ก่อนหน้า
          </button>

          <div class="text-center">
            <div class="text-lg font-semibold text-slate-900">
              {{ monthLabel }}
            </div>
            <div class="text-xs text-slate-400">
              คลิกที่วันเพื่อดูรายชื่อผู้ยืม
            </div>
          </div>

          <button @click="shiftCalendarMonth(1)"
            class="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-600 hover:bg-slate-50">
            ถัดไป ›
          </button>
        </div>

        <div class="grid grid-cols-7 bg-slate-100 text-slate-600 text-xs">
          <div v-for="day in weekdays" :key="day" class="px-3 py-2 text-center font-semibold">
            {{ day }}
          </div>
        </div>

        <div class="grid grid-cols-7">
          <template v-for="(cell, cellIndex) in monthCells" :key="cell.dateKey || `blank-${cellIndex}`">
            <div v-if="!cell.isCurrentMonth" class="min-h-[104px] border-b border-r border-slate-100 bg-slate-50/60"></div>

            <button v-else type="button" @click="selectDate(cell)" :class="[
              'min-h-[104px] w-full border-b border-r border-slate-100 p-2 text-left align-top transition',
              cell.dateKey === selectedDateKey ? 'ring-2 ring-inset ring-indigo-500 bg-indigo-50/60' : 'hover:bg-slate-50'
            ]">
              <div class="flex items-center justify-between">
                <span :class="[
                  'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                  cell.isToday ? 'bg-indigo-600 text-white' : 'text-slate-700'
                ]">
                  {{ cell.day }}
                </span>

                <span v-if="dayCount(cell.dateKey) > 0"
                  class="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                  {{ dayCount(cell.dateKey) }}
                </span>
              </div>

              <div class="mt-1 space-y-1">
                <div v-for="event in dayList(cell.dateKey).slice(0, 2)" :key="event.id"
                  class="truncate rounded px-1.5 py-0.5 text-[10px] font-medium"
                  :class="event.isOverdue
                    ? 'bg-rose-100 text-rose-700'
                    : event.isReturned
                      ? 'bg-slate-100 text-slate-500'
                      : 'bg-amber-100 text-amber-800'">
                  {{ event.borrowerName || 'ไม่ระบุชื่อ' }}
                </div>

                <div v-if="dayCount(cell.dateKey) > 2" class="text-[10px] text-slate-400">
                  +{{ dayCount(cell.dateKey) - 2 }} รายการ
                </div>
              </div>
            </button>
          </template>
        </div>

        <div class="flex flex-wrap items-center gap-3 px-4 py-3 text-xs text-slate-500">
          <span class="inline-flex items-center gap-1">
            <span class="h-3 w-3 rounded bg-amber-100 border border-amber-200"></span> ยังไม่คืน / กำลังยืม
          </span>
          <span class="inline-flex items-center gap-1">
            <span class="h-3 w-3 rounded bg-slate-100 border border-slate-200"></span> คืนแล้ว
          </span>
          <span class="inline-flex items-center gap-1">
            <span class="h-3 w-3 rounded bg-rose-100 border border-rose-200"></span> เลยกำหนดคืน
          </span>
        </div>
      </div>

      <!-- รายละเอียดวันที่เลือก -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="px-4 py-3 border-b border-slate-200">
          <h3 class="text-sm font-semibold text-slate-900">
            รายชื่อผู้ยืมวันที่ {{ selectedDateLabel }}
          </h3>
          <p class="mt-0.5 text-xs text-slate-400">
            พบ {{ selectedDateEvents.length }} รายการ (รวมวันที่ค้างยืม)
          </p>
        </div>

        <div class="divide-y divide-slate-100 max-h-[620px] overflow-y-auto">
          <div v-for="event in selectedDateEvents" :key="event.id" class="p-4 space-y-2">
            <div class="flex items-start justify-between gap-2">
              <div>
                <div class="text-sm font-semibold text-slate-800">
                  {{ event.assetName || '-' }}
                </div>
                <div v-if="event.assetCode" class="text-xs text-slate-400">
                  {{ event.assetCode }}
                </div>
              </div>

              <span class="inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                :class="statusBadgeClass(event)">
                {{ statusBadgeText(event) }}
              </span>
            </div>

            <div class="text-sm text-slate-700">
              <span class="font-medium">ผู้ยืม:</span> {{ event.borrowerName || '-' }}
              <span v-if="event.department" class="text-slate-400">
                ({{ event.department }})
              </span>
            </div>

            <div v-if="event.purpose" class="text-xs text-slate-500">
              งาน/โครงการ: {{ event.purpose }}
            </div>

            <div class="text-xs text-slate-500">
              ช่วงที่ยืม {{ formatShortDate(event.startKey) }} – {{ formatShortDate(event.endKey) }}
              ({{ event.totalDays }} วัน)
            </div>

            <div v-if="event.isPickedUpToday && !event.isReturned" class="text-xs font-medium text-indigo-600">
              • วันนี้เป็นวันที่รับครุภัณฑ์ไป
            </div>

            <button v-if="event.record && event.record.status === 'Active'" @click="$emit('return-asset', event.record)"
              class="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition">
              บันทึกคืนอุปกรณ์
            </button>
          </div>

          <div v-if="selectedDateEvents.length === 0" class="p-8 text-center text-sm text-slate-400">
            ไม่มีรายการยืมในวันนี้
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
