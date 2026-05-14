import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import NotificationModal from '../../components/NotificationModal';
import AdminService from '../../services/AdminService';
import './AdminHelperDetailPage.css';
import './AdminUserDetailPage.css';
import './AdminBookingDetailPage.css';

const STATUS_LABEL = {
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

const ADMIN_CANCEL_ALLOWED_STATUSES = new Set(['PENDING', 'PENDING_ACCEPTANCE', 'CONFIRMED']);
const ADMIN_NO_SHOW_ALLOWED_STATUSES = new Set(['CONFIRMED', 'ARRIVED']);

const PAY_LABEL = {
    HOLDING: 'Đang giữ (Escrow)',
    RELEASED: 'Đã giải ngân cho thợ',
    REFUNDED: 'Đã hoàn cho khách',
};

const fmtDate = (d) => (d ? new Date(d).toLocaleString('vi-VN') : '—');
const fmtMoney = (n) =>
    n == null ? '—' : Number(n).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });

const BackButton = ({ onClick }) => (
    <button type="button" className="admin-back-btn" onClick={onClick}>
        <span className="admin-back-btn-icon" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
        </span>
        <span className="admin-back-btn-text">Quay lại danh sách booking</span>
    </button>
);

const AdminBookingDetailPage = () => {
    const { bookingId } = useParams();
    const navigate = useNavigate();
    const [b, setB] = useState(null);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [showCancel, setShowCancel] = useState(false);
    const [cancelReason, setCancelReason] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await AdminService.getBookingDetail(bookingId);
            setB(data);
        } catch (err) {
            setToast({ type: 'error', message: err?.message || 'Không tải được booking' });
            setB(null);
        } finally {
            setLoading(false);
        }
    }, [bookingId]);

    useEffect(() => {
        load();
    }, [load]);

    const canCancel = b && ADMIN_CANCEL_ALLOWED_STATUSES.has(String(b.status || '').toUpperCase());
    const canUnflag = b && b.isFlagged;
    const canMarkNoShow = b && ADMIN_NO_SHOW_ALLOWED_STATUSES.has(String(b.status || '').toUpperCase());
    const executionTimeline = [
        { key: 'arrive', label: 'Thợ đến địa điểm', time: fmtDate(b?.arrivedAt), done: Boolean(b?.arrivedAt) },
        { key: 'arrivalConfirm', label: 'Khách xác nhận thợ đến', time: fmtDate(b?.customerArrivalConfirmedAt), done: Boolean(b?.customerArrivalConfirmed) },
        { key: 'start', label: 'Bắt đầu công việc', time: fmtDate(b?.confirmedStartAt), done: Boolean(b?.confirmedStartAt) },
        { key: 'checkout', label: 'Thợ checkout', time: fmtDate(b?.checkedOutAt), done: Boolean(b?.checkedOutAt) },
        { key: 'complete', label: 'Khách xác nhận hoàn thành', time: fmtDate(b?.confirmedDoneAt), done: Boolean(b?.confirmedDoneAt) || ['COMPLETED', 'DISPUTED', 'RESOLVED'].includes(String(b?.status || '').toUpperCase()) },
    ];

    const handleCancel = async () => {
        if (cancelReason.trim().length < 5) {
            setToast({ type: 'error', message: 'Lý do hủy cần ít nhất 5 ký tự' });
            return;
        }
        setActionLoading(true);
        try {
            const res = await AdminService.cancelBooking(bookingId, cancelReason.trim());
            setToast({ type: 'success', message: res?.message || 'Đã hủy booking' });
            setShowCancel(false);
            setCancelReason('');
            await load();
        } catch (err) {
            setToast({ type: 'error', message: err?.message || 'Không thể hủy booking' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleUnflag = async () => {
        if (!window.confirm('Gỡ cờ cảnh báo cho đơn này?')) return;
        setActionLoading(true);
        try {
            const res = await AdminService.unflagBooking(bookingId);
            setToast({ type: 'success', message: res?.message || 'Đã gỡ cờ' });
            await load();
        } catch (err) {
            setToast({ type: 'error', message: err?.message || 'Thao tác thất bại' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleHelperNoShow = async () => {
        if (!window.confirm('Xác nhận thợ vắng mặt? Đơn sẽ bị hủy, hoàn tiền full và phạt thợ.')) return;
        setActionLoading(true);
        try {
            const res = await AdminService.markHelperNoShow(bookingId, 'Admin xác nhận thợ vắng mặt');
            setToast({ type: 'success', message: res?.message || 'Đã xử lý thợ vắng mặt' });
            await load();
        } catch (err) {
            setToast({ type: 'error', message: err?.message || 'Không thể xử lý thợ vắng mặt' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleCustomerNoShow = async () => {
        const input = window.prompt('Nhập tỷ lệ trả helper (0.3 - 0.5):', '0.3');
        if (input == null) return;
        const ratio = Number(input);
        if (Number.isNaN(ratio) || ratio < 0.3 || ratio > 0.5) {
            setToast({ type: 'error', message: 'Tỷ lệ phải nằm trong khoảng 0.3 - 0.5' });
            return;
        }
        setActionLoading(true);
        try {
            const res = await AdminService.markCustomerNoShow(bookingId, ratio, 'Admin xác nhận khách vắng mặt');
            setToast({ type: 'success', message: res?.message || 'Đã xử lý khách vắng mặt' });
            await load();
        } catch (err) {
            setToast({ type: 'error', message: err?.message || 'Không thể xử lý khách vắng mặt' });
        } finally {
            setActionLoading(false);
        }
    };

    if (loading && !b) {
        return (
            <AdminLayout>
                <div className="admin-helper-detail-main">
                    <p className="text-center">Đang tải...</p>
                </div>
            </AdminLayout>
        );
    }

    if (!b) {
        return (
            <AdminLayout>
                <div className="admin-helper-detail-main admin-booking-detail">
                    <div className="admin-back-bar">
                        <BackButton onClick={() => navigate('/admin/bookings')} />
                    </div>
                    <p className="error-message">Không tìm thấy booking.</p>
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
                    <BackButton onClick={() => navigate('/admin/bookings')} />
                    {b.jobPostId != null && (
                        <Link className="admin-booking-meta admin-booking-jobpost-link" to={`/admin/job-posts/${b.jobPostId}`}>
                            Tin đăng #{b.jobPostId}
                        </Link>
                    )}
                </div>

                <h1 className="detail-title">Booking #{b.bookingId}</h1>

                <div className="detail-section">
                    <h2>Trạng thái &amp; thanh toán</h2>
                    <dl className="admin-user-dl">
                        <dt>Trạng thái đơn</dt>
                        <dd>{STATUS_LABEL[b.status] || b.status}</dd>
                        <dt>Thanh toán</dt>
                        <dd>{PAY_LABEL[b.paymentStatus] || b.paymentStatus}</dd>
                        <dt>Tổng giá</dt>
                        <dd>{fmtMoney(b.totalPrice)}</dd>
                        <dt>Cờ bất thường</dt>
                        <dd>{b.isFlagged ? 'Có (checkout sớm / cần xem xét)' : 'Không'}</dd>
                    </dl>
                </div>

                <div className="detail-section">
                    <h2>Khách hàng</h2>
                    <dl className="admin-user-dl">
                        <dt>Tên</dt>
                        <dd>
                            <Link className="admin-booking-user-link" to={`/admin/users/${b.customerId}`}>
                                {b.customerName}
                            </Link>
                        </dd>
                        <dt>Email / SĐT</dt>
                        <dd>
                            {b.customerEmail} | {b.customerPhone}
                        </dd>
                    </dl>
                </div>

                <div className="detail-section">
                    <h2>Helper</h2>
                    <dl className="admin-user-dl">
                        <dt>Tên</dt>
                        <dd>
                            <Link className="admin-booking-user-link" to={`/admin/users/${b.helperId}`}>
                                {b.helperName}
                            </Link>
                        </dd>
                        <dt>Email / SĐT</dt>
                        <dd>
                            {b.helperEmail} | {b.helperPhone}
                        </dd>
                    </dl>
                </div>

                <div className="detail-section">
                    <h2>Dịch vụ &amp; lịch</h2>
                    <dl className="admin-user-dl">
                        <dt>Dịch vụ</dt>
                        <dd>{b.serviceName}</dd>
                        <dt>Bắt đầu / Kết thúc (dự kiến)</dt>
                        <dd>
                            {fmtDate(b.scheduledStartTime)} → {fmtDate(b.scheduledEndTime)}
                        </dd>
                        <dt>Hết hạn phản hồi</dt>
                        <dd>{fmtDate(b.expiredAt)}</dd>
                    </dl>
                </div>

                <div className="detail-section">
                    <h2>Địa chỉ</h2>
                    <p className="admin-booking-address">{b.addressFormatted || '—'}</p>
                    <dl className="admin-user-dl">
                        <dt>Chi tiết</dt>
                        <dd>{b.addressDetail || '—'}</dd>
                        <dt>Phường / Quận / Tỉnh</dt>
                        <dd>
                            {[b.wardName, b.districtName, b.provinceName].filter(Boolean).join(', ') || '—'}
                        </dd>
                    </dl>
                </div>

                <div className="detail-section">
                    <h2>Thực hiện</h2>
                    <div className="admin-booking-timeline">
                        {executionTimeline.map((step) => (
                            <div key={step.key} className={`admin-booking-timeline-item ${step.done ? 'done' : ''}`}>
                                <div className="admin-booking-timeline-dot">{step.done ? '✓' : '•'}</div>
                                <div className="admin-booking-timeline-body">
                                    <div className="admin-booking-timeline-label">{step.label}</div>
                                    <div className="admin-booking-timeline-time">{step.time}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <dl className="admin-user-dl">
                        <dt>Đến nơi (arrived)</dt>
                        <dd>{fmtDate(b.arrivedAt)}</dd>
                        <dt>Ảnh check-in / proof</dt>
                        <dd>
                            {b.arrivalProofImage || b.checkinPhotoUrl ? (
                                <a href={b.arrivalProofImage || b.checkinPhotoUrl} target="_blank" rel="noreferrer">
                                    Xem ảnh
                                </a>
                            ) : (
                                '—'
                            )}
                        </dd>
                        <dt>Khách xác nhận thợ đến</dt>
                        <dd>{b.customerArrivalConfirmed ? `Có (${fmtDate(b.customerArrivalConfirmedAt)})` : 'Chưa'}</dd>
                        <dt>Bắt đầu làm (xác nhận)</dt>
                        <dd>{fmtDate(b.confirmedStartAt)}</dd>
                        <dt>Thợ báo xong</dt>
                        <dd>{fmtDate(b.checkedOutAt)}</dd>
                        <dt>Ảnh sau làm</dt>
                        <dd>
                            {b.checkoutPhotoUrl ? (
                                <a href={b.checkoutPhotoUrl} target="_blank" rel="noreferrer">
                                    Xem ảnh
                                </a>
                            ) : (
                                '—'
                            )}
                        </dd>
                        <dt>Lý do hoàn thành sớm</dt>
                        <dd>{b.checkoutReason || '—'}</dd>
                        <dt>Khách xác nhận hoàn thành</dt>
                        <dd>{fmtDate(b.confirmedDoneAt)}</dd>
                    </dl>
                </div>

                <div className="detail-section">
                    <h2>Hệ thống</h2>
                    <dl className="admin-user-dl">
                        <dt>Tạo lúc</dt>
                        <dd>{fmtDate(b.createdAt)}</dd>
                        <dt>Cập nhật</dt>
                        <dd>{fmtDate(b.updatedAt)}</dd>
                    </dl>
                </div>

                <div className="detail-section admin-booking-actions">
                    <h2>Thao tác quản trị</h2>
                    <p className="admin-user-actions-hint">
                        <strong>Hủy đơn:</strong> áp dụng cùng quy tắc hoàn tiền/hold như khi khách tự hủy (sát giờ có phạt
                        30%). Không thể hủy đơn đã hoàn thành hoặc đã hủy.
                    </p>
                    <div className="admin-user-actions-btns">
                        {canUnflag && (
                            <button
                                type="button"
                                className="btn-primary-action"
                                disabled={actionLoading}
                                onClick={handleUnflag}
                            >
                                Gỡ cờ bất thường
                            </button>
                        )}
                        {canCancel && (
                            <button
                                type="button"
                                className="btn-danger-action"
                                disabled={actionLoading}
                                onClick={() => setShowCancel(true)}
                            >
                                Hủy booking (Admin)
                            </button>
                        )}
                        {canMarkNoShow && (
                            <button
                                type="button"
                                className="btn-secondary"
                                disabled={actionLoading}
                                onClick={handleHelperNoShow}
                            >
                                Xử lý Thợ vắng mặt
                            </button>
                        )}
                        {canMarkNoShow && (
                            <button
                                type="button"
                                className="btn-secondary"
                                disabled={actionLoading}
                                onClick={handleCustomerNoShow}
                            >
                                Xử lý Customer vắng mặt
                            </button>
                        )}
                    </div>
                </div>

                {showCancel && (
                    <div className="modal-overlay" role="presentation" onClick={() => !actionLoading && setShowCancel(false)}>
                        <div
                            className="modal-content modal-content-wide"
                            role="dialog"
                            aria-modal="true"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3>Hủy booking</h3>
                            <p>Nhập lý do (tối thiểu 5 ký tự). Khách và Helper sẽ nhận thông báo.</p>
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

export default AdminBookingDetailPage;
