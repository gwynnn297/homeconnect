import apiClient from './apiClient';

const NotificationService = {
    /**
     * Lấy danh sách thông báo mới nhất của user hiện tại
     * Endpoint: GET /api/v1/notifications
     * Role: HELPER, CUSTOMER, ADMIN
     * 
     * @param {number} limit - Số lượng thông báo muốn lấy (mặc định là 20)
     * @returns {Promise<any>}
     */
    getNotifications: async (limit = 20) => {
        return apiClient.get('/api/v1/notifications', {
            params: { limit }
        });
    },

    /**
     * Đánh dấu 1 thông báo đã đọc
     * Backend: PATCH /api/v1/notifications/{notificationId}/read
     * Response: ApiResponse<NotificationResponse>
     * @param {number|string} notificationId
     */
    markAsRead: async (notificationId) => {
        return apiClient.patch(`/api/v1/notifications/${notificationId}/read`);
    },

    /**
     * Đánh dấu tất cả thông báo đã đọc
     * Backend: PATCH /api/v1/notifications/read-all
     * Response: ApiResponse<Integer> (số lượng đã update)
     */
    markAllAsRead: async () => {
        return apiClient.patch('/api/v1/notifications/read-all');
    },

    /**
     * Lấy URL kết nối SSE (Server-Sent Events) để nhận thông báo realtime
     * Endpoint: GET /api/v1/notifications/stream
     * Role: HELPER, CUSTOMER, ADMIN
     * 
     * Lưu ý: Đối tượng EventSource mặc định của trình duyệt không hỗ trợ header `Authorization`.
     * Cần cấu hình truyền token qua tham số query (ex: ?token=...) hoặc sử dụng thư viện `@microsoft/fetch-event-source` nếu cần gửi Bearer token.
     * 
     * @param {string} token - (Optional) Token xác thực nếu muốn nối vào query parameter
     * @returns {string} URL của endpoint stream
     */
    getStreamUrl: (token = '') => {
        const baseUrl = apiClient.defaults.baseURL || 'http://localhost:8080';
        let url = `${baseUrl}/api/v1/notifications/stream`;
        if (token) {
            url += `?token=${encodeURIComponent(token)}`;
        }
        return url;
    }
};

export default NotificationService;
