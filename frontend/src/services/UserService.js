import apiClient from './apiClient';

/**
 * Service quản lý thông tin người dùng
 */
const UserService = {
    /**
     * Lấy danh sách tỉnh/thành phố
     * Endpoint: GET /api/locations/provinces
     * 
     * @returns {Array<{id: number, name: string}>} Danh sách tỉnh/thành
     */
    getProvinces: async () => {
        return apiClient.get('/api/locations/provinces');
    },

    /**
     * Nộp hồ sơ KYC (Cho Helper)
     * Endpoint: PUT /api/users/update-kyc
     * 
     * @param {Object} kycData - Dữ liệu định danh
     * @param {string} kycData.cccdFront - URL ảnh mặt trước CMND/CCCD
     * @param {string} kycData.cccdBack - URL ảnh mặt sau CMND/CCCD
     * @param {string} kycData.avatar - URL ảnh đại diện/selfie
     * @param {string} kycData.address - Địa chỉ liên hệ cụ thể
     * @param {number} kycData.hometown - ID của tỉnh/thành quê quán
     */
    updateKyc: async (kycData) => {
        return apiClient.put('/api/users/update-kyc', kycData);
    }
};

export default UserService;
