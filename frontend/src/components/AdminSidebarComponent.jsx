import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import AdminService from '../services/AdminService';
import './AdminSidebarComponent.css';

const AdminSidebarComponent = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);

    useEffect(() => {
        AdminService.getStatistics()
            .then((data) => setStats(data))
            .catch(() => setStats(null));
    }, []);

    const kycBadgeCount = useMemo(() => {
        const pending = stats?.helperStats?.pendingKyc ?? 0;
        const waiting = stats?.helperStats?.waitingApproval ?? 0;
        return Number(pending) + Number(waiting);
    }, [stats]);

    const linkClass = ({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`;

    const handleLogout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        navigate('/login');
    };

    return (
        <aside className="admin-sidebar">
            <nav className="sidebar-nav">
                <NavLink
                    to="/admin/dashboard"
                    className={linkClass}
                >
                    <div className="sidebar-link-left">
                        <div className="icon-wrapper">
                            {/* dashboard icon */}
                            <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="7" height="7"></rect>
                                <rect x="14" y="3" width="7" height="7"></rect>
                                <rect x="14" y="14" width="7" height="7"></rect>
                                <rect x="3" y="14" width="7" height="7"></rect>
                            </svg>
                        </div>
                        <span>Tổng quan</span>
                    </div>
                </NavLink>

                <NavLink
                    to="/admin/helpers"
                    className={linkClass}
                >
                    <div className="sidebar-link-left">
                        <div className="icon-wrapper">
                            {/* users icon */}
                            <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="9" cy="7" r="4"></circle>
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                            </svg>
                        </div>
                        <span>Quản lý Helper</span>
                    </div>
                </NavLink>

                {/* Duyệt KYC */}
                <NavLink
                    to="/admin/helpers?status=WAITING_APPROVAL"
                    className={linkClass}
                >
                    <div className="sidebar-link-left">
                        <div className="icon-wrapper">
                            <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7z"></path>
                            </svg>
                        </div>
                        <span>Duyệt KYC</span>
                    </div>
                    {kycBadgeCount > 0 && (
                        <span className="sidebar-badge sidebar-badge-warning">
                            {kycBadgeCount}
                        </span>
                    )}
                </NavLink>

                <NavLink to="/admin/users" className={linkClass}>
                    <div className="sidebar-link-left">
                        <div className="icon-wrapper">
                            <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                <circle cx="8.5" cy="7" r="4"></circle>
                                <line x1="20" y1="11" x2="20" y2="21"></line>
                                <line x1="23" y1="14" x2="17" y2="14"></line>
                            </svg>
                        </div>
                        <span>Quản lý User</span>
                    </div>
                </NavLink>

                <NavLink to="/admin/bookings" className={linkClass}>
                    <div className="sidebar-link-left">
                        <div className="icon-wrapper">
                            <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="16" y1="2" x2="16" y2="6"></line>
                                <line x1="8" y1="2" x2="8" y2="6"></line>
                                <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                        </div>
                        <span>Quản lý Booking</span>
                    </div>
                </NavLink>

                <NavLink
                    to="/admin/services"
                    className={linkClass}
                >
                    <div className="sidebar-link-left">
                        <div className="icon-wrapper">
                            {/* service icon */}
                            <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 7h-9"></path>
                                <path d="M14 17H5"></path>
                                <circle cx="17" cy="17" r="3"></circle>
                                <circle cx="7" cy="7" r="3"></circle>
                            </svg>
                        </div>
                        <span>Quản lý dịch vụ</span>
                    </div>
                </NavLink>

                <NavLink
                    to="/admin/wallet-transactions"
                    className={linkClass}
                >
                    <div className="sidebar-link-left">
                        <div className="icon-wrapper">
                            <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path>
                                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"></path>
                                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"></path>
                            </svg>
                        </div>
                        <span>Ví &amp; Giao dịch</span>
                    </div>
                </NavLink>

                <NavLink to="/admin/complaints" className={linkClass}>
                    <div className="sidebar-link-left">
                        <div className="icon-wrapper">
                            <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8z"></path>
                            </svg>
                        </div>
                        <span>Khiếu nại &amp; Hoàn tiền</span>
                    </div>
                </NavLink>

                <NavLink to="/admin/reports" className={linkClass}>
                    <div className="sidebar-link-left">
                        <div className="icon-wrapper">
                            <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 3v18h18"></path>
                                <path d="M8 14l2-2 3 3 5-7"></path>
                            </svg>
                        </div>
                        <span>Báo cáo &amp; Thống kê</span>
                    </div>
                </NavLink>



                <NavLink
                    to="/admin/notifications"
                    className={linkClass}
                >
                    <div className="sidebar-link-left">
                        <div className="icon-wrapper">
                            {/* notification icon */}
                            <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                            </svg>
                        </div>
                        <span>Thông báo</span>
                    </div>
                </NavLink>
            </nav>

            <div className="sidebar-footer">
                <button type="button" className="sidebar-logout" onClick={handleLogout}>
                    <span>Đăng xuất</span>
                </button>
            </div>
        </aside>
    );
};

export default AdminSidebarComponent;
