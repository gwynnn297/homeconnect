import apiClient from './apiClient';

const AIChatNLPService = {
    parseMessage: async (message) => {
        return apiClient.post('/api/v1/chat/parse', { message });
    },
    createSession: async (channel = 'web') => {
        return apiClient.post('/api/v1/chat/sessions', { channel });
    },
    getSessions: async () => {
        return apiClient.get('/api/v1/chat/sessions');
    },
    deleteSession: async (sessionId) => {
        return apiClient.delete(`/api/v1/chat/sessions/${sessionId}`);
    },
    getSessionMessages: async (sessionId) => {
        return apiClient.get(`/api/v1/chat/sessions/${sessionId}/messages`);
    },
    getSession: async (sessionId) => {
        return apiClient.get(`/api/v1/chat/sessions/${sessionId}`);
    },
    sendSessionMessage: async (sessionId, message) => {
        return apiClient.post(`/api/v1/chat/sessions/${sessionId}/messages`, { message });
    },
    selectHelper: async (sessionId, helperId) => {
        return apiClient.post(`/api/v1/chat/sessions/${sessionId}/helpers/${helperId}/select`);
    },
    selectAddress: async (sessionId, addressId) => {
        return apiClient.post(`/api/v1/chat/sessions/${sessionId}/addresses/${addressId}/select`);
    },
    autocompleteAddress: async (input) => {
        return apiClient.get('/api/v1/addresses/autocomplete', { params: { input } });
    },
    createAddress: async (payload) => {
        return apiClient.post('/api/v1/addresses', payload);
    },
    confirmBooking: async (sessionId) => {
        return apiClient.post(`/api/v1/chat/sessions/${sessionId}/confirm-booking`);
    },
    resumeAfterTopup: async (sessionId) => {
        return apiClient.post(`/api/v1/chat/sessions/${sessionId}/resume-after-topup`);
    },
};

export default AIChatNLPService;
