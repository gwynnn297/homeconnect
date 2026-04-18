import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import NotificationModal from '../../components/NotificationModal';
import AdminService from '../../services/AdminService';
import ServiceManagerService from '../../services/ServiceManagerService';
import './AdminHelpersPage.css';
import './AdminBookingsPage.css';

const STATUS_OPTIONS = [
    { value: '', label: 'Tất cả trạng thái' },
    { value: 'PUBLISHED', label: 'Đang tìm thợ' },
    { value: 'ASSIGNED', label: 'Đã chốt thợ' },
    { value: 'COMPLETED', label: 'Hoàn thành' },
    { value: 'CANCELLED', label: 'Đã hủy' },
    { value: 'EXPIRED', label: 'Hết hạn' },
];

const STATUS_BADGE = {
    PUBLISHED: 'status-waiting',
    ASSIGNED: 'status-verified',
    COMPLETED: 'status-verified',
    CANCELLED: 'status-rejected',
    EXPIRED: 'status-rejected',
};

const fmtMoney = (n) =>
    n == null ? '—' : Number(n).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });

const fmtWorkDate = (wd) => {
    if (wd == null || wd === '') return '—';
    if (Array.isArray(wd)) {
        const [y, m, day] = wd;
        return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return String(wd);
};

const AdminJobPostsPage = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [posts, setPosts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);

    const [status, setStatus] = useState(searchParams.get('status') || '');
    const [categoryId, setCategoryId] = useState(searchParams.get('categoryId') || '');
    const [q, setQ] = useState(searchParams.get('q') || '');
    const [qInput, setQInput] = useState(searchParams.get('q') || '');
    const [fromDate, setFromDate] = useState(searchParams.get('from') || '');
    const [toDate, setToDate] = useState(searchParams.get('to') || '');
    const [page, setPage] = useState(Number(searchParams.get('page')) || 0);
    const [size, setSize] = useState(Number(searchParams.get('size')) || 20);
    const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'createdAt');
    const [sortDir, setSortDir] = useState(searchParams.get('sortDir') || 'desc');

    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);

    useEffect(() => {
        (async () => {
            try {
                const res = await ServiceManagerService.getParentCategories();
                const list = res?.data ?? res;
                const arr = Array.isArray(list) ? list : [];
                setCategories(
                    arr.map((c) => ({
                        categoryId: c?.categoryId ?? c?.category_id ?? c?.id,
                        name: c?.name ?? '',
                    })),
                );
            } catch {
                setCategories([]);
            }
        })();
    }, []);

    const syncUrl = useCallback(() => {
        const next = new URLSearchParams();
        if (status) next.set('status', status);
        if (categoryId) next.set('categoryId', categoryId);
        if (q) next.set('q', q);
        if (fromDate) next.set('from', fromDate);
        if (toDate) next.set('to', toDate);
        if (page) next.set('page', String(page));
        if (size !== 20) next.set('size', String(size));
        if (sortBy !== 'createdAt') next.set('sortBy', sortBy);
        if (sortDir !== 'desc') next.set('sortDir', sortDir);
        setSearchParams(next, { replace: true });
    }, [status, categoryId, q, fromDate, toDate, page, size, sortBy, sortDir, setSearchParams]);

    useEffect(() => {
        syncUrl();
    }, [syncUrl]);

    const buildParams = useCallback(() => {
        const params = { page, size, sortBy, sortDir };
        if (status) params.status = status;
        if (categoryId) params.categoryId = Number(categoryId);
        if (q.trim()) params.q = q.trim();
        if (fromDate) params.workDateFrom = fromDate;
        if (toDate) params.workDateTo = toDate;
        return params;
    }, [page, size, sortBy, sortDir, status, categoryId, q, fromDate, toDate]);

    const fetchPosts = useCallback(async () => {
        setLoading(true);
        try {
            const res = await AdminService.getJobPosts(buildParams());
            setPosts(res.posts || []);
            setTotalPages(res.totalPages ?? 0);
            setTotalElements(res.totalElements ?? 0);
        } catch (err) {
            setToast({ type: 'error', message: err?.message || 'Không tải được danh sách tin đăng' });
            setPosts([]);
        } finally {
            setLoading(false);
        }
    }, [buildParams]);

    useEffect(() => {
        fetchPosts();
    }, [fetchPosts]);

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
                    <h1>Quản lý tin đăng</h1>
                    <p>Tổng: {totalElements} tin (chợ việc)</p>
                </div>

                <form className="filter-section" onSubmit={applySearch}>
                    <div className="filter-group">
                        <label>Trạng thái tin</label>
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
                        <label>Danh mục</label>
                        <select
                            value={categoryId}
                            onChange={(e) => {
                                setCategoryId(e.target.value);
                                setPage(0);
                            }}
                        >
                            <option value="">Tất cả</option>
                            {categories.map((c) => (
                                <option key={c.categoryId} value={String(c.categoryId)}>
                                    {c.name}
                                </option>
                            ))}
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
                        <label>Tìm (mã tin, tiêu đề, khách)</label>
                        <div className="admin-users-search-row">
                            <input
                                type="search"
                                className="admin-users-search-input"
                                value={qInput}
                                onChange={(e) => setQInput(e.target.value)}
                                placeholder="VD: 12 hoặc tiêu đề / email"
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
                            <option value="createdAt">Ngày đăng tin</option>
                            <option value="workDate">Ngày làm việc</option>
                            <option value="offerPrice">Giá đề xuất</option>
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

                {!loading && posts.length > 0 && (
                    <div className="helpers-table-wrapper">
                        <table className="helpers-table">
                            <thead>
                                <tr>
                                    <th>Mã tin</th>
                                    <th>Khách</th>
                                    <th>Tiêu đề</th>
                                    <th>Danh mục</th>
                                    <th>Ngày làm</th>
                                    <th>Quận</th>
                                    <th>Giá</th>
                                    <th>TT</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {posts.map((p) => (
                                    <tr key={p.postId}>
                                        <td>{p.postId}</td>
                                        <td>{p.customerName}</td>
                                        <td>{p.title || '—'}</td>
                                        <td>{p.categoryName || '—'}</td>
                                        <td>
                                            {fmtWorkDate(p.workDate)}
                                            {p.startTime ? ` · ${String(p.startTime).slice(0, 5)}` : ''}
                                        </td>
                                        <td>{p.districtName || '—'}</td>
                                        <td>{fmtMoney(p.offerPrice)}</td>
                                        <td>
                                            <span className={`status-badge ${STATUS_BADGE[p.status] || ''}`}>
                                                {STATUS_OPTIONS.find((o) => o.value === p.status)?.label || p.status}
                                            </span>
                                        </td>
                                        <td>
                                            <button
                                                type="button"
                                                className="btn-view-detail"
                                                onClick={() => navigate(`/admin/job-posts/${p.postId}`)}
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

                {!loading && posts.length === 0 && (
                    <p className="admin-users-empty">Không có tin đăng phù hợp.</p>
                )}

                {!loading && totalPages > 1 && (
                    <div className="pagination-controls">
                        <button type="button" disabled={page <= 0} onClick={() => setPage((x) => Math.max(0, x - 1))}>
                            ← Trước
                        </button>
                        <span>
                            Trang {page + 1} / {totalPages}
                        </span>
                        <button
                            type="button"
                            disabled={page >= totalPages - 1}
                            onClick={() => setPage((x) => x + 1)}
                        >
                            Sau →
                        </button>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
};

export default AdminJobPostsPage;
