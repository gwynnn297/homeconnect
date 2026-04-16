import React, { useState, useEffect, useCallback, useRef } from 'react';
import KYCModal from '../../components/KYCModal';
import HelperLayout from '../../layouts/HelperLayout';
import ProfileService from '../../services/ProfileService';
import './HelperDashboardPage.css';

/* ──────────────────────────────────────────
   Mock data (thay bằng API call sau)
────────────────────────────────────────── */
const MOCK_STATS = [
    { id: 1, label: 'Công việc tháng này', value: '12', unit: 'việc', trend: '+3 so với tháng trước', trendUp: true },
    { id: 2, label: 'Thu nhập tháng này', value: '4.200.000', unit: 'đ', trend: '+15% so với tháng trước', trendUp: true },
    { id: 3, label: 'Đánh giá trung bình', value: '4.8', unit: '/ 5', trend: 'Dựa trên 36 đánh giá', trendUp: true },
    { id: 4, label: 'Tỉ lệ hoàn thành', value: '97', unit: '%', trend: 'Rất xuất sắc', trendUp: true },
];

const MOCK_NEW_JOBS = [
    { id: 1, service: 'Dọn dẹp nhà', address: '45 Nguyễn Huệ, Q1, TP.HCM', date: '07/03/2026', time: '08:00 – 11:00', price: '250.000đ', tag: 'Mới' },
    { id: 2, service: 'Nấu ăn gia đình', address: '12 Lê Lợi, Bình Thạnh, TP.HCM', date: '08/03/2026', time: '16:00 – 18:00', price: '180.000đ', tag: 'Mới' },
    { id: 3, service: 'Vệ sinh văn phòng', address: '88 CMT8, Q3, TP.HCM', date: '09/03/2026', time: '07:00 – 10:00', price: '320.000đ', tag: 'Gấp' },
];

const MOCK_RECENT_JOBS = [
    { id: 1, service: 'Dọn dẹp nhà', customer: 'Minh Châu', date: '04/03/2026', status: 'Hoàn thành', rating: 5, price: '250.000đ' },
    { id: 2, service: 'Nấu ăn', customer: 'Bảo Ngọc', date: '02/03/2026', status: 'Hoàn thành', rating: 4, price: '180.000đ' },
    { id: 3, service: 'Làm vườn', customer: 'Thanh Tùng', date: '28/02/2026', status: 'Hoàn thành', rating: 5, price: '200.000đ' },
];

/* ──────────────────────────────────────────
   Sub-components
────────────────────────────────────────── */

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

/* ──────────────────────────────────────────
   Main Page
────────────────────────────────────────── */
const HelperDashboardPage = () => {
    const [showKYCModal, setShowKYCModal] = useState(false);
    const [kycStatus, setKycStatus] = useState(null);
    const [helperName, setHelperName] = useState('');
    const hasReloadedAfterApprove = useRef(false);

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
                    <p className="hdb-welcome-sub">Hôm nay bạn có <strong>3 công việc mới</strong> đang chờ nhận.</p>
                    <button className="hdb-welcome-btn">Xem việc làm mới &rsaquo;</button>
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
                {MOCK_STATS.map(s => <StatCard key={s.id} {...s} />)}
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
                        {MOCK_NEW_JOBS.map(job => (
                            <div key={job.id} className="hdb-job-card">
                                <div className="hdb-job-card-top">
                                    <div>
                                        <p className="hdb-job-service">
                                            {job.service}
                                            <JobTagBadge tag={job.tag} />
                                        </p>
                                        <p className="hdb-job-address">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                                strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                                <circle cx="12" cy="10" r="3" />
                                            </svg>
                                            {job.address}
                                        </p>
                                    </div>
                                    <span className="hdb-job-price">{job.price}</span>
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
                                            {job.date}
                                        </span>
                                        <span>
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                                strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="12" cy="12" r="10" />
                                                <polyline points="12 6 12 12 16 14" />
                                            </svg>
                                            {job.time}
                                        </span>
                                    </div>
                                    <button className="hdb-accept-btn">Nhận việc</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Recent activity */}
                <section className="hdb-section">
                    <div className="hdb-section-header">
                        <h2 className="hdb-section-title">Việc đã hoàn thành</h2>
                        <a className="hdb-section-link" href="/helper/my-jobs">Xem tất cả &rsaquo;</a>
                    </div>
                    <div className="hdb-recent-list">
                        {MOCK_RECENT_JOBS.map(job => (
                            <div key={job.id} className="hdb-recent-card">
                                <div className="hdb-recent-avatar">
                                    {job.customer.charAt(0)}
                                </div>
                                <div className="hdb-recent-info">
                                    <p className="hdb-recent-service">{job.service}</p>
                                    <p className="hdb-recent-customer">{job.customer} · {job.date}</p>
                                    <div className="hdb-recent-stars">
                                        {Array.from({ length: 5 }).map((_, i) => (
                                            <span key={i} className={i < job.rating ? 'star filled' : 'star'}>★</span>
                                        ))}
                                    </div>
                                </div>
                                <span className="hdb-recent-price">{job.price}</span>
                            </div>
                        ))}
                    </div>

                    {/* Mini earning chart placeholder */}
                    <div className="hdb-earning-summary">
                        <p className="hdb-earning-label">Tổng thu nhập tháng 3</p>
                        <p className="hdb-earning-amount">4.200.000 đ</p>
                        <div className="hdb-earning-bar-wrap">
                            <div className="hdb-earning-bar" style={{ width: '70%' }} />
                        </div>
                        <p className="hdb-earning-goal">Mục tiêu: 6.000.000 đ · Đạt 70%</p>
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