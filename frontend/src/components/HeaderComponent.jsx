import { useState } from 'react';
import { Link } from 'react-router-dom';
import './HeaderComponent.css';

export default function HeaderComponent() {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [notifications, setNotifications] = useState(5);

    const toggleDropdown = () => {
        setIsDropdownOpen(!isDropdownOpen);
    };

    const handleLogout = () => {
        // Handle logout logic here
        console.log('Logout');
    };

    return (
        <header className="header">
            <div className="header-container">
                {/* Logo and Brand */}
                <div className="header-logo">
                    <Link to="/" className="logo-link">
                        <svg className="logo-icon" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
                        </svg>
                        <span className="logo-text">HomieConnect</span>
                    </Link>
                </div>

                {/* Right Side - Navigation & Profile */}
                <div className="header-right">
                    {/* Management Button */}
                    <Link to="/management" className="nav-button">
                        <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8"></circle>
                            <path d="m21 21-4.35-4.35"></path>
                        </svg>
                        <span>Quản lý ví</span>
                    </Link>

                    {/* Notification Bell */}
                    <button className="notification-btn">
                        <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                        </svg>
                        {notifications > 0 && <span className="notification-badge">{notifications}</span>}
                    </button>

                    {/* User Profile Dropdown */}
                    <div className="profile-dropdown">
                        <button className="profile-btn" onClick={toggleDropdown}>
                            <div className="user-avatar">A</div>
                            <span className="user-name">Nguyễn Phương</span>
                            <svg className={`dropdown-arrow ${isDropdownOpen ? 'open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </button>

                        {/* Dropdown Menu */}
                        {isDropdownOpen && (
                            <div className="dropdown-menu">
                                <Link to="/profile" className="dropdown-item">
                                    <svg className="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                        <circle cx="12" cy="7" r="4"></circle>
                                    </svg>
                                    Hồ sơ cá nhân
                                </Link>
                                <Link to="/settings" className="dropdown-item">
                                    <svg className="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="1"></circle>
                                        <path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m2.12 2.12l4.24 4.24M1 12h6m6 0h6m-16.78 7.78l4.24-4.24m2.12-2.12l4.24-4.24"></path>
                                    </svg>
                                    Cài đặt
                                </Link>
                                <hr className="dropdown-divider" />
                                <button className="dropdown-item logout" onClick={handleLogout}>
                                    <svg className="dropdown-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                        <polyline points="16 17 21 12 16 7"></polyline>
                                        <line x1="21" y1="12" x2="9" y2="12"></line>
                                    </svg>
                                    Đăng xuất
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
