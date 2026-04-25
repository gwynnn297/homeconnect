import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import NotificationModal from '../../components/NotificationModal';
import AdminService from '../../services/AdminService';
import './AdminHelperDetailPage.css';
import './AdminUserDetailPage.css';

const ROLE_LABEL = {
    CUSTOMER: 'Khách hàng',
    HELPER: 'Helper',
    ADMIN: 'Quản trị viên',
};

const STATUS_LABEL = {
    PENDING_OTP: 'Chờ xác thực OTP',
    DRAFT: 'Đang điền hồ sơ',
    PROFILE_COMPLETED: 'Đã hoàn tất hồ sơ',
    PENDING_REVIEW: 'Chờ phê duyệt hồ sơ',
    ACTIVE: 'Đang hoạt động',
    BANNED: 'Bị khóa',
    SUSPENDED: 'Tạm đình chỉ',
    WITHDRAW_ONLY: 'Chỉ rút tiền',
    BLOCKED: 'Bị khóa',
    REJECTED: 'Bị từ chối hồ sơ',
};

const KYC_LABEL = {
    PENDING: 'Chưa nộp',
    WAITING_APPROVAL: 'Chờ duyệt',
    IDENTITY_VERIFIED: 'AI Verified',
    VERIFIED: 'Đã xác minh',
    REJECTED: 'Bị từ chối',
};

const fmtDate = (d) => (d ? new Date(d).toLocaleString('vi-VN') : '—');

const fmtMoney = (n) => {
    if (n == null || n === '') return '—';
    const num = Number(n);
    if (Number.isNaN(num)) return '—';
    return num.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
};

const BackToListButton = ({ onClick, label = 'Quay lại danh sách User' }) => (
    <button type="button" className="admin-back-btn" onClick={onClick}>
        <span className="admin-back-btn-icon" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
        </span>
        <span className="admin-back-btn-text">{label}</span>
    </button>
);

const AdminUserDetailPage = () => {
    const { userId } = useParams();
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [showBlockModal, setShowBlockModal] = useState(false);
    const [blockReason, setBlockReason] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await AdminService.getAdminUserDetail(userId);
            setUser(data);
        } catch (err) {
            const msg = err?.message || err?.error || 'Không tải được thông tin người dùng';
            setToast({ type: 'error', message: msg });
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        load();
    }, [load]);

    const errMsg = (err) => err?.message || err?.error || 'Thao tác thất bại';

    const handleUnblock = async () => {
        if (!window.confirm('Mở khóa tài khoản này? Người dùng có thể đăng nhập lại.')) return;
        setActionLoading(true);
        try {
            const res = await AdminService.updateUserStatus(userId, { status: 'ACTIVE' });
            setToast({ type: 'success', message: res?.message || 'Đã mở khóa tài khoản' });
            await load();
        } catch (err) {
            setToast({ type: 'error', message: errMsg(err) });
        } finally {
            setActionLoading(false);
        }
    };

    const handleBlockConfirm = async () => {
        setActionLoading(true);
        try {
            const res = await AdminService.updateUserStatus(userId, {
                status: 'BANNED',
                reason: blockReason.trim() || undefined,
            });
            setToast({ type: 'success', message: res?.message || 'Đã khóa tài khoản' });
            setShowBlockModal(false);
            setBlockReason('');
            await load();
        } catch (err) {
            setToast({ type: 'error', message: errMsg(err) });
        } finally {
            setActionLoading(false);
        }
    };

    if (loading && !user) {
        return (
            <AdminLayout>
                <div className="admin-helper-detail-main">
                    <p className="text-center">Đang tải...</p>
                </div>
            </AdminLayout>
        );
    }

    if (!user) {
        return (
            <AdminLayout>
                <div className="admin-helper-detail-main admin-user-detail">
                    <div className="admin-back-bar">
                        <BackToListButton onClick={() => navigate('/admin/users')} />
                    </div>
                    <p className="error-message">Không tìm thấy người dùng.</p>
                </div>
            </AdminLayout>
        );
    }

    const isBlocked = ['BANNED', 'SUSPENDED', 'WITHDRAW_ONLY', 'BLOCKED'].includes(user.status);
    const isHelper = user.role === 'HELPER';
    const addr = user.defaultAddress;
    const act = user.activity;
    const w = user.wallet;

    return (
        <AdminLayout>
            <div className="admin-helper-detail-main admin-user-detail">
                {toast && (
                    <NotificationModal
                        message={toast.message}
                        type={toast.type}
                        onClose={() => setToast(null)}
                    />
                )}

                <div className="admin-back-bar">
                    <BackToListButton onClick={() => navigate('/admin/users')} />
                    {isHelper && (
                        <Link className="admin-user-link-kyc" to={`/admin/helpers/${user.userId}`}>
                            Duyệt KYC Helper →
                        </Link>
                    )}
                </div>

                <h1 className="detail-title">Chi tiết người dùng #{user.userId}</h1>

                <div className="detail-section">
                    <h2>Thông tin tài khoản</h2>
                    <dl className="admin-user-dl">
                        <dt>Họ tên</dt>
                        <dd>{user.fullName}</dd>
                        <dt>Email</dt>
                        <dd>{user.email}</dd>
                        <dt>Số điện thoại</dt>
                        <dd>{user.phone}</dd>
                        <dt>Vai trò</dt>
                        <dd>{ROLE_LABEL[user.role] || user.role}</dd>
                        <dt>Trạng thái</dt>
                        <dd>
                            <span className={`status-badge ${isBlocked ? 'status-rejected' : 'status-verified'}`}>
                                {STATUS_LABEL[user.status] || user.status}
                            </span>
                        </dd>
                        <dt>Giới tính</dt>
                        <dd>{user.gender || '—'}</dd>
                        <dt>Ngày sinh</dt>
                        <dd>{user.dateOfBirth || '—'}</dd>
                        <dt>Ngày tạo</dt>
                        <dd>{fmtDate(user.createdAt)}</dd>
                        <dt>Cập nhật cuối</dt>
                        <dd>{fmtDate(user.updatedAt)}</dd>
                    </dl>
                </div>

                {addr && (
                    <div className="detail-section">
                        <h2>Địa chỉ mặc định</h2>
                        <dl className="admin-user-dl">
                            <dt>Chi tiết</dt>
                            <dd>{addr.addressDetail || '—'}</dd>
                            <dt>Phường/Xã</dt>
                            <dd>{addr.wardName || '—'}</dd>
                            <dt>Quận/Huyện</dt>
                            <dd>{addr.districtName || '—'}</dd>
                            <dt>Tỉnh/TP</dt>
                            <dd>{addr.provinceName || '—'}</dd>
                        </dl>
                    </div>
                )}

                {act && (
                    <div className="detail-section">
                        <h2>Hoạt động trên sàn</h2>
                        <div className="admin-user-stats-grid">
                            <div className="admin-user-stat-card">
                                <span className="admin-user-stat-label">Booking với vai trò khách</span>
                                <strong className="admin-user-stat-value">{act.bookingsAsCustomer ?? 0}</strong>
                            </div>
                            <div className="admin-user-stat-card">
                                <span className="admin-user-stat-label">Booking với vai trò Helper</span>
                                <strong className="admin-user-stat-value">{act.bookingsAsHelper ?? 0}</strong>
                            </div>
                            <div className="admin-user-stat-card">
                                <span className="admin-user-stat-label">Tin đăng việc (Job post)</span>
                                <strong className="admin-user-stat-value">{act.jobPostsCreated ?? 0}</strong>
                            </div>
                        </div>
                    </div>
                )}

                {w && (
                    <div className="detail-section">
                        <h2>Ví &amp; thu nhập</h2>
                        <dl className="admin-user-dl">
                            <dt>Mã ví</dt>
                            <dd>{w.walletId}</dd>
                            <dt>Số dư khả dụng</dt>
                            <dd>{fmtMoney(w.availableBalance)}</dd>
                            <dt>Đang giữ (hold)</dt>
                            <dd>{fmtMoney(w.holdBalance)}</dd>
                            <dt>Nợ sàn</dt>
                            <dd>{fmtMoney(w.debtBalance)}</dd>
                            <dt>Tổng thu nhập (RELEASE)</dt>
                            <dd>{fmtMoney(w.totalEarnings)}</dd>
                            <dt>Trạng thái ví</dt>
                            <dd>
                                {w.isFrozen ? (
                                    <span className="status-badge status-rejected">Đóng băng</span>
                                ) : (
                                    <span className="status-badge status-verified">Bình thường</span>
                                )}
                            </dd>
                        </dl>
                    </div>
                )}

                {user.helperSummary && (
                    <div className="detail-section">
                        <h2>Hồ sơ Helper</h2>
                        <dl className="admin-user-dl">
                            <dt>Profile ID</dt>
                            <dd>{user.helperSummary.profileId}</dd>
                            <dt>KYC</dt>
                            <dd>{KYC_LABEL[user.helperSummary.kycStatus] || user.helperSummary.kycStatus}</dd>
                            <dt>Đang bật nhận việc</dt>
                            <dd>{user.helperSummary.isOnline ? 'Có' : 'Không'}</dd>
                            <dt>Đánh giá TB / Số review</dt>
                            <dd>
                                {user.helperSummary.ratingAverage != null
                                    ? Number(user.helperSummary.ratingAverage).toFixed(1)
                                    : '—'}{' '}
                                / {user.helperSummary.totalReviews ?? 0}
                            </dd>
                            {user.helperSummary.rejectionReason && (
                                <>
                                    <dt>Lý do từ chối KYC</dt>
                                    <dd>{user.helperSummary.rejectionReason}</dd>
                                </>
                            )}
                        </dl>
                    </div>
                )}

                <div className="detail-section admin-user-actions">
                    <h2>Thao tác quản trị</h2>
                    <p className="admin-user-actions-hint">
                        Khi <strong>khóa</strong>, mọi phiên đăng nhập hiện tại sẽ bị từ chối ở request tiếp theo; người
                        dùng nhận thông báo và được đưa về trang đăng nhập. <strong>Mở khóa</strong> chỉ khi tài khoản
                        đang <strong>Bị khóa</strong>.
                    </p>
                    <div className="admin-user-actions-btns">
                        {isBlocked ? (
                            <button
                                type="button"
                                className="btn-primary-action"
                                disabled={actionLoading}
                                onClick={handleUnblock}
                            >
                                Mở khóa tài khoản
                            </button>
                        ) : (
                            <button
                                type="button"
                                className="btn-danger-action"
                                disabled={actionLoading}
                                onClick={() => setShowBlockModal(true)}
                            >
                                Khóa tài khoản
                            </button>
                        )}
                    </div>
                </div>

                {showBlockModal && (
                    <div
                        className="modal-overlay"
                        role="presentation"
                        onClick={() => !actionLoading && setShowBlockModal(false)}
                    >
                        <div
                            className="modal-content"
                            role="dialog"
                            aria-modal="true"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3>Khóa tài khoản</h3>
                            <p>Nhập ghi chú nội bộ (không bắt buộc):</p>
                            <textarea
                                className="modal-textarea"
                                rows={3}
                                value={blockReason}
                                onChange={(e) => setBlockReason(e.target.value)}
                                placeholder="Lý do khóa..."
                            />
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowBlockModal(false)}>
                                    Hủy
                                </button>
                                <button
                                    type="button"
                                    className="btn-danger-action"
                                    disabled={actionLoading}
                                    onClick={handleBlockConfirm}
                                >
                                    Xác nhận khóa
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
};

export default AdminUserDetailPage;
