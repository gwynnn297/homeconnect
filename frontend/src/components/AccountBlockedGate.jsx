import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import NotificationModal from './NotificationModal';

/**
 * Lắng nghe sự kiện khi API trả 403 + code ACCOUNT_BLOCKED (tài khoản bị admin khóa khi đang đăng nhập).
 */
const AccountBlockedGate = () => {
    const navigate = useNavigate();
    const [blockedMessage, setBlockedMessage] = useState(null);

    useEffect(() => {
        const handler = (e) => {
            setBlockedMessage(e.detail?.message || 'Tài khoản của bạn đã bị khóa.');
        };
        window.addEventListener('account-blocked', handler);
        return () => window.removeEventListener('account-blocked', handler);
    }, []);

    const handleClose = useCallback(() => {
        setBlockedMessage(null);
        navigate('/login', { replace: true });
    }, [navigate]);

    if (!blockedMessage) return null;

    return (
        <NotificationModal
            type="error"
            message={blockedMessage}
            persistent
            duration={0}
            onClose={handleClose}
        />
    );
};

export default AccountBlockedGate;
