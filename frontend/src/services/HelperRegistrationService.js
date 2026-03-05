import apiClient from './apiClient.js';

const BASE_URL = '/api/helpers';

const HelperRegistrationService = {
    /**
     * Lấy danh sách tỉnh/thành phố
     * @returns {Promise<Array>} Danh sách các tỉnh/thành phố
     */
    getProvinces: async () => {
        return await apiClient.get(`/api/v1/locations/provinces`);
    },

    /**
     * Lấy danh sách quận/huyện theo tỉnh
     * @param {string} provinceCode - Mã của tỉnh/thành phố
     * @returns {Promise<Array>} Danh sách các quận/huyện
     */
    getDistricts: async (provinceCode) => {
        return await apiClient.get(`/api/v1/locations/provinces/${provinceCode}/districts`);
    },

    /**
     * Lấy danh sách phường/xã theo quận
     * @param {string} districtCode - Mã của quận/huyện
     * @returns {Promise<Array>} Danh sách các phường/xã
     */
    getWards: async (districtCode) => {
        return await apiClient.get(`/api/v1/locations/districts/${districtCode}/wards`);
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
     * @param {string} request.dateOfBirth - Ngày sinh (YYYY-MM-DD)
     * @param {string} request.hometownName - Tên Tỉnh/Thành phố quê quán
     * @param {string} request.provinceName - Tên Tỉnh/Thành phố hiện tại
     * @param {string} request.districtName - Tên Quận/Huyện hiện tại
     * @param {string} request.wardName - Tên Phường/Xã hiện tại
     * @param {string} request.currentAddress - Địa chỉ hiện tại (Số nhà, đường...)
     * @param {Array<Object>} request.workingDistricts - Danh sách khu vực làm việc [{ districtName, priority }]
     * @param {string} request.bio - Giới thiệu bản thân
     * @param {number} request.experienceYears - Số năm kinh nghiệm
     * @param {Array<number>} request.serviceIds - Danh sách ID dịch vụ đăng ký
     * @returns {Promise<Object>} Kết quả đăng ký giai đoạn 1
     */
    registerStage1: async (request) => {
        return await apiClient.post(`${BASE_URL}/register-stage1`, request);
    },

    /**
     * Giai đoạn 2: Xác thực danh tính (CCCD)
     * @param {Object} request - Thông tin giai đoạn 2
     * @param {string} request.identityNumber - Số CCCD
     * @param {string} request.cccdFrontUrl - URL ảnh mặt trước CCCD
     * @param {string} request.cccdBackUrl - URL ảnh mặt sau CCCD
     * @param {string} request.selfieUrl - URL ảnh chân dung
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
