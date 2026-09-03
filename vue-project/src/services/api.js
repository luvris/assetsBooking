import keycloak from "@/auth/keycloak";

const API_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '/api';

async function request(path, options = {}) {
    try {
        await keycloak.updateToken(30);
    } catch (error) {
        console.error('ไม่สามารถ refresh Keycloak token ได้:', error);

        await keycloak.login();
        throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
    }

    const response = await fetch(`${API_URL}${path}`, {
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${keycloak.token}`,

            ...(options.headers || {}),
        },
        ...options,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        console.error(`API ${response.status} ${path}:`, data);

        throw new Error(
            data.message ||
            data.error ||
            data.details ||
            `API error ${response.status}: ${response.statusText}`,
        );
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

    updateAsset: (assetId, payload) => request(`/assets/${assetId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    }),

    deleteAsset: (assetId) => request(`/assets/${assetId}`, {
        method: 'DELETE',
    }),

    getSupplies: () => request('/supplies'),

    createSupply: (payload) => request('/supplies', {
        method: 'POST',
        body: JSON.stringify(payload),
    }),

    updateSupply: (supplyId, payload) => request(`/supplies/${supplyId}`, {
        method: 'PUT',
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