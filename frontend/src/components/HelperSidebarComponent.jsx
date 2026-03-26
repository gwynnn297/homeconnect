import React from 'react';
import { NavLink } from 'react-router-dom';
import './HelperSidebarComponent.css';

const HelperSidebarComponent = () => {
    return (
        <aside className="hc-helper-sidebar">
            <nav className="hc-helper-sidebar__nav">
                <NavLink
                    to="/helper/dashboard"
                    className={({ isActive }) =>
                        `hc-helper-sidebar__link ${isActive ? 'hc-helper-sidebar__link--active' : ''}`
                    }
                >
                    <div className="hc-helper-sidebar__icon-wrap">
                        <svg className="hc-helper-sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="7" height="7"></rect>
                            <rect x="14" y="3" width="7" height="7"></rect>
                            <rect x="14" y="14" width="7" height="7"></rect>
                            <rect x="3" y="14" width="7" height="7"></rect>
                        </svg>
                    </div>
                    <span>Tổng quan</span>
                </NavLink>

                <NavLink
                    to="/helper/new-jobs"
                    className={({ isActive }) =>
                        `hc-helper-sidebar__link ${isActive ? 'hc-helper-sidebar__link--active' : ''}`
                    }
                >
                    <div className="hc-helper-sidebar__icon-wrap">
                        <svg className="hc-helper-sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                            <line x1="12" y1="22.08" x2="12" y2="12"></line>
                        </svg>
                    </div>
                    <span>Việc làm mới</span>
                </NavLink>

                <NavLink
                    to="/helper/schedule"
                    className={({ isActive }) =>
                        `hc-helper-sidebar__link ${isActive ? 'hc-helper-sidebar__link--active' : ''}`
                    }
                >
                    <div className="hc-helper-sidebar__icon-wrap">
                        <svg className="hc-helper-sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                    </div>
                    <span>Lịch làm việc</span>
                </NavLink>

                <NavLink
                    to="/helper/wallet"
                    className={({ isActive }) =>
                        `hc-helper-sidebar__link ${isActive ? 'hc-helper-sidebar__link--active' : ''}`
                    }
                >
                    <div className="hc-helper-sidebar__icon-wrap">
                        <svg className="hc-helper-sidebar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

export default HelperSidebarComponent;
