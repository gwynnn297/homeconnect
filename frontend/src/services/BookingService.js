import apiClient from './apiClient';

const BOOKING_BASE_URL = '/api/v1/bookings';

const BookingService = {
    /**
     * Lấy danh sách helper đã apply vào một job post của customer.
     * Backend: GET /api/v1/bookings/job/{jobId}/applicants
     */
    getApplicants: async (jobId) => {
        return apiClient.get(`${BOOKING_BASE_URL}/job/${jobId}/applicants`);
    },

    /**
     * Customer chọn helper từ danh sách ứng tuyển.
     * Backend: POST /api/v1/bookings/job/{jobId}/select
     * Body: { applicationId }
     */
    selectApplicant: async (jobId, applicationId) => {
        return apiClient.post(`${BOOKING_BASE_URL}/job/${jobId}/select`, { applicationId });
    },

    /**
     * Lấy chi tiết booking theo bookingId.
     * Backend: GET /api/v1/bookings/{bookingId}
     */
    getBookingDetail: async (bookingId) => {
        return apiClient.get(`${BOOKING_BASE_URL}/${bookingId}`);
    },

    /**
     * Khách hàng xác nhận helper đã đến đúng địa điểm.
     * Backend: POST /api/v1/bookings/{bookingId}/arrival/confirm
     */
    confirmArrival: async (bookingId) => {
        return apiClient.post(`${BOOKING_BASE_URL}/${bookingId}/arrival/confirm`);
    },

    /** Khách xác nhận thợ hoàn thành: PENDING_COMPLETION → COMPLETED */
    confirmComplete: async (bookingId) => {
        return apiClient.post(`${BOOKING_BASE_URL}/${bookingId}/confirm-complete`, {});
    },

    /** Khách khiếu nại đơn đã COMPLETED */
    reportBooking: async (bookingId, payload) => {
        return apiClient.post(`${BOOKING_BASE_URL}/${bookingId}/report`, payload);
    },

    /** Helper gửi giải trình khiếu nại */
    submitDisputeResponse: async (bookingId, payload) => {
        return apiClient.post(`${BOOKING_BASE_URL}/${bookingId}/dispute-response`, payload);
    },

    /**
     * Khách hàng đặt thợ trực tiếp (Direct Booking - PB-13).
     * Backend: POST /api/v1/bookings/direct
     */
    createDirectBooking: async (payload) => {
        return apiClient.post(`${BOOKING_BASE_URL}/direct`, payload);
    },

    /**
     * Thợ lấy danh sách các đơn đặt trực tiếp (Direct Booking).
     * Backend: GET /api/v1/bookings/my-direct
     */
    getMyDirectBookings: async () => {
        return apiClient.get(`${BOOKING_BASE_URL}/my-direct`);
    },

    /**
     * Thợ phản hồi đơn đặt trực tiếp: accept=true/false.
     * Backend: PUT /api/v1/bookings/{bookingId}/respond?accept=...
     */
    respondToBooking: async (bookingId, accept) => {
        return apiClient.put(`${BOOKING_BASE_URL}/${bookingId}/respond`, null, {
            params: { accept }
        });
    },
};



export default BookingService;
