import apiClient from './apiClient';

const AIChatNLPService = {
    parseMessage: async (message) => {
        return apiClient.post('/api/v1/chat/parse', { message });
    },
};

export default AIChatNLPService;
