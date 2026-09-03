import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import keycloak from '@/auth/keycloak';
import { api } from '../api';

vi.mock('@/auth/keycloak', () => ({
  default: {
    updateToken: vi.fn(),
    login: vi.fn(),
    token: 'test-keycloak-token-xyz',
  },
}));

describe('api service (src/services/api.js)', () => {
  const originalFetch = global.fetch;
  let consoleErrorSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    keycloak.token = 'test-keycloak-token-xyz';
    keycloak.updateToken.mockResolvedValue(true);
    keycloak.login.mockResolvedValue(true);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    consoleErrorSpy.mockRestore();
  });

  describe('Authentication & Token Refresh', () => {
    it('should refresh token with 30s buffer before making request', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [{ id: '1', name: 'IT' }],
      });

      await api.getCategories();

      expect(keycloak.updateToken).toHaveBeenCalledWith(30);
    });

    it('should call keycloak.login() and throw error when token refresh fails', async () => {
      const refreshError = new Error('Token expired');
      keycloak.updateToken.mockRejectedValue(refreshError);

      await expect(api.getCategories()).rejects.toThrow('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
      expect(keycloak.login).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith('ไม่สามารถ refresh Keycloak token ได้:', refreshError);
    });
  });

  describe('Request headers & Edge cases', () => {
    it('should include Content-Type and Authorization Bearer header', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [],
      });

      await api.getAssets();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/assets'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-keycloak-token-xyz',
          }),
        }),
      );
    });

    it('should handle non-JSON or empty response gracefully without throwing syntax error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        json: async () => {
          throw new Error('Unexpected end of JSON input');
        },
      });

      const result = await api.deleteAsset('asset-123');
      expect(result).toEqual({});
    });
  });

  describe('Error handling on non-OK HTTP responses', () => {
    it('should throw data.message when available', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ message: 'ชื่อหมวดหมู่ซ้ำ' }),
      });

      await expect(api.createCategory({ name: 'อุปกรณ์' })).rejects.toThrow('ชื่อหมวดหมู่ซ้ำ');
    });

    it('should throw data.error when message is absent', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({ error: 'ไม่มีสิทธิ์เข้าถึง' }),
      });

      await expect(api.getAssets()).rejects.toThrow('ไม่มีสิทธิ์เข้าถึง');
    });

    it('should throw data.details when message and error are absent', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        json: async () => ({ details: 'ข้อมูลไม่ถูกต้อง' }),
      });

      await expect(api.createAsset({})).rejects.toThrow('ข้อมูลไม่ถูกต้อง');
    });

    it('should throw fallback status message when no error details in json response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({}),
      });

      await expect(api.getSupplies()).rejects.toThrow('API error 500: Internal Server Error');
    });
  });

  describe('API endpoints & methods (Happy Paths)', () => {
    beforeEach(() => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });
    });

    it('getCategories: calls GET /categories', async () => {
      await api.getCategories();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/categories$/),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-keycloak-token-xyz',
          }),
        }),
      );
    });

    it('createCategory: calls POST /categories with payload', async () => {
      const payload = { name: 'คอมพิวเตอร์', type: 'asset' };
      await api.createCategory(payload);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/categories$/),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      );
    });

    it('getAssets: calls GET /assets', async () => {
      await api.getAssets();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/assets$/),
        expect.anything(),
      );
    });

    it('createAsset: calls POST /assets with payload', async () => {
      const payload = { code: 'AST-001', name: 'Laptop Dell' };
      await api.createAsset(payload);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/assets$/),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      );
    });

    it('updateAsset: calls PUT /assets/:id with payload', async () => {
      const payload = { name: 'Laptop Dell XPS' };
      await api.updateAsset('ast-1', payload);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/assets\/ast-1$/),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(payload),
        }),
      );
    });

    it('deleteAsset: calls DELETE /assets/:id', async () => {
      await api.deleteAsset('ast-1');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/assets\/ast-1$/),
        expect.objectContaining({
          method: 'DELETE',
        }),
      );
    });

    it('getSupplies: calls GET /supplies', async () => {
      await api.getSupplies();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/supplies$/),
        expect.anything(),
      );
    });

    it('createSupply: calls POST /supplies with payload', async () => {
      const payload = { name: 'กระดาษ A4', quantity: 50 };
      await api.createSupply(payload);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/supplies$/),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      );
    });

    it('updateSupply: calls PUT /supplies/:id with payload', async () => {
      const payload = { quantity: 45 };
      await api.updateSupply('sup-1', payload);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/supplies\/sup-1$/),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(payload),
        }),
      );
    });

    it('getBorrows: calls GET /borrows', async () => {
      await api.getBorrows();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/borrows$/),
        expect.anything(),
      );
    });

    it('createBorrow: calls POST /borrows with payload', async () => {
      const payload = { assetId: 'ast-1', borrower: 'Somchai' };
      await api.createBorrow(payload);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/borrows$/),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      );
    });

    it('returnBorrow: calls POST /borrows/:id/return with payload', async () => {
      const payload = { returnDate: '2026-09-03', condition: 'good' };
      await api.returnBorrow('brw-1', payload);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/borrows\/brw-1\/return$/),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      );
    });

    it('getSupplyTransactions: calls GET /supply-transactions', async () => {
      await api.getSupplyTransactions();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/supply-transactions$/),
        expect.anything(),
      );
    });

    it('createSupplyTransaction: calls POST /supplies/:id/transactions with payload', async () => {
      const payload = { type: 'out', amount: 5 };
      await api.createSupplyTransaction('sup-1', payload);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/supplies\/sup-1\/transactions$/),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      );
    });
  });
});
