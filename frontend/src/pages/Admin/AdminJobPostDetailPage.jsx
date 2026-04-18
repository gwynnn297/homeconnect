import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import NotificationModal from '../../components/NotificationModal';
import AdminService from '../../services/AdminService';
import './AdminHelperDetailPage.css';
import './AdminUserDetailPage.css';
import './AdminBookingDetailPage.css';

const STATUS_LABEL = {
    PUBLISHED: 'Đang tìm thợ',
    ASSIGNED: 'Đã chốt thợ',
    COMPLETED: 'Hoàn thành',
    CANCELLED: 'Đã hủy',
    EXPIRED: 'Hết hạn',
};

const BOOKING_STATUS_LABEL = {
    PENDING: 'Chờ xác nhận',
    PENDING_ACCEPTANCE: 'Chờ thợ phản hồi',
    CONFIRMED: 'Đã xác nhận',
    ARRIVED: 'Thợ đã đến',
    IN_PROGRESS: 'Đang làm',
    PENDING_COMPLETION: 'Chờ khách xác nhận xong',
    COMPLETED: 'Hoàn thành',
    CANCELLED: 'Đã hủy',
    EXPIRED: 'Hết hạn phản hồi',
};

const fmtDate = (d) => (d ? new Date(d).toLocaleString('vi-VN') : '—');
/** LocalDate từ API có thể là chuỗi hoặc mảng [y,m,d]. */
const fmtWorkDate = (wd) => {
    if (wd == null || wd === '') return '—';
    if (Array.isArray(wd)) {
        const [y, m, day] = wd;
        return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    return String(wd);
};
const fmtMoney = (n) =>
    n == null ? '—' : Number(n).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });

const BackButton = ({ onClick }) => (
    <button type="button" className="admin-back-btn" onClick={onClick}>
        <span className="admin-back-btn-icon" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
        </span>
        <span className="admin-back-btn-text">Quay lại danh sách tin</span>
    </button>
);

const AdminJobPostDetailPage = () => {
    const { postId } = useParams();
    const navigate = useNavigate();
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [showCancel, setShowCancel] = useState(false);
    const [cancelReason, setCancelReason] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await AdminService.getJobPostDetail(postId);
            setDetail(data);
        } catch (err) {
            setToast({ type: 'error', message: err?.message || 'Không tải được chi tiết tin' });
            setDetail(null);
        } finally {
            setLoading(false);
        }
    }, [postId]);

    useEffect(() => {
        load();
    }, [load]);

    const p = detail?.post;
    const canCancel = p && (p.status === 'PUBLISHED' || p.status === 'ASSIGNED');

    const handleCancel = async () => {
        if (cancelReason.trim().length < 5) {
            setToast({ type: 'error', message: 'Lý do cần ít nhất 5 ký tự' });
            return;
        }
        setActionLoading(true);
        try {
            const res = await AdminService.cancelJobPost(postId, cancelReason.trim());
            setToast({ type: 'success', message: res?.message || 'Đã xử lý hủy tin' });
            setShowCancel(false);
            setCancelReason('');
            await load();
        } catch (err) {
            setToast({ type: 'error', message: err?.message || 'Không thể hủy tin' });
        } finally {
            setActionLoading(false);
        }
    };

    if (loading && !detail) {
        return (
            <AdminLayout>
                <div className="admin-helper-detail-main">
                    <p className="text-center">Đang tải...</p>
                </div>
            </AdminLayout>
        );
    }

    if (!detail || !p) {
        return (
            <AdminLayout>
                <div className="admin-helper-detail-main admin-booking-detail">
                    <div className="admin-back-bar">
                        <BackButton onClick={() => navigate('/admin/job-posts')} />
                    </div>
                    <p className="error-message">Không tìm thấy tin đăng.</p>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="admin-helper-detail-main admin-booking-detail">
                {toast && (
                    <NotificationModal
                        message={toast.message}
                        type={toast.type}
                        onClose={() => setToast(null)}
                    />
                )}

                <div className="admin-back-bar">
                    <BackButton onClick={() => navigate('/admin/job-posts')} />
                </div>

                <h1 className="detail-title">Tin #{p.postId}</h1>

                <div className="detail-section admin-booking-actions">
                    <h2>Thao tác quản trị</h2>
                    <p className="admin-user-actions-hint">
                        <strong>Hủy tin:</strong> nếu tin đang mở (PUBLISHED), hệ thống hoàn tiền giữ chỗ và hủy ứng tuyển
                        chờ như khi khách hủy. Nếu đã chốt thợ (ASSIGNED), hệ thống hủy đơn booking theo luật Admin rồi đóng
                        tin.
                    </p>
                    <div className="admin-user-actions-btns">
                        {canCancel && (
                            <button
                                type="button"
                                className="btn-danger-action"
                                disabled={actionLoading}
                                onClick={() => setShowCancel(true)}
                            >
                                Hủy tin (Admin)
                            </button>
                        )}
                    </div>
                    {!canCancel && (
                        <p className="admin-user-actions-hint">Tin đã kết thúc — không thể hủy thêm.</p>
                    )}
                </div>

                <div className="detail-section">
                    <h2>Trạng thái &amp; giá</h2>
                    <dl className="admin-user-dl">
                        <dt>Trạng thái tin</dt>
                        <dd>{STATUS_LABEL[p.status] || p.status}</dd>
                        <dt>Giá đề xuất (hold)</dt>
                        <dd>{fmtMoney(p.offerPrice)}</dd>
                        <dt>Ngày đăng</dt>
                        <dd>{fmtDate(p.createdAt)}</dd>
                        <dt>Ứng tuyển</dt>
                        <dd>
                            {detail.pendingApplicationCount} đang chờ / {detail.applicationCount} tổng
                        </dd>
                    </dl>
                </div>

                <div className="detail-section">
                    <h2>Khách hàng</h2>
                    <dl className="admin-user-dl">
                        <dt>Tên</dt>
                        <dd>
                            <Link className="admin-booking-user-link" to={`/admin/users/${detail.customerId}`}>
                                {detail.customerName}
                            </Link>
                        </dd>
                        <dt>Email / SĐT</dt>
                        <dd>
                            {detail.customerEmail} | {detail.customerPhone}
                        </dd>
                    </dl>
                </div>

                <div className="detail-section">
                    <h2>Booking liên quan</h2>
                    {detail.linkedBookingId ? (
                        <dl className="admin-user-dl">
                            <dt>Mã đơn</dt>
                            <dd>
                                <Link
                                    className="admin-booking-user-link"
                                    to={`/admin/bookings/${detail.linkedBookingId}`}
                                >
                                    #{detail.linkedBookingId}
                                </Link>
                            </dd>
                            <dt>Trạng thái đơn</dt>
                            <dd>{BOOKING_STATUS_LABEL[detail.linkedBookingStatus] || detail.linkedBookingStatus}</dd>
                        </dl>
                    ) : (
                        <p>Chưa có booking (tin đang mở hoặc chưa chốt thợ).</p>
                    )}
                </div>

                <div className="detail-section">
                    <h2>Nội dung công việc</h2>
                    <dl className="admin-user-dl">
                        <dt>Tiêu đề</dt>
                        <dd>{p.title || '—'}</dd>
                        <dt>Danh mục</dt>
                        <dd>{p.categoryName || '—'}</dd>
                        <dt>Thời gian làm</dt>
                        <dd>
                            {fmtWorkDate(p.workDate)}{' '}
                            {p.startTime ? `lúc ${String(p.startTime).slice(0, 5)}` : ''} — {p.durationHours} giờ
                        </dd>
                        <dt>Mô tả</dt>
                        <dd>
                            <span className="admin-job-post-desc">{p.description || '—'}</span>
                        </dd>
                        <dt>Địa chỉ</dt>
                        <dd>{p.fullAddress || [p.addressDetail, p.wardName, p.districtName, p.provinceName].filter(Boolean).join(', ') || '—'}</dd>
                    </dl>
                </div>

                {showCancel && (
                    <div
                        className="modal-overlay"
                        role="presentation"
                        onClick={() => !actionLoading && setShowCancel(false)}
                    >
                        <div
                            className="modal-content modal-content-wide"
                            role="dialog"
                            aria-modal="true"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3>Hủy tin đăng</h3>
                            <p>Nhập lý do (tối thiểu 5 ký tự). Khách (và Helper nếu có đơn) sẽ nhận thông báo tương ứng.</p>
                            <textarea
                                className="modal-textarea"
                                rows={4}
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                placeholder="Lý do hủy bởi quản trị viên..."
                            />
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowCancel(false)}>
                                    Đóng
                                </button>
                                <button
                                    type="button"
                                    className="btn-danger-action"
                                    disabled={actionLoading}
                                    onClick={handleCancel}
                                >
                                    Xác nhận hủy
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
};

export default AdminJobPostDetailPage;
