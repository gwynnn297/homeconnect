import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './RegisterPage.css';
import AuthService from '../../services/AuthService';
import logoHomieConnect from '../../assets/LogoHomieConnect.png';
import OTPVerificationModal from '../../components/OTPVerificationModal';
import NotificationModal from '../../components/NotificationModal';

const RegisterPage = () => {
    const navigate = useNavigate();
    const [role, setRole] = useState('customer'); // 'customer' or 'helper'
    const [formData, setFormData] = useState({
        fullName: '',
        phone: '',
        email: '',
        password: '',
        confirmPassword: ''
    });

    // State quản lý UI
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isOTPModalOpen, setIsOTPModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [notification, setNotification] = useState(null); // { type, message }

    // State cho checkbox điều khoản
    const [agreedToTerms, setAgreedToTerms] = useState(false);

    const togglePasswordVisibility = () => setShowPassword(!showPassword);
    const toggleConfirmPasswordVisibility = () => setShowConfirmPassword(!showConfirmPassword);

    // Navigation handlers
    const handleLogin = () => {
        navigate('/login');
    };

    const handleRegister = () => {
        navigate('/register');
    };
    const handleHome = () => {
        navigate("/home");
    };
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        // Xóa thông báo khi user nhập liệu
        if (notification) setNotification(null);
    };

    const validateForm = () => {
        if (!formData.fullName || !formData.phone || !formData.email || !formData.password || !formData.confirmPassword) {
            setNotification({ type: 'error', message: 'Vui lòng điền đầy đủ thông tin' });
            return false;
        }
        if (formData.password !== formData.confirmPassword) {
            setNotification({ type: 'error', message: 'Mật khẩu nhập lại không khớp' });
            return false;
        }
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,50}$/;
        if (!passwordRegex.test(formData.password)) {
            setNotification({ type: 'error', message: 'Mật khẩu phải từ 8-50 ký tự, bao gồm chữ hoa, chữ thường và số' });
            return false;
        }
        const phoneRegex = /^(0[3|5|7|8|9])+([0-9]{8})$/;
        if (!phoneRegex.test(formData.phone)) {
            setNotification({ type: 'error', message: 'Số điện thoại không hợp lệ' });
            return false;
        }
        if (!agreedToTerms) {
            setNotification({ type: 'error', message: 'Bạn cần đồng ý với điều khoản dịch vụ' });
            return false;
        }
        return true;
    };

    const handleRegisterSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) return;

        setIsLoading(true);
        setNotification(null);

        try {
            const registerData = {
                fullName: formData.fullName,
                phone: formData.phone,
                email: formData.email,
                password: formData.password,
                role: role.toUpperCase()
            };

            await AuthService.registerInit(registerData);
            setIsOTPModalOpen(true);
        } catch (err) {
            console.error('Registration init error:', err);
            setNotification({ type: 'error', message: err.message || 'Có lỗi xảy ra, vui lòng thử lại' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOTP = async (otpCode) => {
        try {
            await AuthService.registerVerify({
                email: formData.email,
                otpCode: otpCode,
                password: formData.password
            });

            setIsOTPModalOpen(false);
            setNotification({ type: 'success', message: 'Đăng ký tài khoản thành công! Đang chuyển hướng...' });
            setTimeout(() => navigate('/login'), 2000);
        } catch (err) {
            console.error('OTP verification error:', err);
            setNotification({ type: 'error', message: err.message || 'Mã OTP không chính xác hoặc đã hết hạn' });
        }
    };

    const handleResendOTP = async () => {
        try {
            await AuthService.registerInit({
                fullName: formData.fullName,
                phone: formData.phone,
                email: formData.email,
                password: formData.password,
                role: role.toUpperCase()
            });
            setNotification({ type: 'success', message: 'Đã gửi lại mã OTP thành công' });
        } catch (err) {
            console.error('Resend OTP error:', err);
            setNotification({ type: 'error', message: err.message || 'Không thể gửi lại mã OTP' });
        }
    };

    return (
        <>
            {notification && (
                <NotificationModal
                    type={notification.type}
                    message={notification.message}
                    onClose={() => setNotification(null)}
                />
            )}
            <div className="register-container">
                <header className="header-register">
                    <div className="logo-register" onClick={handleHome}>
                        <img className="logo-img-register" src={logoHomieConnect} alt="HomieConnectLogo" />
                    </div>
                    <div className="header-buttons-register">
                        <button className="btn-login-register" onClick={handleLogin}>
                            Đăng nhập
                        </button>
                        <button className="btn-register-register" onClick={handleRegister}>
                            Đăng kí
                        </button>
                    </div>
                </header>

                <div className="register-card">
                    {/* Logo Section */}
                    <div className="register-logo">
                        <div className="logo-icon-wrapper">
                            <img className="logo-img" src={logoHomieConnect} alt="HomieConnectLogo" />
                        </div>
                    </div>

                    <h1 className="register-title">Đăng Kí</h1>
                    <p className="register-subtitle">Tạo tài khoản mới để bắt đầu sử dụng HomieConnect</p>

                    <h2 className="register-heading">Đăng kí tài khoản với vai trò:</h2>

                    {/* Role Selection */}
                    <div className="role-selection">
                        <div
                            className={`role-card ${role === 'customer' ? 'active' : ''}`}
                            onClick={() => setRole('customer')}
                        >
                            <div className="role-icon-container">
                                <svg className="role-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="12" cy="7" r="4"></circle>
                                </svg>
                                {role === 'customer' && (
                                    <div className="check-circle">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12"></polyline>
                                        </svg>
                                    </div>
                                )}
                            </div>
                            <div className="role-info">
                                <h3>KHÁCH HÀNG</h3>
                                <p>Tìm và đặt dịch vụ giúp việc nhà</p>
                            </div>
                        </div>

                        <div
                            className={`role-card ${role === 'helper' ? 'active' : ''}`}
                            onClick={() => setRole('helper')}
                        >
                            <div className="role-icon-container">
                                <svg className="role-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                                </svg>
                                {role === 'helper' && (
                                    <div className="check-circle">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12"></polyline>
                                        </svg>
                                    </div>
                                )}
                            </div>
                            <div className="role-info">
                                <h3>NGƯỜI GIÚP VIỆC</h3>
                                <p>Tìm việc làm và tạo thu nhập</p>
                            </div>
                        </div>
                    </div>

                    <form className="register-form" onSubmit={handleRegisterSubmit}>
                        <div className="form-group">
                            <label>Họ và tên</label>
                            <div className="input-with-icon">
                                <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="12" cy="7" r="4"></circle>
                                </svg>
                                <input
                                    type="text"
                                    name="fullName"
                                    value={formData.fullName}
                                    onChange={handleChange}
                                    placeholder="Nguyễn Văn A"
                                    className="form-input"
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Số điện thoại</label>
                            <div className="input-with-icon">
                                <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                                </svg>
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    placeholder="0901234567"
                                    className="form-input"
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Email</label>
                            <div className="input-with-icon">
                                <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                    <polyline points="22,6 12,13 2,6"></polyline>
                                </svg>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="email@example.com"
                                    className="form-input"
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Mật khẩu</label>
                            <div className="input-with-icon">
                                <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                </svg>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="••••••••"
                                    className="form-input"
                                />
                                {/* <div className="password-toggle" onClick={togglePasswordVisibility}>
                                    {showPassword ? (
                                        <svg className="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                                            <line x1="1" y1="1" x2="23" y2="23"></line>
                                        </svg>
                                    ) : (
                                        <svg className="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                            <circle cx="12" cy="12" r="3"></circle>
                                        </svg>
                                    )}
                                </div> */}
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Xác nhận mật khẩu</label>
                            <div className="input-with-icon">
                                <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                </svg>
                                <input
                                    type={showConfirmPassword ? "text" : "password"}
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    placeholder="••••••••"
                                    className="form-input"
                                />
                                {/* <div className="password-toggle" onClick={toggleConfirmPasswordVisibility}>
                                    {showConfirmPassword ? (
                                        <svg className="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                                            <line x1="1" y1="1" x2="23" y2="23"></line>
                                        </svg>
                                    ) : (
                                        <svg className="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                            <circle cx="12" cy="12" r="3"></circle>
                                        </svg>
                                    )}
                                </div> */}
                            </div>
                        </div>

                        <div className="form-checkbox">
                            <label className="terms-label">
                                <input
                                    type="checkbox"
                                    className="checkbox-input"
                                    checked={agreedToTerms}
                                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                                />
                                <span>Tôi đồng ý với <Link to="/terms">Điều khoản dịch vụ</Link> và <Link to="/privacy-policy">Chính sách bảo mật</Link></span>
                            </label>
                        </div>

                        <button type="submit" className="register-button" disabled={isLoading}>
                            {isLoading ? 'Đang xử lý...' : 'Đăng ký ngay'}
                        </button>

                        <div className="login-link">
                            Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
                        </div>
                    </form>
                </div>
            </div>
            <OTPVerificationModal
                isOpen={isOTPModalOpen}
                onClose={() => setIsOTPModalOpen(false)}
                email={formData.email}
                onVerify={handleVerifyOTP}
                onResend={handleResendOTP}
            />
        </>
    );
};

export default RegisterPage;
