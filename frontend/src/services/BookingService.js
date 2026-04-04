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
};

export default BookingService;
