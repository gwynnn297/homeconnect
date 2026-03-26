import React from 'react';
import { NavLink } from 'react-router-dom';
import './CustomerSidebarComponent.css';

const csPrimaryLinks = [
    { to: '/customer-dashboard', label: 'Tổng quan', icon: 'grid' },
    { to: '/customer/book', label: 'Đặt dịch vụ', icon: 'plus' },
    { to: '/customer/manage-posts', label: 'Quản lý bài đăng', icon: 'file', badge: 'Mới' },
];

const csAccountLinks = [
    { to: '/customer/my-bookings', label: 'Lịch đặt', icon: 'calendar' },
    { to: '/customer/history', label: 'Lịch sử dịch vụ', icon: 'clock' },
    { to: '/customer/wallet', label: 'Ví tiền', icon: 'wallet' },
];

const CustomerSidebarIcon = ({ icon }) => {
    if (icon === 'plus') {
        return (
            <svg className="cs-sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="16"></line>
                <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
        );
    }
    if (icon === 'file') {
        return (
            <svg className="cs-sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
        );
    }
    if (icon === 'calendar') {
        return (
            <svg className="cs-sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
        );
    }
    if (icon === 'clock') {
        return (
            <svg className="cs-sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
        );
    }
    if (icon === 'wallet') {
        return (
            <svg className="cs-sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
            </svg>
        );
    }
    return (
        <svg className="cs-sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
    );
};

const CustomerSidebarComponent = ({ onNavigate }) => {
    const csAllLinks = [...csPrimaryLinks, ...csAccountLinks];

    return (
        <aside className="cs-sidebar">
            <nav className="cs-sidebar-nav">
                {csAllLinks.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) => `cs-sidebar-link ${isActive ? 'active' : ''}`}
                        onClick={() => onNavigate?.()}
                    >
                        <div className="cs-sidebar-link-left">
                            <div className="cs-icon-wrapper">
                                <CustomerSidebarIcon icon={item.icon} />
                            </div>
                            <span>{item.label}</span>
                        </div>
                        {item.badge && <span className="cs-sidebar-badge">{item.badge}</span>}
                    </NavLink>
                ))}
            </nav>
        </aside>
    );
};

export default CustomerSidebarComponent;
