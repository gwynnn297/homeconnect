import apiClient from './apiClient';

const AdminService = {
    /**
     * Lấy thông tin thống kê cho trang Dashboard của Admin
     * Endpoint: GET /api/v1/admin/statistics
     */
    getStatistics: async () => {
        return apiClient.get('/api/v1/admin/statistics');
    },

    /**
     * Lấy danh sách Helper với filter và pagination
     * Endpoint: GET /api/v1/admin/helpers
     * @param {Object} params
     * @param {string} params.status - Filter theo KYC status (PENDING, WAITING_APPROVAL, VERIFIED, REJECTED)
     * @param {number} params.page - Số trang (bắt đầu từ 0)
     * @param {number} params.size - Số lượng item mỗi trang
     * @param {string} params.sortBy - Sắp xếp theo field (user.createdAt, user.fullName, updatedAt, kycStatus)
     * @param {string} params.sortDir - Hướng sắp xếp (asc, desc)
     */
    getHelpers: async (params = {}) => {
        return apiClient.get('/api/v1/admin/helpers', { params });
    },

    /**
     * Lấy chi tiết Helper
     * Endpoint: GET /api/v1/admin/helpers/{helperId}
     * @param {number} helperId - ID của Helper
     */
    getHelperDetail: async (helperId) => {
        return apiClient.get(`/api/v1/admin/helpers/${helperId}`);
    },

    /**
     * Review (Approve/Reject) Helper KYC
     * Endpoint: PATCH /api/v1/admin/helpers/{helperId}/review
     * @param {number} helperId - ID của Helper
     * @param {Object} data
     * @param {string} data.action - VERIFIED hoặc REJECTED
     * @param {string} data.rejectionReason - Lý do từ chối (bắt buộc nếu action = REJECTED)
     */
    reviewHelper: async (helperId, data) => {
        return apiClient.patch(`/api/v1/admin/helpers/${helperId}/review`, data);
    },

    /**
     * Approve CV after AI identity verification
     * Endpoint: PATCH /api/v1/admin/helpers/{helperId}/approve-cv
     */
    approveCv: async (helperId) => {
        return apiClient.patch(`/api/v1/admin/helpers/${helperId}/approve-cv`);
    },

    /**
     * Gửi thông báo Broadcast
     * Endpoint: POST /api/v1/admin/notifications/broadcast
     * @param {Object} data
     * @param {string} data.title - Tiêu đề email
     * @param {string} data.message - Nội dung thông báo
     * @param {string} data.targetRole - Role nhận (CUSTOMER, HELPER, ADMIN). Null = tất cả
     */
    broadcastNotification: async (data) => {
        return apiClient.post('/api/v1/admin/notifications/broadcast', data);
    }
};

export default AdminService;
