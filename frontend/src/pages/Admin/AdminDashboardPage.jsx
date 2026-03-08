import React, { useState, useEffect } from 'react';
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

    const renderUserStats = () => {
        if (!stats?.userStats) return null;
        const u = stats.userStats;
        return (
            <div className="stat-section">
                <h3>Thống kê người dùng</h3>
                <div className="stat-grid">
                    <div className="stat-card">
                        <span>Tổng user</span>
                        <strong>{u.totalUsers}</strong>
                    </div>
                    <div className="stat-card">
                        <span>Khách hàng</span>
                        <strong>{u.totalCustomers}</strong>
                    </div>
                    <div className="stat-card">
                        <span>Người giúp việc</span>
                        <strong>{u.totalHelpers}</strong>
                    </div>
                    <div className="stat-card">
                        <span>Admin</span>
                        <strong>{u.totalAdmins}</strong>
                    </div>
                    <div className="stat-card">
                        <span>Hoạt động</span>
                        <strong>{u.activeUsers}</strong>
                    </div>
                    <div className="stat-card">
                        <span>Bị khoá</span>
                        <strong>{u.blockedUsers}</strong>
                    </div>
                </div>
            </div>
        );
    };

    const renderHelperStats = () => {
        if (!stats?.helperStats) return null;
        const h = stats.helperStats;
        return (
            <div className="stat-section">
                <h3>Thống kê người giúp việc</h3>
                <div className="stat-grid">
                    <div className="stat-card">
                        <span>Tổng helpers</span>
                        <strong>{h.totalHelpers}</strong>
                    </div>
                    <div className="stat-card">
                        <span>Pending KYC</span>
                        <strong>{h.pendingKyc}</strong>
                    </div>
                    <div className="stat-card">
                        <span>Chờ duyệt</span>
                        <strong>{h.waitingApproval}</strong>
                    </div>
                    <div className="stat-card">
                        <span>Đã xác minh</span>
                        <strong>{h.verifiedHelpers}</strong>
                    </div>
                    <div className="stat-card">
                        <span>Bị từ chối</span>
                        <strong>{h.rejectedHelpers}</strong>
                    </div>
                </div>
            </div>
        );
    };

    const renderSystemStats = () => {
        if (!stats?.systemStats) return null;
        const s = stats.systemStats;
        return (
            <div className="stat-section">
                <h3>Thống kê hệ thống</h3>
                <div className="stat-grid">
                    <div className="stat-card">
                        <span>Tổng dịch vụ</span>
                        <strong>{s.totalServices}</strong>
                    </div>
                    <div className="stat-card">
                        <span>Tổng địa điểm</span>
                        <strong>{s.totalLocations}</strong>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <AdminLayout>
            <div className="admin-dashboard-main">
                <h1 className="admin-page-title">Dashboard - Thống kê hệ thống</h1>
                {loading && <p>Đang tải dữ liệu...</p>}
                {error && <p className="error-message">{error}</p>}
                {!loading && stats && (
                    <>
                        {renderUserStats()}
                        {renderHelperStats()}
                        {renderSystemStats()}
                    </>
                )}
            </div>
        </AdminLayout>
    );
};

export default AdminDashboardPage;
