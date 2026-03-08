import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import logoHomieConnect from '../assets/LogoHomieConnect.png';
import ProfileService from '../services/ProfileService';
import './HeaderComponent.css';

const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map((w) => w[0]).filter(Boolean).slice(-2).join('').toUpperCase();
};

const HeaderComponent = () => {
    const navigate = useNavigate();
    const [showDropdown, setShowDropdown] = useState(false);
    const userInfoRef = useRef(null);

    // Reactive user info state
    const [userInfo, setUserInfo] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('user')) || {};
        } catch { return {}; }
    });

    // Hàm fetch avatar + name từ API — dùng khi mount và khi có 'profile:updated'
    const fetchUserProfile = useCallback(() => {
        ProfileService.getMyProfile()
            .then((res) => {
                const data = res?.data;
                if (!data) return;
                setUserInfo((prev) => ({
                    ...prev,
                    fullName: data.fullName || prev.fullName,
                    avatarUrl: data.avatarUrl ?? prev.avatarUrl,
                }));
                // Sync to localStorage
                try {
                    const stored = JSON.parse(localStorage.getItem('user') || '{}');
                    if (data.avatarUrl !== undefined) stored.avatarUrl = data.avatarUrl;
                    if (data.fullName) stored.fullName = data.fullName;
                    localStorage.setItem('user', JSON.stringify(stored));
                } catch { /* ignore */ }
            })
            .catch(() => { /* silent fail */ });
    }, []);

    // Fetch khi mount
    useEffect(() => { fetchUserProfile(); }, [fetchUserProfile]);

    // Lắng nghe CustomEvent 'profile:updated' từ cùng tab (Profile page dispatch sau khi lưu)
    useEffect(() => {
        window.addEventListener('profile:updated', fetchUserProfile);
        return () => window.removeEventListener('profile:updated', fetchUserProfile);
    }, [fetchUserProfile]);

    // Lắng nghe storage event từ tab khác
    useEffect(() => {
        const onStorage = () => {
            try {
                const u = JSON.parse(localStorage.getItem('user') || '{}');
                setUserInfo(u);
            } catch { /* ignore */ }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    const displayName = userInfo?.fullName || userInfo?.name || userInfo?.username || userInfo?.email || 'Người dùng';
    const avatarUrl = userInfo?.avatarUrl || null;
    const avatarInitials = getInitials(displayName);

    const handleDashboard = () => {
        if (userInfo?.role === 'ADMIN') navigate('/admin/dashboard');
        else if (userInfo?.role === 'HELPER') navigate('/helper/dashboard');
        else if (userInfo?.role === 'CUSTOMER') navigate('/customer-dashboard');
        else navigate('/home');
    };

    const toggleDropdown = () => setShowDropdown((v) => !v);

    const handleProfile = () => {
        setShowDropdown(false);
        if (userInfo?.role === 'HELPER') {
            navigate('/helper/profile');
        } else if (userInfo?.role === 'CUSTOMER') {
            navigate('/customer/profile');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        navigate('/login');
    };

    // Close dropdown on outside click
    useEffect(() => {
        if (!showDropdown) return;
        const handleClickOutside = (e) => {
            if (userInfoRef.current && !userInfoRef.current.contains(e.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showDropdown]);

    return (
        <header className="header">
            <div className="logo">
                <img className="logo-img" src={logoHomieConnect} alt="HomieConnectLogo" />
            </div>

            <div className="header-user-actions">
                {/* Notification Bell */}
                <div className="notification-icon" title="Thông báo">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
                    </svg>
                    <span className="notification-badge"></span>
                </div>

                {/* User Profile */}
                <div className="user-info" ref={userInfoRef}>
                    <div
                        className="user-avatar"
                        onClick={handleProfile}
                        title={userInfo?.role !== 'ADMIN' ? "Hồ sơ cá nhân" : "Ảnh đại diện"}
                        style={{ cursor: userInfo?.role !== 'ADMIN' ? 'pointer' : 'default' }}
                    >
                        {avatarUrl
                            ? <img src={avatarUrl} alt="Avatar" className="user-avatar-img" />
                            : <span>{avatarInitials}</span>
                        }
                    </div>
                    <span className="username" onClick={toggleDropdown} style={{ cursor: 'pointer' }}>
                        {displayName}
                    </span>
                    <button className="dropdown-toggle" onClick={toggleDropdown} aria-label="Toggle user menu">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>

                    {/* Dropdown Menu */}
                    {showDropdown && (
                        <div className="user-dropdown">
                            {userInfo?.role !== 'ADMIN' && (
                                <div className="dropdown-item" onClick={handleProfile}>
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                        <path d="M8 8C10.21 8 12 6.21 12 4C12 1.79 10.21 0 8 0C5.79 0 4 1.79 4 4C4 6.21 5.79 8 8 8ZM8 10C5.33 10 0 11.34 0 14V16H16V14C16 11.34 10.67 10 8 10Z" fill="currentColor" />
                                    </svg>
                                    Hồ sơ
                                </div>
                            )}
                            <div className="dropdown-divider"></div>
                            <div className="dropdown-item dropdown-item-danger" onClick={handleLogout}>
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <path d="M6 12H2V2H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M10 9L14 5L10 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M14 5H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                Đăng xuất
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default HeaderComponent;

