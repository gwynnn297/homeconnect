import React, { useState } from 'react';
import CustomerLayout from '../../layouts/CustomerLayout';
import './CustomerDashboardPage.css';

/* ──────────────────────────────────────────
   Static mock data
────────────────────────────────────────── */
const SERVICE_CATEGORIES = [
    {
        id: 1, label: 'Dọn dẹp', color: '#e8f5e9',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="#2e7d32" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
        ),
    },
    {
        id: 2, label: 'Nấu ăn', color: '#fff3e0',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="#e65100" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                <line x1="6" y1="1" x2="6" y2="4" />
                <line x1="10" y1="1" x2="10" y2="4" />
                <line x1="14" y1="1" x2="14" y2="4" />
            </svg>
        ),
    },
    {
        id: 3, label: 'Vệ sinh văn phòng', color: '#e3f2fd',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="#1565c0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                <line x1="9" y1="9" x2="9.01" y2="9" />
                <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
        ),
    },
    {
        id: 4, label: 'Trông trẻ', color: '#fce4ec',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="#c62828" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
        ),
    },
    {
        id: 5, label: 'Đi chợ', color: '#f3e5f5',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="#6a1b9a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
        ),
    },
    {
        id: 6, label: 'Làm vườn', color: '#e8f5e9',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="#2e7d32" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22V12" />
                <path d="M5 12c0-3.9 3.1-7 7-7s7 3.1 7 7" />
                <path d="M5 12H2" />
                <path d="M22 12h-3" />
            </svg>
        ),
    },
    {
        id: 7, label: 'Sơn sửa', color: '#fff8e1',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="#f57f17" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
        ),
    },
    {
        id: 8, label: 'Xem thêm', color: '#f5f5f5',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="#546e7a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="5" cy="5" r="1" fill="#546e7a" stroke="none" />
                <circle cx="12" cy="5" r="1" fill="#546e7a" stroke="none" />
                <circle cx="19" cy="5" r="1" fill="#546e7a" stroke="none" />
                <circle cx="5" cy="12" r="1" fill="#546e7a" stroke="none" />
                <circle cx="12" cy="12" r="1" fill="#546e7a" stroke="none" />
                <circle cx="19" cy="12" r="1" fill="#546e7a" stroke="none" />
                <circle cx="5" cy="19" r="1" fill="#546e7a" stroke="none" />
                <circle cx="12" cy="19" r="1" fill="#546e7a" stroke="none" />
                <circle cx="19" cy="19" r="1" fill="#546e7a" stroke="none" />
            </svg>
        ),
    },
];

const FEATURED_HELPERS = [
    { id: 1, initials: 'MT', name: 'Minh Tuấn', service: 'Thợ điện', rating: 4.9, jobs: 120, bg: '#4CAF50' },
    { id: 2, initials: 'TH', name: 'Thu Hương', service: 'Dọn dẹp', rating: 4.8, jobs: 98, bg: '#FF7043' },
    { id: 3, initials: 'NL', name: 'Ngọc Linh', service: 'Nấu ăn', rating: 4.9, jobs: 215, bg: '#5C6BC0' },
    { id: 4, initials: 'PK', name: 'Phúc Khang', service: 'Làm vườn', rating: 4.7, jobs: 77, bg: '#26A69A' },
];

/* ──────────────────────────────────────────
   Component
────────────────────────────────────────── */
const CustomerDashboardPage = () => {
    const [searchQuery, setSearchQuery] = useState('');

    return (
        <CustomerLayout>
            <div className="cdb-wrapper">

                {/* ── Search Bar ── */}
                <div className="cdb-search-bar">
                    <div className="cdb-search-input-wrap">
                        <svg className="cdb-search-icon" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                            type="text"
                            className="cdb-search-input"
                            placeholder="Bạn cần người làm dịch vụ gì?"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <button className="cdb-filter-btn" title="Lọc">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                        </svg>
                    </button>
                </div>

                {/* ── Service Categories ── */}
                <section className="cdb-section">
                    <div className="cdb-section-header">
                        <h2 className="cdb-section-title">Danh mục dịch vụ</h2>
                        <a className="cdb-section-link" href="#">Xem tất cả &rsaquo;</a>
                    </div>
                    <div className="cdb-categories-grid">
                        {SERVICE_CATEGORIES.map(cat => (
                            <button key={cat.id} className="cdb-category-card">
                                <div className="cdb-category-icon" style={{ backgroundColor: cat.color }}>
                                    {cat.icon}
                                </div>
                                <span className="cdb-category-label">{cat.label}</span>
                            </button>
                        ))}
                    </div>
                </section>

                {/* ── Hot Deal Banner ── */}
                <section className="cdb-hotdeal-banner">
                    <div className="cdb-hotdeal-left">
                        <span className="cdb-hotdeal-badge">🔥 HOT DEAL</span>
                        <h3 className="cdb-hotdeal-title">Chào Hè Rực Rỡ!</h3>
                        <p className="cdb-hotdeal-subtitle">
                            <strong>Giảm 20%</strong> cho tất cả dịch vụ dọn dẹp
                        </p>
                        <button className="cdb-hotdeal-btn">
                            Xem ngay &rsaquo;
                        </button>
                    </div>
                    <div className="cdb-hotdeal-right">
                        <div className="cdb-hotdeal-sun">
                            <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)"
                                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="5" />
                                <line x1="12" y1="1" x2="12" y2="3" />
                                <line x1="12" y1="21" x2="12" y2="23" />
                                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                                <line x1="1" y1="12" x2="3" y2="12" />
                                <line x1="21" y1="12" x2="23" y2="12" />
                                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                            </svg>
                        </div>
                    </div>
                </section>

                {/* ── Featured Helpers ── */}
                <section className="cdb-section">
                    <div className="cdb-section-header">
                        <h2 className="cdb-section-title">Đối tác tiêu biểu</h2>
                        <a className="cdb-section-link" href="#">Xem tất cả &rsaquo;</a>
                    </div>
                    <div className="cdb-helpers-grid">
                        {FEATURED_HELPERS.map(h => (
                            <div key={h.id} className="cdb-helper-card">
                                <div className="cdb-helper-avatar" style={{ backgroundColor: h.bg }}>
                                    {h.initials}
                                </div>
                                <div className="cdb-helper-info">
                                    <p className="cdb-helper-name">{h.name}</p>
                                    <p className="cdb-helper-service">{h.service}</p>
                                    <div className="cdb-helper-meta">
                                        <span className="cdb-helper-rating">⭐ {h.rating}</span>
                                        <span className="cdb-helper-jobs">{h.jobs} việc</span>
                                    </div>
                                </div>
                                <button className="cdb-helper-book-btn">Đặt ngay</button>
                            </div>
                        ))}
                    </div>
                </section>

            </div>
        </CustomerLayout>
    );
};

export default CustomerDashboardPage;