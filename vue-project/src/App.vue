<script setup>
import { computed, inject, onMounted, reactive, ref } from 'vue';
import { api } from './services/api.js';

import DashboardView from './components/DashboardView.vue';
import AssetsView from './components/AssetsView.vue';
import BorrowView from './components/BorrowView.vue';
import SuppliesView from './components/SuppliesView.vue';
import CategoriesView from './components/CategoriesView.vue';
import SuppliesLogView from './components/SuppliesLogView.vue';
import SuppliesSummaryView from './components/SuppliesSummaryView.vue';

const currentTab = ref('dashboard');
const showSuppliesMenu = ref(false);

const setTab = (tab) => {
  currentTab.value = tab;
  showSuppliesMenu.value = false;
};

const loading = ref(false);
const loadError = ref('');

const assets = ref([]);
const borrowRecords = ref([]);
const supplies = ref([]);
const supplyTransactions = ref([]);
const categories = ref([]);

const showAssetModal = ref(false);
const showSupplyModal = ref(false);
const showCategoryModal = ref(false);
const showBorrowModal = ref(false);
const supplyTxModal = ref(false);

const editingAssetId = ref(null);
const editingSupplyId = ref(null);

const assetForm = reactive({
  name: '',
  brand: '',
  model: '',
  assetCode: '',
  serialNumber: '',
  categoryId: '',
  location: '',
  note: '',
  status: 'AVAILABLE',
});

const supplyForm = reactive({
  itemCode: '',
  name: '',
  categoryId: '',
  quantity: 0,
  minimumQuantity: 5,
  unit: 'pcs',
  location: '',
  note: '',
});

const categoryForm = reactive({
  name: '',
  type: 'ASSET',
});

const borrowForm = reactive({
  assetId: '',
  borrowerCid: 'TEMP-USER',
  borrowerName: '',
  location: '',
  purpose: '',
  startDate: '',
  dueDate: '',
  note: '',
});

const supplyTxForm = reactive({
  supplyId: '',
  type: 'IN',
  quantity: 1,
  note: '',
  requesterName: '',
  department: '',
  createdByCid: 'TEMP-USER',
});

const assetSearch = ref('');
const assetStatusFilter = ref('');
const supplySearch = ref('');

const uiStatusFromDb = (status) => {
  const statusMap = {
    AVAILABLE: 'Available',
    BORROWED: 'Borrowed',
    REPAIR: 'Maintenance',
    DISPOSED: 'Retired',
  };

  return statusMap[status] || status || 'Available';
};

const dbStatusFromUi = (status) => {
  const statusMap = {
    Available: 'AVAILABLE',
    Borrowed: 'BORROWED',
    Maintenance: 'REPAIR',
    Retired: 'DISPOSED',
  };

  return statusMap[status] || status || 'AVAILABLE';
};

const normalizeCategory = (category) => ({
  ...category,
  id: Number(category.id),
  type: String(category.type || '').toLowerCase(),
});

const normalizeAsset = (asset) => ({
  ...asset,
  id: Number(asset.id),
  categoryId: asset.categoryId === null || asset.categoryId === undefined
    ? ''
    : Number(asset.categoryId),
  status: uiStatusFromDb(asset.status),
});

const normalizeSupply = (supply) => ({
  ...supply,
  id: Number(supply.id),
  categoryId: supply.categoryId === null || supply.categoryId === undefined
    ? ''
    : Number(supply.categoryId),
  quantity: Number(supply.quantity || 0),
  minThreshold: Number(supply.minimumQuantity ?? supply.minThreshold ?? 0),
  minimumQuantity: Number(supply.minimumQuantity ?? supply.minThreshold ?? 0),
});

const formatThaiDateTime = (dateValue) => {
  if (!dateValue) return '';

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const normalizeBorrow = (record) => {
  const borrowedAt = record.borrowedAt || '';
  const dueAt = record.dueAt || '';
  const returnedAt = record.returnedAt || '';

  const getDays = (startDate, endDate) => {
    if (!startDate || !endDate) return 0;

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return 0;
    }

    return Math.max(
      0,
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
    );
  };

  return {
    ...record,

    assetId: record.assetId,
    borrowerName: record.borrowerName || '',
    location: record.department || '',
    jobTask: record.purpose || '',

    // แปลง UTC จาก API เป็นเวลาไทยก่อนส่งให้ template เดิม
    borrowDate: formatThaiDateTime(borrowedAt),
    dueDate: formatThaiDateTime(returnedAt || dueAt),

    status: returnedAt ? 'Returned' : 'Active',

    totalDays: getDays(borrowedAt, dueAt),

    lateDays:
      returnedAt && dueAt
        ? getDays(dueAt, returnedAt)
        : 0,
  };
};

const normalizeSupplyTransaction = (transaction) => ({
  ...transaction,
  id: Number(transaction.id),
  supplyId: Number(transaction.supplyId),
  type: transaction.transactionType || transaction.type,

  // แปลงเวลา UTC จาก API เป็นวันเวลาไทย
  timestamp: transaction.createdAt
    ? new Date(transaction.createdAt).toLocaleString('th-TH', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    : transaction.timestamp || null,

  workOrderNo: transaction.workOrderNo || '',
});

const loadData = async () => {
  loading.value = true;
  loadError.value = '';

  try {
    const [categoryData, assetData, supplyData] = await Promise.all([
      api.getCategories(),
      api.getAssets(),
      api.getSupplies(),
    ]);

    categories.value = categoryData.map(normalizeCategory);
    assets.value = assetData.map(normalizeAsset);
    supplies.value = supplyData.map(normalizeSupply);

    try {
      const borrowData = await api.getBorrows();
      borrowRecords.value = borrowData.map(normalizeBorrow);
    } catch (error) {
      console.warn('Borrow API is not ready:', error.message);
      borrowRecords.value = [];
    }

    try {
      const transactionData = await api.getSupplyTransactions();
      supplyTransactions.value = transactionData.map(normalizeSupplyTransaction);
    } catch (error) {
      console.warn('Supply transaction API is not ready:', error.message);
      supplyTransactions.value = [];
    }
  } catch (error) {
    console.error('Load data failed:', error);
    loadError.value = error.message || 'ไม่สามารถโหลดข้อมูลจากระบบได้';
  } finally {
    loading.value = false;
  }
};

onMounted(loadData);

const stats = computed(() => {
  const totalAssets = assets.value.length;
  const availableAssets = assets.value.filter((asset) => asset.status === 'Available').length;
  const borrowedAssets = assets.value.filter((asset) => asset.status === 'Borrowed').length;
  const maintenanceAssets = assets.value.filter((asset) => asset.status === 'Maintenance').length;
  const lowSupplies = supplies.value.filter(
    (supply) => Number(supply.quantity) <= Number(supply.minThreshold),
  ).length;

  return {
    totalAssets,
    availableAssets,
    borrowedAssets,
    maintenanceAssets,
    lowSupplies,
  };
});

const keycloak = inject('keycloak', null);

const userDisplayName = computed(() => (
  keycloak?.tokenParsed?.name
  || keycloak?.tokenParsed?.preferred_username
  || 'ผู้ใช้งาน'
));

const logout = () => {
  if (keycloak?.logout) {
    keycloak.logout({
      redirectUri: window.location.origin,
    });
  }
};

const filteredAssets = computed(() => {
  const keyword = assetSearch.value.trim().toLowerCase();

  return assets.value.filter((item) => {
    const matchSearch = !keyword
      || item.name?.toLowerCase().includes(keyword)
      || item.assetCode?.toLowerCase().includes(keyword)
      || item.serialNumber?.toLowerCase().includes(keyword);

    const matchStatus = assetStatusFilter.value
      ? item.status === assetStatusFilter.value
      : true;

    return matchSearch && matchStatus;
  });
});

const filteredSupplies = computed(() => {
  const keyword = supplySearch.value.trim().toLowerCase();

  return supplies.value.filter((item) => (
    !keyword
    || item.name?.toLowerCase().includes(keyword)
    || item.itemCode?.toLowerCase().includes(keyword)
  ));
});

const getCategoryName = (categoryId) => {
  const category = categories.value.find((item) => Number(item.id) === Number(categoryId));
  return category?.name || 'ไม่มีหมวดหมู่';
};

const getBorrowRowStatus = (record) => {
  if (!record.dueDate || record.status !== 'Active') {
    return { type: 'normal', daysLeft: null };
  }

  const today = new Date();
  const dueDate = new Date(record.dueDate);

  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);

  const daysLeft = Math.round(
    (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysLeft < 0) return { type: 'overdue', daysLeft };
  if (daysLeft <= 3) return { type: 'near', daysLeft };

  return { type: 'normal', daysLeft };
};

const getStatusBadge = (status) => {
  switch (status) {
    case 'Available':
      return 'bg-emerald-100 text-emerald-800';
    case 'Borrowed':
      return 'bg-amber-100 text-amber-800';
    case 'Maintenance':
      return 'bg-rose-100 text-rose-800';
    case 'Retired':
      return 'bg-slate-200 text-slate-700';
    default:
      return 'bg-slate-100 text-slate-800';
  }
};

const saveCategory = async () => {
  const name = categoryForm.name.trim();
  const type = categoryForm.type.trim().toUpperCase();

  if (!name) {
    alert('กรุณาระบุชื่อหมวดหมู่');
    return;
  }

  if (!['ASSET', 'SUPPLY'].includes(type)) {
    alert(`ประเภทหมวดหมู่ไม่ถูกต้อง: ${categoryForm.type}`);
    return;
  }

  try {
    const createdCategory = await api.createCategory({
      name,
      type,
    });

    categoryForm.name = '';
    categoryForm.type = 'ASSET';
    showCategoryModal.value = false;

    await loadData();

    alert('เพิ่มหมวดหมู่สำเร็จ');
  } catch (error) {
    console.error('Save category failed:', error);
    console.error('Error message:', error?.message);
    console.error('Error response:', error?.response);

    alert(error?.message || 'ไม่สามารถเพิ่มหมวดหมู่ได้');
  }
};

const deleteCategory = async () => {
  alert('API ลบหมวดหมู่ยังไม่ได้สร้าง เพื่อป้องกันข้อมูลครุภัณฑ์/วัสดุอ้างอิงผิดพลาด');
};

const openAssetModal = (asset = null) => {
  if (asset) {
    editingAssetId.value = asset.id;
    assetForm.name = asset.name || '';
    assetForm.brand = asset.brand || '';
    assetForm.model = asset.model || '';
    assetForm.assetCode = asset.assetCode || '';
    assetForm.serialNumber = asset.serialNumber || '';
    assetForm.categoryId = asset.categoryId || '';
    assetForm.location = asset.location || '';
    assetForm.note = asset.note || '';
    assetForm.status = dbStatusFromUi(asset.status);
  } else {
    editingAssetId.value = null;
    assetForm.name = '';
    assetForm.brand = '';
    assetForm.model = '';
    assetForm.assetCode = '';
    assetForm.serialNumber = '';
    assetForm.categoryId = categories.value.find((item) => item.type === 'asset')?.id || '';
    assetForm.location = '';
    assetForm.note = '';
    assetForm.status = 'AVAILABLE';
  }

  showAssetModal.value = true;
};

const saveAsset = async () => {
  const payload = {
    assetCode: assetForm.assetCode.trim(),
    name: assetForm.name.trim(),
    brand: assetForm.brand.trim(),
    model: assetForm.model.trim(),
    serialNumber: assetForm.serialNumber.trim(),
    categoryId: Number(assetForm.categoryId),
    location: assetForm.location.trim(),
    note: assetForm.note.trim(),
    status: dbStatusFromUi(assetForm.status),
  };

  try {
    const isEditing = Boolean(editingAssetId.value);

    const response = await fetch(
      isEditing
        ? `http://localhost:3000/api/assets/${editingAssetId.value}`
        : 'http://localhost:3000/api/assets',
      {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );

    const savedAsset = await response.json();

    if (!response.ok) {
      throw new Error(
        savedAsset.message ||
        (isEditing
          ? 'ไม่สามารถแก้ไขครุภัณฑ์ได้'
          : 'ไม่สามารถเพิ่มครุภัณฑ์ได้'),
      );
    }
    savedAsset.status = uiStatusFromDb(savedAsset.status);

    if (isEditing) {
      const index = assets.value.findIndex(
        (item) => item.id === editingAssetId.value,
      );

      if (index !== -1) {
        assets.value[index] = {
          ...assets.value[index],
          ...savedAsset,
        };
      }
    } else {
      assets.value.push(savedAsset);
    }

    showAssetModal.value = false;
    editingAssetId.value = null;

    alert(
      savedAsset.message ||
      (isEditing ? 'แก้ไขครุภัณฑ์สำเร็จ' : 'เพิ่มครุภัณฑ์สำเร็จ'),
    );
  } catch (error) {
    alert(error.message || 'ไม่สามารถบันทึกครุภัณฑ์ได้');
  }
};

const deleteAsset = async (assetId) => {
  const asset = assets.value.find((item) => item.id === assetId);

  if (!asset) {
    alert('ไม่พบข้อมูลครุภัณฑ์ที่ต้องการนำออกจากรายการ');
    return;
  }

  const confirmed = window.confirm(
    `ต้องการนำ "${asset.assetCode} - ${asset.name}" ออกจากรายการใช้งานหรือไม่?\n\n` +
    'หากกำลังถูกยืมอยู่ จะไม่สามารถนำออกจากรายการได้\n' +
    'ประวัติยืม–คืนจะยังคงอยู่',
  );

  if (!confirmed) return;

  try {
    const response = await fetch(
      `http://localhost:3000/api/assets/${assetId}`,
      {
        method: 'DELETE',
      },
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'ไม่สามารถนำครุภัณฑ์ออกจากรายการได้');
    }

    assets.value = assets.value.filter((item) => item.id !== assetId);

    alert(data.message || 'นำครุภัณฑ์ออกจากรายการใช้งานสำเร็จ');
  } catch (error) {
    alert(error.message || 'ไม่สามารถนำครุภัณฑ์ออกจากรายการได้');
  }
};

const openBorrowModal = () => {
  const today = new Date().toISOString().slice(0, 10);

  borrowForm.assetId = '';
  borrowForm.borrowerCid = 'TEMP-USER';
  borrowForm.borrowerName = '';
  borrowForm.department = '';
  borrowForm.purpose = '';
  borrowForm.startDate = today;
  borrowForm.dueDate = '';

  showBorrowModal.value = true;
};

const submitBorrow = async () => {
  const assetId = Number(borrowForm.assetId);
  const borrowerCid = borrowForm.borrowerCid?.trim() || 'TEMP-USER';
  const borrowerName = borrowForm.borrowerName?.trim();
  const location = borrowForm.location?.trim();
  const purpose = borrowForm.purpose?.trim();
  const borrowDate = borrowForm.startDate;
  const dueDate = borrowForm.dueDate;
  const note = borrowForm.note?.trim() || null;

  const missingFields = [];

  if (!assetId) {
    missingFields.push('อุปกรณ์');
  }

  if (!borrowerName) {
    missingFields.push('ชื่อผู้ยืม');
  }

  if (!purpose) {
    missingFields.push('งาน/โครงการที่ใช้');
  }

  if (!location) {
    missingFields.push('สถานที่ใช้งาน / สถานที่ยืม');
  }

  if (!borrowDate) {
    missingFields.push('วันที่เริ่มยืม');
  }

  if (!dueDate) {
    missingFields.push('วันที่กำหนดคืน');
  }

  if (missingFields.length > 0) {
    alert(`กรุณากรอกข้อมูลให้ครบ: ${missingFields.join(', ')}`);
    return;
  }

  if (new Date(dueDate) < new Date(borrowDate)) {
    alert('วันที่กำหนดคืนต้องไม่ก่อนวันที่ยืม');
    return;
  }

  try {
    await api.createBorrow({
      assetId,
      borrowerCid,
      borrowerName,
      location,
      purpose,
      borrowDate,
      dueDate,
      note,
    });

    Object.assign(borrowForm, {
      assetId: '',
      borrowerCid: 'TEMP-USER',
      borrowerName: '',
      location: '',
      purpose: '',
      startDate: '',
      dueDate: '',
      note: '',
    });

    showBorrowModal.value = false;

    await loadData();

    alert('บันทึกการยืมสำเร็จ');
  } catch (error) {
    console.error('Submit borrow failed:', error);
    alert(error?.message || 'ไม่สามารถบันทึกการยืมได้');
  }
};

const returnAsset = async (record) => {
  if (!confirm('ยืนยันการคืนอุปกรณ์นี้หรือไม่?')) return;

  try {
    await api.returnBorrow(record.id, {
      receivedByCid: 'TEMP-USER',
      returnNote: '',
    });

    await loadData();
  } catch (error) {
    console.error('Return asset failed:', error);
    alert(error.message);
  }
};

const openSupplyModal = (supply = null) => {
  if (supply) {
    editingSupplyId.value = supply.id;
    supplyForm.itemCode = supply.itemCode || '';
    supplyForm.name = supply.name || '';
    supplyForm.categoryId = supply.categoryId || '';
    supplyForm.quantity = Number(supply.quantity || 0);
    supplyForm.minimumQuantity = Number(supply.minimumQuantity ?? supply.minThreshold ?? 0);
    supplyForm.unit = supply.unit || 'pcs';
    supplyForm.location = supply.location || '';
    supplyForm.note = supply.note || '';
  } else {
    editingSupplyId.value = null;
    supplyForm.itemCode = '';
    supplyForm.name = '';
    supplyForm.categoryId = categories.value.find((item) => item.type === 'supply')?.id || '';
    supplyForm.quantity = 0;
    supplyForm.minimumQuantity = 5;
    supplyForm.unit = 'pcs';
    supplyForm.location = '';
    supplyForm.note = '';
  }

  showSupplyModal.value = true;
};

const saveSupply = async () => {
  const payload = {
    itemCode: supplyForm.itemCode.trim(),
    name: supplyForm.name.trim(),
    categoryId: Number(supplyForm.categoryId),
    unit: supplyForm.unit.trim(),
    quantity: Number(supplyForm.quantity || 0),
    minimumQuantity: Number(supplyForm.minimumQuantity || 0),
    location: supplyForm.location.trim(),
    note: supplyForm.note.trim(),
  };

  const isEditing = Boolean(editingSupplyId.value);

  try {
    const response = await fetch(
      isEditing
        ? `http://localhost:3000/api/supplies/${editingSupplyId.value}`
        : 'http://localhost:3000/api/supplies',
      {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );

    const savedSupply = await response.json();

    if (!response.ok) {
      throw new Error(
        savedSupply.message ||
        (isEditing
          ? 'ไม่สามารถแก้ไขวัสดุสิ้นเปลืองได้'
          : 'ไม่สามารถเพิ่มวัสดุสิ้นเปลืองได้'),
      );
    }

    if (isEditing) {
      const index = supplies.value.findIndex(
        (item) => item.id === editingSupplyId.value,
      );

      if (index !== -1) {
        supplies.value[index] = {
          ...supplies.value[index],
          ...savedSupply,
        };
      }
    } else {
      supplies.value.push(savedSupply);
    }

    showSupplyModal.value = false;
    editingSupplyId.value = null;

    alert(
      savedSupply.message ||
      (isEditing
        ? 'แก้ไขวัสดุสิ้นเปลืองสำเร็จ'
        : 'เพิ่มวัสดุสิ้นเปลืองสำเร็จ'),
    );
  } catch (error) {
    alert(error.message || 'ไม่สามารถบันทึกวัสดุสิ้นเปลืองได้');
  }
};

const openSupplyTxModal = (supplyId, type) => {
  supplyTxForm.supplyId = Number(supplyId);
  supplyTxForm.type = type;
  supplyTxForm.quantity = 1;
  supplyTxForm.note = '';
  supplyTxForm.requesterName = '';
  supplyTxForm.department = '';
  supplyTxForm.workOrderNo = '';
  supplyTxForm.createdByCid = 'TEMP-USER';

  supplyTxModal.value = true;
};

const submitSupplyTx = async () => {
  const supplyId = Number(supplyTxForm.supplyId);
  const quantity = Number(supplyTxForm.quantity);

  if (!supplyId) {
    alert('ไม่พบรายการวัสดุ');
    return;
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    alert('กรุณาระบุจำนวนเป็นตัวเลขมากกว่า 0');
    return;
  }

  if (
    supplyTxForm.type === 'OUT'
    && !supplyTxForm.workOrderNo.trim()
  ) {
    alert('กรุณาระบุหมายเลขใบงานก่อนเบิกวัสดุ');
    return;
  }

  try {
    await api.createSupplyTransaction(supplyId, {
      transactionType: supplyTxForm.type,
      quantity,
      workOrderNo: supplyTxForm.workOrderNo.trim(),
      requesterName: supplyTxForm.requesterName.trim(),
      department: supplyTxForm.department.trim(),
      note: supplyTxForm.note.trim(),
      createdByCid: supplyTxForm.createdByCid || 'TEMP-USER',
    });

    supplyTxModal.value = false;

    await loadData();

    alert(
      supplyTxForm.type === 'IN'
        ? 'บันทึกรับวัสดุเข้าเรียบร้อย'
        : 'บันทึกการเบิกวัสดุเรียบร้อย',
    );
  } catch (error) {
    console.error('Save supply transaction failed:', error);
    alert(error?.message || 'ไม่สามารถบันทึกรายการวัสดุได้');
  }
};

const supplyLogs = computed(() => (
  supplyTransactions.value
    .map((transaction) => {
      const supply = supplies.value.find(
        (item) => Number(item.id) === Number(transaction.supplyId),
      );

      return {
        ...transaction,
        supplyName: transaction.supplyName || supply?.name || '',
        unit: transaction.unit || supply?.unit || '',
        categoryId: supply?.categoryId || '',
        categoryName: supply
          ? getCategoryName(supply.categoryId)
          : '',
      };
    })
    .sort((a, b) => {
      const timeA = new Date(a.timestamp || 0).getTime();
      const timeB = new Date(b.timestamp || 0).getTime();
      return timeB - timeA;
    })
));

const suppliesUsageByCategory = computed(() => {
  const result = {};

  for (const transaction of supplyTransactions.value) {
    if (!transaction.supplyId || transaction.type !== 'OUT') continue;

    const supply = supplies.value.find(
      (item) => Number(item.id) === Number(transaction.supplyId),
    );

    if (!supply) continue;

    const categoryId = supply.categoryId || 'uncategorized';

    if (!result[categoryId]) {
      result[categoryId] = {
        categoryId,
        categoryName: getCategoryName(categoryId),
        used: 0,
        currentQty: 0,
      };
    }

    result[categoryId].used += Number(transaction.quantity) || 0;
  }

  for (const supply of supplies.value) {
    const categoryId = supply.categoryId || 'uncategorized';

    if (!result[categoryId]) {
      result[categoryId] = {
        categoryId,
        categoryName: getCategoryName(categoryId),
        used: 0,
        currentQty: 0,
      };
    }

    result[categoryId].currentQty += Number(supply.quantity) || 0;
  }

  return Object.values(result);
});

const suppliesUsageByItem = computed(() => {
  const result = {};

  for (const transaction of supplyTransactions.value) {
    if (!transaction.supplyId || transaction.type !== 'OUT') continue;

    if (!result[transaction.supplyId]) {
      result[transaction.supplyId] = {
        supplyId: transaction.supplyId,
        name: '',
        categoryId: '',
        categoryName: '',
        used: 0,
        currentQty: 0,
      };
    }

    result[transaction.supplyId].used += Number(transaction.quantity) || 0;
  }

  for (const supply of supplies.value) {
    if (!result[supply.id]) {
      result[supply.id] = {
        supplyId: supply.id,
        name: supply.name || '',
        categoryId: supply.categoryId || '',
        categoryName: getCategoryName(supply.categoryId),
        used: 0,
        currentQty: 0,
      };
    }

    result[supply.id].name = supply.name || result[supply.id].name;
    result[supply.id].categoryId = supply.categoryId || result[supply.id].categoryId;
    result[supply.id].categoryName = getCategoryName(supply.categoryId);
    result[supply.id].currentQty = Number(supply.quantity) || 0;
  }

  return Object.values(result);
});

const assetSummaryByCategory = computed(() => {
  const result = {};

  for (const asset of assets.value) {
    const categoryId = asset.categoryId || 'uncategorized';

    if (!result[categoryId]) {
      result[categoryId] = {
        categoryId,
        categoryName: getCategoryName(categoryId),
        total: 0,
        available: 0,
        borrowed: 0,
        maintenance: 0,
        retired: 0,
        items: [],
      };
    }

    result[categoryId].total += 1;

    if (asset.status === 'Available') result[categoryId].available += 1;
    else if (asset.status === 'Borrowed') result[categoryId].borrowed += 1;
    else if (asset.status === 'Maintenance') result[categoryId].maintenance += 1;
    else if (asset.status === 'Retired') result[categoryId].retired += 1;

    result[categoryId].items.push(asset);
  }

  return Object.values(result)
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => (
        (a.name || '').localeCompare(b.name || '')
      )),
    }))
    .sort((a, b) => (
      (a.categoryName || '').localeCompare(b.categoryName || '')
    ));
});

const suppliesUsageSummary = computed(() => {
  let totalUsed = 0;
  let totalCurrent = 0;

  for (const row of suppliesUsageByCategory.value) {
    totalUsed += Number(row.used) || 0;
    totalCurrent += Number(row.currentQty) || 0;
  }

  return { totalUsed, totalCurrent };
});

const suppliesMonthlySummary = computed(() => {
  const result = {};

  for (const transaction of supplyTransactions.value) {
    const date = new Date(transaction.createdAt || 0);

    if (Number.isNaN(date.getTime())) continue;

    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!result[month]) {
      result[month] = {
        month,
        totalIn: 0,
        totalOut: 0,
        departments: {},
      };
    }

    const quantity = Number(transaction.quantity) || 0;

    if (transaction.type === 'IN') {
      result[month].totalIn += quantity;
      continue;
    }

    if (transaction.type !== 'OUT') continue;

    result[month].totalOut += quantity;

    const department = transaction.department || 'ไม่ระบุแผนก';

    if (!result[month].departments[department]) {
      result[month].departments[department] = {
        department,
        totalOut: 0,
        items: {},
      };
    }

    const departmentData = result[month].departments[department];
    departmentData.totalOut += quantity;

    if (!departmentData.items[transaction.supplyId]) {
      departmentData.items[transaction.supplyId] = {
        supplyId: transaction.supplyId,
        name: transaction.supplyName || '',
        unit: transaction.unit || '',
        totalQty: 0,
      };
    }

    departmentData.items[transaction.supplyId].totalQty += quantity;
  }

  const summary = Object.values(result)
    .map((item) => ({
      month: item.month,
      totalIn: item.totalIn,
      totalOut: item.totalOut,
      departments: Object.values(item.departments).map((department) => ({
        department: department.department,
        totalOut: department.totalOut,
        items: Object.values(department.items),
      })),
    }))
    .sort((a, b) => (a.month < b.month ? 1 : -1));

  return {
    months: summary.map((item) => item.month),
    summary,
  };
});
</script>

<template>
  <div class="min-h-screen flex flex-col font-sans">
    <!-- Navbar -->
    <header
      class="bg-gradient-to-r from-slate-900 via-indigo-900 to-violet-900 text-white shadow-lg border-b border-white/10">
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
            'px-3 py-2 rounded-lg text-sm font-medium transition duration-200',
            currentTab === 'dashboard'
              ? 'bg-white text-indigo-800 shadow-md'
              : 'bg-white/10 text-indigo-50 hover:bg-white/20'
          ]">
            ภาพรวมอุปกรณ์
          </button>

          <button @click="setTab('assets')" :class="[
            'px-3 py-2 rounded-lg text-sm font-medium transition duration-200',
            currentTab === 'assets'
              ? 'bg-white text-indigo-800 shadow-md'
              : 'bg-white/10 text-indigo-50 hover:bg-white/20'
          ]">
            ครุภัณฑ์/อุปกรณ์ไอที
          </button>

          <button @click="setTab('borrow')" :class="[
            'px-3 py-2 rounded-lg text-sm font-medium transition duration-200',
            currentTab === 'borrow'
              ? 'bg-white text-indigo-800 shadow-md'
              : 'bg-white/10 text-indigo-50 hover:bg-white/20'
          ]">
            ระบบยืม–คืนอุปกรณ์
          </button>

          <!-- Dropdown สำหรับเมนูวัสดุสิ้นเปลือง -->
          <div class="relative">
            <button @click="showSuppliesMenu = !showSuppliesMenu" :class="[
              'px-3 py-2 rounded-lg text-sm font-medium transition duration-200 flex items-center gap-1',
              ['supplies', 'suppliesLog', 'suppliesSummary'].includes(currentTab)
                ? 'bg-white text-indigo-800 shadow-md'
                : 'bg-white/10 text-indigo-50 hover:bg-white/20'
            ]">
              จัดการวัสดุสิ้นเปลือง
              <span class="text-[10px]">▾</span>
            </button>

            <div v-if="showSuppliesMenu"
              class="absolute right-0 mt-2 w-60 overflow-hidden bg-white text-slate-800 rounded-xl shadow-xl border border-slate-200 z-20">
              <button @click="setTab('supplies')"
                class="w-full px-4 py-3 text-left text-sm hover:bg-indigo-50 hover:text-indigo-700 transition">
                คลังวัสดุสิ้นเปลือง
              </button>

              <button @click="setTab('suppliesLog')"
                class="w-full px-4 py-3 text-left text-sm hover:bg-indigo-50 hover:text-indigo-700 transition">
                ประวัติการเบิกวัสดุ
              </button>

              <button @click="setTab('suppliesSummary')"
                class="w-full px-4 py-3 text-left text-sm hover:bg-indigo-50 hover:text-indigo-700 transition">
                สรุปยอดใช้วัสดุ (รายเดือน/แผนก)
              </button>
            </div>
          </div>

          <button @click="setTab('categories')" :class="[
            'px-3 py-2 rounded-lg text-sm font-medium transition duration-200',
            currentTab === 'categories'
              ? 'bg-white text-indigo-800 shadow-md'
              : 'bg-white/10 text-indigo-50 hover:bg-white/20'
          ]">
            หมวดหมู่
          </button>

          <div class="flex items-center gap-2">
            <div class="hidden sm:block text-right">
              <div class="text-sm font-medium text-white">
                {{ userDisplayName }}
              </div>
            </div>

            <button @click="logout"
              class="px-3 py-2 rounded-lg text-sm font-medium bg-rose-600 hover:bg-rose-700 text-white transition">
              ออกจากระบบ
            </button>
          </div>
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
              สถานะปัจจุบัน
            </label>
            <select v-model="assetForm.status"
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="Available">พร้อมใช้งาน</option>
              <option value="Maintenance">อยู่ระหว่างซ่อมบำรุง</option>
              <option value="Retired">เลิกใช้งาน</option>
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
            <input v-model="borrowForm.purpose" type="text"
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
              <input v-model="borrowForm.startDate" type="date"
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

        <div class="form-group">
          <label class="block text-xs font-medium text-slate-600 mb-1">รหัสวัสดุ</label>
          <input v-model="supplyForm.itemCode" type="text"
            class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="เช่น SUP-002" />
        </div>

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
                จำนวนที่มี
              </label>
              <input v-model.number="supplyForm.quantity" type="number" min="0" :readonly="Boolean(editingSupplyId)"
                class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none" :class="editingSupplyId
                  ? 'cursor-not-allowed bg-slate-100 text-slate-500'
                  : 'bg-white focus:ring-2 focus:ring-indigo-500'" />
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

          <!-- แสดงเฉพาะเมื่อเป็นการเบิกวัสดุ (OUT) -->
          <div v-if="supplyTxForm.type === 'OUT'">
            <label class="block text-xs font-medium text-slate-600 mb-1">
              หมายเลขใบงานซ่อม <span class="text-rose-500">*</span>
            </label>
            <input v-model="supplyTxForm.workOrderNo" type="text"
              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="เช่น WO-2026-0001" />
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