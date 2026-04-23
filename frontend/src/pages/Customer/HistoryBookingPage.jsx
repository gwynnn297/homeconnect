import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomerLayout from '../../layouts/CustomerLayout';
import apiClient from '../../services/apiClient';
import './HistoryBookingPage.css';

const JOB_LIST_ENDPOINTS = ['/api/v1/jobs/my', '/api/v1/jobs/customer', '/api/v1/jobs'];

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
            let fetched = null;
            let lastErr = null;

            for (const endpoint of JOB_LIST_ENDPOINTS) {
                try {
                    const res = await apiClient.get(endpoint);
                    const list = extractPayload(res);
                    if (Array.isArray(list)) {
                        fetched = list;
                        break;
                    }
                } catch (err) {
                    lastErr = err;
                }
            }

            if (cancelled) return;

            if (!Array.isArray(fetched)) {
                setPosts([]);
                setError(lastErr?.message || 'Không thể tải lịch sử dịch vụ.');
                setLoading(false);
                return;
            }

            setPosts(fetched);
            setLoading(false);
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
                                <div className="hbp-card-top">
                                    <div>
                                        <p className="hbp-service">{item.serviceName}</p>
                                        <h3 className="hbp-title">{item.title}</h3>
                                    </div>
                                    <span className="hbp-status">{getStatusLabel(item.status)}</span>
                                </div>

                                <div className="hbp-meta">
                                    <span>Mã booking: #{item.bookingId || '---'}</span>
                                    <span>Hoàn thành: {formatDateTime(item.completedAt)}</span>
                                    <span>Chi phí: {formatCurrency(item.totalPrice)}</span>
                                </div>

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
