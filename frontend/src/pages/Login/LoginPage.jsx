import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './LoginPage.css';
import logoHomieConnect from '../../assets/LogoHomieConnect.png';
import AuthService from '../../services/AuthService';
import NotificationModal from '../../components/NotificationModal';

const LoginPage = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [notification, setNotification] = useState(null); // { type, message }

    const handleLogin = async (e) => {
        e.preventDefault();
        setNotification(null);

        try {
            const response = await AuthService.login({ email, password });

            if (response.accessToken) {
                localStorage.setItem('user', JSON.stringify(response.user));
                localStorage.setItem('token', response.accessToken);

                const role = response.user.role;
                if (role === 'CUSTOMER') {
                    navigate('/customer-dashboard');
                } else if (role === 'HELPER') {
                    navigate('/helper-dashboard');
                } else if (role === 'ADMIN') {
                    navigate('/admin/dashboard');
                } else {
                    setNotification({ type: 'error', message: 'Vai trò người dùng không hợp lệ' });
                }
            } else {
                setNotification({ type: 'error', message: response.message || 'Đăng nhập thất bại' });
            }
        } catch (err) {
            console.error(err);
            setNotification({ type: 'error', message: err.message || 'Có lỗi xảy ra khi đăng nhập' });
        }
    };

    const handleRegister = () => {
        navigate('/register');
    };
    const handleHome = () => {
        navigate("/home");
    };
    return (
        <div className="login-container">
            {notification && (
                <NotificationModal
                    type={notification.type}
                    message={notification.message}
                    onClose={() => setNotification(null)}
                />
            )}
            <header className="header-login">
                <div className="logo-login" onClick={handleHome}>
                    <img className="logo-img-login" src={logoHomieConnect} alt="HomieConnectLogo" />
                </div>
                <div className="header-buttons-login">
                    <button className="btn-login-login" onClick={() => navigate('/login')}>
                        Đăng nhập
                    </button>
                    <button className="btn-register-login" onClick={handleRegister}>
                        Đăng kí
                    </button>
                </div>
            </header>

            <div className="login-card">
                {/* Logo Section - Adapted from HeaderComponent */}
                <div className="login-logo">
                    <div className="logo-icon-wrapper">
                        <img className="logo-img" src={logoHomieConnect} alt="HomieConnectLogo" />
                    </div>
                </div>

                <h1 className="login-title">Đăng Nhập</h1>
                <p className="login-subtitle">Chào mừng bạn quay trở lại HomieConnect</p>


                <form className="login-form" onSubmit={handleLogin}>
                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <div className="input-with-icon">
                            <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                <polyline points="22,6 12,13 2,6"></polyline>
                            </svg>
                            <input
                                type="email"
                                id="email"
                                placeholder="abc@gmail.com"
                                className="form-input"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Mật khẩu</label>

                        <div className="input-with-icon">
                            <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                            <input
                                type="password"
                                id="password"
                                placeholder="••••••"
                                className="form-input"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-actions">
                        <label className="remember-me">
                            <input type="checkbox" />
                            <span>Ghi nhớ đăng nhập</span>
                        </label>
                        <Link to="/forgot-password" className="forgot-password">Quên mật khẩu?</Link>
                    </div>

                    <button type="submit" className="login-button">Đăng Nhập</button>

                    <div className="register-link">
                        Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;
