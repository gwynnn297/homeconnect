import React, { useEffect, useState } from 'react';
import CustomerLayout from '../../layouts/CustomerLayout';
import HelperRegistrationService from '../../services/HelperRegistrationService';
import './CustomerDashboardPage.css';

const CATEGORY_COLORS = ['#e8f5e9', '#fff3e0', '#e3f2fd', '#fce4ec', '#f3e5f5', '#fff8e1'];

const normalizeServiceLabel = (label = '') =>
    String(label)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

const getServiceIcon = (label) => {
    const normalized = normalizeServiceLabel(label);

    if (normalized.includes('don dep') || normalized.includes('ve sinh') || normalized.includes('tap vu') || normalized.includes('lau')) {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="#2e7d32" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
        );
    }

    if (normalized.includes('nau') || normalized.includes('bep') || normalized.includes('an uong')) {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="#e65100" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                <line x1="6" y1="1" x2="6" y2="4" />
                <line x1="10" y1="1" x2="10" y2="4" />
                <line x1="14" y1="1" x2="14" y2="4" />
            </svg>
        );
    }

    if (normalized.includes('tre') || normalized.includes('em be') || normalized.includes('bao mau')) {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="#c62828" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
        );
    }

    if (normalized.includes('cho') || normalized.includes('di cho') || normalized.includes('mua sam')) {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="#6a1b9a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
        );
    }

    if (normalized.includes('vuon') || normalized.includes('cay') || normalized.includes('cat tia')) {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="#2e7d32" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22V12" />
                <path d="M5 12c0-3.9 3.1-7 7-7s7 3.1 7 7" />
                <path d="M5 12H2" />
                <path d="M22 12h-3" />
            </svg>
        );
    }

    if (normalized.includes('son') || normalized.includes('sua') || normalized.includes('dien') || normalized.includes('nuoc')) {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="#f57f17" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
        );
    }

    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="#2f4858" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M8 12h8" />
            <path d="M12 8v8" />
        </svg>
    );
};

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
    const [serviceCategories, setServiceCategories] = useState([]);
    const [categoryPage, setCategoryPage] = useState(0);
    const [isShowingAllCategories, setIsShowingAllCategories] = useState(false);
    const PAGE_SIZE = 6;
    const totalPages = Math.max(1, Math.ceil(serviceCategories.length / PAGE_SIZE));
    const startIndex = categoryPage * PAGE_SIZE;
    const visibleCategories = serviceCategories.slice(startIndex, startIndex + PAGE_SIZE);
    const displayedCategories = isShowingAllCategories ? serviceCategories : visibleCategories;
    const canSlidePrev = categoryPage > 0;
    const canSlideNext = categoryPage < totalPages - 1;

    useEffect(() => {
        let isMounted = true;

        const fetchServices = async () => {
            try {
                const res = await HelperRegistrationService.getServices();
                const rawItems = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
                const normalized = rawItems
                    .map((item, index) => {
                        const label =
                            item?.categoryName ??
                            item?.name ??
                            item?.serviceName ??
                            '';

                        return {
                            id: item?.categoryId ?? item?.id ?? item?.serviceId ?? `category-${index}`,
                            label,
                            color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
                            icon: getServiceIcon(label),
                        };
                    })
                    .filter((item) => item.label && item.label.trim().length > 0);

                if (isMounted) {
                    setServiceCategories(normalized);
                    setCategoryPage(0);
                }
            } catch (err) {
                console.error('[CustomerDashboardPage] fetchServices failed:', err);
                if (isMounted) {
                    setServiceCategories([]);
                    setCategoryPage(0);
                }
            }
        };

        fetchServices();
        return () => {
            isMounted = false;
        };
    }, []);

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
                        <a
                            className="cdb-section-link"
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                setIsShowingAllCategories((prev) => !prev);
                            }}
                        >
                            {isShowingAllCategories ? 'Thu gọn' : 'Xem tất cả'} &rsaquo;
                        </a>
                    </div>
                    <div className="cdb-categories-carousel">
                        {!isShowingAllCategories && (
                            <button
                                className="cdb-category-nav"
                                aria-label="Xem nhóm dịch vụ trước"
                                onClick={() => setCategoryPage((prev) => Math.max(0, prev - 1))}
                                disabled={!canSlidePrev}
                            >
                                &lsaquo;
                            </button>
                        )}
                        <div className="cdb-categories-grid">
                            {displayedCategories.map(cat => (
                                <button key={cat.id} className="cdb-category-card">
                                    <div className="cdb-category-icon" style={{ backgroundColor: cat.color }}>
                                        {cat.icon}
                                    </div>
                                    <span className="cdb-category-label">{cat.label}</span>
                                </button>
                            ))}
                            {serviceCategories.length === 0 && (
                                <p className="cdb-empty-note">Chưa có danh mục dịch vụ.</p>
                            )}
                        </div>
                        {!isShowingAllCategories && (
                            <button
                                className="cdb-category-nav"
                                aria-label="Xem nhóm dịch vụ tiếp theo"
                                onClick={() => setCategoryPage((prev) => Math.min(totalPages - 1, prev + 1))}
                                disabled={!canSlideNext}
                            >
                                &rsaquo;
                            </button>
                        )}
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