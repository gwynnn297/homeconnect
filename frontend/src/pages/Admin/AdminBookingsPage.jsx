import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import NotificationModal from '../../components/NotificationModal';
import AdminService from '../../services/AdminService';
import './AdminHelpersPage.css';
import './AdminBookingsPage.css';

const STATUS_OPTIONS = [
    { value: '', label: 'Tất cả trạng thái' },
    { value: 'PENDING', label: 'Chờ xác nhận' },
    { value: 'PENDING_ACCEPTANCE', label: 'Chờ thợ phản hồi' },
    { value: 'CONFIRMED', label: 'Đã xác nhận' },
    { value: 'ARRIVED', label: 'Thợ đã đến' },
    { value: 'IN_PROGRESS', label: 'Đang làm' },
    { value: 'PENDING_COMPLETION', label: 'Chờ khách xác nhận xong' },
    { value: 'COMPLETED', label: 'Hoàn thành' },
    { value: 'CANCELLED', label: 'Đã hủy' },
    { value: 'EXPIRED', label: 'Hết hạn phản hồi' },
];

const STATUS_BADGE = {
    PENDING: 'status-waiting',
    PENDING_ACCEPTANCE: 'status-waiting',
    CONFIRMED: 'status-verified',
    ARRIVED: 'status-ai-verified',
    IN_PROGRESS: 'status-ai-verified',
    PENDING_COMPLETION: 'status-waiting',
    COMPLETED: 'status-verified',
    CANCELLED: 'status-rejected',
    EXPIRED: 'status-rejected',
};

const fmtDate = (d) => (d ? new Date(d).toLocaleString('vi-VN') : '—');
const fmtMoney = (n) =>
    n == null ? '—' : Number(n).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });

const AdminBookingsPage = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);

    const [status, setStatus] = useState(searchParams.get('status') || '');
    const [flaggedOnly, setFlaggedOnly] = useState(searchParams.get('flagged') === '1');
    const [q, setQ] = useState(searchParams.get('q') || '');
    const [qInput, setQInput] = useState(searchParams.get('q') || '');
    const [fromDate, setFromDate] = useState(searchParams.get('from') || '');
    const [toDate, setToDate] = useState(searchParams.get('to') || '');
    const [page, setPage] = useState(Number(searchParams.get('page')) || 0);
    const [size, setSize] = useState(Number(searchParams.get('size')) || 20);
    const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'scheduledStartTime');
    const [sortDir, setSortDir] = useState(searchParams.get('sortDir') || 'desc');

    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);

    const syncUrl = useCallback(() => {
        const next = new URLSearchParams();
        if (status) next.set('status', status);
        if (flaggedOnly) next.set('flagged', '1');
        if (q) next.set('q', q);
        if (fromDate) next.set('from', fromDate);
        if (toDate) next.set('to', toDate);
        if (page) next.set('page', String(page));
        if (size !== 20) next.set('size', String(size));
        if (sortBy !== 'scheduledStartTime') next.set('sortBy', sortBy);
        if (sortDir !== 'desc') next.set('sortDir', sortDir);
        setSearchParams(next, { replace: true });
    }, [status, flaggedOnly, q, fromDate, toDate, page, size, sortBy, sortDir, setSearchParams]);

    useEffect(() => {
        syncUrl();
    }, [syncUrl]);

    const buildParams = useCallback(() => {
        const params = { page, size, sortBy, sortDir };
        if (status) params.status = status;
        if (flaggedOnly) params.flaggedOnly = true;
        if (q.trim()) params.q = q.trim();
        if (fromDate) {
            params.scheduledFrom = `${fromDate}T00:00:00`;
        }
        if (toDate) {
            params.scheduledTo = `${toDate}T23:59:59`;
        }
        return params;
    }, [page, size, sortBy, sortDir, status, flaggedOnly, q, fromDate, toDate]);

    const fetchBookings = useCallback(async () => {
        setLoading(true);
        try {
            const res = await AdminService.getBookings(buildParams());
            setBookings(res.bookings || []);
            setTotalPages(res.totalPages ?? 0);
            setTotalElements(res.totalElements ?? 0);
        } catch (err) {
            setToast({ type: 'error', message: err?.message || 'Không tải được danh sách booking' });
            setBookings([]);
        } finally {
            setLoading(false);
        }
    }, [buildParams]);

    useEffect(() => {
        fetchBookings();
    }, [fetchBookings]);

    const applySearch = (e) => {
        e?.preventDefault();
        setQ(qInput);
        setPage(0);
    };

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
                    <h1>Quản lý Booking</h1>
                    <p>Tổng: {totalElements} đơn</p>
                </div>

                <form className="filter-section" onSubmit={applySearch}>
                    <div className="filter-group">
                        <label>Trạng thái</label>
                        <select
                            value={status}
                            onChange={(e) => {
                                setStatus(e.target.value);
                                setPage(0);
                            }}
                        >
                            {STATUS_OPTIONS.map((o) => (
                                <option key={o.value || 'all'} value={o.value}>
                                    {o.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="filter-group">
                        <label>Chỉ đơn bất thường</label>
                        <select
                            value={flaggedOnly ? '1' : '0'}
                            onChange={(e) => {
                                setFlaggedOnly(e.target.value === '1');
                                setPage(0);
                            }}
                        >
                            <option value="0">Không</option>
                            <option value="1">Có</option>
                        </select>
                    </div>
                    <div className="filter-group">
                        <label>Từ ngày làm</label>
                        <input
                            type="date"
                            className="admin-bookings-date"
                            value={fromDate}
                            onChange={(e) => {
                                setFromDate(e.target.value);
                                setPage(0);
                            }}
                        />
                    </div>
                    <div className="filter-group">
                        <label>Đến ngày làm</label>
                        <input
                            type="date"
                            className="admin-bookings-date"
                            value={toDate}
                            onChange={(e) => {
                                setToDate(e.target.value);
                                setPage(0);
                            }}
                        />
                    </div>
                    <div className="filter-group filter-group-wide">
                        <label>Tìm (mã đơn hoặc tên khách)</label>
                        <div className="admin-users-search-row">
                            <input
                                type="search"
                                className="admin-users-search-input"
                                value={qInput}
                                onChange={(e) => setQInput(e.target.value)}
                                placeholder="VD: 42 hoặc Nguyễn"
                            />
                            <button type="submit" className="admin-users-search-btn">
                                Tìm
                            </button>
                        </div>
                    </div>
                    <div className="filter-group">
                        <label>Sắp xếp</label>
                        <select
                            value={sortBy}
                            onChange={(e) => {
                                setSortBy(e.target.value);
                                setPage(0);
                            }}
                        >
                            <option value="scheduledStartTime">Giờ làm việc</option>
                            <option value="createdAt">Ngày tạo đơn</option>
                            <option value="totalPrice">Giá</option>
                            <option value="status">Trạng thái</option>
                        </select>
                    </div>
                    <div className="filter-group">
                        <label>Thứ tự</label>
                        <select
                            value={sortDir}
                            onChange={(e) => {
                                setSortDir(e.target.value);
                                setPage(0);
                            }}
                        >
                            <option value="desc">Mới nhất</option>
                            <option value="asc">Cũ nhất</option>
                        </select>
                    </div>
                    <div className="filter-group">
                        <label>Số dòng/trang</label>
                        <select
                            value={size}
                            onChange={(e) => {
                                setSize(Number(e.target.value));
                                setPage(0);
                            }}
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                        </select>
                    </div>
                </form>

                {loading && <p className="text-center">Đang tải...</p>}

                {!loading && bookings.length > 0 && (
                    <div className="helpers-table-wrapper">
                        <table className="helpers-table">
                            <thead>
                                <tr>
                                    <th>Mã</th>
                                    <th>Khách</th>
                                    <th>Helper</th>
                                    <th>Dịch vụ</th>
                                    <th>Giờ làm</th>
                                    <th>Giá</th>
                                    <th>TT</th>
                                    <th>Cờ</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {bookings.map((b) => (
                                    <tr key={b.bookingId}>
                                        <td>{b.bookingId}</td>
                                        <td>{b.customerName}</td>
                                        <td>{b.helperName}</td>
                                        <td>{b.serviceName}</td>
                                        <td>{fmtDate(b.scheduledStartTime)}</td>
                                        <td>{fmtMoney(b.totalPrice)}</td>
                                        <td>
                                            <span className={`status-badge ${STATUS_BADGE[b.status] || ''}`}>
                                                {STATUS_OPTIONS.find((o) => o.value === b.status)?.label || b.status}
                                            </span>
                                        </td>
                                        <td>{b.isFlagged ? '⚠️' : '—'}</td>
                                        <td>
                                            <button
                                                type="button"
                                                className="btn-view-detail"
                                                onClick={() => navigate(`/admin/bookings/${b.bookingId}`)}
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

                {!loading && bookings.length === 0 && (
                    <p className="admin-users-empty">Không có booking phù hợp.</p>
                )}

                {!loading && totalPages > 1 && (
                    <div className="pagination-controls">
                        <button type="button" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                            ← Trước
                        </button>
                        <span>
                            Trang {page + 1} / {totalPages}
                        </span>
                        <button
                            type="button"
                            disabled={page >= totalPages - 1}
                            onClick={() => setPage((p) => p + 1)}
                        >
                            Sau →
                        </button>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
};

export default AdminBookingsPage;
