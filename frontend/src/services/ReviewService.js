import apiClient from './apiClient';

const REVIEWS_BASE_URL = '/api/v1/reviews';

const ReviewService = {
    submitReview: async (payload) => {
        return apiClient.post(REVIEWS_BASE_URL, payload);
    },

    getReviewByBooking: async (bookingId) => {
        return apiClient.get(`${REVIEWS_BASE_URL}/booking/${bookingId}`);
    },

    updateReview: async (reviewId, payload) => {
        return apiClient.put(`${REVIEWS_BASE_URL}/${reviewId}`, payload);
    },

    /**
     * Danh sách đánh giá công khai của helper (phân trang Spring: page, size, sort).
     * GET /api/v1/reviews/helper/{helperId}
     */
    getHelperReviews: async (helperId, params = {}) => {
        return apiClient.get(`${REVIEWS_BASE_URL}/helper/${helperId}`, {
            params: {
                page: 0,
                size: 15,
                sort: 'createdAt,desc',
                ...params,
            },
        });
    },

    /** Thống kê điểm TB + phân bổ sao. GET /api/v1/reviews/helper/{helperId}/stats */
    getHelperReviewStats: async (helperId) => {
        return apiClient.get(`${REVIEWS_BASE_URL}/helper/${helperId}/stats`);
    },
};

export default ReviewService;
