<script setup>
import { computed } from 'vue';

const props = defineProps({
  currentPage: {
    type: Number,
    required: true,
  },
  totalPages: {
    type: Number,
    required: true,
  },
  totalItems: {
    type: Number,
    required: true,
  },
  startIndex: {
    type: Number,
    required: true,
  },
  endIndex: {
    type: Number,
    required: true,
  },
  itemLabel: {
    type: String,
    default: 'รายการ',
  },
});

const emit = defineEmits(['update:current-page']);

const pages = computed(() => {
  return Array.from(
    { length: props.totalPages },
    (_, index) => index + 1
  );
});

function changePage(page) {
  const pageNumber = Number(page);

  if (
    !Number.isInteger(pageNumber) ||
    pageNumber < 1 ||
    pageNumber > props.totalPages ||
    pageNumber === props.currentPage
  ) {
    return;
  }

  emit('update:current-page', pageNumber);
}
</script>

<template>
  <div v-if="totalItems > 0 && totalPages === 1"
    class="border-t border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
    แสดง {{ startIndex + 1 }}–{{ endIndex }}
    จากทั้งหมด {{ totalItems }} {{ itemLabel }}
  </div>

  <div v-else-if="totalPages > 1"
    class="flex flex-col gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
    <p class="text-sm text-slate-500">
      แสดง {{ startIndex + 1 }}–{{ endIndex }}
      จากทั้งหมด {{ totalItems }} {{ itemLabel }}
    </p>

    <div class="flex flex-wrap items-center gap-1">
      <button type="button" title="หน้าแรก" :disabled="currentPage === 1"
        class="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        @click="changePage(1)">
        «
      </button>

      <button type="button" :disabled="currentPage === 1"
        class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        @click="changePage(currentPage - 1)">
        ก่อนหน้า
      </button>

      <button v-for="page in pages" :key="page" type="button"
        class="min-w-9 rounded-lg px-3 py-1.5 text-sm font-medium transition" :class="page === currentPage
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
          " @click="changePage(page)">
        {{ page }}
      </button>

      <button type="button" :disabled="currentPage === totalPages"
        class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        @click="changePage(currentPage + 1)">
        ถัดไป
      </button>

      <button type="button" title="หน้าสุดท้าย" :disabled="currentPage === totalPages"
        class="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        @click="changePage(totalPages)">
        »
      </button>
    </div>
  </div>
</template>