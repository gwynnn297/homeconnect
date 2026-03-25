import React, { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import AdminService from '../../services/AdminService';
import './AdminDashboardPage.css';

const AdminDashboardPage = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        AdminService.getStatistics()
            .then((data) => {
                setStats(data);
            })
            .catch((err) => {
                setError(err.message || 'Không thể lấy dữ liệu thống kê');
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    const userStats = stats?.userStats || null;
    const helperStats = stats?.helperStats || null;
    const systemStats = stats?.systemStats || null;

    const kyc = useMemo(() => {
        const h = helperStats || {};
        const pendingKyc = Number(h.pendingKyc ?? 0);
        const waitingApproval = Number(h.waitingApproval ?? 0);
        const verified = Number(h.verifiedHelpers ?? 0);
        const rejected = Number(h.rejectedHelpers ?? 0);
        const total = pendingKyc + waitingApproval + verified + rejected;
        return { pendingKyc, waitingApproval, verified, rejected, total };
    }, [helperStats]);

    const totalLocations = Number(systemStats?.totalLocations ?? 0);
    const totalServices = Number(systemStats?.totalServices ?? 0);

    const formatNumber = (value) => {
        const n = Number(value ?? 0);
        return Number.isNaN(n) ? '0' : n.toLocaleString('vi-VN');
    };

    const KycProgress = ({ label, value, softClass }) => {
        const percent = kyc.total > 0 ? Math.round((Number(value) / kyc.total) * 100) : 0;
        return (
            <div className="progress-row">
                <div className="progress-meta">
                    <span className={`progress-pill ${softClass}`}>{label}</span>
                    <span className="progress-value">{formatNumber(value)}</span>
                </div>
                <div className="progress-track" aria-label={`${label}: ${percent}%`}>
                    <div
                        className={`progress-fill ${softClass}`}
                        style={{ width: `${percent}%` }}
                    />
                </div>
            </div>
        );
    };

    return (
        <AdminLayout>
            <div className="admin-dashboard">
                <section className="dashboard-hero">
                    <div className="hero-text">
                        <h1 className="hero-title">Dashboard Admin</h1>
                        <p className="hero-subtitle">
                            Tổng quan nhanh về người dùng, KYC helper và tình trạng hệ thống.
                        </p>
                    </div>

                    <div className="hero-actions">
                        <NavLink
                            to="/admin/helpers?status=WAITING_APPROVAL"
                            className="hero-btn hero-btn-primary"
                        >
                            Duyệt KYC
                            <span className="hero-btn-badge">
                                {formatNumber(kyc.waitingApproval)}
                            </span>
                        </NavLink>

                        <NavLink
                            to="/admin/services"
                            className="hero-btn hero-btn-secondary"
                        >
                            Dịch vụ &amp; Giá
                        </NavLink>
                    </div>
                </section>

                {loading && (
                    <section className="dashboard-skeleton">
                        <div className="sk-hero" />
                        <div className="sk-row">
                            <div className="sk-card" />
                            <div className="sk-card" />
                            <div className="sk-card" />
                            <div className="sk-card" />
                        </div>
                        <div className="sk-row">
                            <div className="sk-panel" />
                            <div className="sk-panel" />
                        </div>
                    </section>
                )}

                {!loading && error && (
                    <p className="error-message">{error}</p>
                )}

                {!loading && stats && (
                    <>
                        <section className="dashboard-panels">
                            <div className="panel panel-stats">
                                <div className="panel-header">
                                    <h2 className="panel-title">Thống kê người dùng</h2>
                                    <span className="panel-hint">Realtime từ API</span>
                                </div>

                                <div className="stats-cards">
                                    <div className="stat-card stat-card-soft">
                                        <span className="stat-label">Tổng user</span>
                                        <strong className="stat-value">{formatNumber(userStats?.totalUsers)}</strong>
                                    </div>
                                    <div className="stat-card stat-card-soft">
                                        <span className="stat-label">Khách hàng</span>
                                        <strong className="stat-value">{formatNumber(userStats?.totalCustomers)}</strong>
                                    </div>
                                    <div className="stat-card stat-card-soft">
                                        <span className="stat-label">Helpers</span>
                                        <strong className="stat-value">{formatNumber(userStats?.totalHelpers)}</strong>
                                    </div>
                                    <div className="stat-card stat-card-soft">
                                        <span className="stat-label">Admin</span>
                                        <strong className="stat-value">{formatNumber(userStats?.totalAdmins)}</strong>
                                    </div>
                                    <div className="stat-card stat-card-soft">
                                        <span className="stat-label">Hoạt động</span>
                                        <strong className="stat-value">{formatNumber(userStats?.activeUsers)}</strong>
                                    </div>
                                    <div className="stat-card stat-card-soft">
                                        <span className="stat-label">Bị khoá</span>
                                        <strong className="stat-value">{formatNumber(userStats?.blockedUsers)}</strong>
                                    </div>
                                </div>
                            </div>

                            <div className="panel panel-kyc">
                                <div className="panel-header">
                                    <h2 className="panel-title">Duyệt KYC</h2>
                                    <span className="panel-hint">
                                        Chờ duyệt: <strong>{formatNumber(kyc.waitingApproval)}</strong>
                                    </span>
                                </div>

                                <div className="progress-stack">
                                    <KycProgress
                                        label="Chưa nộp"
                                        value={kyc.pendingKyc}
                                        softClass="tone-warning"
                                    />
                                    <KycProgress
                                        label="Chờ duyệt"
                                        value={kyc.waitingApproval}
                                        softClass="tone-warning"
                                    />
                                    <KycProgress
                                        label="Đã xác minh"
                                        value={kyc.verified}
                                        softClass="tone-success"
                                    />
                                    <KycProgress
                                        label="Bị từ chối"
                                        value={kyc.rejected}
                                        softClass="tone-danger"
                                    />
                                </div>

                                <div className="panel-footer">
                                    <NavLink
                                        to="/admin/helpers?status=WAITING_APPROVAL"
                                        className="panel-link"
                                    >
                                        Xem danh sách KYC
                                    </NavLink>
                                </div>
                            </div>

                            <div className="panel panel-system">
                                <div className="panel-header">
                                    <h2 className="panel-title">Hệ thống</h2>
                                    <span className="panel-hint">Overview</span>
                                </div>

                                <div className="system-cards">
                                    <div className="stat-card stat-card-compact">
                                        <span className="stat-label">Tổng dịch vụ</span>
                                        <strong className="stat-value">{formatNumber(totalServices)}</strong>
                                    </div>
                                    <div className="stat-card stat-card-compact">
                                        <span className="stat-label">Tổng địa điểm</span>
                                        <strong className="stat-value">{formatNumber(totalLocations)}</strong>
                                    </div>
                                </div>

                                <div className="panel-footer">
                                    <NavLink to="/admin/services" className="panel-link">
                                        Quản lý danh mục &amp; giá
                                    </NavLink>
                                </div>
                            </div>
                        </section>

                        <section className="quick-actions">
                            <div className="panel-header quick-header">
                                <h2 className="panel-title">Truy cập nhanh</h2>
                                <span className="panel-hint">Menu admin mở rộng</span>
                            </div>

                            <div className="quick-grid">
                                <NavLink to="/admin/users" className="quick-tile">
                                    <span className="quick-title">Quản lý User</span>
                                    <span className="quick-sub">Role &amp; trạng thái</span>
                                </NavLink>
                                <NavLink to="/admin/helpers" className="quick-tile">
                                    <span className="quick-title">Quản lý Helper</span>
                                    <span className="quick-sub">KYC &amp; hồ sơ</span>
                                </NavLink>
                                <NavLink to="/admin/bookings" className="quick-tile">
                                    <span className="quick-title">Quản lý Booking</span>
                                    <span className="quick-sub">Lịch sử &amp; trạng thái</span>
                                </NavLink>
                                <NavLink to="/admin/wallet-transactions" className="quick-tile">
                                    <span className="quick-title">Ví &amp; Giao dịch</span>
                                    <span className="quick-sub">Nạp/giữ/thanh toán</span>
                                </NavLink>
                                <NavLink to="/admin/complaints" className="quick-tile">
                                    <span className="quick-title">Khiếu nại</span>
                                    <span className="quick-sub">Hoàn tiền (nếu có)</span>
                                </NavLink>
                                <NavLink to="/admin/reports" className="quick-tile">
                                    <span className="quick-title">Báo cáo</span>
                                    <span className="quick-sub">Thống kê tổng hợp</span>
                                </NavLink>
                            </div>
                        </section>
                    </>
                )}
            </div>
        </AdminLayout>
    );
};

export default AdminDashboardPage;
