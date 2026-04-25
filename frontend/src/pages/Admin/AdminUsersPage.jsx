import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import NotificationModal from '../../components/NotificationModal';
import AdminService from '../../services/AdminService';
import './AdminHelpersPage.css';
import './AdminUsersPage.css';

const ROLE_OPTIONS = [
    { value: '', label: 'Tất cả vai trò' },
    { value: 'CUSTOMER', label: 'Khách hàng' },
    { value: 'HELPER', label: 'Helper' },
    { value: 'ADMIN', label: 'Admin' },
];

const STATUS_OPTIONS = [
    { value: '', label: 'Tất cả trạng thái' },
    { value: 'PENDING_OTP', label: 'Chờ xác thực OTP' },
    { value: 'DRAFT', label: 'Đang điền hồ sơ' },
    { value: 'PROFILE_COMPLETED', label: 'Đã hoàn tất hồ sơ' },
    { value: 'PENDING_REVIEW', label: 'Chờ phê duyệt hồ sơ' },
    { value: 'ACTIVE', label: 'Đang hoạt động' },
    { value: 'BANNED', label: 'Bị khóa' },
    { value: 'SUSPENDED', label: 'Tạm đình chỉ' },
    { value: 'WITHDRAW_ONLY', label: 'Chỉ rút tiền' },
    { value: 'BLOCKED', label: 'Bị khóa' },
    { value: 'REJECTED', label: 'Bị từ chối hồ sơ' },
];

const fmtDate = (d) => (d ? new Date(d).toLocaleString('vi-VN') : '—');

const AdminUsersPage = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);

    const [role, setRole] = useState(searchParams.get('role') || '');
    const [status, setStatus] = useState(searchParams.get('status') || '');
    const [q, setQ] = useState(searchParams.get('q') || '');
    const [qInput, setQInput] = useState(searchParams.get('q') || '');
    const [page, setPage] = useState(Number(searchParams.get('page')) || 0);
    const [size, setSize] = useState(Number(searchParams.get('size')) || 20);
    const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'createdAt');
    const [sortDir, setSortDir] = useState(searchParams.get('sortDir') || 'desc');

    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);

    const syncUrl = useCallback(() => {
        const next = new URLSearchParams();
        if (role) next.set('role', role);
        if (status) next.set('status', status);
        if (q) next.set('q', q);
        if (page) next.set('page', String(page));
        if (size !== 20) next.set('size', String(size));
        if (sortBy !== 'createdAt') next.set('sortBy', sortBy);
        if (sortDir !== 'desc') next.set('sortDir', sortDir);
        setSearchParams(next, { replace: true });
    }, [role, status, q, page, size, sortBy, sortDir, setSearchParams]);

    useEffect(() => {
        syncUrl();
    }, [syncUrl]);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const params = { page, size, sortBy, sortDir };
            if (role) params.role = role;
            if (status) params.status = status;
            if (q.trim()) params.q = q.trim();
            const res = await AdminService.getUsers(params);
            setUsers(res.users || []);
            setTotalPages(res.totalPages ?? 0);
            setTotalElements(res.totalElements ?? 0);
        } catch (err) {
            const msg = err?.message || err?.error || 'Không thể tải danh sách người dùng';
            setToast({ type: 'error', message: msg });
            setUsers([]);
        } finally {
            setLoading(false);
        }
    }, [page, size, sortBy, sortDir, role, status, q]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const applySearch = (e) => {
        e?.preventDefault();
        setQ(qInput);
        setPage(0);
    };

    const roleLabel = (r) => ROLE_OPTIONS.find((o) => o.value === r)?.label || r;
    const statusLabel = (s) => STATUS_OPTIONS.find((o) => o.value === s)?.label || s;

    const badgeClass = (s) => {
        if (s === 'ACTIVE') return 'status-verified';
        if (s === 'BANNED' || s === 'SUSPENDED' || s === 'BLOCKED') return 'status-rejected';
        if (s === 'WITHDRAW_ONLY') return 'status-waiting';
        if (s === 'REJECTED') return 'status-rejected';
        return 'status-waiting';
    };

    return (
        <AdminLayout>
            <div className="admin-helpers-main admin-users-main">
                {toast && (
                    <NotificationModal
                        message={toast.message}
                        type={toast.type}
                        onClose={() => setToast(null)}
                    />
                )}

                <div className="page-header">
                    <h1>Quản lý User</h1>
                    <p>Tổng: {totalElements} tài khoản</p>
                </div>

                <form className="filter-section" onSubmit={applySearch}>
                    <div className="filter-group">
                        <label>Vai trò</label>
                        <select
                            value={role}
                            onChange={(e) => {
                                setRole(e.target.value);
                                setPage(0);
                            }}
                        >
                            {ROLE_OPTIONS.map((o) => (
                                <option key={o.value || 'all'} value={o.value}>
                                    {o.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="filter-group">
                        <label>Trạng thái tài khoản</label>
                        <select
                            value={status}
                            onChange={(e) => {
                                setStatus(e.target.value);
                                setPage(0);
                            }}
                        >
                            {STATUS_OPTIONS.map((o) => (
                                <option key={o.value || 'all-s'} value={o.value}>
                                    {o.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="filter-group filter-group-wide">
                        <label>Tìm kiếm (tên, email, SĐT)</label>
                        <div className="admin-users-search-row">
                            <input
                                type="search"
                                className="admin-users-search-input"
                                value={qInput}
                                onChange={(e) => setQInput(e.target.value)}
                                placeholder="Nhập và nhấn Tìm..."
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
                            <option value="createdAt">Ngày tạo</option>
                            <option value="updatedAt">Ngày cập nhật</option>
                            <option value="fullName">Họ tên</option>
                            <option value="email">Email</option>
                            <option value="phone">SĐT</option>
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

                {loading && <p className="text-center">Đang tải dữ liệu...</p>}

                {!loading && users.length > 0 && (
                    <div className="helpers-table-wrapper">
                        <table className="helpers-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Họ tên</th>
                                    <th>Email</th>
                                    <th>SĐT</th>
                                    <th>Vai trò</th>
                                    <th>Trạng thái</th>
                                    <th>Ngày tạo</th>
                                    <th>Hành động</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u) => (
                                    <tr key={u.userId}>
                                        <td>{u.userId}</td>
                                        <td>{u.fullName}</td>
                                        <td>{u.email}</td>
                                        <td>{u.phone}</td>
                                        <td>{roleLabel(u.role)}</td>
                                        <td>
                                            <span className={`status-badge ${badgeClass(u.status)}`}>
                                                {statusLabel(u.status)}
                                            </span>
                                        </td>
                                        <td>{fmtDate(u.createdAt)}</td>
                                        <td>
                                            <button
                                                type="button"
                                                className="btn-view-detail"
                                                onClick={() => navigate(`/admin/users/${u.userId}`)}
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

                {!loading && users.length === 0 && (
                    <p className="admin-users-empty">Không có người dùng phù hợp bộ lọc.</p>
                )}

                {!loading && totalPages > 1 && (
                    <div className="pagination-controls">
                        <button
                            type="button"
                            disabled={page <= 0}
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                        >
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

export default AdminUsersPage;
