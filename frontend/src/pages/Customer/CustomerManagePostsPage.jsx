import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomerLayout from '../../layouts/CustomerLayout';
import apiClient from '../../services/apiClient';
import BookingService from '../../services/BookingService';
import './CustomerManagePostsPage.css';

const JOB_LIST_ENDPOINT = '/api/v1/jobs';
const extractPayload = (res) => (res && typeof res === 'object' && 'data' in res ? res.data : res);

const PALETTE = ['#2F5D50', '#B56A00', '#2196F3', '#16A34A', '#E74C3C'];
const STATUS_GROUPS = [
    { key: 'ALL', label: 'Tất cả', statuses: null },
    { key: 'OPEN', label: 'Đang tìm helper', statuses: ['PENDING', 'PUBLISHED'] },
    { key: 'ASSIGNED', label: 'Đã chốt helper', statuses: ['MATCHED', 'ASSIGNED', 'CONFIRMED'] },
    { key: 'COMPLETED', label: 'Đã hoàn thành', statuses: ['COMPLETED'] },
    { key: 'EXPIRED', label: 'Đã hết hạn', statuses: ['EXPIRED'] },
    { key: 'CANCELLED', label: 'Đã hủy', statuses: ['CANCELLED'] },
];

const normalizeServiceLabel = (label = '') =>
    String(label)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

const getCategoryEmoji = (categoryName) => {
    const normalized = normalizeServiceLabel(categoryName);

    if (
        normalized.includes('don dep') ||
        normalized.includes('ve sinh') ||
        normalized.includes('tap vu') ||
        normalized.includes('lau')
    ) {
        return '🏡';
    }

    if (normalized.includes('nau') || normalized.includes('bep') || normalized.includes('an uong')) {
        return '🍳';
    }

    if (normalized.includes('di cho') || normalized.includes('cho') || normalized.includes('mua sam')) {
        return '🛒';
    }

    return '✨';
};

const getInitial = (name = '') => {
    const trimmed = String(name).trim();
    return trimmed ? trimmed.charAt(0).toUpperCase() : 'H';
};

const CustomerManagePostsPage = () => {
    const navigate = useNavigate();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeGroup, setActiveGroup] = useState('ALL');
    const [applicantsByPostId, setApplicantsByPostId] = useState({});

    useEffect(() => {
        const fetchPosts = async () => {
            setLoading(true);
            setError('');

            let fetched = null;
            let lastErr = null;

            try {
                const res = await apiClient.get(JOB_LIST_ENDPOINT);
                const list = extractPayload(res);
                if (Array.isArray(list)) {
                    fetched = list;
                }
            } catch (err) {
                lastErr = err;
            }

            if (!Array.isArray(fetched)) {
                setPosts([]);
                const rawMsg = String(lastErr?.message || '');
                const friendlyMsg = rawMsg.includes('Unable to find com.homeconnect.core.entity.Address with id')
                    ? 'Không thể tải bài đăng do có dữ liệu địa chỉ cũ đã bị xóa khỏi hệ thống. Vui lòng liên hệ quản trị để đồng bộ lại dữ liệu địa chỉ cho các bài đăng trước đây.'
                    : (rawMsg || 'Không thể tải danh sách bài đăng từ hệ thống.');
                setError(friendlyMsg);
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
                const categoryName = post?.categoryName ?? post?.category_name ?? '';
                const addressText = [post?.addressDetail, post?.wardName, post?.districtName, post?.provinceName]
                    .filter(Boolean)
                    .join(', ');

                return {
                    postId,
                    categoryId,
                    categoryName,
                    bookingId: post?.bookingId ?? null,
                    bookingStatus: post?.bookingStatus ?? null,
                    customerArrivalConfirmed: Boolean(post?.customerArrivalConfirmed),
                    arrivalProofImage: post?.arrivalProofImage || null,
                    title: post?.title || `Bài đăng #${postId}`,
                    description: post?.description || 'Không có mô tả.',
                    addressText: addressText || post?.address_detail || 'Chưa có địa chỉ',
                    createdAt: post?.createdAt ?? post?.created_at,
                    status: post?.status || 'PUBLISHED',
                    estimatedPrice: Number(post?.offerPrice ?? post?.estimated_price ?? 0),
                };
            }),
        [posts]
    );

    const formatCurrency = (val) => {
        if (Number.isNaN(Number(val))) return '0 ₫';
        return val.toLocaleString('vi-VN') + ' ₫';
    };

    const isAssignedPost = (status) => ['MATCHED', 'ASSIGNED', 'CONFIRMED'].includes(status);

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
            case 'EXPIRED':
                return { label: 'Đã hết hạn', color: '#6B7280', bg: '#F3F4F6' };
            default:
                return { label: status, color: '#6B7280', bg: '#F3F4F6' };
        }
    };

    const groupedPosts = useMemo(() => {
        const groupMap = STATUS_GROUPS.reduce((acc, group) => {
            if (!group.statuses) {
                acc[group.key] = normalizedPosts;
                return acc;
            }
            acc[group.key] = normalizedPosts.filter((post) => group.statuses.includes(post.status));
            return acc;
        }, {});
        return groupMap;
    }, [normalizedPosts]);

    const visiblePosts = groupedPosts[activeGroup] || [];

    useEffect(() => {
        const openPostIds = normalizedPosts
            .filter((post) => ['PENDING', 'PUBLISHED'].includes(post.status))
            .map((post) => post.postId)
            .filter(Boolean);

        const pendingIds = openPostIds.filter((postId) => !(postId in applicantsByPostId));
        if (pendingIds.length === 0) return;

        let cancelled = false;

        const fetchApplicantsForPosts = async () => {
            const entries = await Promise.all(
                pendingIds.map(async (postId) => {
                    try {
                        const res = await BookingService.getApplicants(postId);
                        const list = extractPayload(res);
                        return [postId, Array.isArray(list) ? list : []];
                    } catch {
                        return [postId, []];
                    }
                })
            );

            if (cancelled) return;
            setApplicantsByPostId((prev) => {
                const next = { ...prev };
                entries.forEach(([postId, list]) => {
                    next[postId] = list;
                });
                return next;
            });
        };

        fetchApplicantsForPosts();
        return () => {
            cancelled = true;
        };
    }, [normalizedPosts, applicantsByPostId]);

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
                                Đăng bài
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="cmp-group-tabs" role="tablist" aria-label="Nhóm trạng thái bài đăng">
                                {STATUS_GROUPS.map((group) => (
                                    <button
                                        key={group.key}
                                        type="button"
                                        className={`cmp-group-tab ${activeGroup === group.key ? 'cmp-group-tab-active' : ''}`}
                                        onClick={() => setActiveGroup(group.key)}
                                    >
                                        {group.label}
                                        <span className="cmp-group-count">{(groupedPosts[group.key] || []).length}</span>
                                    </button>
                                ))}
                            </div>

                            {visiblePosts.length === 0 ? (
                                <div className="cmp-empty-state">
                                    <div className="cmp-empty-icon">📭</div>
                                    <h3>Không có bài đăng trong nhóm này</h3>
                                    <p>Hãy chọn nhóm trạng thái khác để xem thêm dữ liệu.</p>
                                </div>
                            ) : (
                                <div className="cmp-post-grid">
                                    {visiblePosts.map(post => {
                                const serviceColor = PALETTE[(Number(post.categoryId) || 0) % PALETTE.length];
                                const service = {
                                    name: post.categoryName || 'Dịch vụ',
                                    icon: getCategoryEmoji(post.categoryName),
                                    color: serviceColor
                                };
                                const statusConf = getStatusConfig(post.status);
                                const isAssigned = isAssignedPost(post.status);
                                const applicants = applicantsByPostId[post.postId] || [];
                                const hasApplicants = ['PENDING', 'PUBLISHED'].includes(post.status) && applicants.length > 0;
                                const previewApplicants = applicants.slice(0, 3);
                                const canOpenBooking = Number(post?.bookingId) > 0;
                                const shouldShowArrivalCta = canOpenBooking && ['CONFIRMED', 'ARRIVED', 'IN_PROGRESS'].includes(String(post?.bookingStatus || '').toUpperCase());
                                const hasArrivalProof = Boolean(post?.arrivalProofImage);

                                return (
                                    <div
                                        key={post.postId}
                                        className={`cmp-post-card ${isAssigned ? 'cmp-post-card-assigned' : ''}`}
                                    >
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
                                            {isAssigned ? (
                                                <div className="cmp-assigned-banner">
                                                    ✅ Bài đăng đã chốt helper. Theo dõi chi tiết để xem tiến độ làm việc.
                                                </div>
                                            ) : null}
                                            {canOpenBooking ? (
                                                <div className="cmp-assigned-banner" style={{ marginTop: 8 }}>
                                                    Booking #{post.bookingId} - Trạng thái: {post.bookingStatus || '---'}
                                                </div>
                                            ) : null}
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

                                            {hasApplicants ? (
                                                <div
                                                    className="cmp-applicant-preview"
                                                    onClick={() => navigate(`/customer/manage-posts/${post.postId}`)}
                                                    role="button"
                                                    tabIndex={0}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            navigate(`/customer/manage-posts/${post.postId}`);
                                                        }
                                                    }}
                                                >
                                                    <div className="cmp-applicant-avatars">
                                                        {previewApplicants.map((applicant, idx) => (
                                                            applicant?.avatarUrl ? (
                                                                <img
                                                                    key={`${post.postId}-avatar-${applicant.applicationId || idx}`}
                                                                    src={applicant.avatarUrl}
                                                                    alt={applicant.fullName || 'Helper'}
                                                                    className="cmp-applicant-avatar"
                                                                    style={{ zIndex: previewApplicants.length - idx }}
                                                                />
                                                            ) : (
                                                                <div
                                                                    key={`${post.postId}-avatar-fallback-${applicant.applicationId || idx}`}
                                                                    className="cmp-applicant-avatar cmp-applicant-avatar-fallback"
                                                                    style={{ zIndex: previewApplicants.length - idx }}
                                                                >
                                                                    {getInitial(applicant?.fullName)}
                                                                </div>
                                                            )
                                                        ))}
                                                    </div>
                                                    <p className="cmp-applicant-text">
                                                        {applicants.length === 1
                                                            ? 'Đã có 1 helper apply vào bài đăng này'
                                                            : `Đã có ${applicants.length} helper apply vào bài đăng này`}
                                                    </p>
                                                </div>
                                            ) : null}

                                            {canOpenBooking ? (
                                                <div style={{ marginTop: 12 }}>
                                                    {hasArrivalProof ? (
                                                        <div className="cmp-assigned-banner" style={{ marginBottom: 8 }}>
                                                            Đã có ảnh địa điểm helper gửi để xác minh đúng nhà.
                                                        </div>
                                                    ) : null}
                                                    <button
                                                        type="button"
                                                        className="cmp-btn-outline cmp-btn-action"
                                                        onClick={() => navigate(`/customer/bookings/${post.bookingId}`)}
                                                    >
                                                        {shouldShowArrivalCta
                                                            ? (post.customerArrivalConfirmed
                                                                ? 'Xem xác nhận helper đã đến'
                                                                : 'Xem ảnh địa điểm và xác nhận helper đã đến đúng nhà')
                                                            : 'Xem chi tiết booking'}
                                                    </button>
                                                </div>
                                            ) : null}
                                        </div>

                                        <div className="cmp-post-card-footer">
                                            <button
                                                className="cmp-btn-outline"
                                                style={{ borderColor: service.color, color: service.color }}
                                                type="button"
                                                onClick={() => navigate(`/customer/manage-posts/${post.postId}`)}
                                            >
                                                Xem chi tiết
                                            </button>
                                        </div>
                                    </div>
                                );
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </CustomerLayout>
    );
};

export default CustomerManagePostsPage;
