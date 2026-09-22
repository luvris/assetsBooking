<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { api } from './services/api.js';
import keycloak from './auth/keycloak.js';
import DashboardView from './components/DashboardView.vue';
import AssetsView from './components/AssetsView.vue';
import BorrowView from './components/BorrowView.vue';
import BorrowPrintView from './components/BorrowPrintView.vue';
import BorrowCalendarView from './components/BorrowCalendarView.vue';
import SuppliesView from './components/SuppliesView.vue';
import CategoriesView from './components/CategoriesView.vue';
import SuppliesLogView from './components/SuppliesLogView.vue';
import SuppliesSummaryView from './components/SuppliesSummaryView.vue';

import {
  dbStatusFromUi,
  normalizeAsset,
  normalizeBorrow,
  normalizeBorrowFormType,
  uiStatusFromDb,
} from './utils/inventoryRecords.js';

const currentTab = ref('dashboard');
const showSuppliesMenu = ref(false);
const selectedBorrowForPrint = ref(null);

const setTab = (tab) => {
  currentTab.value = tab;
  showSuppliesMenu.value = false;
};

const openBorrowPrint = (borrowRecord) => {
  if (!borrowRecord?.id) {
    window.alert('ไม่พบข้อมูลรายการยืมสำหรับพิมพ์เอกสาร');
    return;
  }

  selectedBorrowForPrint.value = borrowRecord;
  currentTab.value = 'borrow-print';
  showSuppliesMenu.value = false;
};

const closeBorrowPrint = () => {
  selectedBorrowForPrint.value = null;
  currentTab.value = 'borrow';
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
  department: '',

  // ข้อมูลตามแบบฟอร์มขอยืมครุภัณฑ์คอมพิวเตอร์ (A6-1/A6-2)
  phone: '',
  formType: '',
  outOfAreaNote: '',
  isHodAcknowledged: false,

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

/**
 * หาครุภัณฑ์ในทะเบียนจากข้อมูลอ้างอิงในระเบียนยืม
 * ลำดับ: assetId -> assetCode -> ชื่อครุภัณฑ์
 */
const findAssetByReference = (assetList, record) => {
  const list = Array.isArray(assetList) ? assetList : [];
  const borrow = record && typeof record === 'object' ? record : {};
  const asset = borrow.asset || borrow.assetInfo || borrow.asset_info || {};

  const referencedId = borrow.assetId ?? borrow.asset_id;
  const referencedCode = borrow.assetCode ?? borrow.asset_code
    ?? asset.assetCode ?? asset.asset_code;
  const referencedName = borrow.assetName ?? borrow.asset_name ?? asset.name;

  if (referencedId !== null && referencedId !== undefined && referencedId !== '') {
    const byId = list.find((item) => Number(item.id) === Number(referencedId));

    if (byId) return byId;
  }

  if (referencedCode) {
    const byCode = list.find(
      (item) => String(item.assetCode || '').toLowerCase()
        === String(referencedCode).trim().toLowerCase(),
    );

    if (byCode) return byCode;
  }

  if (referencedName) {
    const byName = list.find(
      (item) => String(item.name || '').toLowerCase()
        === String(referencedName).trim().toLowerCase(),
    );

    if (byName) return byName;
  }

  return null;
};

const normalizeCategory = (category) => ({
  ...category,
  id: Number(category.id),
  type: String(category.type || '').toLowerCase(),
});

const normalizeSupply = (supply) => ({
  ...supply,

  id: Number(supply.id),

  itemCode: supply.itemCode ?? supply.item_code ?? '',

  categoryId:
    supply.categoryId === null || supply.categoryId === undefined
      ? ''
      : Number(supply.categoryId),

  quantity: Number(supply.quantity || 0),

  minThreshold: Number(
    supply.minimumQuantity ?? supply.minThreshold ?? 0,
  ),

  minimumQuantity: Number(
    supply.minimumQuantity ?? supply.minThreshold ?? 0,
  ),
});

/**
 * แสดงวันเวลาเป็นรูปแบบไทย (Asia/Bangkok)
 * ระบุ timeZone ชัดเจนเพื่อไม่ให้เบราว์เซอร์บวกเวลาเพิ่มซ้ำ
 */
const formatThaiDateTime = (value) => {
  if (!value) return '';

  const date = new Date(value);

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

const normalizeSupplyTransaction = (transaction) => {
  return {

    ...transaction,

    id: Number(transaction.id),

    supplyId: Number(
      transaction.supplyId ??
      transaction.supply_id ??
      0,
    ),

    type: String(
      transaction.type ??
      transaction.transactionType ??
      transaction.transaction_type ??
      '',
    )
      .trim()
      .toUpperCase(),

    quantity: Number(transaction.quantity ?? 0),

    createdAt:
      transaction.createdAt ??
      transaction.created_at ??
      null,

    timestamp:
      transaction.createdAt || transaction.created_at
        ? formatThaiDateTime(
          transaction.createdAt ?? transaction.created_at,
        )
        : transaction.timestamp || null,

    workOrderNo:
      transaction.workOrderNo ??
      transaction.work_order_no ??
      '',

    requesterName:
      transaction.requesterName ??
      transaction.requester_name ??
      '',

    // รองรับ department ทุกชื่อที่ API อาจส่งมา
    department:
      transaction.department ??
      transaction.departmentName ??
      transaction.department_name ??
      transaction.location ??
      '',

    note: transaction.note ?? '',
  };
};

const applySupplyTotalReceived = () => {
  const totalInBySupplyId = new Map();

  for (const transaction of supplyTransactions.value) {
    const supplyId = Number(transaction.supplyId);
    const quantity = Number(transaction.quantity || 0);

    if (!supplyId || quantity <= 0) {
      continue;
    }

    // หลัง normalize แล้ว type จะเป็น IN หรือ OUT
    if (transaction.type !== 'IN') {
      continue;
    }

    totalInBySupplyId.set(
      supplyId,
      (totalInBySupplyId.get(supplyId) || 0) + quantity,
    );
  }

  supplies.value = supplies.value.map((supply) => {
    const supplyId = Number(supply.id);
    const totalIn = totalInBySupplyId.get(supplyId) || 0;

    return {
      ...supply,

      // ถ้ามีประวัติ IN ให้ใช้ผลรวมของ IN
      // กรณีไม่มี history ให้ fallback เป็นยอดคงเหลือปัจจุบัน
      totalReceived: totalIn > 0
        ? totalIn
        : Number(supply.quantity || 0),
    };
  });
};

const loadData = async () => {
  loading.value = true;
  loadError.value = '';

  try {
    const [
      categoryResponse,
      assetResponse,
      supplyResponse,
      borrowResponse,
      transactionResponse,
    ] = await Promise.all([
      api.getCategories(),
      api.getAssets(),
      api.getSupplies(),

      api.getBorrows().catch((error) => {
        console.warn('Borrow API is not ready:', error.message);
        return [];
      }),

      api.getSupplyTransactions().catch((error) => {
        console.warn('Supply transaction API is not ready:', error.message);
        return [];
      }),
    ]);

    const categoryData = Array.isArray(categoryResponse)
      ? categoryResponse
      : (categoryResponse?.data ?? []);

    const assetData = Array.isArray(assetResponse)
      ? assetResponse
      : (assetResponse?.data ?? []);

    const supplyData = Array.isArray(supplyResponse)
      ? supplyResponse
      : (supplyResponse?.data ?? []);

    const borrowData = Array.isArray(borrowResponse)
      ? borrowResponse
      : (borrowResponse?.data ?? []);

    const transactionData = Array.isArray(transactionResponse)
      ? transactionResponse
      : (transactionResponse?.data ?? []);

    categories.value = Array.isArray(categoryData)
      ? categoryData.map(normalizeCategory)
      : [];

    assets.value = Array.isArray(assetData)
      ? assetData.map(normalizeAsset)
      : [];

    supplies.value = Array.isArray(supplyData)
      ? supplyData.map(normalizeSupply)
      : [];

    borrowRecords.value = Array.isArray(borrowData)
      ? borrowData.map((record) => {
        // เติมรหัส/ชื่อครุภัณฑ์จากทะเบียนครุภัณฑ์ เมื่อระเบียนยืมไม่ได้ส่งมา
        const asset = findAssetByReference(assets.value, record);

        return normalizeBorrow(record, {
          assetId: asset?.id,
          assetCode: asset?.assetCode,
          assetName: asset?.name,
        });
      })
      : [];

    supplyTransactions.value = Array.isArray(transactionData)
      ? transactionData.map(normalizeSupplyTransaction)
      : [];

    // คำนวณยอดรับเข้ารวมทั้งหมดจาก transaction type = IN
    applySupplyTotalReceived();
  } catch (error) {
    console.error('Load data failed:', error);

    loadError.value =
      error?.message ||
      'ไม่สามารถโหลดข้อมูลจากระบบได้';

    categories.value = [];
    assets.value = [];
    supplies.value = [];
    borrowRecords.value = [];
    supplyTransactions.value = [];
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

//const keycloak = inject('keycloak', null);

const userDisplayName = computed(() => {
  const token = keycloak?.tokenParsed;

  const fullName = [
    token?.given_name,
    token?.family_name,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    token?.name ||
    fullName ||
    token?.preferred_username ||
    'ผู้ใช้งาน'
  );
});

const logout = async () => {
  try {
    await keycloak.logout({
      redirectUri: window.location.origin,
    });
  } catch (error) {
    console.error('Keycloak logout failed:', error);
    alert('ไม่สามารถออกจากระบบได้ กรุณาลองใหม่อีกครั้ง');
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

async function deleteCategory(categoryId) {
  const category = categories.value.find(
    (item) => item.id === categoryId,
  );

  const categoryName =
    category?.category_name ||
    category?.name ||
    `รหัส ${categoryId}`;

  const confirmed = window.confirm(
    `ต้องการลบหมวดหมู่ "${categoryName}" ใช่หรือไม่?`,
  );

  if (!confirmed) return;

  try {
    await api.deleteCategory(categoryId);

    categories.value = categories.value.filter(
      (item) => item.id !== categoryId,
    );

    alert('ลบหมวดหมู่เรียบร้อยแล้ว');
  } catch (error) {
    alert(error.message || 'ไม่สามารถลบหมวดหมู่ได้');
  }
}

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

    const savedAsset = isEditing
      ? await api.updateAsset(editingAssetId.value, payload)
      : await api.createAsset(payload);

    if (isEditing) {
      const index = assets.value.findIndex(
        (item) => item.id === editingAssetId.value,
      );

      if (index !== -1) {
        assets.value[index] = normalizeAsset({
          ...assets.value[index],
          ...savedAsset,
        });
      }
    } else {
      // normalize ก่อนเก็บลง state เพื่อให้ทุกจุดที่ใช้งานได้ค่าเดียวกัน
      assets.value.push(normalizeAsset(savedAsset));
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
    const data = await api.deleteAsset(assetId);

    assets.value = assets.value.filter((item) => item.id !== assetId);

    alert(data?.message || 'นำครุภัณฑ์ออกจากรายการใช้งานสำเร็จ');
  } catch (error) {
    alert(error.message || 'ไม่สามารถนำครุภัณฑ์ออกจากรายการได้');
  }
};

const openBorrowModal = () => {
  const today = new Date().toISOString().slice(0, 10);

  Object.assign(borrowForm, {
    assetId: '',
    borrowerCid: 'TEMP-USER',
    borrowerName: '',
    department: '',
    location: '',
    purpose: '',
    phone: '',
    formType: '',
    outOfAreaNote: '',
    isHodAcknowledged: false,
    startDate: today,
    dueDate: '',
    note: '',
  });

  showBorrowModal.value = true;
};

/** ครุภัณฑ์ที่เลือกไว้ในฟอร์มยืม */
const selectedBorrowAsset = computed(() => (
  assets.value.find((item) => Number(item.id) === Number(borrowForm.assetId)) || null
));

/**
 * ประเภทใบขอยืม: ผู้ใช้เลือกเองก่อน ถ้าไม่เลือกจึงเดาจากข้อมูลที่กรอก
 * - OUT_OF_AREA = A6-1 ขอยืมออกนอกพื้นที่โรงพยาบาล
 * - IN_HOSPITAL = A6-2 ขอยืมใช้ภายในโรงพยาบาล
 */
const borrowFormType = computed(() => (
  borrowForm.formType || normalizeBorrowFormType({
    purpose: borrowForm.purpose,
    location: borrowForm.location,
    outOfAreaNote: borrowForm.outOfAreaNote,
    phone: borrowForm.phone,
  })
));

const isOutOfAreaBorrow = computed(() => borrowFormType.value === 'OUT_OF_AREA');

const submitBorrow = async () => {
  const assetId = Number(borrowForm.assetId);
  const borrowerCid = borrowForm.borrowerCid?.trim() || 'TEMP-USER';
  const borrowerName = borrowForm.borrowerName?.trim();
  const location = borrowForm.location?.trim();
  const department = (borrowForm.department || location)?.trim();
  const purpose = borrowForm.purpose?.trim();
  const phone = borrowForm.phone?.trim();
  const borrowDate = borrowForm.startDate;
  const dueDate = borrowForm.dueDate;
  const note = borrowForm.note?.trim() || null;
  const outOfAreaNote = borrowForm.outOfAreaNote?.trim();

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
    // Backend ใช้ชื่อ field borrowedAt และ dueAt
    const payload = {
      assetId,
      borrowerCid,
      borrowerName,
      department,
      location: location || department,
      purpose,

      // วันที่จาก input type="date" จะเป็น YYYY-MM-DD
      // เติมเวลาเพื่อให้ backend บันทึกเป็น DateTime ได้ชัดเจน
      borrowedAt: `${borrowDate}T00:00:00`,
      dueAt: `${dueDate}T23:59:59`,

      note,

      // ข้อมูลตามแบบฟอร์มขอยืมครุภัณฑ์คอมพิวเตอร์ (A6-1/A6-2)
      formType: borrowFormType.value,
      phone: phone || null,
      outOfAreaNote: borrowFormType.value === 'OUT_OF_AREA'
        ? (outOfAreaNote || null)
        : null,
      isHodAcknowledged: Boolean(borrowForm.isHodAcknowledged),

      // รหัส/ชื่อครุภัณฑ์จากทะเบียน เพื่อให้ระเบียนยืมแสดงผลได้ทันที
      assetCode: selectedBorrowAsset.value?.assetCode || null,
      assetName: selectedBorrowAsset.value?.name || null,
    };

    await api.createBorrow(payload);

    Object.assign(borrowForm, {
      assetId: '',
      borrowerCid: 'TEMP-USER',
      borrowerName: '',
      department: '',
      location: '',
      purpose: '',
      phone: '',
      formType: '',
      outOfAreaNote: '',
      isHodAcknowledged: false,
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
    const savedSupply = isEditing
      ? await api.updateSupply(editingSupplyId.value, payload)
      : await api.createSupply(payload);

    // normalize ก่อนเก็บลง state เพื่อให้ทุกจุดที่ใช้งานได้ค่าเดียวกัน
    const savedSupplyRecord = normalizeSupply(savedSupply);

    if (isEditing) {
      const index = supplies.value.findIndex(
        (item) => item.id === editingSupplyId.value,
      );

      if (index !== -1) {
        supplies.value[index] = {
          ...supplies.value[index],
          ...savedSupplyRecord,
        };
      }
    } else {
      supplies.value.push(savedSupplyRecord);
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

        itemCode:
          transaction.itemCode ||
          transaction.item_code ||
          transaction.itemcode ||
          supply?.itemCode ||
          supply?.item_code ||
          supply?.itemcode ||
          '',

        supplyName:
          transaction.supplyName ||
          transaction.supply_name ||
          transaction.supplyname ||
          supply?.name ||
          '-',

        unit:
          transaction.unit ||
          supply?.unit ||
          '',

        categoryId: supply?.categoryId,

        categoryName: supply
          ? getCategoryName(supply.categoryId)
          : '-',
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
  const monthMap = {};

  for (const transaction of supplyTransactions.value) {
    const dateValue = transaction.createdAt || transaction.created_at;

    if (!dateValue) continue;

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) continue;

    const month = `${date.getFullYear()}-${String(
      date.getMonth() + 1,
    ).padStart(2, '0')}`;

    if (!monthMap[month]) {
      monthMap[month] = {
        month,
        totalIn: 0,
        totalOut: 0,
        departmentsMap: {},
      };
    }

    const monthData = monthMap[month];
    const quantity = Number(transaction.quantity) || 0;
    const type = String(transaction.type || '').trim().toUpperCase();

    if (type === 'IN') {
      monthData.totalIn += quantity;
      continue;
    }

    if (type !== 'OUT') continue;

    monthData.totalOut += quantity;

    const department = String(
      transaction.department ||
      transaction.departmentName ||
      transaction.department_name ||
      transaction.location ||
      'ไม่ระบุแผนก',
    ).trim() || 'ไม่ระบุแผนก';

    if (!monthData.departmentsMap[department]) {
      monthData.departmentsMap[department] = {
        department,
        totalOut: 0,
        itemsMap: {},
      };
    }

    const departmentData = monthData.departmentsMap[department];
    departmentData.totalOut += quantity;

    const supplyId = Number(
      transaction.supplyId ?? transaction.supply_id ?? 0,
    );

    if (!departmentData.itemsMap[supplyId]) {
      const supply = supplies.value.find(
        (item) => Number(item.id) === supplyId,
      );

      departmentData.itemsMap[supplyId] = {
        supplyId,

        itemCode:
          transaction.itemCode ||
          transaction.item_code ||
          supply?.itemCode ||
          supply?.item_code ||
          '',

        name:
          transaction.supplyName ||
          transaction.supply_name ||
          supply?.name ||
          'ไม่ระบุวัสดุ',

        unit:
          transaction.unit ||
          supply?.unit ||
          '',

        totalQty: 0,
      };
    }

    departmentData.itemsMap[supplyId].totalQty += quantity;
  }

  const summary = Object.values(monthMap)
    .map((monthData) => ({
      month: monthData.month,
      totalIn: monthData.totalIn,
      totalOut: monthData.totalOut,

      departments: Object.values(monthData.departmentsMap)
        .map((department) => ({
          department: department.department,
          totalOut: department.totalOut,

          items: Object.values(department.itemsMap).sort((a, b) =>
            String(a.itemCode || a.name).localeCompare(
              String(b.itemCode || b.name),
              'th',
            ),
          ),
        }))
        .sort((a, b) =>
          a.department.localeCompare(b.department, 'th'),
        ),
    }))
    .sort((a, b) => b.month.localeCompare(a.month));

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



          <button @click="setTab('borrowCalendar')" :class="[
            'px-3 py-2 rounded-lg text-sm font-medium transition duration-200',
            currentTab === 'borrowCalendar'
              ? 'bg-white text-indigo-800 shadow-md'
              : 'bg-white/10 text-indigo-50 hover:bg-white/20'
          ]">
            ปฏิทินการยืม
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
        :clear-all-borrow-logs="clearAllBorrowLogs" @open-borrow-modal="openBorrowModal" @return-asset="returnAsset"
        @print-borrow="openBorrowPrint" />

      <BorrowPrintView v-else-if="currentTab === 'borrow-print'" :borrow-record="selectedBorrowForPrint"
        :assets="assets" @back="closeBorrowPrint" />

      <BorrowCalendarView v-else-if="currentTab === 'borrowCalendar'" :assets="assets" :borrow-records="borrowRecords"
        @return-asset="returnAsset" />

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
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div class="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div class="flex items-center justify-between gap-4">
          <div>
            <h3 class="text-xl font-bold text-slate-800">
              บันทึกการยืมอุปกรณ์
            </h3>

            <p class="mt-1 text-sm text-slate-500">
              กรอกข้อมูลเพื่อสร้างรายการยืมและใบแบบฟอร์ม A6-1/A6-2
            </p>
          </div>

          <button type="button" class="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="ปิดหน้าต่าง" @click="showBorrowModal = false">
            ✕
          </button>
        </div>

        <!-- ฟอร์มหลัก -->
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <!-- อุปกรณ์ -->
          <div class="sm:col-span-2">
            <label class="mb-1 block text-xs font-medium text-slate-600">
              เลือกอุปกรณ์ที่พร้อมให้ยืม
              <span class="text-rose-500">*</span>
            </label>

            <select v-model="borrowForm.assetId"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option disabled value="">
                -- เลือกอุปกรณ์ --
              </option>

              <option v-for="item in assets.filter((asset) => asset.status === 'Available')" :key="item.id"
                :value="item.id">
                {{ item.assetCode }} - {{ item.name }}
              </option>
            </select>
          </div>

          <!-- จำนวน -->
          <div>
            <label class="mb-1 block text-xs font-medium text-slate-600">
              จำนวน
              <span class="text-rose-500">*</span>
            </label>

            <input v-model.number="borrowForm.quantity" type="number" min="1"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          </div>

          <!-- ประเภทแบบฟอร์ม -->
          <div>
            <label class="mb-1 block text-xs font-medium text-slate-600">
              ประเภทใบขอยืม
              <span class="text-rose-500">*</span>
            </label>

            <select v-model="borrowForm.formType"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="IN_HOSPITAL">
                A6-2: ยืมภายในโรงพยาบาล
              </option>

              <option value="OUT_OF_AREA">
                A6-1: ยืมออกนอกพื้นที่
              </option>
            </select>
          </div>

          <!-- ชื่อผู้ยืม -->
          <div>
            <label class="mb-1 block text-xs font-medium text-slate-600">
              ชื่อผู้ยืม
              <span class="text-rose-500">*</span>
            </label>

            <input v-model="borrowForm.borrowerName" type="text"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="เช่น นายสมชาย ใจดี">
          </div>

          <!-- เบอร์โทร -->
          <div>
            <label class="mb-1 block text-xs font-medium text-slate-600">
              เบอร์โทรติดต่อกลับ
            </label>

            <input v-model="borrowForm.borrowerPhone" type="tel"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="เช่น 081-234-5678">
          </div>

          <!-- ตำแหน่ง -->
          <div>
            <label class="mb-1 block text-xs font-medium text-slate-600">
              ตำแหน่ง
            </label>

            <input v-model="borrowForm.borrowerPosition" type="text"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="เช่น นักวิชาการคอมพิวเตอร์">
          </div>

          <!-- หน่วยงาน -->
          <div>
            <label class="mb-1 block text-xs font-medium text-slate-600">
              หน่วยงาน/แผนก
            </label>

            <input v-model="borrowForm.department" type="text"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="เช่น กลุ่มงานดิจิทัลการแพทย์">
          </div>

          <!-- เหตุผล/งาน -->
          <div class="sm:col-span-2">
            <label class="mb-1 block text-xs font-medium text-slate-600">
              งาน/โครงการที่ใช้
              <span class="text-rose-500">*</span>
            </label>

            <input v-model="borrowForm.purpose" type="text"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="เช่น ติดตั้งระบบเครือข่ายหอผู้ป่วย">
          </div>

          <!-- สถานที่ -->
          <div class="sm:col-span-2">
            <label class="mb-1 block text-xs font-medium text-slate-600">
              สถานที่ใช้งาน / สถานที่ยืม
              <span class="text-rose-500">*</span>
            </label>

            <input v-model="borrowForm.location" type="text"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="เช่น ห้องตรวจ 3, อาคาร OPD ชั้น 2">
          </div>

          <!-- A6-1 เฉพาะยืมออกนอกพื้นที่ -->
          <div v-if="isOutOfAreaBorrow" class="rounded-xl border border-amber-200 bg-amber-50 p-3 sm:col-span-2">
            <label class="mb-1 block text-xs font-medium text-amber-900">
              รายละเอียดการนำออกนอกพื้นที่
              <span class="text-rose-500">*</span>
            </label>

            <textarea v-model="borrowForm.outOfAreaNote" rows="2"
              class="w-full resize-none rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="เช่น ศูนย์ประชุมจังหวัดเชียงใหม่" />

            <label class="mt-2 flex items-center gap-2 text-xs text-amber-900">
              <input v-model="borrowForm.isHodAcknowledged" type="checkbox"
                class="rounded border-amber-300 text-indigo-600 focus:ring-indigo-500">
              หัวหน้าหน่วยงานรับทราบ
            </label>
          </div>

          <!-- วันที่เริ่มยืม -->
          <div>
            <label class="mb-1 block text-xs font-medium text-slate-600">
              วันที่เริ่มยืม
              <span class="text-rose-500">*</span>
            </label>

            <input v-model="borrowForm.startDate" type="date"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          </div>

          <!-- วันที่กำหนดคืน -->
          <div>
            <label class="mb-1 block text-xs font-medium text-slate-600">
              วันที่กำหนดคืน
              <span class="text-rose-500">*</span>
            </label>

            <input v-model="borrowForm.dueDate" type="date"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
          </div>

          <!-- หมายเหตุ -->
          <div class="sm:col-span-2">
            <label class="mb-1 block text-xs font-medium text-slate-600">
              หมายเหตุ
              <span class="text-slate-400">(ถ้ามี)</span>
            </label>

            <textarea v-model="borrowForm.note" rows="2"
              class="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="รายละเอียดเพิ่มเติม..." />
          </div>
        </div>

        <!-- ปุ่มดำเนินการ -->
        <div class="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button"
            class="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
            @click="showBorrowModal = false">
            ยกเลิก
          </button>

          <button type="button"
            class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
            @click="submitBorrow">
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