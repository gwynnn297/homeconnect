import apiClient from './apiClient';

const BOOKING_BASE_URL = '/api/v1/bookings';

const BookingCheckinService = {
    createChallenge: async (bookingId) => {
        return apiClient.post(`${BOOKING_BASE_URL}/${bookingId}/checkin/challenge`);
    },

    verifyCheckin: async (bookingId, payload) => {
        return apiClient.post(`${BOOKING_BASE_URL}/${bookingId}/checkin/verify`, payload);
    }
};

export default BookingCheckinService;
