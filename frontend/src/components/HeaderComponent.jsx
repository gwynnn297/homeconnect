import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import logoHomeiConnect from '../assets/LogoHomeiConnect.png';
import './HeaderComponent.css';

const HeaderComponent = () => {
    const navigate = useNavigate();
    const [showDropdown, setShowDropdown] = useState(false);
    const userInfoRef = useRef(null);

    const handleHome = () => {
        navigate("/home");
    };

    const toggleDropdown = () => {
        setShowDropdown(!showDropdown);
    };

    const handleLogout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        navigate('/login');
    };

    // Đóng dropdown khi click bên ngoài
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showDropdown && userInfoRef.current && !userInfoRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };

        if (showDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showDropdown]);

    // Lấy thông tin user từ localStorage
    const storedUser = (() => {
        try {
            return JSON.parse(localStorage.getItem('user')) || null;
        } catch (e) {
            return null;
        }
    })();
    const storedName = storedUser?.fullName || storedUser?.name || storedUser?.username || storedUser?.email || 'Người dùng';
    const displayName = storedName;
    const avatarInitial = (displayName || 'U').trim().charAt(0).toUpperCase();

    return (
        <header className="header">
            <div className="logo">
                <img className="logo-img" src={logoHomeiConnect} alt="HomieConnectLogo" />
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
                    <div className="user-avatar" onClick={() => { navigate('/profile'); setShowDropdown(false); }}>
                        <span>{avatarInitial}</span>
                    </div>
                    <span className="username" onClick={toggleDropdown} style={{ cursor: 'pointer' }}>{displayName}</span>
                    <button
                        className="dropdown-toggle"
                        onClick={toggleDropdown}
                        aria-label="Toggle user menu"
                    >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>

                    {/* Dropdown Menu */}
                    {showDropdown && (
                        <div className="user-dropdown">
                            <div className="dropdown-item" onClick={() => { setShowDropdown(false); }}>
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M8 8C10.21 8 12 6.21 12 4C12 1.79 10.21 0 8 0C5.79 0 4 1.79 4 4C4 6.21 5.79 8 8 8ZM8 10C5.33 10 0 11.34 0 14V16H16V14C16 11.34 10.67 10 8 10Z" fill="currentColor" />
                                </svg>
                                Hồ sơ
                            </div>
                            <div className="dropdown-divider"></div>
                            <div className="dropdown-item dropdown-item-danger" onClick={handleLogout}>
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
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
