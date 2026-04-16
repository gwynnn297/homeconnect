import apiClient from './apiClient';

const WalletService = {
  // ===== WALLET =====
  getWalletInfo: async () => {
    return await apiClient.get('/api/v1/wallets/me');
  },

  getTransactions: async (params = { page: 0, size: 10 }) => {
    return await apiClient.get('/api/v1/wallets/transactions', { params });
  },

  generateQr: async (amount) => {
    return await apiClient.post('/api/v1/wallets/generate-qr', { amount });
  },

  // ===== DANH SACH NGAN HANG VIET (VietQR) =====
  getBankList: async () => {
    const response = await fetch('https://api.vietqr.io/v2/banks');
    const data = await response.json();
    return data.data || [];
  },

  // ===== TAIKHOAN NGAN HANG =====
  getBankAccounts: async () => {
    return await apiClient.get('/api/v1/wallets/bank-accounts');
  },

  addBankAccount: async (data) => {
    // data: { bankName, bankCode, accountNumber, accountHolderName, qrCodeUrl? }
    return await apiClient.post('/api/v1/wallets/bank-accounts', data);
  },

  setDefaultBankAccount: async (bankAccountId) => {
    return await apiClient.patch(`/api/v1/wallets/bank-accounts/${bankAccountId}/default`);
  },

  deleteBankAccount: async (bankAccountId) => {
    return await apiClient.delete(`/api/v1/wallets/bank-accounts/${bankAccountId}`);
  },

  // ===== RUT TIEN =====
  requestWithdraw: async (amount, bankAccountId = null) => {
    const body = { amount };
    if (bankAccountId) body.bankAccountId = bankAccountId;
    return await apiClient.post('/api/v1/wallets/withdraw', body);
  },

  getWithdrawals: async (params = { page: 0, size: 10 }) => {
    return await apiClient.get('/api/v1/wallets/withdrawals', { params });
  },

  getWithdrawDetail: async (requestId) => {
    return await apiClient.get(`/api/v1/wallets/withdrawals/${requestId}`);
  },
};

export default WalletService;
