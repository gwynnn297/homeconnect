import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import KYCModal from '../../components/KYCModal';
import HelperLayout from '../../layouts/HelperLayout';
import ProfileService from '../../services/ProfileService';
import HelperJobService from '../../services/HelperJobService';
import WalletService from '../../services/WalletService';
import './HelperDashboardPage.css';

const StatCard = ({ label, value, unit, trend, trendUp }) => (
    <div className="hdb-stat-card">
        <p className="hdb-stat-label">{label}</p>
        <div className="hdb-stat-value-row">
            <span className="hdb-stat-value">{value}</span>
            <span className="hdb-stat-unit">{unit}</span>
        </div>
        <p className={`hdb-stat-trend ${trendUp ? 'up' : 'down'}`}>
            {trendUp ? '▲' : '▼'} {trend}
        </p>
    </div>
);

const JobTagBadge = ({ tag }) => (
    <span className={`hdb-job-tag ${tag === 'Gấp' ? 'urgent' : 'new'}`}>{tag}</span>
);

const extractPayload = (res) => (res && typeof res === 'object' && 'data' in res ? res.data : res);

const formatCurrencyVnd = (value) => {
    if (value === undefined || value === null || Number.isNaN(Number(value))) return 'N/A';
    return `${Number(value).toLocaleString('vi-VN')}đ`;
};

const formatWorkDate = (value) => {
    if (!value) return 'N/A';
    const [y, m, d] = String(value).split('-');
    if (y && m && d) return `${d}/${m}/${y}`;
    return String(value);
};

const buildLocationText = (job) =>
    [job?.addressDetail, job?.wardName, job?.districtName, job?.provinceName].filter(Boolean).join(', ') || 'N/A';

const isUnassignedJob = (job) => {
    const hasAssignedHelper = Boolean(
        job?.assignedHelperId ||
        job?.helperId ||
        job?.assignedHelper?.id
    );
    const hasBooking = Number(job?.bookingId) > 0;
    return !hasAssignedHelper && !hasBooking;
};

const isCompletedJob = (job) => String(job?.status || '').toUpperCase() === 'COMPLETED' || String(job?.bookingStatus || '').toUpperCase() === 'COMPLETED';
const MONTHLY_GOAL_VND = 6000000;

const HelperDashboardPage = () => {
    const navigate = useNavigate();
    const [showKYCModal, setShowKYCModal] = useState(false);
    const [kycStatus, setKycStatus] = useState(null);
    const [helperName, setHelperName] = useState('');
    const [newJobs, setNewJobs] = useState([]);
    const [completedJobs, setCompletedJobs] = useState([]);
    const [monthlyEarning, setMonthlyEarning] = useState(0);
    const hasReloadedAfterApprove = useRef(false);

    const [stats, setStats] = useState({
        jobsThisMonth: 0,
        jobsThisMonthTrend: 0,
        averageRating: '0.0',
        totalReviews: 0,
        completionRate: 100
    });

    const syncUserToLocalStorage = useCallback((basicProfile, helperProfile) => {
        try {
            const stored = JSON.parse(localStorage.getItem('user') || '{}');
            if (basicProfile?.fullName) stored.fullName = basicProfile.fullName;
            if (basicProfile?.name) stored.name = basicProfile.name;
            if (helperProfile?.kycStatus) stored.kycStatus = helperProfile.kycStatus;
            localStorage.setItem('user', JSON.stringify(stored));
        } catch {
            // ignore localStorage parsing/sync errors
        }
    }, []);

    const fetchLatestProfileStatus = useCallback(async () => {
        try {
            const [basicRes, helperRes] = await Promise.all([
                ProfileService.getMyProfile(),
                ProfileService.getHelperProfessionalProfile(),
            ]);

            const basic = basicRes?.data || {};
            const helper = helperRes?.data || {};
            const latestStatus = helper.kycStatus || 'PENDING';
            const latestName = basic.fullName || basic.name || 'Helper';

            setKycStatus(latestStatus);
            setHelperName(latestName.split(' ').slice(-2).join(' '));
            
            setStats(prev => ({
                ...prev,
                averageRating: Number(helper.ratingAverage || 0).toFixed(1),
                totalReviews: helper.totalReviews || 0
            }));

            syncUserToLocalStorage(basic, helper);
            return latestStatus;
        } catch (err) {
            console.error('[HelperDashboardPage] fetchLatestProfileStatus failed:', err);
            return null;
        }
    }, [syncUserToLocalStorage]);

    useEffect(() => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const status = user.kycStatus || 'PENDING';
        const name = user.fullName || user.name || 'Helper';
        setKycStatus(status);
        setHelperName(name.split(' ').slice(-2).join(' '));

        if (status === 'PENDING') {
            setShowKYCModal(true);
        }

        fetchLatestProfileStatus();
    }, [fetchLatestProfileStatus]);

    useEffect(() => {
        if (kycStatus !== 'WAITING_APPROVAL' && kycStatus !== 'IDENTITY_VERIFIED') return undefined;

        const poll = async () => {
            const latestStatus = await fetchLatestProfileStatus();
            if (
                latestStatus === 'VERIFIED' &&
                !hasReloadedAfterApprove.current
            ) {
                hasReloadedAfterApprove.current = true;
                window.location.reload();
            }
        };

        const intervalId = setInterval(poll, 5000);
        return () => clearInterval(intervalId);
    }, [kycStatus, fetchLatestProfileStatus]);

    useEffect(() => {
        let cancelled = false;

        const loadNewJobs = async () => {
            try {
                const res = await HelperJobService.getJobsByTab('NEW');
                const data = extractPayload(res);
                const jobs = Array.isArray(data) ? data : [];
                const latestUnassigned = jobs
                    .filter(isUnassignedJob)
                    .sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime())
                    .slice(0, 5);

                if (!cancelled) {
                    setNewJobs(latestUnassigned);
                }
            } catch (err) {
                console.error('[HelperDashboardPage] loadNewJobs failed:', err);
                if (!cancelled) {
                    setNewJobs([]);
                }
            }
        };

        if (kycStatus === 'VERIFIED') {
            loadNewJobs();
        }

        return () => { cancelled = true; };
    }, [kycStatus]);

    useEffect(() => {
        let cancelled = false;

        const loadMonthlyEarning = async () => {
            try {
                const firstRes = await WalletService.getTransactions({
                    page: 0,
                    size: 100,
                    sortBy: 'createdAt',
                    sortDir: 'desc'
                });
                const firstData = extractPayload(firstRes) || {};
                const totalPages = Number(firstData?.totalPages || 1);
                let allTransactions = Array.isArray(firstData?.transactions) ? firstData.transactions : [];

                if (totalPages > 1) {
                    const pageRequests = [];
                    for (let page = 1; page < Math.min(totalPages, 20); page += 1) {
                        pageRequests.push(
                            WalletService.getTransactions({
                                page,
                                size: 100,
                                sortBy: 'createdAt',
                                sortDir: 'desc'
                            })
                        );
                    }

                    if (pageRequests.length > 0) {
                        const pageResults = await Promise.all(pageRequests);
                        pageResults.forEach((res) => {
                            const data = extractPayload(res) || {};
                            const txs = Array.isArray(data?.transactions) ? data.transactions : [];
                            allTransactions = allTransactions.concat(txs);
                        });
                    }
                }

                const now = new Date();
                const currentMonth = now.getMonth();
                const currentYear = now.getFullYear();
                const monthIncome = allTransactions
                    .filter((tx) => String(tx?.type || '').toUpperCase() === 'RELEASE')
                    .filter((tx) => {
                        const d = tx?.createdAt ? new Date(tx.createdAt) : null;
                        return d && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
                    })
                    .reduce((sum, tx) => sum + Number(tx?.amount || 0), 0);

                if (!cancelled) {
                    setMonthlyEarning(monthIncome);
                }
            } catch (err) {
                console.error('[HelperDashboardPage] loadMonthlyEarning failed:', err);
                if (!cancelled) {
                    setMonthlyEarning(0);
                }
            }
        };

        if (kycStatus === 'VERIFIED') {
            loadMonthlyEarning();
        }

        return () => { cancelled = true; };
    }, [kycStatus]);

    useEffect(() => {
        let cancelled = false;

        const loadCompletedJobs = async () => {
            try {
                const res = await HelperJobService.getJobsByTab('CONFIRMED');
                const data = extractPayload(res);
                const jobs = Array.isArray(data) ? data : [];
                
                const now = new Date();
                const currentMonth = now.getMonth();
                const currentYear = now.getFullYear();

                let prevMonth = currentMonth - 1;
                let prevYear = currentYear;
                if (prevMonth < 0) {
                    prevMonth = 11;
                    prevYear--;
                }

                let completedThisMonthCount = 0;
                let completedPrevMonthCount = 0;

                const completedJobsList = jobs.filter(isCompletedJob);
                
                completedJobsList.forEach(job => {
                    const d = new Date(job.updatedAt || job.completedAt || job.workDate || job.createdAt || 0);
                    if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                        completedThisMonthCount++;
                    } else if (d.getMonth() === prevMonth && d.getFullYear() === prevYear) {
                        completedPrevMonthCount++;
                    }
                });

                if (!cancelled) {
                    setStats(prev => ({
                        ...prev,
                        jobsThisMonth: completedThisMonthCount,
                        jobsThisMonthTrend: completedThisMonthCount - completedPrevMonthCount,
                        completionRate: 100 // Tạm thời 100% khi chưa có API tính số đơn huỷ
                    }));
                }

                const latestCompleted = completedJobsList
                    .sort((a, b) => {
                        const aTime = new Date(a?.updatedAt || a?.completedAt || a?.workDate || a?.createdAt || 0).getTime();
                        const bTime = new Date(b?.updatedAt || b?.completedAt || b?.workDate || b?.createdAt || 0).getTime();
                        return bTime - aTime;
                    })
                    .slice(0, 5);

                if (!cancelled) {
                    setCompletedJobs(latestCompleted);
                }
            } catch (err) {
                console.error('[HelperDashboardPage] loadCompletedJobs failed:', err);
                if (!cancelled) {
                    setCompletedJobs([]);
                }
            }
        };

        if (kycStatus === 'VERIFIED') {
            loadCompletedJobs();
        }

        return () => { cancelled = true; };
    }, [kycStatus]);

    const handleKYCSuccess = () => {
        setShowKYCModal(false);
        setKycStatus('IDENTITY_VERIFIED');
    };

    const handleCloseKYC = () => {
        setShowKYCModal(false);
    };

    /* ── KYC Status Cards (PENDING / WAITING / REJECTED) ── */
    const renderKYCStatus = () => {
        switch (kycStatus) {
            case 'PENDING':
                return (
                    <div className="hdb-kyc-card">
                        <div className="hdb-kyc-icon pending">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#346252" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="8.5" cy="7" r="4" />
                                <path d="M20 8v6" /><path d="M23 11h-6" />
                            </svg>
                        </div>
                        <h2 className="hdb-kyc-title">Chưa xác minh danh tính</h2>
                        <p className="hdb-kyc-desc">
                            Bạn cần hoàn tất xác minh danh tính (KYC) để có thể nhận việc trên HomieConnect.
                        </p>
                        <button className="hdb-kyc-btn" onClick={() => setShowKYCModal(true)}>
                            Xác minh ngay
                        </button>
                    </div>
                );
            case 'WAITING_APPROVAL':
                return (
                    <div className="hdb-kyc-card">
                        <div className="hdb-kyc-icon waiting">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                            </svg>
                        </div>
                        <h2 className="hdb-kyc-title">Hồ sơ đang chờ duyệt</h2>
                        <p className="hdb-kyc-desc">
                            Hồ sơ KYC của bạn đã được gửi thành công và đang chờ Admin phê duyệt.
                            Bạn sẽ nhận được thông báo khi hồ sơ được xử lý.
                        </p>
                    </div>
                );
            case 'IDENTITY_VERIFIED':
                return (
                    <div className="hdb-kyc-card">
                        <div className="hdb-kyc-icon waiting">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0e7490" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 6L9 17l-5-5" />
                            </svg>
                        </div>
                        <h2 className="hdb-kyc-title">AI đã xác minh danh tính</h2>
                        <p className="hdb-kyc-desc">
                            Xác minh khuôn mặt thành công! Hồ sơ của bạn đang chờ Admin duyệt kỹ năng để chính thức nhận việc.
                        </p>
                    </div>
                );
            case 'REJECTED':
                return (
                    <div className="hdb-kyc-card">
                        <div className="hdb-kyc-icon rejected">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="15" y1="9" x2="9" y2="15" />
                                <line x1="9" y1="9" x2="15" y2="15" />
                            </svg>
                        </div>
                        <h2 className="hdb-kyc-title">Hồ sơ bị từ chối</h2>
                        <p className="hdb-kyc-desc">
                            Hồ sơ KYC của bạn đã bị từ chối. Vui lòng nộp lại hồ sơ với thông tin chính xác.
                        </p>
                        <button className="hdb-kyc-btn" onClick={() => setShowKYCModal(true)}>
                            Nộp lại hồ sơ
                        </button>
                    </div>
                );
            default:
                return null;
        }
    };

    /* ── Full Dashboard (VERIFIED) ── */
    const renderVerifiedDashboard = () => (
        <div className="hdb-dashboard">

            {/* Welcome banner */}
            <div className="hdb-welcome-banner">
                <div className="hdb-welcome-left">
                   
                    <h1 className="hdb-welcome-title">Chào mừng trở lại, {helperName}!</h1>
                    <p className="hdb-welcome-sub">Hôm nay bạn có <strong>{newJobs.length} công việc mới</strong> đang chờ nhận.</p>
                    <button className="hdb-welcome-btn" onClick={() => navigate('/helper/new-jobs')}>Xem việc làm mới &rsaquo;</button>
                </div>
                <div className="hdb-welcome-right">
                    <div className="hdb-welcome-illo">
                        <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5"
                            strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                            <polyline points="10 9 9 9 8 9" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* Stats row */}
            <div className="hdb-stats-grid">
                <StatCard 
                    label="Công việc tháng này" 
                    value={stats.jobsThisMonth.toString()} 
                    unit="việc" 
                    trend={stats.jobsThisMonthTrend > 0 ? `+${stats.jobsThisMonthTrend} so với tháng trước` : (stats.jobsThisMonthTrend < 0 ? `${stats.jobsThisMonthTrend} so với tháng trước` : `Bằng tháng trước`)} 
                    trendUp={stats.jobsThisMonthTrend >= 0} 
                />
                <StatCard 
                    label="Thu nhập tháng này" 
                    value={formatCurrencyVnd(monthlyEarning).replace('đ', '')} 
                    unit="đ" 
                    trend="Cập nhật tự động" 
                    trendUp={true} 
                />
                <StatCard 
                    label="Đánh giá trung bình" 
                    value={stats.averageRating.toString()} 
                    unit="/ 5" 
                    trend={stats.totalReviews > 0 ? `Dựa trên ${stats.totalReviews} đánh giá` : `Chưa có đánh giá`} 
                    trendUp={true} 
                />
                <StatCard 
                    label="Tỉ lệ hoàn thành" 
                    value={stats.completionRate.toString()} 
                    unit="%" 
                    trend="Rất xuất sắc" 
                    trendUp={true} 
                />
            </div>

            {/* Two-column: new jobs + recent */}
            <div className="hdb-two-col">

                {/* New jobs */}
                <section className="hdb-section hdb-new-jobs-section">
                    <div className="hdb-section-header">
                        <h2 className="hdb-section-title">Việc làm mới</h2>
                        <a className="hdb-section-link" href="/helper/new-jobs">Xem tất cả &rsaquo;</a>
                    </div>
                    <div className="hdb-new-jobs-list">
                        {newJobs.map(job => (
                            <div key={job.postId} className="hdb-job-card">
                                <div className="hdb-job-card-top">
                                    <div>
                                        <p className="hdb-job-service">
                                            {job.categoryName || job.serviceNames || job.title || 'Dịch vụ'}
                                            <JobTagBadge tag="Mới" />
                                        </p>
                                        <p className="hdb-job-address">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                                strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                                <circle cx="12" cy="10" r="3" />
                                            </svg>
                                            {buildLocationText(job)}
                                        </p>
                                    </div>
                                    <span className="hdb-job-price">{formatCurrencyVnd(job.offerPrice)}</span>
                                </div>
                                <div className="hdb-job-card-bottom">
                                    <div className="hdb-job-datetime">
                                        <span>
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                                strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                                <line x1="16" y1="2" x2="16" y2="6" />
                                                <line x1="8" y1="2" x2="8" y2="6" />
                                                <line x1="3" y1="10" x2="21" y2="10" />
                                            </svg>
                                            {formatWorkDate(job.workDate)}
                                        </span>
                                        <span>
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                                strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="12" cy="12" r="10" />
                                                <polyline points="12 6 12 12 16 14" />
                                            </svg>
                                            {job.startTime || 'N/A'}
                                        </span>
                                    </div>
                                    <button 
                                        className="hdb-accept-btn" 
                                        onClick={() => navigate('/helper/new-jobs', { state: { fromNotification: true, targetPostId: job.postId } })}
                                    >
                                        Nhận việc
                                    </button>
                                </div>
                            </div>
                        ))}
                        {newJobs.length === 0 && (
                            <div className="hdb-job-card">
                                <p className="hdb-job-service">Hiện chưa có việc làm mới chưa có người nhận.</p>
                            </div>
                        )}
                    </div>
                </section>

                {/* Recent activity */}
                <section className="hdb-section">
                    <div className="hdb-section-header">
                        <h2 className="hdb-section-title">Việc đã hoàn thành</h2>
                        <a className="hdb-section-link" href="/helper/my-jobs">Xem tất cả &rsaquo;</a>
                    </div>
                    <div className="hdb-recent-list">
                        {completedJobs.map(job => (
                            <div key={job.postId} className="hdb-recent-card">
                                <div className="hdb-recent-avatar">
                                    {(job.categoryName || job.serviceNames || 'C').charAt(0).toUpperCase()}
                                </div>
                                <div className="hdb-recent-info">
                                    <p className="hdb-recent-service">{job.categoryName || job.serviceNames || job.title || `Công việc #${job.postId}`}</p>
                                    <p className="hdb-recent-customer">Hoàn thành · {formatWorkDate(job.workDate)}</p>
                                    <div className="hdb-recent-stars">
                                        {Array.from({ length: 5 }).map((_, i) => (
                                            <span key={i} className="star filled">★</span>
                                        ))}
                                    </div>
                                </div>
                                <span className="hdb-recent-price">{formatCurrencyVnd(job.offerPrice)}</span>
                            </div>
                        ))}
                        {completedJobs.length === 0 && (
                            <div className="hdb-recent-card">
                                <div className="hdb-recent-info">
                                    <p className="hdb-recent-service">Chưa có công việc nào đã hoàn thành.</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Mini earning chart */}
                    <div className="hdb-earning-summary">
                        <p className="hdb-earning-label">Tổng thu nhập tháng {new Date().getMonth() + 1}</p>
                        <p className="hdb-earning-amount">{formatCurrencyVnd(monthlyEarning).replace('đ', ' đ')}</p>
                        <div className="hdb-earning-bar-wrap">
                            <div
                                className="hdb-earning-bar"
                                style={{ width: `${Math.min((monthlyEarning / MONTHLY_GOAL_VND) * 100, 100)}%` }}
                            />
                        </div>
                        <p className="hdb-earning-goal">
                            Mục tiêu: {formatCurrencyVnd(MONTHLY_GOAL_VND).replace('đ', ' đ')} · Đạt {Math.round(Math.min((monthlyEarning / MONTHLY_GOAL_VND) * 100, 100))}%
                        </p>
                    </div>
                </section>

            </div>
        </div>
    );

    return (
        <HelperLayout>
            <div className="hdb-wrapper">
                {kycStatus === 'VERIFIED' ? renderVerifiedDashboard() : renderKYCStatus()}
            </div>

            <KYCModal
                isOpen={showKYCModal}
                onClose={handleCloseKYC}
                onSuccess={handleKYCSuccess}
            />
        </HelperLayout>
    );
};

export default HelperDashboardPage;