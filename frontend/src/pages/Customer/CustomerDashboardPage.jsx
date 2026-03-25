import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomerLayout from '../../layouts/CustomerLayout';
import ProfileService from '../../services/ProfileService';
import './CustomerDashboardPage.css';

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
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
        );
    }

    if (normalized.includes('nau') || normalized.includes('bep') || normalized.includes('an uong')) {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
        );
    }

    if (normalized.includes('cho') || normalized.includes('di cho') || normalized.includes('mua sam')) {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
        );
    }

    if (normalized.includes('vuon') || normalized.includes('cay') || normalized.includes('cat tia')) {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22V12" />
                <path d="M5 12c0-3.9 3.1-7 7-7s7 3.1 7 7" />
                <path d="M5 12H2" />
                <path d="M22 12h-3" />
            </svg>
        );
    }

    if (normalized.includes('son') || normalized.includes('sua') || normalized.includes('dien') || normalized.includes('nuoc')) {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
        );
    }

    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M8 12h8" />
            <path d="M12 8v8" />
        </svg>
    );
};

/* ──────────────────────────────────────────
   Component
────────────────────────────────────────── */
const CustomerDashboardPage = () => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');

    const [categories, setCategories] = useState([]);
    const [isLoadingCategories, setIsLoadingCategories] = useState(false);
    const [categoriesError, setCategoriesError] = useState('');

    useEffect(() => {
        const loadCategories = async () => {
            try {
                setIsLoadingCategories(true);
                setCategoriesError('');
                const res = await ProfileService.getActiveCategories();
                const list = res?.data ?? res;
                setCategories(Array.isArray(list) ? list : []);
            } catch (err) {
                setCategories([]);
                setCategoriesError(err?.message || 'Không thể tải danh sách dịch vụ. Vui lòng thử lại.');
            } finally {
                setIsLoadingCategories(false);
            }
        };

        loadCategories();
    }, []);

    const PALETTE = useMemo(
        () => ['#E6F0EC', '#FEF3C7', '#DCFCE7', '#FEE2E2', '#F6EFE8', '#FBF7F3', '#E6F0EC'],
        []
    );

    const filteredCategories = useMemo(() => {
        const q = normalizeServiceLabel(searchQuery);
        if (!q) return categories;
        return categories.filter((c) => normalizeServiceLabel(c?.name).includes(q));
    }, [categories, searchQuery]);

    const dashboardCategories = useMemo(() => {
        const MAX = 8;
        return filteredCategories.slice(0, MAX).map((cat, idx) => ({
            id: cat?.id,
            label: cat?.name || 'Dịch vụ',
            color: PALETTE[idx % PALETTE.length],
            icon: getServiceIcon(cat?.name)
        }));
    }, [PALETTE, filteredCategories]);

    const handleServiceClick = (serviceId) => {
        navigate(`/customer/post-job?serviceId=${serviceId}`);
    };

    const mockOverview = useMemo(
        () => [
            { label: 'Bài đăng đang mở', value: 3, tone: 'warning' },
            { label: 'Lịch sắp tới', value: 2, tone: 'primary' },
            { label: 'Đã hoàn thành tháng này', value: 7, tone: 'success' },
        ],
        []
    );

    const mockRecentPosts = useMemo(
        () => [
            { id: 101, title: 'Dọn dẹp căn hộ 2PN', time: '08:00 • 28/03', status: 'Đang tìm helper' },
            { id: 102, title: 'Nấu ăn theo tuần', time: '17:30 • 29/03', status: 'Đã có helper nhận' },
            { id: 103, title: 'Đi chợ và sơ chế', time: '09:00 • 30/03', status: 'Chờ xác nhận' },
        ],
        []
    );

    return (
        <CustomerLayout>
            <div className="cdh-wrapper">
                <section className="cdh-hero">
                    <div>
                        <h1 className="cdh-title">Khám phá dịch vụ phù hợp</h1>
                        <p className="cdh-subtitle">Chọn dịch vụ và đăng tin nhanh chỉ với vài bước.</p>
                    </div>
                    <button className="cdh-hero-btn" onClick={() => navigate('/customer/manage-posts')}>
                        Quản lý bài đăng
                    </button>
                </section>

                <section className="cdh-search-panel">
                    <div className="cdh-search-input-wrap">
                        <svg className="cdh-search-icon" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                            type="text"
                            className="cdh-search-input"
                            placeholder="Bạn cần người làm dịch vụ gì?"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <button className="cdh-filter-btn" title="Lọc">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                        </svg>
                    </button>
                </section>

                <section className="cdh-section">
                    <div className="cdh-section-header">
                        <h2 className="cdh-section-title">Dịch vụ chính</h2>
                        <span className="cdh-section-badge">{dashboardCategories.length}</span>
                    </div>
                    <div className="cdh-categories-grid">
                            {isLoadingCategories && (
                                <div className="cdh-empty">
                                    Đang tải danh sách dịch vụ...
                                </div>
                            )}

                            {!isLoadingCategories && categoriesError && (
                                <div className="cdh-empty cdh-empty-error">
                                    {categoriesError}
                                </div>
                            )}

                            {!isLoadingCategories && !categoriesError && dashboardCategories.length === 0 && (
                                <div className="cdh-empty">
                                    Chưa có dịch vụ nào để hiển thị.
                                </div>
                            )}

                            {!isLoadingCategories && !categoriesError && dashboardCategories.map(cat => (
                                <button
                                    key={cat.id}
                                    className="cdh-category-card"
                                    onClick={() => handleServiceClick(cat.id)}
                                >
                                    <div className="cdh-category-icon" style={{ backgroundColor: cat.color }}>
                                        {cat.icon}
                                    </div>
                                    <span className="cdh-category-label">{cat.label}</span>
                                    <span className="cdh-category-action">Đăng tin</span>
                                </button>
                            ))}
                    </div>
                </section>

                <section className="cdh-grid-2">
                    <div className="cdh-section">
                        <div className="cdh-section-header">
                            <h2 className="cdh-section-title">Tình hình nhanh</h2>
                        </div>
                        <div className="cdh-overview-grid">
                            {mockOverview.map((item) => (
                                <article key={item.label} className={`cdh-overview-card cdh-overview-${item.tone}`}>
                                    <p className="cdh-overview-value">{item.value}</p>
                                    <p className="cdh-overview-label">{item.label}</p>
                                </article>
                            ))}
                        </div>
                    </div>

                    <div className="cdh-section">
                        <div className="cdh-section-header">
                            <h2 className="cdh-section-title">Ưu đãi hôm nay</h2>
                        </div>
                        <div className="cdh-promo-card">
                            <p className="cdh-promo-badge">Giảm 15%</p>
                            <h3 className="cdh-promo-title">Áp dụng cho gói dọn dẹp buổi sáng</h3>
                            <p className="cdh-promo-desc">Đặt lịch trước 10h để nhận ưu đãi tự động.</p>
                            <button className="cdh-promo-btn" onClick={() => navigate('/customer-dashboard')}>
                                Xem chi tiết
                            </button>
                        </div>
                    </div>
                </section>

                <section className="cdh-section">
                    <div className="cdh-section-header">
                        <h2 className="cdh-section-title">Bài đăng gần đây (mô phỏng)</h2>
                    </div>
                    <div className="cdh-recent-list">
                        {mockRecentPosts.map((post) => (
                            <article key={post.id} className="cdh-recent-item">
                                <div>
                                    <p className="cdh-recent-title">{post.title}</p>
                                    <p className="cdh-recent-time">{post.time}</p>
                                </div>
                                <span className="cdh-recent-status">{post.status}</span>
                            </article>
                        ))}
                    </div>
                </section>

            </div>
        </CustomerLayout>
    );
};

export default CustomerDashboardPage;