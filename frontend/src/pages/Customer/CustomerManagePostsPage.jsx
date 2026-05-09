import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomerLayout from '../../layouts/CustomerLayout';
import apiClient from '../../services/apiClient';
import BookingService from '../../services/BookingService';
import NotificationModal from '../../components/NotificationModal';
import './CustomerManagePostsPage.css';

const JOB_LIST_ENDPOINT = '/api/v1/jobs';
const extractPayload = (res) => (res && typeof res === 'object' && 'data' in res ? res.data : res);

const PALETTE = ['#2F5D50', '#B56A00', '#2196F3', '#16A34A', '#E74C3C'];
const STATUS_GROUPS = [
    { key: 'ALL', label: 'Tất cả', statuses: null },
    { key: 'OPEN', label: 'Đang tìm thợ', statuses: ['PENDING', 'PUBLISHED', 'PENDING_ACCEPTANCE'] },
    { key: 'ASSIGNED', label: 'Đã chốt thợ', statuses: ['MATCHED', 'ASSIGNED', 'CONFIRMED'] },
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

/** Khóa thống nhất cho applicantsByPostId (tránh lệch number vs string so với postId API). */
const applicantKey = (postId) => {
    if (postId === undefined || postId === null || postId === '') return '';
    return String(postId);
};

const resolveUnifiedStatus = (post) => {
    const bookingStatus = String(post?.bookingStatus || '').toUpperCase();
    const rawStatus = String(post?.status || 'PUBLISHED').toUpperCase();
    if (['CANCELLED', 'EXPIRED'].includes(bookingStatus)) return bookingStatus;
    if (['COMPLETED', 'DISPUTED', 'RESOLVED'].includes(bookingStatus)) return 'COMPLETED';
    if (['CONFIRMED', 'ARRIVED', 'IN_PROGRESS', 'PENDING_COMPLETION'].includes(bookingStatus)) return 'CONFIRMED';
    if (bookingStatus === 'PENDING_ACCEPTANCE') return 'PENDING_ACCEPTANCE';
    return rawStatus;
};

const CustomerManagePostsPage = () => {
    const navigate = useNavigate();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeGroup, setActiveGroup] = useState('ALL');
    const [applicantsByPostId, setApplicantsByPostId] = useState({});
    const [cancellingTargetKey, setCancellingTargetKey] = useState('');
    const [pendingCancelJobPost, setPendingCancelJobPost] = useState(null);
    const [pendingCancelDirectPost, setPendingCancelDirectPost] = useState(null);
    const [cancelDirectReason, setCancelDirectReason] = useState('');
    const [cancelDirectError, setCancelDirectError] = useState('');
    const [toast, setToast] = useState(null);

    const loadPosts = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        setError('');

        let fetched = null;
        let lastErr = null;

        try {
            const [resJobs, resDirect] = await Promise.all([
                apiClient.get(JOB_LIST_ENDPOINT).catch((e) => {
                    lastErr = e;
                    return { data: [] };
                }),
                apiClient.get('/api/v1/bookings/customer-direct').catch((e) => {
                    console.error('Error fetching direct bookings', e);
                    return { data: [] };
                }),
            ]);

            const listJobs = extractPayload(resJobs);
            const listDirect = extractPayload(resDirect);

            const combined = [];
            if (Array.isArray(listJobs)) combined.push(...listJobs);
            if (Array.isArray(listDirect)) {
                // Normalize Direct Booking Response into pseudo JobPost structure for UI compatibility
                const normalizedDirectBookings = listDirect.map((db) => {
                    // Build address text the same way as job posts
                    const parts = [db.wardName, db.districtName, db.provinceName].filter(Boolean);
                    const shortArea = parts.join(', ') || '';
                    const fullAddr = db.address || shortArea || 'Chưa có địa chỉ';

                    return {
                        postId: `DIR-${db.bookingId}`,
                        categoryId: db.categoryId,
                        categoryName: db.serviceName,
                        bookingId: db.bookingId,
                        bookingStatus: db.status,
                        customerArrivalConfirmed: db.customerArrivalConfirmed,
                        arrivalProofImage: db.arrivalProofImage,
                        title: db.description ? `Đặt trực tiếp: ${db.description.substring(0, 35)}` : 'Đặt thợ trực tiếp',
                        description: db.description || 'Chưa cập nhật chi tiết',
                        addressText: fullAddr,
                        createdAt: db.createdAt,
                        status: db.status,
                        estimatedPrice: Number(db.finalPrice ?? db.totalPrice ?? 0),
                        originalPrice: Number(db.originalPrice ?? db.totalPrice ?? 0),
                        finalPrice: Number(db.finalPrice ?? db.totalPrice ?? 0),
                        discountAmount: Number(db.discountAmount ?? 0),
                        isDirect: true,
                        cancelReason: db.cancelReason,
                        cancelSource: db.cancelSource || null,
                    };
                });
                combined.push(...normalizedDirectBookings);
            }

            // Sort combined by createdAt descending
            combined.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            fetched = combined;
        } catch (err) {
            if (!lastErr) lastErr = err;
        }

        if (!Array.isArray(fetched)) {
            setPosts([]);
            const rawMsg = String(lastErr?.message || '');
            const friendlyMsg = rawMsg.includes('Unable to find com.homeconnect.core.entity.Address with id')
                ? 'Không thể tải bài đăng do có dữ liệu địa chỉ cũ đã bị xóa khỏi hệ thống. Vui lòng liên hệ quản trị để đồng bộ lại dữ liệu địa chỉ cho các bài đăng trước đây.'
                : rawMsg || 'Không thể tải danh sách bài đăng từ hệ thống.';
            setError(friendlyMsg);
            if (!silent) setLoading(false);
            return;
        }

        setPosts(fetched);
        if (!silent) setLoading(false);
    }, []);

    useEffect(() => {
        loadPosts();

        // Polling every 10 seconds
        const interval = setInterval(() => {
            loadPosts(true);
        }, 10000);

        const invalidateApplicantCaches = (rawIds) => {
            if (!Array.isArray(rawIds)) return;
            const keys = [...new Set(rawIds.map(applicantKey).filter(Boolean))];
            if (keys.length === 0) return;
            setApplicantsByPostId((prev) => {
                const next = { ...prev };
                keys.forEach((k) => {
                    delete next[k];
                });
                return next;
            });
        };

        const invalidateApplicantsForJobs = () => setApplicantsByPostId({});

        const handleBookingUpdated = () => loadPosts(true);

        /** Thông báo chuông (JOB_APPLICATION) không kèm postId — xóa cache để refetch applicants mở. */
        const handleNotificationReceived = (e) => {
            loadPosts(true);
            const type = String(e?.detail?.type || '').toUpperCase();
            if (type === 'JOB_APPLICATION') {
                invalidateApplicantsForJobs();
            }
        };

        const handleJobApplication = (e) => {
            loadPosts(true);
            const d = e?.detail || {};
            const pid = d.postId ?? d.jobId ?? d.post_id ?? d.job_id;
            if (pid !== undefined && pid !== null && String(pid) !== '') {
                invalidateApplicantCaches([pid]);
            }
        };

        window.addEventListener('notification:received', handleNotificationReceived);
        window.addEventListener('job:new_application', handleJobApplication);
        window.addEventListener('booking:updated', handleBookingUpdated);

        return () => {
            clearInterval(interval);
            window.removeEventListener('notification:received', handleNotificationReceived);
            window.removeEventListener('job:new_application', handleJobApplication);
            window.removeEventListener('booking:updated', handleBookingUpdated);
        };
    }, [loadPosts]);

    const handleCancelPost = async (post) => {
        const bid = post?.bookingId;
        const targetKey = `${post?.isDirect ? 'DIR' : 'JOB'}-${post?.postId}`;
        if (!targetKey) return;

        if (post?.isDirect) {
            const st = String(post?.bookingStatus || post?.status || '').toUpperCase();
            if (st !== 'PENDING_ACCEPTANCE' || !bid) return;
            setPendingCancelDirectPost(post);
            setCancelDirectReason('');
            setCancelDirectError('');
            return;
        }

        setPendingCancelJobPost(post);
    };

    const handleConfirmCancelJobPost = async () => {
        if (!pendingCancelJobPost?.postId) return;
        const targetKey = `JOB-${pendingCancelJobPost.postId}`;

        setCancellingTargetKey(targetKey);
        try {
            await apiClient.delete(`${JOB_LIST_ENDPOINT}/${pendingCancelJobPost.postId}`);
            await loadPosts();
            setPendingCancelJobPost(null);
        } catch (err) {
            setToast({
                type: 'error',
                message: err?.message || 'Không thể hủy bài đăng. Vui lòng thử lại.'
            });
        } finally {
            setCancellingTargetKey('');
        }
    };

    const handleConfirmCancelDirectPost = async () => {
        if (!pendingCancelDirectPost?.bookingId) return;
        const reason = String(cancelDirectReason || '').trim();
        if (reason.length < 5) {
            setCancelDirectError('Lý do hủy cần tối thiểu 5 ký tự.');
            return;
        }

        const targetKey = `DIR-${pendingCancelDirectPost.postId}`;
        setCancellingTargetKey(targetKey);
        setCancelDirectError('');
        try {
            await BookingService.cancelBooking(pendingCancelDirectPost.bookingId, reason);
            await loadPosts();
            setPendingCancelDirectPost(null);
            setCancelDirectReason('');
        } catch (err) {
            setCancelDirectError(err?.message || 'Không thể hủy đơn. Vui lòng thử lại.');
        } finally {
            setCancellingTargetKey('');
        }
    };

    const normalizedPosts = useMemo(
        () =>
            (Array.isArray(posts) ? posts : []).map((post) => {
                const postId = post?.postId ?? post?.post_id ?? '';
                const categoryId = Number(post?.categoryId ?? post?.service_id ?? 0);
                const categoryName = post?.categoryName ?? post?.category_name ?? '';

                // For direct bookings, addressText is pre-built; for job posts build from parts
                const addressText = post?.isDirect
                    ? (post?.addressText || post?.addressDetail || 'Chưa có địa chỉ')
                    : ([post?.addressDetail, post?.wardName, post?.districtName, post?.provinceName]
                        .filter(Boolean)
                        .join(', ') || post?.address_detail || 'Chưa có địa chỉ');

                // estimatedPrice: direct bookings carry it as estimatedPrice; job posts use offerPrice
                const estimatedPrice = Number(
                    post?.estimatedPrice ?? post?.offerPrice ?? post?.estimated_price ?? 0
                );

                return {
                    postId,
                    categoryId,
                    categoryName,
                    isDirect: Boolean(post?.isDirect),
                    bookingId: post?.bookingId ?? null,
                    bookingStatus: post?.bookingStatus ?? null,
                    customerArrivalConfirmed: Boolean(post?.customerArrivalConfirmed),
                    arrivalProofImage: post?.arrivalProofImage || null,
                    title: post?.title || `Bài đăng #${postId}`,
                    description: post?.description || 'Không có mô tả.',
                    addressText,
                    createdAt: post?.createdAt ?? post?.created_at,
                    status: resolveUnifiedStatus(post),
                    estimatedPrice,
                    originalPrice: Number(post?.originalPrice ?? estimatedPrice),
                    finalPrice: Number(post?.finalPrice ?? estimatedPrice),
                    discountAmount: Number(post?.discountAmount ?? 0),
                    cancelReason: post?.cancelReason || null,
                    cancelSource: post?.cancelSource || null
                };
            }),
        [posts]
    );

    const formatCurrency = (val) => {
        if (Number.isNaN(Number(val))) return '0 ₫';
        return val.toLocaleString('vi-VN') + ' ₫';
    };

    const isAssignedPost = (status) => ['MATCHED', 'ASSIGNED', 'CONFIRMED', 'ARRIVED', 'IN_PROGRESS', 'PENDING_COMPLETION'].includes(status);

    const getStatusConfig = (status) => {
        switch (status) {
            case 'PENDING':
            case 'PUBLISHED':
            case 'PENDING_ACCEPTANCE':
                return { label: status === 'PENDING_ACCEPTANCE' ? 'Đang Chờ thợ' : 'Đang tìm thợ', color: '#B56A00', bg: '#FEF3C7' };
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
            .map((post) => applicantKey(post.postId))
            .filter(Boolean);

        const pendingKeys = openPostIds.filter((k) => !(k in applicantsByPostId));
        if (pendingKeys.length === 0) return;

        let cancelled = false;

        const fetchApplicantsForPosts = async () => {
            const entries = await Promise.all(
                pendingKeys.map(async (key) => {
                    try {
                        const res = await BookingService.getApplicants(key);
                        const list = extractPayload(res);
                        return [key, Array.isArray(list) ? list : []];
                    } catch {
                        return [key, []];
                    }
                })
            );

            if (cancelled) return;
            setApplicantsByPostId((prev) => {
                const next = { ...prev };
                entries.forEach(([key, list]) => {
                    next[key] = list;
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
                <div className="cmp-content">
                    {toast ? (
                        <NotificationModal
                            message={toast.message}
                            type={toast.type}
                            onClose={() => setToast(null)}
                        />
                    ) : null}
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
                                        const applicants = applicantsByPostId[applicantKey(post.postId)] || [];
                                        const hasApplicants = ['PENDING', 'PUBLISHED'].includes(post.status) && applicants.length > 0;
                                        const previewApplicants = applicants.slice(0, 3);
                                        const canOpenBooking = Number(post?.bookingId) > 0;
                                        const shouldShowArrivalCta = canOpenBooking && ['CONFIRMED', 'ARRIVED', 'IN_PROGRESS'].includes(String(post?.bookingStatus || '').toUpperCase());
                                        const hasArrivalProof = Boolean(post?.arrivalProofImage);
                                        const bookingSt = String(post?.bookingStatus || post?.status || '').toUpperCase();
                                        const canCustomerCancelDirect =
                                            post.isDirect &&
                                            canOpenBooking &&
                                            bookingSt === 'PENDING_ACCEPTANCE' &&
                                            !['CANCELLED', 'EXPIRED'].includes(String(post.status || '').toUpperCase());
                                        const canCancelJobPost = !post.isDirect &&
                                            ['PENDING', 'PUBLISHED', 'PENDING_ACCEPTANCE'].includes(String(post.status || '').toUpperCase());
                                        const canCancelAny = canCustomerCancelDirect || canCancelJobPost;
                                        const targetKey = `${post.isDirect ? 'DIR' : 'JOB'}-${post.postId}`;

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
                                                            {post.isDirect ? 'Đơn' : 'Bài đăng'} đã chốt thợ. Theo dõi chi tiết để xem tiến độ làm việc.
                                                        </div>
                                                    ) : null}

                                                    {post.cancelReason && ['CANCELLED', 'EXPIRED'].includes(post.status) && (
                                                        <div className="cmp-cancel-reason">
                                                            <svg className="cmp-cancel-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                                                                <circle cx="12" cy="12" r="10" />
                                                                <line x1="12" y1="16" x2="12" y2="12" />
                                                                <line x1="12" y1="8" x2="12.01" y2="8" />
                                                            </svg>
                                                            {post.cancelReason}
                                                        </div>
                                                    )}


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
                                                        <span className="cmp-price-label">Giá :</span>
                                                        <div className="cmp-price-value-group">
                                                            {post.discountAmount > 0 ? (
                                                                <>
                                                                    <span className="cmp-original-price">{formatCurrency(post.originalPrice)}</span>
                                                                    <div className="cmp-final-price-row">
                                                                        <span className="cmp-final-price">{formatCurrency(post.finalPrice)}</span>
                                                                        {(() => {
                                                                            const ratio = (post.originalPrice - post.finalPrice) / post.originalPrice;
                                                                            const pct = Math.round(ratio * 100);
                                                                            if (pct === 5) return <span className="cmp-discount-badge">Hạng Bạc -5%</span>;
                                                                            if (pct === 10) return <span className="cmp-discount-badge">Hạng Vàng -10%</span>;
                                                                            if (pct > 0) return <span className="cmp-discount-badge">-{pct}%</span>;
                                                                            return null;
                                                                        })()}
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                <span className="cmp-normal-price">{formatCurrency(post.estimatedPrice)}</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {post.hasArrivalProof && (
                                                        <div className="cmp-arrival-badge">
                                                            Đã có ảnh địa điểm thợ gửi để xác minh đúng nhà.
                                                        </div>
                                                    )}


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
                                                                            alt={applicant.fullName || 'thợ'}
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
                                                                    ? 'Đã có 1 thợ ứng tuyển vào bài đăng này'
                                                                    : `Đã có ${applicants.length} thợ ứng tuyển vào bài đăng này`}
                                                            </p>
                                                        </div>
                                                    ) : null}

                                                    {canOpenBooking && hasArrivalProof ? (
                                                        <div style={{ marginTop: 12 }}>
                                                            <div className="cmp-assigned-banner" style={{ marginBottom: 0 }}>
                                                                Đã có ảnh địa điểm thợ gửi để xác minh đúng nhà.
                                                            </div>
                                                        </div>
                                                    ) : null}
                                                </div>

                                                <div className="cmp-post-card-footer" style={{ display: 'flex', gap: '10px', flexWrap: 'nowrap' }}>
                                                    {canCancelAny ? (
                                                        <button
                                                            type="button"
                                                            className="cmp-btn-outline"
                                                            disabled={cancellingTargetKey === targetKey}
                                                            style={{
                                                                margin: 0,
                                                                flex: 1,
                                                                minWidth: 0,
                                                                padding: '10px 4px',
                                                                borderColor: '#b91c1c',
                                                                color: '#b91c1c',
                                                            }}
                                                            onClick={() => handleCancelPost(post)}
                                                        >
                                                            {cancellingTargetKey === targetKey
                                                                ? 'Đang hủy…'
                                                                : (post.isDirect ? 'Hủy yêu cầu' : 'Hủy bài đăng')}
                                                        </button>
                                                    ) : null}

                                                    <button
                                                        className="cmp-btn-outline"
                                                        style={{ borderColor: service.color, color: service.color, flex: 1, minWidth: 0, padding: '10px 4px' }}
                                                        type="button"
                                                        onClick={() => {
                                                            navigate(`/customer/manage-posts/${post.postId}`);
                                                        }}
                                                    >
                                                        Xem chi tiết
                                                    </button>
                                                    {canOpenBooking &&
                                                        post.status !== 'CANCELLED' &&
                                                        post.status !== 'EXPIRED' &&
                                                        !(post.isDirect && bookingSt === 'PENDING_ACCEPTANCE') && (
                                                            <button
                                                                type="button"
                                                                className="cmp-btn-outline cmp-btn-action"
                                                                style={{ margin: 0, flex: 1, minWidth: 0, maxWidth: 'none', padding: '10px 4px' }}
                                                                onClick={() => navigate(`/customer/bookings/${post.bookingId}`)}
                                                            >
                                                                {shouldShowArrivalCta
                                                                    ? (post.customerArrivalConfirmed
                                                                        ? 'Xác nhận'
                                                                        : 'Chi tiết xác nhận')
                                                                    : 'Chi tiết booking'}
                                                            </button>
                                                        )}
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
            {pendingCancelJobPost ? (
                <div className="cmp-modal-overlay" onClick={() => setPendingCancelJobPost(null)}>
                    <div className="cmp-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                        <h3>Bạn chắc chắn muốn hủy bài đăng này?</h3>
                        <p>
                            Bài đăng <strong>{pendingCancelJobPost.title || `#${pendingCancelJobPost.postId}`}</strong> sẽ được hủy và không còn hiển thị cho thợ.
                        </p>
                        <div className="cmp-modal-actions">
                            <button
                                type="button"
                                className="cmp-btn-outline"
                                onClick={() => setPendingCancelJobPost(null)}
                                disabled={cancellingTargetKey === `JOB-${pendingCancelJobPost.postId}`}
                            >
                                Đóng
                            </button>
                            <button
                                type="button"
                                className="cmp-btn-outline cmp-btn-danger"
                                onClick={handleConfirmCancelJobPost}
                                disabled={cancellingTargetKey === `JOB-${pendingCancelJobPost.postId}`}
                            >
                                {cancellingTargetKey === `JOB-${pendingCancelJobPost.postId}` ? 'Đang hủy…' : 'Xác nhận hủy'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
            {pendingCancelDirectPost ? (
                <div
                    className="cmp-modal-overlay"
                    onClick={() => {
                        if (cancellingTargetKey !== `DIR-${pendingCancelDirectPost.postId}`) {
                            setPendingCancelDirectPost(null);
                            setCancelDirectError('');
                        }
                    }}
                >
                    <div className="cmp-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                        <h3>Hủy yêu cầu đặt trực tiếp</h3>
                        <p>
                            Bạn chắc chắn muốn hủy yêu cầu <strong>{pendingCancelDirectPost.title || `#${pendingCancelDirectPost.bookingId}`}</strong>?
                            Nếu hủy sát giờ (dưới 2 giờ), hệ thống có thể trừ 30% tiền giữ và hoàn 70% về ví.
                        </p>
                        <label className="cmp-modal-label" htmlFor="cmp-cancel-direct-reason">
                            Nhập lý do hủy (tối thiểu 5 ký tự):
                        </label>
                        <textarea
                            id="cmp-cancel-direct-reason"
                            className="cmp-modal-textarea"
                            rows={3}
                            value={cancelDirectReason}
                            onChange={(e) => {
                                setCancelDirectReason(e.target.value);
                                if (cancelDirectError) setCancelDirectError('');
                            }}
                            placeholder="Ví dụ: Thay đổi kế hoạch nên chưa cần dịch vụ lúc này..."
                            disabled={cancellingTargetKey === `DIR-${pendingCancelDirectPost.postId}`}
                        />
                        {cancelDirectError ? <div className="cmp-modal-error">{cancelDirectError}</div> : null}
                        <div className="cmp-modal-actions">
                            <button
                                type="button"
                                className="cmp-btn-outline"
                                onClick={() => {
                                    setPendingCancelDirectPost(null);
                                    setCancelDirectError('');
                                }}
                                disabled={cancellingTargetKey === `DIR-${pendingCancelDirectPost.postId}`}
                            >
                                Đóng
                            </button>
                            <button
                                type="button"
                                className="cmp-btn-outline cmp-btn-danger"
                                onClick={handleConfirmCancelDirectPost}
                                disabled={cancellingTargetKey === `DIR-${pendingCancelDirectPost.postId}`}
                            >
                                {cancellingTargetKey === `DIR-${pendingCancelDirectPost.postId}` ? 'Đang hủy…' : 'Xác nhận hủy'}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </CustomerLayout>
    );
};

export default CustomerManagePostsPage;
