import React, { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import AdminService from '../../services/AdminService';
import {
    BOOKING_STATUS_LABELS,
    JOB_POST_STATUS_LABELS,
    PAYMENT_STATUS_LABELS,
    WITHDRAW_STATUS_LABELS,
} from '../../constants/adminStatisticsLabels';
import './AdminReportsPage.css';

const formatNumber = (value) => {
    const n = Number(value ?? 0);
    return Number.isNaN(n) ? '0' : n.toLocaleString('vi-VN');
};

const formatMoney = (value) => {
    if (value == null || value === '') return '—';
    const n = Number(value);
    if (Number.isNaN(n)) return '—';
    return n.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
};

const CHART_COLORS = ['#2f5d50', '#4a8a76', '#f59e0b', '#ef4444', '#6366f1', '#06b6d4', '#f97316', '#84cc16'];

const PieChartCard = ({ map, labels, emptyHint }) => {
    const entries = Object.entries(map || {})
        .map(([key, raw]) => ({ key, value: Number(raw || 0) }))
        .filter((x) => x.value > 0)
        .sort((a, b) => b.value - a.value);

    if (entries.length === 0) {
        return <p className="admin-reports-empty">{emptyHint}</p>;
    }

    const total = entries.reduce((acc, x) => acc + x.value, 0);
    let current = 0;
    const slices = entries.map((x, idx) => {
        const start = current;
        const percent = total > 0 ? (x.value / total) * 100 : 0;
        current += percent;
        return {
            ...x,
            start,
            end: current,
            color: CHART_COLORS[idx % CHART_COLORS.length],
            percent: Math.round(percent * 10) / 10,
            label: labels[x.key] || x.key,
        };
    });

    const conic = slices
        .map((s) => `${s.color} ${s.start.toFixed(2)}% ${s.end.toFixed(2)}%`)
        .join(', ');

    return (
        <div className="pie-layout">
            <div className="pie-wrap">
                <div
                    className="pie-chart"
                    style={{ background: `conic-gradient(${conic})` }}
                    role="img"
                    aria-label="Biểu đồ tròn thống kê"
                >
                    <div className="pie-hole">
                        <span className="pie-total-label">Tổng</span>
                        <strong className="pie-total-value">{formatNumber(total)}</strong>
                    </div>
                </div>
            </div>
            <div className="pie-legend">
                {slices.map((s) => (
                    <div className="pie-legend-item" key={s.key}>
                        <span className="pie-dot" style={{ backgroundColor: s.color }} />
                        <span className="pie-item-label">{s.label}</span>
                        <span className="pie-item-value">
                            {formatNumber(s.value)} ({s.percent}%)
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const AdminReportsPage = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        AdminService.getStatistics()
            .then((data) => setStats(data))
            .catch((err) => setError(err.message || 'Không tải được thống kê'))
            .finally(() => setLoading(false));
    }, []);

    const booking = stats?.booking;
    const jobPost = stats?.jobPost;
    const marketplace = stats?.marketplace;
    const finance = stats?.finance;

    const convRate = useMemo(() => {
        const total = Number(booking?.totalBookings ?? 0);
        const completed = Number(booking?.countByStatus?.COMPLETED ?? 0);
        if (total <= 0) return null;
        return Math.round((completed / total) * 1000) / 10;
    }, [booking]);

    const cancelRate = useMemo(() => {
        const total = Number(booking?.totalBookings ?? 0);
        const cancelled = Number(booking?.countByStatus?.CANCELLED ?? 0);
        if (total <= 0) return null;
        return Math.round((cancelled / total) * 1000) / 10;
    }, [booking]);

    return (
        <AdminLayout>
            <div className="admin-reports">
                <header className="admin-reports-hero">
                    <div>
                        <h1 className="admin-reports-title">Báo cáo &amp; Thống kê</h1>
                        <p className="admin-reports-sub">
                            Số liệu tổng hợp theo trạng thái thực tế trong database (snapshot). Để xem chi tiết từng đơn
                            hoặc tin, dùng các trang quản lý tương ứng.
                        </p>
                    </div>
                    <NavLink to="/admin/dashboard" className="admin-reports-back">
                        ← Dashboard
                    </NavLink>
                </header>

                {loading && <p className="admin-reports-loading">Đang tải dữ liệu…</p>}
                {!loading && error && <p className="error-message">{error}</p>}

                {!loading && stats && (
                    <>
                        <section className="admin-reports-grid">
                            <article className="report-card">
                                <h2 className="report-card-title">Người dùng</h2>
                                <dl className="report-dl">
                                    <div>
                                        <dt>Tổng user</dt>
                                        <dd>{formatNumber(stats.userStats?.totalUsers)}</dd>
                                    </div>
                                    <div>
                                        <dt>Khách / Helper / Admin</dt>
                                        <dd>
                                            {formatNumber(stats.userStats?.totalCustomers)} /{' '}
                                            {formatNumber(stats.userStats?.totalHelpers)} /{' '}
                                            {formatNumber(stats.userStats?.totalAdmins)}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt>Hoạt động / Bị khóa</dt>
                                        <dd>
                                            {formatNumber(stats.userStats?.activeUsers)} /{' '}
                                            {formatNumber(stats.userStats?.blockedUsers)}
                                        </dd>
                                    </div>
                                </dl>
                                <NavLink to="/admin/users" className="report-link">
                                    Quản lý user →
                                </NavLink>
                            </article>

                            <article className="report-card">
                                <h2 className="report-card-title">Helper &amp; KYC</h2>
                                <dl className="report-dl">
                                    <div>
                                        <dt>Chưa nộp / Chờ duyệt</dt>
                                        <dd>
                                            {formatNumber(stats.helperStats?.pendingKyc)} /{' '}
                                            {formatNumber(stats.helperStats?.waitingApproval)}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt>Đã xác minh / Từ chối</dt>
                                        <dd>
                                            {formatNumber(stats.helperStats?.verifiedHelpers)} /{' '}
                                            {formatNumber(stats.helperStats?.rejectedHelpers)}
                                        </dd>
                                    </div>
                                </dl>
                                <NavLink to="/admin/helpers?status=WAITING_APPROVAL" className="report-link">
                                    Hàng chờ KYC →
                                </NavLink>
                            </article>

                            <article className="report-card">
                                <h2 className="report-card-title">Cấu hình hệ thống</h2>
                                <dl className="report-dl">
                                    <div>
                                        <dt>Dịch vụ con</dt>
                                        <dd>{formatNumber(stats.systemStats?.totalServices)}</dd>
                                    </div>
                                    <div>
                                        <dt>Danh mục cha</dt>
                                        <dd>{formatNumber(stats.systemStats?.totalCategories)}</dd>
                                    </div>
                                    <div>
                                        <dt>Địa chỉ đã lưu</dt>
                                        <dd>{formatNumber(stats.systemStats?.totalAddresses)}</dd>
                                    </div>
                                </dl>
                                <NavLink to="/admin/services" className="report-link">
                                    Danh mục &amp; giá →
                                </NavLink>
                            </article>
                        </section>

                        <section className="admin-reports-wide">
                            <h2 className="report-section-title">Booking</h2>
                            <p className="report-section-hint">
                                Tỷ lệ hoàn thành = COMPLETED / tổng đơn. Tỷ lệ hủy = CANCELLED / tổng đơn (tham khảo vận
                                hành).
                            </p>
                            <div className="report-kpi-row">
                                <div className="report-kpi">
                                    <span className="report-kpi-label">Tổng đơn</span>
                                    <strong className="report-kpi-value">{formatNumber(booking?.totalBookings)}</strong>
                                </div>
                                <div className="report-kpi">
                                    <span className="report-kpi-label">Cờ bất thường</span>
                                    <strong className="report-kpi-value report-kpi-warn">
                                        {formatNumber(booking?.flaggedBookings)}
                                    </strong>
                                </div>
                                <div className="report-kpi">
                                    <span className="report-kpi-label">Hoàn thành (%)</span>
                                    <strong className="report-kpi-value">{convRate != null ? `${convRate}%` : '—'}</strong>
                                </div>
                                <div className="report-kpi">
                                    <span className="report-kpi-label">Hủy (%)</span>
                                    <strong className="report-kpi-value">{cancelRate != null ? `${cancelRate}%` : '—'}</strong>
                                </div>
                            </div>
                            <div className="report-two-col">
                                <div>
                                    <h3 className="report-h3">Theo trạng thái đơn</h3>
                                    <PieChartCard
                                        map={booking?.countByStatus}
                                        labels={BOOKING_STATUS_LABELS}
                                        emptyHint="Chưa có booking."
                                    />
                                </div>
                                <div>
                                    <h3 className="report-h3">Theo thanh toán</h3>
                                    <PieChartCard
                                        map={booking?.countByPaymentStatus}
                                        labels={PAYMENT_STATUS_LABELS}
                                        emptyHint="Chưa có dữ liệu thanh toán."
                                    />
                                </div>
                            </div>
                            <NavLink to="/admin/bookings" className="report-link report-link-block">
                                Mở quản lý booking →
                            </NavLink>
                        </section>

                        <section className="admin-reports-wide">
                            <h2 className="report-section-title">Chợ việc (tin đăng)</h2>
                            <div className="report-kpi-row">
                                <div className="report-kpi">
                                    <span className="report-kpi-label">Tổng tin</span>
                                    <strong className="report-kpi-value">{formatNumber(jobPost?.totalPosts)}</strong>
                                </div>
                                <div className="report-kpi">
                                    <span className="report-kpi-label">Ứng tuyển chờ (PENDING)</span>
                                    <strong className="report-kpi-value">
                                        {formatNumber(marketplace?.pendingJobApplications)}
                                    </strong>
                                </div>
                            </div>
                            <h3 className="report-h3">Theo trạng thái tin</h3>
                            <PieChartCard
                                map={jobPost?.countByStatus}
                                labels={JOB_POST_STATUS_LABELS}
                                emptyHint="Chưa có tin đăng."
                            />
                            <NavLink to="/admin/job-posts" className="report-link report-link-block">
                                Quản lý tin đăng →
                            </NavLink>
                        </section>

                        <section className="admin-reports-wide">
                            <h2 className="report-section-title">Tài chính &amp; rút tiền</h2>
                            <p className="report-section-hint">
                                Số tiền là tổng trên toàn bộ ví trong hệ thống (khách + thợ + admin nếu có ví).
                            </p>
                            <div className="report-kpi-row report-kpi-money">
                                <div className="report-kpi">
                                    <span className="report-kpi-label">Số ví</span>
                                    <strong className="report-kpi-value">{formatNumber(finance?.totalWallets)}</strong>
                                </div>
                                <div className="report-kpi">
                                    <span className="report-kpi-label">Tổng khả dụng</span>
                                    <strong className="report-kpi-value">{formatMoney(finance?.sumAvailableBalance)}</strong>
                                </div>
                                <div className="report-kpi">
                                    <span className="report-kpi-label">Tổng đang giữ (hold)</span>
                                    <strong className="report-kpi-value">{formatMoney(finance?.sumHoldBalance)}</strong>
                                </div>
                                <div className="report-kpi">
                                    <span className="report-kpi-label">Tổng nợ sàn</span>
                                    <strong className="report-kpi-value">{formatMoney(finance?.sumDebtBalance)}</strong>
                                </div>
                            </div>
                            <h3 className="report-h3">Yêu cầu rút tiền theo trạng thái</h3>
                            <PieChartCard
                                map={finance?.withdrawCountByStatus}
                                labels={WITHDRAW_STATUS_LABELS}
                                emptyHint="Chưa có yêu cầu rút tiền."
                            />
                            <div className="report-link-row">
                                <NavLink to="/admin/wallet-transactions" className="report-link">
                                    Giao dịch ví →
                                </NavLink>
                                <NavLink to="/admin/withdrawals" className="report-link">
                                    Duyệt rút tiền →
                                </NavLink>
                            </div>
                        </section>
                    </>
                )}
            </div>
        </AdminLayout>
    );
};

export default AdminReportsPage;
