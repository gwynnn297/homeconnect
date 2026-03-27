import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CustomerLayout from '../../layouts/CustomerLayout';
import BookingService from '../../services/BookingService';
import './CustomerBookingDetailPage.css';

const formatCurrency = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0 ₫';
    return `${n.toLocaleString('vi-VN')} ₫`;
};

const formatDateTime = (value) => {
    if (!value) return '---';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '---';
    return d.toLocaleString('vi-VN');
};

const getBookingStatusUI = (status) => {
    const s = String(status || '').toUpperCase();
    switch (s) {
        case 'PENDING':
        case 'PENDING_ACCEPTANCE':
            return { label: 'Chờ xác nhận', tone: 'warning' };
        case 'CONFIRMED':
        case 'IN_PROGRESS':
            return { label: 'Đã xác nhận', tone: 'success' };
        case 'COMPLETED':
            return { label: 'Hoàn thành', tone: 'success' };
        case 'CANCELLED':
            return { label: 'Đã hủy', tone: 'danger' };
        default:
            return { label: status || '---', tone: 'neutral' };
    }
};

const getPaymentStatusUI = (status) => {
    const s = String(status || '').toUpperCase();
    switch (s) {
        case 'HOLDING':
            return { label: 'Đang giữ tiền', tone: 'warning' };
        case 'PAID':
        case 'SUCCESS':
            return { label: 'Đã thanh toán', tone: 'success' };
        case 'REFUNDED':
            return { label: 'Đã hoàn tiền', tone: 'neutral' };
        case 'FAILED':
            return { label: 'Thanh toán lỗi', tone: 'danger' };
        default:
            return { label: status || '---', tone: 'neutral' };
    }
};

const CustomerBookingDetailPage = () => {
    const navigate = useNavigate();
    const { bookingId } = useParams();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [booking, setBooking] = useState(null);

    useEffect(() => {
        const loadBooking = async () => {
            if (!bookingId) return;
            setLoading(true);
            setError('');
            try {
                const res = await BookingService.getBookingDetail(bookingId);
                const data = res?.data ?? res;
                setBooking(data || null);
            } catch (err) {
                setBooking(null);
                setError(err?.message || 'Không thể tải chi tiết đơn hàng.');
            } finally {
                setLoading(false);
            }
        };

        loadBooking();
    }, [bookingId]);

    const statusUI = getBookingStatusUI(booking?.status);
    const paymentUI = getPaymentStatusUI(booking?.paymentStatus);

    return (
        <CustomerLayout>
            <div className="cbd-container slide-up">
                <div className="cbd-header">
                    <button className="cbd-back" type="button" onClick={() => navigate(-1)}>
                        ← Quay lại
                    </button>
                    <div className="cbd-header-main">
                        <h1 className="cbd-title">Chi tiết đơn làm việc</h1>
                        <div className="cbd-sub">
                            <span className={`cbd-badge cbd-badge--${statusUI.tone}`}>{statusUI.label}</span>
                            <span className={`cbd-badge cbd-badge--${paymentUI.tone}`}>{paymentUI.label}</span>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="cbd-card">
                        <div className="cbd-loading">Đang tải đơn hàng...</div>
                    </div>
                ) : error ? (
                    <div className="cbd-card cbd-error">
                        <h3>Không tải được đơn hàng</h3>
                        <p>{error}</p>
                        <div className="cbd-actions">
                            <button className="cbd-btn cbd-btn--primary" type="button" onClick={() => navigate('/customer/manage-posts')}>
                                Về quản lý bài đăng
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="cbd-grid">
                            <div className="cbd-card">
                                <div className="cbd-section-title">Tổng quan</div>
                                <div className="cbd-kv">
                                    <div className="cbd-k">Mã đơn</div>
                                    <div className="cbd-v">#{booking?.bookingId}</div>
                                </div>
                                <div className="cbd-kv">
                                    <div className="cbd-k">Dịch vụ</div>
                                    <div className="cbd-v">{booking?.serviceName || '---'}</div>
                                </div>
                                <div className="cbd-kv">
                                    <div className="cbd-k">Tổng tiền</div>
                                    <div className="cbd-v cbd-v--price">{formatCurrency(booking?.totalPrice)}</div>
                                </div>
                            </div>

                            <div className="cbd-card">
                                <div className="cbd-section-title">Lịch làm việc</div>
                                <div className="cbd-kv">
                                    <div className="cbd-k">Bắt đầu</div>
                                    <div className="cbd-v">{formatDateTime(booking?.scheduledStartTime)}</div>
                                </div>
                                <div className="cbd-kv">
                                    <div className="cbd-k">Kết thúc</div>
                                    <div className="cbd-v">{formatDateTime(booking?.scheduledEndTime)}</div>
                                </div>
                                <div className="cbd-kv">
                                    <div className="cbd-k">Địa chỉ</div>
                                    <div className="cbd-v">{booking?.address || '---'}</div>
                                </div>
                            </div>

                            <div className="cbd-card">
                                <div className="cbd-section-title">Người thực hiện</div>
                                <div className="cbd-kv">
                                    <div className="cbd-k">Khách hàng</div>
                                    <div className="cbd-v">{booking?.customerName || '---'}</div>
                                </div>
                                <div className="cbd-kv">
                                    <div className="cbd-k">Helper</div>
                                    <div className="cbd-v">{booking?.helperName || '---'}</div>
                                </div>
                                <div className="cbd-kv">
                                    <div className="cbd-k">Thanh toán</div>
                                    <div className="cbd-v">
                                        <span className={`cbd-pill cbd-pill--${paymentUI.tone}`}>{paymentUI.label}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="cbd-actions">
                            <button className="cbd-btn" type="button" onClick={() => navigate('/customer/manage-posts')}>
                                Danh sách bài đăng
                            </button>
                            <button className="cbd-btn cbd-btn--primary" type="button" onClick={() => navigate('/customer-dashboard')}>
                                Về tổng quan
                            </button>
                        </div>
                    </>
                )}
            </div>
        </CustomerLayout>
    );
};

export default CustomerBookingDetailPage;
