import apiClient from './apiClient';

const KycService = {
    /**
     * API PB-33: AI verify CCCD + face matching
     * Endpoint: POST /api/v1/kyc/verify
     */
    verify: async (data) => {
        return apiClient.post('/api/v1/kyc/verify', data);
    },
};

export default KycService;
