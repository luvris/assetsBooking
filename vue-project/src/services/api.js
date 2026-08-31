const API_URL = 'http://localhost:3000/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'เกิดข้อผิดพลาดในการเรียก API');
  }

  return data;
}

export const api = {
  getCategories: () => request('/categories'),

  createCategory: (payload) => request('/categories', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  getAssets: () => request('/assets'),

  createAsset: (payload) => request('/assets', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  getSupplies: () => request('/supplies'),

  createSupply: (payload) => request('/supplies', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  getBorrows: () => request('/borrows'),

  createBorrow: (payload) => request('/borrows', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  returnBorrow: (borrowId, payload) => request(`/borrows/${borrowId}/return`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  getSupplyTransactions: () => request('/supply-transactions'),

  createSupplyTransaction: (supplyId, payload) => request(
    `/supplies/${supplyId}/transactions`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  ),
};