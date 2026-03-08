import React, { useEffect, useState, useRef, useCallback } from 'react';
import './NotificationModal.css';

const NotificationModal = ({ type = 'success', message, onClose, duration = 3000 }) => {
    const [isVisible, setIsVisible] = useState(true);
    const [isExiting, setIsExiting] = useState(false);
    const [progress, setProgress] = useState(100);
    const progressIntervalRef = useRef(null);
    const startTimeRef = useRef(Date.now());

    // useCallback để tránh stale closure khi gọi trong useEffect
    const handleClose = useCallback(() => {
        setIsExiting(true);
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
        }
        // Đợi animation fade-out xong rồi mới unmount
        setTimeout(() => {
            setIsVisible(false);
            if (onClose) onClose();
        }, 300);
    }, [onClose]);

    useEffect(() => {
        startTimeRef.current = Date.now();

        // Tự động đóng sau duration
        const timer = setTimeout(() => {
            handleClose();
        }, duration);

        // Cập nhật progress bar mỗi 50ms
        progressIntervalRef.current = setInterval(() => {
            const elapsed = Date.now() - startTimeRef.current;
            const remaining = Math.max(0, duration - elapsed);
            const newProgress = (remaining / duration) * 100;
            setProgress(newProgress);
            if (newProgress <= 0) clearInterval(progressIntervalRef.current);
        }, 50);

        return () => {
            clearTimeout(timer);
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        };
    }, [duration, handleClose]);

    if (!isVisible) return null;

    const getIcon = () => {
        switch (type) {
            case 'success':
                return (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                        strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                );
            case 'error':
                return (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                        strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="15" y1="9" x2="9" y2="15" />
                        <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                );
            case 'warning':
                return (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                        strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                );
            case 'info':
            default:
                return (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                        strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                );
        }
    };

    return (
        <div className={`notification-modal ${type} ${isExiting ? 'exiting' : ''}`}>
            <div className="notification-progress-bar">
                <div className="notification-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="notification-icon">
                {getIcon()}
            </div>
            <div className="notification-content">
                <p className="notification-message">{message}</p>
            </div>
            <button className="notification-close" onClick={handleClose} aria-label="Đóng thông báo">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
            </button>
        </div>
    );
};

export default NotificationModal;
