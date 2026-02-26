import apiClient from './apiClient.js';

const BASE_URL = '/api/helpers';

const HelperRegistrationService = {
    /**
     * Lấy danh sách tỉnh/thành phố
     * @returns {Promise<Array>} Danh sách các tỉnh/thành phố
     */
    getProvinces: async () => {
        return await apiClient.get(`${BASE_URL}/provinces`);
    },

    /**
     * Lấy danh sách quận/huyện theo tỉnh
     * @param {number} provinceId - ID của tỉnh/thành phố
     * @returns {Promise<Array>} Danh sách các quận/huyện
     */
    getDistricts: async (provinceId) => {
        return await apiClient.get(`${BASE_URL}/districts/${provinceId}`);
    },

    /**
     * Lấy danh sách dịch vụ
     * @returns {Promise<Array>} Danh sách các dịch vụ có sẵn
     */
    getServices: async () => {
        return await apiClient.get(`${BASE_URL}/services`);
    },

    /**
     * Giai đoạn 1: Thông tin cá nhân & Dịch vụ
     * @param {Object} request - Thông tin giai đoạn 1
     * @param {string} request.fullName - Họ và tên
     * @param {string} request.phoneNumber - Số điện thoại
     * @param {string} request.bio - Giới thiệu bản thân
     * @param {number} request.yearsOfExperience - Số năm kinh nghiệm
     * @param {number} request.provinceId - ID tỉnh/thành phố quê quán
     * @param {Array<number>} request.districtIds - Danh sách ID quận/huyện làm việc
     * @param {Array<number>} request.serviceIds - Danh sách ID dịch vụ đăng ký
     * @returns {Promise<Object>} Kết quả đăng ký giai đoạn 1
     */
    registerStage1: async (request) => {
        return await apiClient.post(`${BASE_URL}/register-stage1`, request);
    },

    /**
     * Giai đoạn 2: Xác thực danh tính (CCCD)
     * @param {Object} request - Thông tin giai đoạn 2
     * @param {string} request.idCardNumber - Số CCCD
     * @param {string} request.idCardFrontImageUrl - URL ảnh mặt trước CCCD
     * @param {string} request.idCardBackImageUrl - URL ảnh mặt sau CCCD
     * @param {string} request.portraitImageUrl - URL ảnh chân dung
     * @returns {Promise<Object>} Kết quả đăng ký giai đoạn 2
     */
    registerStage2: async (request) => {
        return await apiClient.post(`${BASE_URL}/register-stage2`, request);
    },

    /**
     * Gửi hồ sơ đăng ký để chờ phê duyệt
     * @returns {Promise<Object>} Kết quả gửi hồ sơ
     */
    submitRegistration: async () => {
        return await apiClient.put(`${BASE_URL}/submit`);
    }
};

export default HelperRegistrationService;
