import axios from 'axios';

// URL cơ sở cho API, lấy từ biến môi trường hoặc mặc định là http://localhost:8080
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// Tạo axios instance với base config
const apiClient = axios.create({
    baseURL: API_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Xử lý phản hồi từ server
apiClient.interceptors.response.use(
    (response) => {
        // Trả về data trực tiếp nếu có cấu trúc như mong đợi
        if (response && response.data) {
            return response.data;
        }
        return response;
    },
    (error) => {
        // Xử lý lỗi
        if (error.response && error.response.data) {
            throw error.response.data; // Trả về lỗi từ server (CreateResponse)
        }
        throw error;
    }
);

const AuthService = {
    /**
     * Bước 1: Khởi tạo đăng ký - validate form và gửi OTP
     * Endpoint: POST /api/auth/register-init
     * 
     * @param {Object} registerData
     * @param {string} registerData.fullName - Họ tên
     * @param {string} registerData.phone - Số điện thoại (VN)
     * @param {string} registerData.email - Email
     * @param {string} registerData.password - Mật khẩu (8-50 ký tự, có hoa, thường, số)
     * @param {string} registerData.role - Vai trò: 'CUSTOMER' hoặc 'HELPER'
     */
    registerInit: async (registerData) => {
        return apiClient.post('/api/auth/register-init', registerData);
    },

    /**
     * Bước 2: Xác thực OTP và tạo tài khoản
     * Endpoint: POST /api/auth/register-verify
     * 
     * @param {Object} verifyData
     * @param {string} verifyData.email - Email đã đăng ký
     * @param {string} verifyData.otpCode - Mã OTP 6 số
     */
    registerVerify: async (verifyData) => {
        return apiClient.post('/api/auth/register-verify', verifyData);
    }
};

export default AuthService;
