import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './ForgotPasswordPage.css';
import logoHomieConnect from '../../assets/LogoHomieConnect.png';
import AuthService from '../../services/AuthService';

const ForgotPasswordPage = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: Reset Password
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [resetToken, setResetToken] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [otpTimer, setOtpTimer] = useState(0);
    const [canResendOtp, setCanResendOtp] = useState(false);

    // Countdown timer cho OTP
    useEffect(() => {
        let interval;
        if (otpTimer > 0) {
            interval = setInterval(() => {
                setOtpTimer(prev => prev - 1);
            }, 1000);
        } else if (otpTimer === 0 && step === 2) {
            setCanResendOtp(true);
        }
        return () => clearInterval(interval);
    }, [otpTimer, step]);

    const handleEmailSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        // Validation
        if (!email) {
            setError('Vui lòng nhập email');
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError('Email không hợp lệ');
            return;
        }

        setLoading(true);
        try {
            const response = await AuthService.forgotPassword({ email });
            if (response.success) {
                setSuccess('Mã OTP đã được gửi tới email của bạn');
                setStep(2);
                setOtpTimer(300);
                setCanResendOtp(false);
            } else {
                setError(response.message || 'Có lỗi xảy ra');
            }
        } catch (err) {
            setError(err.message || 'Gửi OTP thất bại, vui lòng thử lại');
        } finally {
            setLoading(false);
        }
    };

    const handleOtpSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        // Validation
        if (!otp || otp.length !== 6) {
            setError('Vui lòng nhập mã OTP 6 chữ số');
            return;
        }

        setLoading(true);
        try {
            const response = await AuthService.verifyForgotOtp({
                email,
                otp
            });
            if (response.success) {
                setResetToken(response.resetToken);
                setSuccess('Xác thực OTP thành công');
                setStep(3);
                setOtp('');
            } else {
                setError(response.message || 'OTP không hợp lệ');
            }
        } catch (err) {
            setError(err.message || 'Xác thực OTP thất bại');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPasswordSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        // Validation
        if (!newPassword || !confirmPassword) {
            setError('Vui lòng nhập đầy đủ mật khẩu');
            return;
        }

        if (newPassword.length < 8) {
            setError('Mật khẩu phải có ít nhất 8 ký tự');
            return;
        }

        if (newPassword.length > 50) {
            setError('Mật khẩu không được quá 50 ký tự');
            return;
        }

        if (!/(?=.*[a-z])/.test(newPassword)) {
            setError('Mật khẩu phải có ít nhất 1 chữ thường');
            return;
        }

        if (!/(?=.*[A-Z])/.test(newPassword)) {
            setError('Mật khẩu phải có ít nhất 1 chữ hoa');
            return;
        }

        if (!/(?=.*\d)/.test(newPassword)) {
            setError('Mật khẩu phải có ít nhất 1 chữ số');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Mật khẩu nhập lại không khớp');
            return;
        }

        setLoading(true);
        try {
            const response = await AuthService.resetPassword({
                resetToken,
                newPassword
            });
            if (response.success) {
                setSuccess('Mật khẩu đã được đặt lại thành công!');
                setTimeout(() => {
                    navigate('/login');
                }, 2000);
            } else {
                setError(response.message || 'Đặt lại mật khẩu thất bại');
            }
        } catch (err) {
            setError(err.message || 'Đặt lại mật khẩu thất bại');
        } finally {
            setLoading(false);
        }
    };

    const handleResendOtp = async () => {
        setError('');
        setSuccess('');
        setLoading(true);
        try {
            const response = await AuthService.forgotPassword({ email });
            if (response.success) {
                setSuccess('Mã OTP mới đã được gửi tới email');
                setOtpTimer(300);
                setCanResendOtp(false);
                setOtp('');
            } else {
                setError(response.message || 'Gửi lại OTP thất bại');
            }
        } catch (err) {
            setError(err.message || 'Gửi lại OTP thất bại');
        } finally {
            setLoading(false);
        }
    };

    const handleBackToEmail = () => {
        setStep(1);
        setOtp('');
        setError('');
        setSuccess('');
        setOtpTimer(0);
    };

    const handleBackToOtp = () => {
        setStep(2);
        setNewPassword('');
        setConfirmPassword('');
        setError('');
        setSuccess('');
    };

    const formatTimer = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    return (
        <div className="forgot-password-container">
            <div className="forgot-password-card">
                {/* Header */}
                <div className="forgot-password-header">
                    <img
                        src={logoHomieConnect}
                        alt="HomeConnect Logo"
                        className="logo"
                        onClick={() => navigate('/')}
                        style={{ cursor: 'pointer' }}
                    />
                    <h1>Quên Mật Khẩu</h1>
                    <p className="step-indicator">Bước {step} / 3</p>
                </div>

                {/* Error & Success Messages */}
                {error && <div className="alert alert-error">{error}</div>}
                {success && <div className="alert alert-success">{success}</div>}

                {/* Step 1: Email */}
                {step === 1 && (
                    <form onSubmit={handleEmailSubmit}>
                        <div className="form-group">
                            <label htmlFor="email">Email</label>
                            <input
                                type="email"
                                id="email"
                                placeholder="Nhập email của bạn"
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    setError('');
                                }}
                                disabled={loading}
                            />
                        </div>
                        <button
                            type="submit"
                            className="btn-submit"
                            disabled={loading}
                        >
                            {loading ? 'Đang gửi...' : 'Gửi Mã OTP'}
                        </button>
                    </form>
                )}

                {/* Step 2: OTP */}
                {step === 2 && (
                    <form onSubmit={handleOtpSubmit}>
                        <p className="step-description">
                            Mã OTP đã được gửi tới <strong>{email}</strong>
                        </p>
                        <div className="form-group">
                            <label htmlFor="otp">Mã OTP (6 chữ số)</label>
                            <input
                                type="text"
                                id="otp"
                                placeholder="000000"
                                value={otp}
                                onChange={(e) => {
                                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                                    setOtp(value);
                                    setError('');
                                }}
                                maxLength="6"
                                disabled={loading}
                            />
                        </div>

                        {otpTimer > 0 && (
                            <div className="otp-timer">
                                Hết hạn trong: <strong>{formatTimer(otpTimer)}</strong>
                            </div>
                        )}

                        <button
                            type="submit"
                            className="btn-submit"
                            disabled={loading}
                        >
                            {loading ? 'Đang xác thực...' : 'Xác Thực'}
                        </button>

                        <div className="otp-actions">
                            <button
                                type="button"
                                className="btn-resend"
                                onClick={handleResendOtp}
                                disabled={!canResendOtp || loading}
                            >
                                {canResendOtp ? 'Gửi Lại Mã OTP' : 'Gửi Lại Mã OTP'}
                            </button>
                            <button
                                type="button"
                                className="btn-back"
                                onClick={handleBackToEmail}
                                disabled={loading}
                            >
                                Quay Lại
                            </button>
                        </div>
                    </form>
                )}

                {/* Step 3: Reset Password */}
                {step === 3 && (
                    <form onSubmit={handleResetPasswordSubmit}>
                        <p className="step-description">
                            Nhập mật khẩu mới của bạn
                        </p>

                        <div className="form-group">
                            <label htmlFor="newPassword">Mật Khẩu Mới</label>
                            <div className="password-input-wrapper">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    id="newPassword"
                                    placeholder="••••••••"
                                    value={newPassword}
                                    onChange={(e) => {
                                        setNewPassword(e.target.value);
                                        setError('');
                                    }}
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    className="toggle-password"
                                    onClick={() => setShowPassword(!showPassword)}
                                    disabled={loading}
                                >
                                    {showPassword ? '👁️' : '👁️‍🗨️'}
                                </button>
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="confirmPassword">Xác Nhận Mật Khẩu</label>
                            <div className="password-input-wrapper">
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    id="confirmPassword"
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => {
                                        setConfirmPassword(e.target.value);
                                        setError('');
                                    }}
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    className="toggle-password"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    disabled={loading}
                                >
                                    {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                                </button>
                            </div>
                        </div>

                        <div className="password-requirements">
                            <p>Mật khẩu phải chứa:</p>
                            <ul>
                                <li className={newPassword.length >= 8 ? 'valid' : ''}>
                                    ✓ Ít nhất 8 ký tự
                                </li>
                                <li className={/(?=.*[A-Z])/.test(newPassword) ? 'valid' : ''}>
                                    ✓ Ít nhất 1 chữ hoa
                                </li>
                                <li className={/(?=.*[a-z])/.test(newPassword) ? 'valid' : ''}>
                                    ✓ Ít nhất 1 chữ thường
                                </li>
                                <li className={/(?=.*\d)/.test(newPassword) ? 'valid' : ''}>
                                    ✓ Ít nhất 1 chữ số
                                </li>
                            </ul>
                        </div>

                        <button
                            type="submit"
                            className="btn-submit"
                            disabled={loading}
                        >
                            {loading ? 'Đang cập nhật...' : 'Đặt Lại Mật Khẩu'}
                        </button>

                        <button
                            type="button"
                            className="btn-back"
                            onClick={handleBackToOtp}
                            disabled={loading}
                        >
                            Quay Lại
                        </button>
                    </form>
                )}

                {/* Footer */}
                <div className="forgot-password-footer">
                    <p>Bạn nhớ mật khẩu? <Link to="/login">Đăng Nhập</Link></p>
                </div>
            </div>
        </div>
    );
};

export default ForgotPasswordPage;