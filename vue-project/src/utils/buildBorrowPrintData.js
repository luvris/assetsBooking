import { normalizeAsset, normalizeBorrow } from './inventoryRecords.js';

const blank = (value, fallback = '-') => {
    if (value === null || value === undefined || value === '') {
        return fallback;
    }

    return String(value).trim() || fallback;
};

const cleanText = (value) => String(value ?? '').trim();

const formatThaiDate = (value) => {
    if (!value) return '........................................';

    const dateText = String(value).replace(' ', 'T');
    const date = new Date(dateText);

    if (Number.isNaN(date.getTime())) {
        return String(value).slice(0, 10);
    }

    return new Intl.DateTimeFormat('th-TH', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    }).format(date);
};

const normalizeAssetList = (assetInput) => {
    const assets = Array.isArray(assetInput)
        ? assetInput
        : [assetInput];

    return assets
        .filter(Boolean)
.map((assetInputItem) => {
  const asset = normalizeAsset(assetInputItem);

  const assetName = cleanText(
    asset.name
    || asset.assetName
    || asset.asset_name
    || assetInputItem.name
    || assetInputItem.assetName
    || assetInputItem.asset_name,
  );

  const brand = cleanText(
    asset.brand
    || assetInputItem.brand,
  );

  const model = cleanText(
    asset.model
    || assetInputItem.model,
  );

  return {
    id: asset.id,

    assetCode: blank(
      asset.assetCode
      || asset.asset_code
      || assetInputItem.assetCode
      || assetInputItem.asset_code,
    ),

    assetName: assetName || '-',
    brand,
    model,

    // ต้องการแสดง: ชื่ออุปกรณ์ / ยี่ห้อ
    brandModel: [assetName, brand]
      .filter(Boolean)
      .join(' / ') || '-',

    serialNumber: blank(
      asset.serialNumber
      || asset.serial_number
      || assetInputItem.serialNumber
      || assetInputItem.serial_number,
    ),

    quantity: asset.quantity || assetInputItem.quantity || 1,
    unit: asset.unit || assetInputItem.unit || 'เครื่อง',
  };
});
};

export const buildBorrowPrintData = (borrowInput, assetInput) => {
    const assets = normalizeAssetList(assetInput);
    const firstAsset = assets[0] || {};

    const borrow = normalizeBorrow(borrowInput, {
        assetId: firstAsset.id,
        assetCode: firstAsset.assetCode,
        assetName: firstAsset.assetName,
    });

    const raw = borrowInput || {};

    return {
        formType: borrow.formType === 'OUT_OF_AREA'
            ? 'OUT_OF_AREA'
            : 'IN_HOSPITAL',

        borrowerName: blank(borrow.borrowerName),
        borrowerCid: blank(borrow.borrowerCid),

        phone: blank(
            raw.borrower_phone
            || raw.borrowerPhone
            || raw.borrowerphone
            || raw.phone
            || borrow.borrowerPhone
            || borrow.phone,
        ),

        department: blank(borrow.department),

        position: blank(
            raw.position
            || raw.borrowerPosition
            || raw.borrower_position
            || borrow.borrowerPosition,
        ),

        purpose: blank(borrow.purpose || borrow.jobTask),
        useLocation: blank(borrow.useLocation || borrow.location),
        outOfAreaNote: blank(borrow.outOfAreaNote),

        borrowedAt: borrow.borrowedAt,
        dueAt: borrow.dueAt,

        borrowedDateText: formatThaiDate(borrow.borrowedAt),
        dueDateText: formatThaiDate(borrow.dueAt),

        assets,
    };
};