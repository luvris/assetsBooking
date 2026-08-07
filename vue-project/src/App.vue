<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  increment,
  getDocs,
  query,
} from 'firebase/firestore';
import { db } from './firebase/firebase.js';

import DashboardView from './components/DashboardView.vue';
import AssetsView from './components/AssetsView.vue';
import BorrowView from './components/BorrowView.vue';
import SuppliesView from './components/SuppliesView.vue';
import CategoriesView from './components/CategoriesView.vue';
import SuppliesLogView from './components/SuppliesLogView.vue';
import SuppliesSummaryView from './components/SuppliesSummaryView.vue';

// --- Dev Mode ---
const clearAllBorrowLogs = async () => {
  if (!confirm('ลบประวัติยืม–คืนอุปกรณ์ทั้งหมดหรือไม่? (สำหรับทดสอบเท่านั้น)')) return;

  try {
    const q = query(collection(db, 'borrow_return'));
    const snap = await getDocs(q);

    const deletions = [];
    snap.forEach(docSnap => {
      deletions.push(deleteDoc(doc(db, 'borrow_return', docSnap.id)));
    });

    await Promise.all(deletions);
  } catch (e) {
    console.error('Error clearing borrow logs:', e);
  }
};

const clearAllSupplyLogs = async () => {
  if (!confirm('ลบประวัติการเบิก/เติมวัสดุสิ้นเปลืองทั้งหมดหรือไม่? (สำหรับทดสอบเท่านั้น)')) return;

  try {
    const q = query(collection(db, 'supplies_transactions'));
    const snap = await getDocs(q);

    const deletions = [];
    snap.forEach(docSnap => {
      deletions.push(deleteDoc(doc(db, 'supplies_transactions', docSnap.id)));
    });

    await Promise.all(deletions);
  } catch (e) {
    console.error('Error clearing supply logs:', e);
  }
};

// --- Reactive State ---
const currentTab = ref('dashboard'); // 'dashboard', 'assets', 'borrow', 'supplies', 'suppliesLog', 'suppliesSummary', 'categories'

const showSuppliesMenu = ref(false);
// helper เวลาเปลี่ยนหน้า
const setTab = (tab) => {
  currentTab.value = tab;
  showSuppliesMenu.value = false;
};

// Data Lists from Firestore
const assets = ref([]);
const borrowRecords = ref([]);
const supplies = ref([]);
const supplyTransactions = ref([]);
const categories = ref([]);

// Modals
const showAssetModal = ref(false);
const showSupplyModal = ref(false);
const showCategoryModal = ref(false);
const showBorrowModal = ref(false);
const supplyTxModal = ref(false);

const editingAssetId = ref(null);
const editingSupplyId = ref(null);

// Forms
const assetForm = reactive({
  name: '',
  brand: '',
  assetCode: '',
  serialNumber: '',
  categoryId: '',
  repairTicket: '',
  status: 'Available'
});

const supplyForm = reactive({
  name: '',
  categoryId: '',
  quantity: 0,
  minThreshold: 5,
  unit: 'pcs'
});

const categoryForm = reactive({
  name: '',
  type: 'asset' // 'asset' or 'supply'
});

const borrowForm = reactive({
  assetId: '',
  borrowerName: '',
  jobTask: '',
  location: '',
  borrowDate: '',
  dueDate: '',
  notes: '',
});

const supplyTxForm = reactive({
  supplyId: '',
  type: 'IN', // 'IN' or 'OUT'
  quantity: 1,
  note: '',
  requesterName: '',
  department: '',
});

// Search & Filter
const assetSearch = ref('');
const assetStatusFilter = ref('');
const supplySearch = ref('');

// --- Firestore Realtime Listeners ---
onMounted(() => {
  onSnapshot(collection(db, 'categories'), (snapshot) => {
    categories.value = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  });

  onSnapshot(collection(db, 'inventory_assets'), (snapshot) => {
    assets.value = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  });

  onSnapshot(collection(db, 'borrow_return'), (snapshot) => {
    borrowRecords.value = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  });

  onSnapshot(collection(db, 'supplies_stock'), (snapshot) => {
    supplies.value = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  });

  onSnapshot(collection(db, 'supplies_transactions'), (snapshot) => {
    supplyTransactions.value = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  });
});

// --- Computed: Stats ---
const stats = computed(() => {
  const totalAssets = assets.value.length;
  const availableAssets = assets.value.filter(a => a.status === 'Available').length;
  const borrowedAssets = assets.value.filter(a => a.status === 'Borrowed').length;
  const maintenanceAssets = assets.value.filter(a => a.status === 'Maintenance').length;
  const lowSupplies = supplies.value.filter(s => s.quantity <= s.minThreshold).length;

  return { totalAssets, availableAssets, borrowedAssets, maintenanceAssets, lowSupplies };
});

const filteredAssets = computed(() => {
  return assets.value.filter(item => {
    const keyword = assetSearch.value.toLowerCase();
    const matchSearch =
      item.name?.toLowerCase().includes(keyword) ||
      item.assetCode?.toLowerCase().includes(keyword) ||
      item.serialNumber?.toLowerCase().includes(keyword);
    const matchStatus = assetStatusFilter.value ? item.status === assetStatusFilter.value : true;
    return matchSearch && matchStatus;
  });
});

const filteredSupplies = computed(() => {
  return supplies.value.filter(item =>
    item.name?.toLowerCase().includes(supplySearch.value.toLowerCase())
  );
});

// --- LOG & SUMMARY วัสดุสิ้นเปลือง ---
const getCategoryName = (catId) => {
  const cat = categories.value.find(c => c.id === catId);
  return cat ? cat.name : 'ไม่มีหมวดหมู่';
};

// helper สำหรับดูสถานะใกล้วันคืน / เลยกำหนด
const getBorrowRowStatus = (record) => {
  if (!record.dueDate || record.status !== 'Active') {
    return { type: 'normal', daysLeft: null };
  }

  const today = new Date();
  const due = new Date(record.dueDate);

  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const diffMs = due.getTime() - today.getTime();
  const daysLeft = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) {
    return { type: 'overdue', daysLeft };
  }
  if (daysLeft <= 3) {
    return { type: 'near', daysLeft };
  }
  return { type: 'normal', daysLeft };
};



const suppliesUsageByCategory = computed(() => {
  const result = {};

  // OUT = used
  for (const tx of supplyTransactions.value) {
    if (!tx.supplyId || tx.type !== 'OUT') continue;
    const supply = supplies.value.find(s => s.id === tx.supplyId);
    if (!supply) continue;

    const catId = supply.categoryId || 'uncategorized';
    if (!result[catId]) {
      result[catId] = {
        categoryId: catId,
        categoryName: getCategoryName(catId),
        used: 0,
        currentQty: 0,
      };
    }
    result[catId].used += Number(tx.quantity) || 0;
  }

  // currentQty จาก stock
  for (const s of supplies.value) {
    const catId = s.categoryId || 'uncategorized';
    if (!result[catId]) {
      result[catId] = {
        categoryId: catId,
        categoryName: getCategoryName(catId),
        used: 0,
        currentQty: 0,
      };
    }
    result[catId].currentQty += Number(s.quantity) || 0;
  }

  return Object.values(result);
});

// ใช้ log + stock สร้าง summary แยกตาม "รายการวัสดุแต่ละตัว"
const suppliesUsageByItem = computed(() => {
  const result = {};

  // 1) รวม OUT (ใช้ไปแล้ว) ต่อ supplyId
  for (const tx of supplyTransactions.value) {
    if (!tx.supplyId || tx.type !== 'OUT') continue;

    if (!result[tx.supplyId]) {
      result[tx.supplyId] = {
        supplyId: tx.supplyId,
        name: '',
        categoryId: '',
        categoryName: '',
        used: 0,
        currentQty: 0,
      };
    }
    result[tx.supplyId].used += Number(tx.quantity) || 0;
  }

  // 2) เติมข้อมูลจาก stock (ชื่อ, หมวด, คงเหลือ)
  for (const s of supplies.value) {
    if (!result[s.id]) {
      result[s.id] = {
        supplyId: s.id,
        name: s.name || '',
        categoryId: s.categoryId || '',
        categoryName: getCategoryName(s.categoryId),
        used: 0,
        currentQty: 0,
      };
    }
    result[s.id].name = s.name || result[s.id].name;
    result[s.id].categoryId = s.categoryId || result[s.id].categoryId;
    result[s.id].categoryName = getCategoryName(s.categoryId) || result[s.id].categoryName;
    result[s.id].currentQty = Number(s.quantity) || 0;
  }

  return Object.values(result);
});

// รวม log การเบิก/เติมวัสดุสิ้นเปลือง พร้อม join กับชื่อวัสดุและหมวดหมู่
const supplyLogs = computed(() => {
  return supplyTransactions.value
    .map(tx => {
      const supply = supplies.value.find(s => s.id === tx.supplyId);
      return {
        id: tx.id,
        supplyId: tx.supplyId,
        type: tx.type, // 'IN' or 'OUT'
        quantity: tx.quantity,
        note: tx.note || '',
        requesterName: tx.requesterName || '',
        department: tx.department || '',
        timestamp: tx.timestamp || null,
        // join จาก stock
        supplyName: supply?.name || '',
        unit: supply?.unit || '',
        categoryId: supply?.categoryId || '',
        categoryName: supply ? getCategoryName(supply.categoryId) : '',
      };
    })
    .sort((a, b) => {
      const ta = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
      const tb = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
      return tb - ta; // ล่าสุดอยู่บน
    });
});

// สรุปครุภัณฑ์ตามหมวดหมู่และสถานะ
const assetSummaryByCategory = computed(() => {
  const result = {};

  for (const a of assets.value) {
    const catId = a.categoryId || 'uncategorized';
    if (!result[catId]) {
      result[catId] = {
        categoryId: catId,
        categoryName: getCategoryName(catId),
        total: 0,
        available: 0,
        borrowed: 0,
        maintenance: 0,
        retired: 0,
        items: [],
      };
    }

    result[catId].total += 1;
    if (a.status === 'Available') result[catId].available += 1;
    else if (a.status === 'Borrowed') result[catId].borrowed += 1;
    else if (a.status === 'Maintenance') result[catId].maintenance += 1;
    else if (a.status === 'Retired') result[catId].retired += 1;

    result[catId].items.push(a);
  }

  return Object.values(result).map(group => {
    group.items.sort((x, y) => (x.name || '').localeCompare(y.name || ''));
    return group;
  }).sort((a, b) => (a.categoryName || '').localeCompare(b.categoryName || ''));
});

const suppliesUsageSummary = computed(() => {
  let totalUsed = 0;
  let totalCurrent = 0;

  for (const row of suppliesUsageByCategory.value) {
    totalUsed += row.used;
    totalCurrent += row.currentQty;
  }

  return { totalUsed, totalCurrent };
});

// Helper status badge
const getStatusBadge = (status) => {
  switch (status) {
    case 'Available': return 'bg-emerald-100 text-emerald-800';
    case 'Borrowed': return 'bg-amber-100 text-amber-800';
    case 'Maintenance': return 'bg-rose-100 text-rose-800';
    case 'Retired': return 'bg-slate-200 text-slate-700';
    default: return 'bg-slate-100 text-slate-800';
  }
};

// --- Category Actions ---
const saveCategory = async () => {
  if (!categoryForm.name) return;
  try {
    await addDoc(collection(db, 'categories'), {
      name: categoryForm.name,
      type: categoryForm.type,
      createdAt: serverTimestamp()
    });
    categoryForm.name = '';
    showCategoryModal.value = false;
  } catch (error) {
    console.error('Error adding category: ', error);
  }
};

const deleteCategory = async (id) => {
  if (confirm('ยืนยันการลบหมวดหมู่นี้หรือไม่?')) {
    await deleteDoc(doc(db, 'categories', id));
  }
};

// --- Asset Actions ---
const openAssetModal = (asset = null) => {
  if (asset) {
    editingAssetId.value = asset.id;
    assetForm.name = asset.name || '';
    assetForm.brand = asset.brand || '';
    assetForm.assetCode = asset.assetCode || '';
    assetForm.serialNumber = asset.serialNumber || '';
    assetForm.categoryId = asset.categoryId || '';
    assetForm.repairTicket = asset.repairTicket || '';
    assetForm.status = asset.status || 'Available';
  } else {
    editingAssetId.value = null;
    assetForm.name = '';
    assetForm.brand = '';
    assetForm.assetCode = '';
    assetForm.serialNumber = '';
    assetForm.categoryId = categories.value[0]?.id || '';
    assetForm.repairTicket = '';
    assetForm.status = 'Available';
  }
  showAssetModal.value = true;
};

const saveAsset = async () => {
  try {
    if (editingAssetId.value) {
      await updateDoc(doc(db, 'inventory_assets', editingAssetId.value), {
        ...assetForm,
        updatedAt: serverTimestamp()
      });
    } else {
      await addDoc(collection(db, 'inventory_assets'), {
        ...assetForm,
        createdAt: serverTimestamp()
      });
    }
    showAssetModal.value = false;
  } catch (error) {
    console.error('Error saving asset: ', error);
  }
};

const deleteAsset = async (id) => {
  if (confirm('ต้องการลบครุภัณฑ์/อุปกรณ์นี้หรือไม่?')) {
    await deleteDoc(doc(db, 'inventory_assets', id));
  }
};

// --- Borrow Actions ---
const openBorrowModal = () => {
  borrowForm.assetId = '';
  borrowForm.borrowerName = '';
  borrowForm.jobTask = '';
  borrowForm.location = '';
  borrowForm.notes = '';

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  borrowForm.borrowDate = todayStr;
  borrowForm.dueDate = todayStr;

  showBorrowModal.value = true;
};

const submitBorrow = async () => {
  if (!borrowForm.assetId || !borrowForm.borrowerName || !borrowForm.jobTask) {
    alert('กรุณากรอกข้อมูลที่จำเป็นให้ครบ (อุปกรณ์, ผู้ยืม, งาน/โครงการ)');
    return;
  }

  if (!borrowForm.borrowDate || !borrowForm.dueDate) {
    alert('กรุณาระบุวันที่เริ่มยืม และวันที่กำหนดคืน');
    return;
  }

  try {
    const start = new Date(borrowForm.borrowDate);
    const due = new Date(borrowForm.dueDate);
    const diffMs = due.getTime() - start.getTime();
    const totalDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24))); // อย่างน้อย 1 วัน

    await addDoc(collection(db, 'borrow_return'), {
      ...borrowForm,
      type: 'BORROW',
      timestamp: serverTimestamp(),
      status: 'Active',
      totalDays,
      lateDays: 0,
    });

    await updateDoc(doc(db, 'inventory_assets', borrowForm.assetId), {
      status: 'Borrowed'
    });

    showBorrowModal.value = false;
  } catch (error) {
    console.error('Error processing borrow: ', error);
  }
};

const returnAsset = async (record) => {
  if (confirm('ยืนยันการคืนอุปกรณ์นี้หรือไม่?')) {
    try {
      const now = new Date();
      const dueDate = record.dueDate ? new Date(record.dueDate) : null;
      let lateDays = 0;

      if (dueDate) {
        const diffMs = now.getTime() - dueDate.getTime();
        lateDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (lateDays < 0) lateDays = 0;
      }

      await updateDoc(doc(db, 'borrow_return', record.id), {
        status: 'Returned',
        returnedAt: serverTimestamp(),
        lateDays,
      });

      await updateDoc(doc(db, 'inventory_assets', record.assetId), {
        status: 'Available'
      });
    } catch (error) {
      console.error('Error processing return: ', error);
    }
  }
};

// --- Supplies Actions ---
const openSupplyModal = (supply = null) => {
  if (supply) {
    editingSupplyId.value = supply.id;
    supplyForm.name = supply.name || '';
    supplyForm.categoryId = supply.categoryId || '';
    supplyForm.quantity = supply.quantity || 0;
    supplyForm.minThreshold = supply.minThreshold || 5;
    supplyForm.unit = supply.unit || 'pcs';
  } else {
    editingSupplyId.value = null;
    supplyForm.name = '';
    supplyForm.categoryId = categories.value[0]?.id || '';
    supplyForm.quantity = 0;
    supplyForm.minThreshold = 5;
    supplyForm.unit = 'pcs';
  }
  showSupplyModal.value = true;
};

const saveSupply = async () => {
  try {
    if (editingSupplyId.value) {
      await updateDoc(doc(db, 'supplies_stock', editingSupplyId.value), {
        ...supplyForm,
        updatedAt: serverTimestamp()
      });
    } else {
      await addDoc(collection(db, 'supplies_stock'), {
        ...supplyForm,
        createdAt: serverTimestamp()
      });
    }
    showSupplyModal.value = false;
  } catch (error) {
    console.error('Error saving supply: ', error);
  }
};

const openSupplyTxModal = (supplyId, type) => {
  supplyTxForm.supplyId = supplyId;
  supplyTxForm.type = type;
  supplyTxForm.quantity = 1;
  supplyTxForm.note = '';
  supplyTxForm.requesterName = '';
  supplyTxForm.department = '';
  supplyTxModal.value = true;
};

const submitSupplyTx = async () => {
  try {
    const qtyChange = supplyTxForm.type === 'IN'
      ? Number(supplyTxForm.quantity)
      : -Number(supplyTxForm.quantity);

    await addDoc(collection(db, 'supplies_transactions'), {
      ...supplyTxForm,
      quantity: Number(supplyTxForm.quantity),
      timestamp: serverTimestamp()
    });

    const supplyRef = doc(db, 'supplies_stock', supplyTxForm.supplyId);
    await updateDoc(supplyRef, {
      quantity: increment(qtyChange)
    });

    supplyTxModal.value = false;
  } catch (error) {
    console.error('Error recording supply transaction:', error);
  }
};

// สรุปยอดวัสดุแบบรายเดือน
// - totalIn  : ยอดเติมเข้าทั้งเดือน (IN)
// - totalOut : ยอดเบิกใช้ทั้งเดือน (OUT)
// - departments : OUT แยกตามแผนก
const suppliesMonthlySummary = computed(() => {
  const result = {};

  for (const tx of supplyTransactions.value) {
    if (!tx.timestamp || !tx.timestamp.toDate) continue;

    const d = tx.timestamp.toDate();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const monthKey = `${year}-${month}`; // เช่น 2026-08
    const dept = tx.department || 'ไม่ระบุแผนก';

    if (!result[monthKey]) {
      result[monthKey] = {
        month: monthKey,
        totalIn: 0,
        totalOut: 0,
        byDept: {},
      };
    }

    const qty = Number(tx.quantity) || 0;

    if (tx.type === 'IN') {
      result[monthKey].totalIn += qty;
    } else if (tx.type === 'OUT') {
      result[monthKey].totalOut += qty;

      if (!result[monthKey].byDept[dept]) {
        result[monthKey].byDept[dept] = 0;
      }
      result[monthKey].byDept[dept] += qty;
    }
  }

  const summary = Object.values(result)
    .map(item => ({
      month: item.month,
      totalIn: item.totalIn,
      totalOut: item.totalOut,
      departments: Object.entries(item.byDept).map(([department, total]) => ({
        department,
        total,
      })),
    }))
    .sort((a, b) => (a.month < b.month ? 1 : -1)); // เดือนล่าสุดก่อน

  const months = summary.map(item => item.month);

  return { months, summary };
});
</script>

<template>
  <div class="min-h-screen flex flex-col font-sans">
    <!-- Navbar -->
    <header class="bg-indigo-700 text-white shadow-md">
      <div class="w-full px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div class="flex items-center gap-3">
          <span class="text-2xl font-bold tracking-tight">
            คลังวัสดุฝ่ายงานคอมพิวเตอร์
          </span>
          <span class="text-xs bg-indigo-500/70 px-2 py-1 rounded-full">
            IT Asset
          </span>
        </div>

        <nav class="flex flex-wrap gap-2">
          <button @click="setTab('dashboard')" :class="[
            'px-3 py-2 rounded-lg text-sm font-medium transition',
            currentTab === 'dashboard'
              ? 'bg-white text-indigo-700 shadow-inner'
              : 'bg-indigo-600 hover:bg-indigo-500'
          ]">
            ภาพรวมอุปกรณ์
          </button>

          <button @click="setTab('assets')" :class="[
            'px-3 py-2 rounded-lg text-sm font-medium transition',
            currentTab === 'assets'
              ? 'bg-white text-indigo-700 shadow-inner'
              : 'bg-indigo-600 hover:bg-indigo-500'
          ]">
            ครุภัณฑ์/อุปกรณ์ไอที
          </button>

          <button @click="setTab('borrow')" :class="[
            'px-3 py-2 rounded-lg text-sm font-medium transition',
            currentTab === 'borrow'
              ? 'bg-white text-indigo-700 shadow-inner'
              : 'bg-indigo-600 hover:bg-indigo-500'
          ]">
            ระบบยืม–คืนอุปกรณ์
          </button>

          <!-- Dropdown สำหรับเมนูวัสดุสิ้นเปลือง -->
          <div class="relative">
            <button @click="showSuppliesMenu = !showSuppliesMenu" :class="[
              'px-3 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1',
              ['supplies', 'suppliesLog', 'suppliesSummary'].includes(currentTab)
                ? 'bg-white text-indigo-700 shadow-inner'
                : 'bg-indigo-600 hover:bg-indigo-500'
            ]">
              จัดการวัสดุสิ้นเปลือง
              <span class="text-[10px]">▾</span>
            </button>

            <div v-if="showSuppliesMenu"
              class="absolute right-0 mt-2 w-60 bg-white text-slate-800 rounded-lg shadow-lg border border-slate-200 z-20">
              <button class="w-full text-left px-3 py-2 text-sm hover:bg-slate-100" @click="setTab('supplies')">
                คลังวัสดุสิ้นเปลือง
              </button>
              <button class="w-full text-left px-3 py-2 text-sm hover:bg-slate-100" @click="setTab('suppliesLog')">
                ประวัติการเบิกวัสดุ
              </button>
              <button class="w-full text-left px-3 py-2 text-sm hover:bg-slate-100" @click="setTab('suppliesSummary')">
                สรุปยอดใช้วัสดุ (รายเดือน/แผนก)
              </button>
            </div>
          </div>

          <button @click="setTab('categories')" :class="[
            'px-3 py-2 rounded-lg text-sm font-medium transition',
            currentTab === 'categories'
              ? 'bg-white text-indigo-700 shadow-inner'
              : 'bg-indigo-600 hover:bg-indigo-500'
          ]">
            หมวดหมู่
          </button>
        </nav>
      </div>
    </header>

    <!-- Main -->
    <main class="flex-1 w-full px-6 py-6 bg-slate-50 text-slate-800">
      <DashboardView v-if="currentTab === 'dashboard'" :stats="stats" :assets="assets" :borrow-records="borrowRecords"
        :supplies="supplies" :supplies-usage-by-category="suppliesUsageByCategory"
        :supplies-usage-by-item="suppliesUsageByItem" :asset-summary-by-category="assetSummaryByCategory"
        :supplies-usage-summary="suppliesUsageSummary" :get-status-badge="getStatusBadge"
        :get-category-name="getCategoryName" :get-borrow-row-status="getBorrowRowStatus" @return-asset="returnAsset" />

      <AssetsView v-else-if="currentTab === 'assets'" :assets="filteredAssets" :asset-search="assetSearch"
        :asset-status-filter="assetStatusFilter" :categories="categories" :get-category-name="getCategoryName"
        :get-status-badge="getStatusBadge" @update-asset-search="val => (assetSearch = val)"
        @update-asset-status-filter="val => (assetStatusFilter = val)" @open-asset-modal="openAssetModal"
        @delete-asset="deleteAsset" />

      <BorrowView v-else-if="currentTab === 'borrow'" :assets="assets" :borrow-records="borrowRecords"
        :clear-all-borrow-logs="clearAllBorrowLogs" @open-borrow-modal="openBorrowModal" @return-asset="returnAsset" />

      <SuppliesView v-else-if="currentTab === 'supplies'" :supplies="filteredSupplies" :categories="categories"
        :supply-search="supplySearch" :get-category-name="getCategoryName"
        @update-supply-search="val => (supplySearch = val)" @open-supply-modal="openSupplyModal"
        @open-supply-tx-modal="payload => openSupplyTxModal(payload.id, payload.type)" />

      <SuppliesLogView v-else-if="currentTab === 'suppliesLog'" :logs="supplyLogs"
        :clear-all-supply-logs="clearAllSupplyLogs" />

      <SuppliesSummaryView v-else-if="currentTab === 'suppliesSummary'" :monthly-summary="suppliesMonthlySummary" />

      <CategoriesView v-else-if="currentTab === 'categories'" :categories="categories"
        @open-category-modal="() => (showCategoryModal = true)" @delete-category="deleteCategory" />
    </main>

    <!-- MODALS (อยู่ใน App.vue ทั้งหมด) -->

    <!-- Asset Modal -->
    <div v-if="showAssetModal"
      class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
        <h3 class="text-xl font-bold text-slate-800">
          {{ editingAssetId ? 'แก้ไขข้อมูลครุภัณฑ์/อุปกรณ์ไอที' : 'เพิ่มครุภัณฑ์/อุปกรณ์ไอทีใหม่' }}
        </h3>

        <div class="space-y-3">
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">
              ชื่ออุปกรณ์
            </label>
            <input v-model="assetForm.name" type="text"
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="เช่น โน้ตบุ๊ก Dell Latitude 5420" />
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">
              ยี่ห้อ/รุ่น
            </label>
            <input v-model="assetForm.brand" type="text"
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="เช่น Dell" />
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">
                เลขครุภัณฑ์ (Asset Code)
              </label>
              <input v-model="assetForm.assetCode" type="text"
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="เช่น 7440-001-0001" />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">
                หมายเลขซีเรียล (Serial Number)
              </label>
              <input v-model="assetForm.serialNumber" type="text"
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="เช่น SN123456" />
            </div>
          </div>

          <div>
            <div class="flex justify-between items-center mb-1">
              <label class="text-xs font-medium text-slate-600">
                หมวดหมู่
              </label>
              <button @click="showCategoryModal = true" class="text-xs text-indigo-600 hover:underline">
                เพิ่มหมวดหมู่ใหม่
              </button>
            </div>
            <select v-model="assetForm.categoryId"
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option v-for="cat in categories.filter(c => c.type === 'asset')" :key="cat.id" :value="cat.id">
                {{ cat.name }}
              </option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">
              หมายเลขใบงานซ่อม (ถ้ามี)
            </label>
            <input v-model="assetForm.repairTicket" type="text"
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="เช่น TICKET-9921" />
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">
              สถานะปัจจุบัน
            </label>
            <select v-model="assetForm.status"
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="Available">พร้อมใช้งาน</option>
              <option value="Borrowed">กำลังถูกยืมใช้งาน</option>
              <option value="Maintenance">อยู่ระหว่างซ่อมบำรุง</option>
              <option value="Retired">จำหน่าย/เลิกใช้งาน</option>
            </select>
          </div>
        </div>

        <div class="flex justify-end space-x-2 pt-2">
          <button @click="showAssetModal = false"
            class="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200">
            ยกเลิก
          </button>
          <button @click="saveAsset"
            class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            บันทึกครุภัณฑ์
          </button>
        </div>
      </div>
    </div>

    <!-- Borrow Modal -->
    <div v-if="showBorrowModal"
      class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
        <h3 class="text-xl font-bold text-slate-800">
          บันทึกการยืมอุปกรณ์
        </h3>

        <div class="space-y-3">
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">
              เลือกอุปกรณ์ที่พร้อมให้ยืม
            </label>
            <select v-model="borrowForm.assetId"
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option disabled value="">-- เลือกอุปกรณ์ --</option>
              <option v-for="item in assets.filter(a => a.status === 'Available')" :key="item.id" :value="item.id">
                {{ item.assetCode }} - {{ item.name }}
              </option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">
              ชื่อผู้ยืม
            </label>
            <input v-model="borrowForm.borrowerName" type="text"
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="เช่น นายสมชาย ใจดี" />
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">
              งาน/โครงการที่ใช้
            </label>
            <input v-model="borrowForm.jobTask" type="text"
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="เช่น ติดตั้งระบบเครือข่ายหอผู้ป่วย" />
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">
              สถานที่ใช้งาน / สถานที่ยืม
            </label>
            <input v-model="borrowForm.location" type="text"
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="เช่น ห้องตรวจ 3, อาคาร OPD ชั้น 2" />
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">
                วันที่เริ่มยืม
              </label>
              <input v-model="borrowForm.borrowDate" type="date"
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">
                วันที่กำหนดคืน
              </label>
              <input v-model="borrowForm.dueDate" type="date"
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">
              หมายเหตุ (ถ้ามี)
            </label>
            <textarea v-model="borrowForm.notes" rows="2"
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="รายละเอียดเพิ่มเติม..."></textarea>
          </div>
        </div>

        <div class="flex justify-end space-x-2 pt-2">
          <button @click="showBorrowModal = false"
            class="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200">
            ยกเลิก
          </button>
          <button @click="submitBorrow"
            class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            บันทึกการยืม
          </button>
        </div>
      </div>
    </div>

    <!-- Supply Item Modal -->
    <div v-if="showSupplyModal"
      class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
        <h3 class="text-xl font-bold text-slate-800">
          {{ editingSupplyId ? 'แก้ไขข้อมูลวัสดุสิ้นเปลือง' : 'เพิ่มวัสดุสิ้นเปลือง' }}
        </h3>

        <div class="space-y-3">
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">
              ชื่อวัสดุ
            </label>
            <input v-model="supplyForm.name" type="text"
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="เช่น สาย LAN Cat6, หมึกพิมพ์, เมาส์" />
          </div>

          <div>
            <div class="flex justify-between items-center mb-1">
              <label class="text-xs font-medium text-slate-600">
                หมวดหมู่
              </label>
              <button @click="showCategoryModal = true" class="text-xs text-indigo-600 hover:underline">
                เพิ่มหมวดหมู่ใหม่
              </button>
            </div>
            <select v-model="supplyForm.categoryId"
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option v-for="cat in categories.filter(c => c.type === 'supply')" :key="cat.id" :value="cat.id">
                {{ cat.name }}
              </option>
            </select>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">
                จำนวนเริ่มต้น
              </label>
              <input v-model.number="supplyForm.quantity" type="number"
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">
                ระดับแจ้งเตือนขั้นต่ำ
              </label>
              <input v-model.number="supplyForm.minThreshold" type="number"
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">
              หน่วยนับ
            </label>
            <input v-model="supplyForm.unit" type="text"
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="เช่น pcs, กล่อง, ม้วน" />
          </div>
        </div>

        <div class="flex justify-end space-x-2 pt-2">
          <button @click="showSupplyModal = false"
            class="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200">
            ยกเลิก
          </button>
          <button @click="saveSupply"
            class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            บันทึกวัสดุ
          </button>
        </div>
      </div>
    </div>

    <!-- Supply In/Out Transaction Modal -->
    <div v-if="supplyTxModal"
      class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
        <h3 class="text-xl font-bold text-slate-800">
          {{ supplyTxForm.type === 'IN' ? 'บันทึกการเติมสต็อกวัสดุ' : 'บันทึกการเบิกใช้วัสดุ' }}
        </h3>

        <div class="space-y-3">

          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">
              ชื่อ
            </label>
            <input v-model="supplyTxForm.requesterName" type="text"
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="เช่น น.ส. ขวัญลดา คำปวน" />
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">
              หน่วยงาน / แผนก
            </label>
            <input v-model="supplyTxForm.department" type="text"
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="เช่น งานห้องตรวจ EEG, ฝ่ายงานคอมพิวเตอร์" />
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">
              จำนวนที่จะ{{ supplyTxForm.type === 'IN' ? 'เติม' : 'เบิก' }}
            </label>
            <input v-model.number="supplyTxForm.quantity" type="number" min="1"
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">
              หมายเหตุ / สาเหตุ
            </label>
            <input v-model="supplyTxForm.note" type="text"
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="เช่น ซื้อสต็อกเพิ่ม, ใช้ในงาน X" />
          </div>
        </div>

        <div class="flex justify-end space-x-2 pt-2">
          <button @click="supplyTxModal = false"
            class="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200">
            ยกเลิก
          </button>
          <button @click="submitSupplyTx"
            class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            ยืนยัน
          </button>
        </div>
      </div>
    </div>

    <!-- Category Modal -->
    <div v-if="showCategoryModal"
      class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div class="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
        <h3 class="text-xl font-bold text-slate-800">
          เพิ่มหมวดหมู่ใหม่
        </h3>

        <div class="space-y-3">
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">
              ชื่อหมวดหมู่
            </label>
            <input v-model="categoryForm.name" type="text"
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="เช่น โน้ตบุ๊ก, อุปกรณ์เครือข่าย, หมึกพิมพ์" />
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">
              ประเภทหมวดหมู่
            </label>
            <select v-model="categoryForm.type"
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="asset">ครุภัณฑ์/อุปกรณ์ไอที</option>
              <option value="supply">วัสดุสิ้นเปลือง</option>
            </select>
          </div>
        </div>

        <div class="flex justify-end space-x-2 pt-2">
          <button @click="showCategoryModal = false"
            class="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200">
            ยกเลิก
          </button>
          <button @click="saveCategory"
            class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            บันทึกหมวดหมู่
          </button>
        </div>
      </div>
    </div>
  </div>
</template>