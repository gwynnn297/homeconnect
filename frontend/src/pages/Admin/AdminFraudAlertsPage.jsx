import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import NotificationModal from '../../components/NotificationModal';
import AdminService from '../../services/AdminService';
import './AdminHelpersPage.css';
import './AdminBookingsPage.css';

const formatDate = (value) => (value ? new Date(value).toLocaleString('vi-VN') : '—');
const formatMoney = (value) =>
    value == null ? '—' : Number(value).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });

const AdminFraudAlertsPage = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState(null);
    const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
    const [limit, setLimit] = useState(Number(searchParams.get('limit')) || 10);
    const [totalPages, setTotalPages] = useState(0);
    const [totalRecords, setTotalRecords] = useState(0);

    const fetchAlerts = useCallback(async () => {
        setLoading(true);
        try {
            const res = await AdminService.getFraudAlerts({ page, limit });
            setAlerts(Array.isArray(res?.data) ? res.data : []);
            setTotalPages(Number(res?.total_pages || 0));
            setTotalRecords(Number(res?.total_records || 0));
        } catch (error) {
            setToast({ type: 'error', message: error?.message || 'Không thể tải danh sách cảnh báo' });
            setAlerts([]);
        } finally {
            setLoading(false);
        }
    }, [page, limit]);

    useEffect(() => {
        const next = new URLSearchParams();
        if (page !== 1) next.set('page', String(page));
        if (limit !== 10) next.set('limit', String(limit));
        setSearchParams(next, { replace: true });
    }, [page, limit, setSearchParams]);

    useEffect(() => {
        fetchAlerts();
    }, [fetchAlerts]);

    const pageNumbers = Array.from({ length: totalPages }, (_, idx) => idx + 1);

    return (
        <AdminLayout>
            <div className="admin-helpers-main admin-bookings-page">
                {toast && (
                    <NotificationModal
                        message={toast.message}
                        type={toast.type}
                        onClose={() => setToast(null)}
                    />
                )}
                <div className="page-header">
                    <h1>Cảnh báo gian lận</h1>
                    <p>Tổng: {totalRecords} cảnh báo</p>
                </div>

                <div className="filter-section">
                    <div className="filter-group">
                        <label>Số dòng/trang</label>
                        <select
                            value={limit}
                            onChange={(e) => {
                                setLimit(Number(e.target.value));
                                setPage(1);
                            }}
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                        </select>
                    </div>
                </div>

                {loading && <p className="text-center">Đang tải...</p>}

                {!loading && alerts.length > 0 && (
                    <div className="helpers-table-wrapper">
                        <table className="helpers-table">
                            <thead>
                                <tr>
                                    <th>Mã đơn</th>
                                    <th>Khách hàng</th>
                                    <th>Helper</th>
                                    <th>Dịch vụ</th>
                                    <th>Trạng thái</th>
                                    <th>Giá</th>
                                    <th>Giờ làm</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {alerts.map((item) => (
                                    <tr key={item.bookingId}>
                                        <td>{item.bookingId}</td>
                                        <td>{item.customerName}</td>
                                        <td>{item.helperName}</td>
                                        <td>{item.serviceName}</td>
                                        <td>{item.status || '—'}</td>
                                        <td>{formatMoney(item.totalPrice)}</td>
                                        <td>{formatDate(item.scheduledStartTime)}</td>
                                        <td>
                                            <button
                                                type="button"
                                                className="btn-view-detail"
                                                onClick={() => navigate(`/admin/bookings/${item.bookingId}`)}
                                            >
                                                Chi tiết
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {!loading && alerts.length === 0 && (
                    <p className="admin-users-empty">Không có cảnh báo gian lận.</p>
                )}

                {!loading && totalPages > 1 && (
                    <div className="pagination-controls">
                        <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                            &lt; Trang trước
                        </button>
                        {pageNumbers.map((p) => (
                            <button
                                key={p}
                                type="button"
                                className={p === page ? 'active' : ''}
                                onClick={() => setPage(p)}
                            >
                                {p}
                            </button>
                        ))}
                        <button
                            type="button"
                            disabled={page >= totalPages}
                            onClick={() => setPage((p) => p + 1)}
                        >
                            Trang sau &gt;
                        </button>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
};

export default AdminFraudAlertsPage;
