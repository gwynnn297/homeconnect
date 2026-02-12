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
     * Bước 2: Xác thực OTP và hoàn tất đăng ký
     * Endpoint: POST /api/auth/register-verify
     * 
     * @param {Object} verifyData
     * @param {string} verifyData.email - Email đã khởi tạo đăng ký
     * @param {string} verifyData.otpCode - Mã OTP 6 số
     * @param {string} verifyData.password - Mật khẩu đã đăng ký
     */
    registerVerify: async (verifyData) => {
        return apiClient.post('/api/auth/register-verify', verifyData);
    },

    /**
     * Đăng nhập
     * Endpoint: POST /api/auth/login
     * 
     * @param {Object} loginData
     * @param {string} loginData.email - Email
     * @param {string} loginData.password - Mật khẩu
     */
    login: async (loginData) => {
        return apiClient.post('/api/auth/login', loginData);
    },

    /**
     * Quên mật khẩu - Gửi OTP
     * Endpoint: POST /api/auth/forgot-password
     * 
     * @param {Object} data
     * @param {string} data.email - Email
     */
    forgotPassword: async (data) => {
        return apiClient.post('/api/auth/forgot-password', data);
    },

    /**
     * Xác thực OTP quên mật khẩu
     * Endpoint: POST /api/auth/verify-forgot-otp
     * 
     * @param {Object} data
     * @param {string} data.email - Email
     * @param {string} data.otp - Mã OTP 6 số
     */
    verifyForgotOtp: async (data) => {
        return apiClient.post('/api/auth/verify-forgot-otp', data);
    },

    /**
     * Đặt lại mật khẩu
     * Endpoint: POST /api/auth/reset-password
     * 
     * @param {Object} data
     * @param {string} data.resetToken - Token đặt lại mật khẩu nhận được từ bước verifyForgotOtp
     * @param {string} data.newPassword - Mật khẩu mới
     */
    resetPassword: async (data) => {
        return apiClient.post('/api/auth/reset-password', data);
    }
};

export default AuthService;
