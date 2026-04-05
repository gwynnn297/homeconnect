import apiClient from './apiClient';

const BOOKING_BASE_URL = '/api/v1/bookings';

const CheckoutService = {
    /**
     * [BE-Exec-03] Thợ check-out + ảnh hoàn thành
     * Thợ gửi URL ảnh sau khi làm xong. Status: IN_PROGRESS → PENDING_COMPLETION
     * @param {number|string} bookingId
     * @param {Object} checkoutData - { checkoutPhotoUrl, checkoutReason }
     */
    checkOut: async (bookingId, checkoutData) => {
        return apiClient.post(`${BOOKING_BASE_URL}/${bookingId}/check-out`, checkoutData);
    },

    /**
     * [BE-Exec-03b] Khách xác nhận hoàn thành
     * Khách bấm 'Xác nhận & Đánh giá'. Status: PENDING_COMPLETION → COMPLETED.
     * @param {number|string} bookingId 
     */
    confirmComplete: async (bookingId) => {
        return apiClient.post(`${BOOKING_BASE_URL}/${bookingId}/confirm-complete`);
    }
};

export default CheckoutService;
