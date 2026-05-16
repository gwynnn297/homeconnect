import axios from 'axios';

/** Lỗi 403 khi admin khóa tài khoản — đã xử lý ở AccountBlockedGate, không cần toast trùng. */
export function isAccountBlockedError(err) {
    return err?.code === 'ACCOUNT_BLOCKED' || err?.silent === true;
}

// Empty baseURL = same-origin (nginx proxies /api/* to backend in Docker/production).
const API_URL = import.meta.env.VITE_API_URL
    || (typeof window !== 'undefined' ? '' : 'http://localhost:8080');

const apiClient = axios.create({
    baseURL: API_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor: add token to headers
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor: extract data and handle errors
apiClient.interceptors.response.use(
    (response) => {
        if (response && response.data) {
            return response.data;
        }
        return response;
    },
    (error) => {
        const status = error.response?.status;
        const data = error.response?.data;
        if (status === 403 && data?.code === 'ACCOUNT_BLOCKED') {
            try {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            } catch (_) {
                /* ignore */
            }
            window.dispatchEvent(
                new CustomEvent('account-blocked', {
                    detail: {
                        message:
                            data?.message ||
                            'Tài khoản của bạn đã bị khóa. Bạn sẽ được chuyển về trang đăng nhập.',
                    },
                })
            );
            throw {
                ...data,
                silent: true,
                code: 'ACCOUNT_BLOCKED',
                message: data?.message,
            };
        }
        if (error.response && error.response.data) {
            throw error.response.data;
        }
        throw error;
    }
);

export default apiClient;
