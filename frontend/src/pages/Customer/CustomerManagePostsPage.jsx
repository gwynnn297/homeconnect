import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomerLayout from '../../layouts/CustomerLayout';
import apiClient from '../../services/apiClient';
import './CustomerManagePostsPage.css';

const SERVICE_INFOS = {
    1: { name: 'Dọn dẹp nhà cửa', icon: '🏡', color: '#2F5D50' },
    2: { name: 'Nấu ăn', icon: '🍳', color: '#2F5D50' },
    3: { name: 'Đi chợ', icon: '🛒', color: '#2F5D50' },
};

const JOB_LIST_ENDPOINTS = ['/api/v1/jobs/my', '/api/v1/jobs/customer', '/api/v1/jobs'];

const CustomerManagePostsPage = () => {
    const navigate = useNavigate();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchPosts = async () => {
            setLoading(true);
            setError('');

            let fetched = null;
            let lastErr = null;

            for (const endpoint of JOB_LIST_ENDPOINTS) {
                try {
                    const res = await apiClient.get(endpoint);
                    const list = res?.data ?? res;
                    if (Array.isArray(list)) {
                        fetched = list;
                        break;
                    }
                } catch (err) {
                    lastErr = err;
                }
            }

            if (!Array.isArray(fetched)) {
                setPosts([]);
                setError(lastErr?.message || 'Không thể tải danh sách bài đăng từ hệ thống.');
                setLoading(false);
                return;
            }

            setPosts(fetched);
            setLoading(false);
        };

        fetchPosts();
    }, []);

    const normalizedPosts = useMemo(
        () =>
            (Array.isArray(posts) ? posts : []).map((post) => {
                const postId = post?.postId ?? post?.post_id ?? '';
                const categoryId = Number(post?.categoryId ?? post?.service_id ?? 0);
                const addressText = [post?.addressDetail, post?.wardName, post?.districtName, post?.provinceName]
                    .filter(Boolean)
                    .join(', ');

                return {
                    postId,
                    categoryId,
                    title: post?.title || `Bài đăng #${postId}`,
                    description: post?.description || 'Không có mô tả.',
                    addressText: addressText || post?.address_detail || 'Chưa có địa chỉ',
                    createdAt: post?.createdAt ?? post?.created_at,
                    status: post?.status || 'PENDING',
                    estimatedPrice: Number(post?.offerPrice ?? post?.estimated_price ?? 0),
                };
            }),
        [posts]
    );

    const formatCurrency = (val) => {
        if (Number.isNaN(Number(val))) return '0 ₫';
        return val.toLocaleString('vi-VN') + ' ₫';
    };

    const getStatusConfig = (status) => {
        switch (status) {
            case 'PENDING':
            case 'PUBLISHED':
                return { label: 'Đang tìm người', color: '#B56A00', bg: '#FEF3C7' };
            case 'MATCHED':
            case 'ASSIGNED':
            case 'CONFIRMED':
                return { label: 'Đã nhận việc', color: '#2196F3', bg: '#E3F2FD' };
            case 'COMPLETED':
                return { label: 'Đã hoàn thành', color: '#16A34A', bg: '#DCFCE7' };
            case 'CANCELLED':
                return { label: 'Đã hủy', color: '#E74C3C', bg: '#FEE2E2' };
            default:
                return { label: status, color: '#6B7280', bg: '#F3F4F6' };
        }
    };

    return (
        <CustomerLayout>
            <div className="cmp-container slide-up">
                <div className="cmp-header">
                    <h1 className="cmp-title">Quản lý bài đăng</h1>
                    <p className="cmp-subtitle">Xem và theo dõi trạng thái các yêu cầu dịch vụ bạn đã đăng.</p>
                </div>

                <div className="cmp-content">
                    {loading ? (
                        <div className="cmp-loading-wrapper">
                            <div className="cmp-spinner"></div>
                            <p>Đang tải dữ liệu bài đăng...</p>
                        </div>
                    ) : error ? (
                        <div className="cmp-empty-state">
                            <div className="cmp-empty-icon">⚠️</div>
                            <h3>Không tải được bài đăng</h3>
                            <p>{error}</p>
                        </div>
                    ) : normalizedPosts.length === 0 ? (
                        <div className="cmp-empty-state">
                            <div className="cmp-empty-icon">📝</div>
                            <h3>Bạn chưa có bài đăng nào</h3>
                            <p>Hãy đặt dịch vụ để trải nghiệm tiện ích tuyệt vời của chúng tôi nhé!</p>
                            <button className="cmp-btn-outline cmp-btn-action" onClick={() => navigate('/customer-dashboard')}>
                                Đăng bài mới
                            </button>
                        </div>
                    ) : (
                        <div className="cmp-post-grid">
                            {normalizedPosts.map(post => {
                                const service = SERVICE_INFOS[post.categoryId] || { name: 'Dịch vụ', icon: '✨', color: '#2F5D50' };
                                const statusConf = getStatusConfig(post.status);

                                return (
                                    <div key={post.postId} className="cmp-post-card">
                                        <div className="cmp-post-card-header" style={{ borderBottomColor: `${service.color}30` }}>
                                            <div className="cmp-service-badge" style={{ color: service.color, backgroundColor: `${service.color}15` }}>
                                                <span className="cmp-icon">{service.icon}</span>
                                                {service.name}
                                            </div>
                                            <div className="cmp-status-badge" style={{ color: statusConf.color, backgroundColor: statusConf.bg }}>
                                                {statusConf.label}
                                            </div>
                                        </div>

                                        <div className="cmp-post-card-body">
                                            <h3 className="cmp-post-title">{post.title}</h3>
                                            <p className="cmp-post-desc">{post.description}</p>
                                            
                                            <div className="cmp-post-info-row">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                                    <circle cx="12" cy="10" r="3" />
                                                </svg>
                                                <span>{post.addressText}</span>
                                            </div>

                                            <div className="cmp-post-info-row">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <circle cx="12" cy="12" r="10" />
                                                    <polyline points="12 6 12 12 16 14" />
                                                </svg>
                                                <span>
                                                    Ngày đăng:{' '}
                                                    {post.createdAt
                                                        ? new Date(post.createdAt).toLocaleDateString('vi-VN')
                                                        : '---'}
                                                </span>
                                            </div>
                                            <div className="cmp-post-price">
                                                Giá dự kiến: <strong>{formatCurrency(post.estimatedPrice)}</strong>
                                            </div>
                                        </div>

                                        <div className="cmp-post-card-footer">
                                            <button className="cmp-btn-outline" style={{ borderColor: service.color, color: service.color }} type="button">
                                                Xem chi tiết
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </CustomerLayout>
    );
};

export default CustomerManagePostsPage;
