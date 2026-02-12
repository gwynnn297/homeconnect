import React, { useState, useEffect, useRef } from 'react';
import './OTPVerificationModal.css';

const OTPVerificationModal = ({ isOpen, onClose, email, onVerify, onResend }) => {
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [timeLeft, setTimeLeft] = useState(56); // 56 seconds as per screenshot
    const inputRefs = useRef([]);

    // Initialize refs array
    useEffect(() => {
        inputRefs.current = inputRefs.current.slice(0, 6);
    }, []);

    // Timer logic
    useEffect(() => {
        if (!isOpen) return;

        // Reset timer when modal opens
        setTimeLeft(60);
        setOtp(['', '', '', '', '', '']);

        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [isOpen]);

    // Handle input change
    const handleChange = (element, index) => {
        if (isNaN(element.value)) return;

        const newOtp = [...otp];
        newOtp[index] = element.value;
        setOtp(newOtp);

        // Move to next input if value is entered
        if (element.value && index < 5) {
            inputRefs.current[index + 1].focus();
        }
    };

    // Handle backspace
    const handleKeyDown = (e, index) => {
        if (e.key === 'Backspace') {
            if (!otp[index] && index > 0) {
                // Focus previous input if current is empty
                inputRefs.current[index - 1].focus();
            } else if (otp[index]) {
                // Clear current input content
                const newOtp = [...otp];
                newOtp[index] = '';
                setOtp(newOtp);
            }
        }
    };

    // Format time mm:ss
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleVerifyClick = () => {
        const otpCode = otp.join('');
        if (otpCode.length === 6) {
            onVerify(otpCode);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="otp-modal-overlay" onClick={onClose}>
            <div className="otp-modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="otp-close-btn" onClick={onClose}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>

                <div className="otp-icon-container">
                    <svg className="otp-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                        <polyline points="22,6 12,13 2,6"></polyline>
                    </svg>
                </div>

                <h2 className="otp-title">Xác thực OTP</h2>
                <p className="otp-description">
                    Nhập mã 6 số đã được gửi đến email của bạn
                </p>
                <div className="otp-contact">
                    {email || 'abc***@gmail.com'}
                </div>

                <div className="otp-inputs-container">
                    {otp.map((data, index) => (
                        <input
                            key={index}
                            type="text"
                            maxLength="1"
                            className="otp-input"
                            value={data}
                            ref={(el) => (inputRefs.current[index] = el)}
                            onChange={(e) => handleChange(e.target, index)}
                            onKeyDown={(e) => handleKeyDown(e, index)}
                            onFocus={(e) => e.target.select()}
                        />
                    ))}
                </div>

                <div className="otp-timer-container">
                    <span className="otp-timer-label">Mã hết hạn sau</span>
                    <span className="otp-timer-value">{formatTime(timeLeft)}</span>
                </div>

                <div className="otp-resend">
                    Không nhận được mã?
                    <button className="otp-resend-link" onClick={onResend}>
                        Gửi lại
                    </button>
                </div>

                <button
                    className="otp-verify-btn"
                    onClick={handleVerifyClick}
                    style={{ backgroundColor: otp.join('').length === 6 ? '#346252' : '#8daaa0' }}
                >
                    Xác thực
                </button>
            </div>
        </div>
    );
};

export default OTPVerificationModal;
