import React from 'react';
import { NavLink } from 'react-router-dom';
import './CustomerSidebarComponent.css';

const CustomerSidebarComponent = () => {
    return (
        <aside className="customer-sidebar">
            <nav className="sidebar-nav">

                <NavLink
                    to="/customer-dashboard"
                    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                >
                    <div className="icon-wrapper">
                        {/* Dashboard icon */}
                        <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="7" height="7"></rect>
                            <rect x="14" y="3" width="7" height="7"></rect>
                            <rect x="14" y="14" width="7" height="7"></rect>
                            <rect x="3" y="14" width="7" height="7"></rect>
                        </svg>
                    </div>
                    <span>Tổng quan</span>
                </NavLink>

                <NavLink
                    to="/customer/book"
                    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                >
                    <div className="icon-wrapper">
                        {/* Plus-circle / Book service icon */}
                        <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="16"></line>
                            <line x1="8" y1="12" x2="16" y2="12"></line>
                        </svg>
                    </div>
                    <span>Đặt dịch vụ</span>
                </NavLink>

                <NavLink
                    to="/customer/my-bookings"
                    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                >
                    <div className="icon-wrapper">
                        {/* Calendar / My bookings icon */}
                        <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                    </div>
                    <span>Lịch đặt</span>
                </NavLink>

                <NavLink
                    to="/customer/history"
                    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                >
                    <div className="icon-wrapper">
                        {/* Clock / History icon */}
                        <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                    </div>
                    <span>Lịch sử dịch vụ</span>
                </NavLink>

                <NavLink
                    to="/customer/wallet"
                    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                >
                    <div className="icon-wrapper">
                        {/* Wallet icon */}
                        <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                            <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                            <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
                        </svg>
                    </div>
                    <span>Ví tiền</span>
                </NavLink>

            </nav>
        </aside>
    );
};

export default CustomerSidebarComponent;
