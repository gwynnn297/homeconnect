import apiClient from './apiClient';

const ServiceManagerService = {
    /**
     * Tạo mới dịch vụ hệ thống
     * Endpoint: POST /api/v1/admin/services
     * @param {Object} data - CreateServiceRequest
     */
    createService: async (data) => {
        return apiClient.post('/api/v1/admin/services', data);
    },

    /**
     * Lấy chi tiết cấu hình dịch vụ
     * Endpoint: GET /api/v1/admin/services/{serviceId}
     * @param {number} serviceId - ID dịch vụ
     */
    getServiceDetail: async (serviceId) => {
        return apiClient.get(`/api/v1/admin/services/${serviceId}`);
    },

    /**
     * Cập nhật thông tin dịch vụ
     * Endpoint: PATCH /api/v1/admin/services/{serviceId}
     * @param {number} serviceId - ID dịch vụ
     * @param {Object} data - UpdateServiceRequest
     */
    updateService: async (serviceId, data) => {
        return apiClient.patch(`/api/v1/admin/services/${serviceId}`, data);
    },

    /**
     * Xóa dịch vụ
     * Endpoint: DELETE /api/v1/admin/services/{serviceId}
     * @param {number} serviceId - ID dịch vụ
     */
    deleteService: async (serviceId) => {
        return apiClient.delete(`/api/v1/admin/services/${serviceId}`);
    }
};

export default ServiceManagerService;
