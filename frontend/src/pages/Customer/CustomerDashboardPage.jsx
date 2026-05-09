import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomerLayout from '../../layouts/CustomerLayout';
import ProfileService from '../../services/ProfileService';
import apiClient, { isAccountBlockedError } from '../../services/apiClient';
import './CustomerDashboardPage.css';

/** Backend chỉ có GET /api/v1/jobs cho danh sách của khách; /my,/customer không tồn tại và bị ánh xạ thành /{jobId}. */
const JOB_LIST_ENDPOINT = '/api/v1/jobs';
const TIER_DISCOUNT_PERCENT = {
    GOLD: 15,
    SILVER: 10,
    BRONZE: 5,
};

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

const parseYmdToDate = (ymd) => {
    if (!ymd || typeof ymd !== 'string') return null;
    const parts = ymd.split('-');
    if (parts.length !== 3) return null;
    const [y, m, d] = parts.map((p) => Number(p));
    if ([y, m, d].some((n) => Number.isNaN(n))) return null;
    // Noon to reduce timezone edge cases when formatting/displaying.
    return new Date(y, m - 1, d, 12, 0, 0, 0);
};

const parseHmsToHHmm = (hms) => {
    if (!hms || typeof hms !== 'string') return null;
    const parts = hms.split(':');
    if (parts.length < 2) return null;
    const hh = Number(parts[0]);
    const mm = Number(parts[1]);
    if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

const formatJobTimeLabel = (workDate, startTime) => {
    const dateObj = parseYmdToDate(workDate);
    const ddmm = dateObj
        ? dateObj.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
        : '---';
    const hhmm = parseHmsToHHmm(startTime) || '--:--';
    return `${hhmm} • ${ddmm}`;
};

const parseDateTime = (value) => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
};

const getJobStatusText = (status = '') => {
    switch (status) {
        case 'PUBLISHED':
            return 'Đang tìm helper';
        case 'ASSIGNED':
            return 'Đã có helper nhận';
        case 'CANCELLED':
            return 'Đã hủy';
        case 'COMPLETED':
            return 'Đã hoàn thành';
        case 'EXPIRED':
            return 'Hết hạn';
        default:
            return status ? String(status) : '—';
    }
};

const getTierLabel = (tier = 'BRONZE') => {
    switch (String(tier).toUpperCase()) {
        case 'GOLD':
            return 'GOLD';
        case 'SILVER':
            return 'SILVER';
        case 'BRONZE':
        default:
            return 'BRONZE';
    }
};

/* ──────────────────────────────────────────
   Component
────────────────────────────────────────── */
const CustomerDashboardPage = () => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [showMembershipModal, setShowMembershipModal] = useState(false);

    const [categories, setCategories] = useState([]);
    const [isLoadingCategories, setIsLoadingCategories] = useState(false);
    const [categoriesError, setCategoriesError] = useState('');

    const [jobs, setJobs] = useState([]);
    const [isLoadingJobs, setIsLoadingJobs] = useState(false);
    const [jobsError, setJobsError] = useState('');
    const [memberTier, setMemberTier] = useState('BRONZE');
    const [memberDiscountPercent, setMemberDiscountPercent] = useState(TIER_DISCOUNT_PERCENT.BRONZE);

    const refreshDashboard = useCallback((showLoading = false) => {
        // Implementation logic for refreshing data
    }, []);

    useEffect(() => {
        const loadCategories = async () => {
            try {
                setIsLoadingCategories(true);
                setCategoriesError('');
                const res = await ProfileService.getActiveCategories();
                const list = res?.data ?? res;
                setCategories(Array.isArray(list) ? list : []);
            } catch (err) {
                if (isAccountBlockedError(err)) return;
                setCategories([]);
                setCategoriesError(err?.message || 'Không thể tải danh sách dịch vụ. Vui lòng thử lại.');
            } finally {
                setIsLoadingCategories(false);
            }
        };

        loadCategories();
    }, []);

    useEffect(() => {
        const loadJobs = async () => {
            setIsLoadingJobs(true);
            setJobsError('');

            let fetched = null;
            let lastErr = null;

            try {
                const res = await apiClient.get(JOB_LIST_ENDPOINT);
                const list = res?.data ?? res;
                if (Array.isArray(list)) {
                    fetched = list;
                }
            } catch (err) {
                if (isAccountBlockedError(err)) {
                    setIsLoadingJobs(false);
                    return;
                }
                lastErr = err;
            }

            if (!Array.isArray(fetched)) {
                setJobs([]);
                setJobsError(lastErr?.message || 'Không thể tải bài đăng từ hệ thống.');
                setIsLoadingJobs(false);
                return;
            }

            setJobs(fetched);
            setIsLoadingJobs(false);
        };

        loadJobs();
    }, []);

    useEffect(() => {
        const loadMembership = async () => {
            try {
                const res = await ProfileService.getMyProfile();
                const profile = res?.data ?? res;
                const tier = String(profile?.currentTier || 'BRONZE').toUpperCase();
                const safeTier = tier in TIER_DISCOUNT_PERCENT ? tier : 'BRONZE';
                const discountFromProfile = Number(profile?.currentDiscountRate);
                const mappedDiscount = TIER_DISCOUNT_PERCENT[safeTier];
                const discountPercent = Number.isFinite(discountFromProfile)
                    ? Math.max(0, Math.round(discountFromProfile * 100))
                    : mappedDiscount;

                setMemberTier(safeTier);
                setMemberDiscountPercent(discountPercent);
            } catch (err) {
                if (isAccountBlockedError(err)) return;
                setMemberTier('BRONZE');
                setMemberDiscountPercent(TIER_DISCOUNT_PERCENT.BRONZE);
            }
        };

        loadMembership();
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

    const handleServiceClick = (categoryId) => {
        navigate(`/customer/post-job?categoryId=${categoryId}`);
    };

    const normalizedJobs = useMemo(() => {
        return (Array.isArray(jobs) ? jobs : []).map((job) => {
            const jobId = job?.postId ?? job?.post_id ?? job?.jobId ?? '';
            const status = job?.status || 'PUBLISHED';
            return {
                postId: jobId,
                title: job?.title || `Bài đăng #${jobId}`,
                workDate: job?.workDate ?? job?.work_date,
                startTime: job?.startTime ?? job?.start_time,
                createdAt: job?.createdAt ?? job?.created_at,
                status
            };
        });
    }, [jobs]);

    const dashboardStats = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const in7Days = new Date(today);
        in7Days.setDate(in7Days.getDate() + 7);

        const completedMonthKey = `${now.getFullYear()}-${now.getMonth()}`;

        const openCount = normalizedJobs.filter((j) => ['PUBLISHED', 'ASSIGNED'].includes(j.status)).length;
        const upcomingCount = normalizedJobs.filter((j) => {
            const dt = parseYmdToDate(j.workDate);
            if (!dt) return false;
            const dateOnly = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 0, 0, 0, 0);
            return dateOnly >= today && dateOnly <= in7Days;
        }).length;

        const completedThisMonthCount = normalizedJobs.filter((j) => {
            if (j.status !== 'COMPLETED') return false;
            const createdAt = parseDateTime(j.createdAt);
            if (!createdAt) return false;
            const key = `${createdAt.getFullYear()}-${createdAt.getMonth()}`;
            return key === completedMonthKey;
        }).length;

        const recentPosts = [...normalizedJobs]
            .sort((a, b) => {
                const ta = parseDateTime(a.createdAt)?.getTime() ?? 0;
                const tb = parseDateTime(b.createdAt)?.getTime() ?? 0;
                return tb - ta;
            })
            .slice(0, 3)
            .map((p) => ({
                id: p.postId,
                title: p.title,
                time: formatJobTimeLabel(p.workDate, p.startTime),
                status: getJobStatusText(p.status),
            }));

        return { openCount, upcomingCount, completedThisMonthCount, recentPosts };
    }, [normalizedJobs]);

    const membershipMessage = useMemo(() => {
        if (memberTier === 'GOLD') {
            return `Bạn đã đạt hạng Vàng (VIP) trong tháng này với ưu đãi giảm ${memberDiscountPercent}% cho mỗi đơn mới.`;
        }
        if (memberTier === 'SILVER') {
            return `Bạn đang ở hạng Bạc trong tháng này với ưu đãi giảm ${memberDiscountPercent}% cho mỗi đơn mới.`;
        }
        return `Bạn đang ở hạng Đồng trong tháng này với ưu đãi giảm ${memberDiscountPercent}% cho mỗi đơn mới.`;
    }, [memberTier, memberDiscountPercent]);

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
                            {[
                                { label: 'Bài đăng đang mở', value: isLoadingJobs ? '...' : dashboardStats.openCount, tone: 'warning' },
                                { label: 'Lịch sắp tới', value: isLoadingJobs ? '...' : dashboardStats.upcomingCount, tone: 'primary' },
                                { label: 'Đã hoàn thành tháng này', value: isLoadingJobs ? '...' : dashboardStats.completedThisMonthCount, tone: 'success' },
                            ].map((item) => (
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
                            <p className="cdh-promo-badge">Giảm {memberDiscountPercent}%</p>
                            <h3 className="cdh-promo-title">
                                Thành viên hạng {getTierLabel(memberTier)} đang được giảm {memberDiscountPercent}%
                            </h3>
                            <p className="cdh-promo-desc">
                                Ưu đãi hiển thị theo hạng thành viên hiện tại của bạn (BRONZE/SILVER/GOLD).
                            </p>
                            <button className="cdh-promo-btn" onClick={() => setShowMembershipModal(true)}>
                                Xem chi tiết
                            </button>
                        </div>
                    </div>
                </section>

                <section className="cdh-section">
                    <div className="cdh-section-header">
                        <h2 className="cdh-section-title">Bài đăng gần đây</h2>
                    </div>
                    <div className="cdh-recent-list">
                        {isLoadingJobs ? (
                            <div className="cdh-empty" style={{ gridColumn: 'auto' }}>
                                Đang tải bài đăng...
                            </div>
                        ) : jobsError ? (
                            <div className="cdh-empty cdh-empty-error">{jobsError}</div>
                        ) : dashboardStats.recentPosts.length === 0 ? (
                            <div className="cdh-empty">Chưa có bài đăng gần đây.</div>
                        ) : (
                            dashboardStats.recentPosts.map((post) => (
                                <article key={post.id} className="cdh-recent-item">
                                    <div>
                                        <p className="cdh-recent-title">{post.title}</p>
                                        <p className="cdh-recent-time">{post.time}</p>
                                    </div>
                                    <span className="cdh-recent-status">{post.status}</span>
                                </article>
                            ))
                        )}
                    </div>
                </section>

                {showMembershipModal ? (
                    <div className="cdh-modal-overlay" role="presentation" onClick={() => setShowMembershipModal(false)}>
                        <div
                            className="cdh-modal"
                            role="dialog"
                            aria-modal="true"
                            aria-label="Chi tiết hạng thành viên"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="cdh-modal-title">Hạng thành viên</h3>
                            <p className="cdh-modal-tier">{memberTier}</p>
                            <p className="cdh-modal-meta">
                                Đã hoàn thành {dashboardStats.completedThisMonthCount} đơn trong tháng này • Ưu đãi hiện tại {memberDiscountPercent}%
                            </p>
                            <p className="cdh-modal-message">{membershipMessage}</p>
                            <div className="cdh-modal-actions">
                                <button type="button" className="cdh-promo-btn" onClick={() => setShowMembershipModal(false)}>
                                    Đóng
                                </button>
                            </div>
                        </div>
                    </div>
                ) : null}

            </div>
        </CustomerLayout>
    );
};

export default CustomerDashboardPage;