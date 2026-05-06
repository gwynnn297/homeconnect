import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomerLayout from '../../layouts/CustomerLayout';
import apiClient from '../../services/apiClient';
import './HistoryBookingPage.css';

const JOB_POST_ENDPOINT = '/api/v1/jobs';
const DIRECT_BOOKING_ENDPOINT = '/api/v1/bookings/customer-direct';

const extractPayload = (res) => (res && typeof res === 'object' && 'data' in res ? res.data : res);

const getStatusLabel = (status) => {
    const normalized = String(status || '').toUpperCase();
    if (normalized === 'COMPLETED') return 'Đã hoàn thành';
    if (normalized === 'CANCELLED') return 'Đã hủy';
    if (normalized === 'EXPIRED') return 'Đã hết hạn';
    return normalized || '---';
};

const formatDateTime = (value) => {
    if (!value) return '---';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '---';
    return d.toLocaleString('vi-VN');
};

const formatCurrency = (value) => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return '0 ₫';
    return `${amount.toLocaleString('vi-VN')} ₫`;
};

const HistoryBookingPage = () => {
    const navigate = useNavigate();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;

        const loadPosts = async () => {
            setLoading(true);
            setError('');

            try {
                const [resJobs, resDirect] = await Promise.all([
                    apiClient.get(JOB_POST_ENDPOINT).catch(() => ({ data: [] })),
                    apiClient.get(DIRECT_BOOKING_ENDPOINT).catch(() => ({ data: [] })),
                ]);

                if (cancelled) return;

                const jobPosts = Array.isArray(extractPayload(resJobs)) ? extractPayload(resJobs) : [];

                // Normalize direct bookings thành cùng format với job posts
                const directList = Array.isArray(extractPayload(resDirect)) ? extractPayload(resDirect) : [];
                const normalizedDirect = directList.map((db) => ({
                    postId: `DIR-${db.bookingId}`,
                    bookingId: db.bookingId,
                    title: db.description ? `Đặt trực tiếp: ${db.description.substring(0, 35)}` : 'Đặt thợ trực tiếp',
                    categoryName: db.serviceName || 'Dịch vụ tại nhà',
                    bookingStatus: db.status,
                    status: db.status,
                    createdAt: db.createdAt,
                    completedAt: db.completedAt || db.updatedAt || db.createdAt,
                    offerPrice: db.finalPrice ?? db.totalPrice ?? 0,
                    isDirect: true,
                }));

                setPosts([...jobPosts, ...normalizedDirect]);
            } catch (err) {
                if (!cancelled) setError(err?.message || 'Không thể tải lịch sử dịch vụ.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        loadPosts();
        return () => {
            cancelled = true;
        };
    }, []);

    const completedBookings = useMemo(() => {
        return (Array.isArray(posts) ? posts : [])
            .map((post) => {
                const bookingStatus = String(post?.bookingStatus || '').toUpperCase();
                const status = String(post?.status || '').toUpperCase();
                const isCompleted = bookingStatus === 'COMPLETED' || status === 'COMPLETED';

                return {
                    postId: post?.postId,
                    bookingId: post?.bookingId,
                    title: post?.title || `Dịch vụ #${post?.postId ?? '---'}`,
                    serviceName: post?.categoryName || post?.serviceName || 'Dịch vụ tại nhà',
                    status: bookingStatus || status,
                    createdAt: post?.createdAt || post?.created_at,
                    completedAt: post?.completedAt || post?.updatedAt || post?.updated_at || post?.createdAt,
                    totalPrice: post?.offerPrice ?? post?.totalPrice ?? post?.estimated_price ?? 0,
                    isCompleted,
                };
            })
            .filter((item) => item.isCompleted)
            .sort((a, b) => {
                const ta = new Date(a.completedAt || a.createdAt).getTime() || 0;
                const tb = new Date(b.completedAt || b.createdAt).getTime() || 0;
                return tb - ta;
            });
    }, [posts]);

    return (
        <CustomerLayout>
            <div className="hbp-page slide-up">
                <div className="hbp-header">
                    <h1>Lịch sử dịch vụ</h1>
                    <p>Xem lại các booking đã hoàn thành của bạn.</p>
                </div>

                {loading ? (
                    <div className="hbp-state-card">Đang tải lịch sử dịch vụ...</div>
                ) : error ? (
                    <div className="hbp-state-card hbp-state-card-error">{error}</div>
                ) : completedBookings.length === 0 ? (
                    <div className="hbp-state-card">
                        Bạn chưa có booking hoàn thành nào
                    </div>
                ) : (
                    <div className="hbp-list">
                        {completedBookings.map((item) => (
                            <article key={`${item.postId}-${item.bookingId}`} className="hbp-card">
                                {/* Row 1: service label + badge — cùng chiều cao */}
                                <div className="hbp-card-top">
                                    <span className="hbp-service">{item.serviceName}</span>
                                    <span className="hbp-status">{getStatusLabel(item.status)}</span>
                                </div>

                                {/* Row 2: title — min-height 2 dòng để card cân nhau */}
                                <h3 className="hbp-title">{item.title}</h3>

                                {/* Row 3: meta info */}
                                <div className="hbp-meta">
                                    <span className="hbp-meta-sub">Mã booking: <strong>#{item.bookingId || '---'}</strong></span>
                                    <span className="hbp-meta-sub">Hoàn thành: <strong>{formatDateTime(item.completedAt)}</strong></span>
                                    <div className="hbp-price-row">
                                        <span className="hbp-price-label">Chi phí: </span>
                                        <span className="hbp-price-value">{formatCurrency(item.totalPrice)}</span>
                                    </div>
                                </div>

                                {/* Row 4: actions — luôn ở đáy card */}
                                <div className="hbp-actions">
                                    <button
                                        type="button"
                                        className="hbp-secondary-btn"
                                        onClick={() => navigate('/customer/manage-posts')}
                                    >
                                        Xem bài đăng
                                    </button>
                                    {item.bookingId ? (
                                        <button
                                            type="button"
                                            className="hbp-primary-btn"
                                            onClick={() => navigate(`/customer/bookings/${item.bookingId}`)}
                                        >
                                            Chi tiết booking
                                        </button>
                                    ) : null}
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </div>
        </CustomerLayout>
    );
};

export default HistoryBookingPage;
