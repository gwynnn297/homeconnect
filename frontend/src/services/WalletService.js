import apiClient from './apiClient';

const WalletService = {
  getWalletInfo: async () => {
    return await apiClient.get('/api/v1/wallets/me');
  },
  
  getTransactions: async (params = { page: 0, size: 10, sortBy: 'createdAt', sortDir: 'desc' }) => {
    return await apiClient.get('/api/v1/wallets/transactions', { params });
  },
  
  generateQr: async (amount) => {
    return await apiClient.post('/api/v1/wallets/generate-qr', { amount });
  }
};

export default WalletService;
