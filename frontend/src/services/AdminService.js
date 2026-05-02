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
     * Danh sách user (Admin)
     * GET /api/v1/admin/users
     * @param {Object} params role, status, q, page, size, sortBy, sortDir
     */
    getUsers: async (params = {}) => {
        return apiClient.get('/api/v1/admin/users', { params });
    },

    /**
     * Chi tiết user (Admin)
     * GET /api/v1/admin/users/{userId}
     */
    getAdminUserDetail: async (userId) => {
        return apiClient.get(`/api/v1/admin/users/${userId}`);
    },

    /**
     * Khóa / mở khóa tài khoản
     * PATCH /api/v1/admin/users/{userId}/status
     * @param {Object} data { status: 'ACTIVE' | 'BANNED', reason?: string }
     */
    updateUserStatus: async (userId, data) => {
        return apiClient.patch(`/api/v1/admin/users/${userId}/status`, data);
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
    },

    // ===== QUAN LY RUT TIEN =====
    getWithdrawals: async (params = {}) => {
        // params: { status, page, size }
        return apiClient.get('/api/v1/admin/withdrawals', { params });
    },

    getWithdrawDetail: async (requestId) => {
        return apiClient.get(`/api/v1/admin/withdrawals/${requestId}`);
    },

    approveWithdrawal: async (requestId) => {
        return apiClient.patch(`/api/v1/admin/withdrawals/${requestId}/approve`);
    },

    rejectWithdrawal: async (requestId, reason) => {
        return apiClient.patch(`/api/v1/admin/withdrawals/${requestId}/reject`, null, { params: { reason } });
    },

    // ===== QUẢN LÝ BOOKING =====
    getBookings: async (params = {}) => {
        return apiClient.get('/api/v1/admin/bookings', { params });
    },

    getBookingDetail: async (bookingId) => {
        return apiClient.get(`/api/v1/admin/bookings/${bookingId}`);
    },

    cancelBooking: async (bookingId, reason) => {
        return apiClient.post(`/api/v1/admin/bookings/${bookingId}/cancel`, { reason });
    },

    unflagBooking: async (bookingId) => {
        return apiClient.patch(`/api/v1/admin/bookings/${bookingId}/unflag`);
    },

    markHelperNoShow: async (bookingId, reason) => {
        return apiClient.post(`/api/v1/admin/bookings/${bookingId}/helper-no-show`, null, { params: { reason } });
    },

    markCustomerNoShow: async (bookingId, payoutRatio = 0.3, reason) => {
        return apiClient.post(`/api/v1/admin/bookings/${bookingId}/customer-no-show`, null, {
            params: { payoutRatio, reason },
        });
    },

    // ===== TRANH CHAP BOOKING =====
    getDisputes: async (params = {}) => {
        return apiClient.get('/api/v1/admin/disputes', { params });
    },

    resolveDispute: async (bookingId, action, refundRatio, adminNote) => {
        const payload = { action };
        if (refundRatio !== undefined && refundRatio !== null) {
            payload.refundRatio = refundRatio;
        }
        if (adminNote !== undefined && adminNote !== null) {
            payload.adminNote = adminNote;
        }
        return apiClient.post(`/api/v1/admin/disputes/${bookingId}/resolve`, payload);
    },

    // ===== QUẢN LÝ TIN ĐĂNG (JOB POSTS) =====
    getJobPosts: async (params = {}) => {
        return apiClient.get('/api/v1/admin/job-posts', { params });
    },

    getJobPostDetail: async (postId) => {
        return apiClient.get(`/api/v1/admin/job-posts/${postId}`);
    },

    cancelJobPost: async (postId, reason) => {
        return apiClient.post(`/api/v1/admin/job-posts/${postId}/cancel`, { reason });
    },

    getAuditLogs: async (params = {}) => {
        return apiClient.get('/api/v1/admin/audit-logs', { params });
    },

    getViolations: async (params = {}) => {
        return apiClient.get('/api/v1/admin/violations', { params });
    },

    getJobPostEditLogs: async (params = {}) => {
        return apiClient.get('/api/v1/admin/job-post-edit-logs', { params });
    },

    getFraudAlerts: async (params = {}) => {
        return apiClient.get('/api/v1/admin/fraud-alerts', { params });
    },
};

export default AdminService;
