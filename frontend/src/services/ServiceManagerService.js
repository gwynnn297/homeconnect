import apiClient from './apiClient';

const ServiceManagerService = {

    // ============================================================
    // DANH MỤC CHA (service_categories)
    // ============================================================

    /**
     * Tạo mới danh mục cha
     * Endpoint : POST /api/v1/admin/categories
     * Role     : ADMIN
     * @param {Object} data
     * @param {string} data.name        - Tên danh mục (bắt buộc)
     * @param {string} [data.description] - Mô tả danh mục
     * @param {number} [data.basePrice]   - Giá cơ bản
     * @param {string} [data.unit]        - Đơn vị tính (enum: HOUR, SESSION, ...)
     * @returns {Promise<CategoryResponse>}
     */
    createCategory: async (data) => {
        return apiClient.post('/api/v1/admin/categories', data);
    },

    /**
     * Lấy danh sách tất cả danh mục cha (root)
     * Endpoint : GET /api/v1/admin/categories/parents
     * Role     : ADMIN
     * Dùng để  : Điền vào dropdown khi tạo / sửa dịch vụ con
     * @returns {Promise<CategoryResponse[]>}
     */
    getParentCategories: async () => {
        return apiClient.get('/api/v1/admin/categories/parents');
    },

    /**
     * Cập nhật danh mục cha
     * Endpoint : PATCH /api/v1/admin/categories/{categoryId}
     * Role     : ADMIN
     * @param {number} categoryId       - ID danh mục cần cập nhật
     * @param {Object} data
     * @param {string} [data.name]        - Tên mới
     * @param {string} [data.description] - Mô tả mới
     * @param {number} [data.basePrice]   - Giá cơ bản mới
     * @param {string} [data.unit]        - Đơn vị tính mới
     * @returns {Promise<CategoryResponse>}
     */
    updateCategory: async (categoryId, data) => {
        return apiClient.patch(`/api/v1/admin/categories/${categoryId}`, data);
    },

    /**
     * Xóa danh mục cha
     * Endpoint : DELETE /api/v1/admin/categories/{categoryId}
     * Role     : ADMIN
     * Lưu ý   : Xóa danh mục sẽ xóa theo tất cả dịch vụ con bên trong
     * @param {number} categoryId - ID danh mục cần xóa
     * @returns {Promise<void>}
     */
    deleteCategory: async (categoryId) => {
        return apiClient.delete(`/api/v1/admin/categories/${categoryId}`);
    },

    /**
     * Lấy danh sách dịch vụ con theo danh mục cha
     * Endpoint : GET /api/v1/admin/categories/{categoryId}/services
     * Role     : ADMIN
     * Dùng để  : Admin chọn danh mục cha rồi xem / set giá các dịch vụ con
     * @param {number} categoryId - ID danh mục cha
     * @returns {Promise<ServiceResponse[]>}
     */
    getServicesByCategory: async (categoryId) => {
        return apiClient.get(`/api/v1/admin/categories/${categoryId}/services`);
    },

    // ============================================================
    // DỊCH VỤ CON (services)
    // ============================================================

    /**
     * Tạo mới dịch vụ con
     * Endpoint : POST /api/v1/admin/services
     * Role     : ADMIN
     * @param {Object} data
     * @param {string} data.name          - Tên dịch vụ (bắt buộc)
     * @param {number} data.categoryId    - ID danh mục cha (bắt buộc)
     * @param {string} [data.description] - Mô tả dịch vụ
     * @param {number} [data.basePrice]   - Giá cơ bản
     * @param {string} [data.unit]        - Đơn vị tính (enum: HOUR, SESSION, ...)
     * @returns {Promise<ServiceResponse>}
     */
    createService: async (data) => {
        return apiClient.post('/api/v1/admin/services', data);
    },

    /**
     * Lấy chi tiết cấu hình một dịch vụ con
     * Endpoint : GET /api/v1/admin/services/{serviceId}
     * Role     : ADMIN
     * @param {number} serviceId - ID dịch vụ cần xem
     * @returns {Promise<ServiceResponse>}
     */
    getServiceDetail: async (serviceId) => {
        return apiClient.get(`/api/v1/admin/services/${serviceId}`);
    },

    /**
     * Cập nhật thông tin dịch vụ con
     * Endpoint : PATCH /api/v1/admin/services/{serviceId}
     * Role     : ADMIN
     * @param {number} serviceId          - ID dịch vụ cần cập nhật
     * @param {Object} data
     * @param {string} [data.name]        - Tên mới
     * @param {string} [data.description] - Mô tả mới
     * @param {number} [data.basePrice]   - Giá cơ bản mới
     * @param {string} [data.unit]        - Đơn vị tính mới
     * @param {boolean} [data.isActive]   - Trạng thái kích hoạt
     * @returns {Promise<ServiceResponse>}
     */
    updateService: async (serviceId, data) => {
        return apiClient.patch(`/api/v1/admin/services/${serviceId}`, data);
    },

    /**
     * Xóa dịch vụ con
     * Endpoint : DELETE /api/v1/admin/services/{serviceId}
     * Role     : ADMIN
     * @param {number} serviceId - ID dịch vụ cần xóa
     * @returns {Promise<void>}
     */
    deleteService: async (serviceId) => {
        return apiClient.delete(`/api/v1/admin/services/${serviceId}`);
    },
};

export default ServiceManagerService;
