import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CustomerLayout from '../../layouts/CustomerLayout';
import apiClient from '../../services/apiClient';
import BookingService from '../../services/BookingService';
import ProfileService from '../../services/ProfileService';
import ReviewService from '../../services/ReviewService';
import './CustomerPostDetailPage.css';

const extractPayload = (res) => (res && typeof res === 'object' && 'data' in res ? res.data : res);

const formatCurrency = (val) => {
    const n = Number(val);
    if (!Number.isFinite(n)) return '0 ₫';
    return n.toLocaleString('vi-VN') + ' ₫';
};

const formatDate = (val) => {
    if (!val) return '---';
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return '---';
    return d.toLocaleDateString('vi-VN');
};

const formatDateOfBirth = (value) => {
    if (!value) return '---';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '---';
    return d.toLocaleDateString('vi-VN');
};

const formatDateTime = (value) => {
    if (!value) return '---';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '---';
    return d.toLocaleString('vi-VN');
};

function CpdStars({ rating }) {
    const r = Math.min(5, Math.max(0, Number(rating) || 0));
    return (
        <span className="cpd-mini-stars" aria-label={`${r} trên 5 sao`}>
            {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} className={n <= r ? 'cpd-mini-stars__on' : 'cpd-mini-stars__off'}>
                    ★
                </span>
            ))}
        </span>
    );
}

const getStatusConfig = (status) => {
    switch (status) {
        case 'PUBLISHED':
        case 'PENDING':
            return { label: 'Đang tìm người', color: '#B56A00', bg: '#FEF3C7' };
        case 'ASSIGNED':
        case 'MATCHED':
        case 'CONFIRMED':
            return { label: 'Đã nhận việc', color: '#2196F3', bg: '#E3F2FD' };
        case 'COMPLETED':
            return { label: 'Đã hoàn thành', color: '#16A34A', bg: '#DCFCE7' };
        case 'CANCELLED':
            return { label: 'Đã hủy', color: '#E74C3C', bg: '#FEE2E2' };
        case 'EXPIRED':
            return { label: 'Hết hạn', color: '#6B7280', bg: '#F3F4F6' };
        default:
            return { label: status || '---', color: '#6B7280', bg: '#F3F4F6' };
    }
};

const getApplicantStatusConfig = (status) => {
    switch (status) {
        case 'PENDING':
            return { label: 'Đang chờ', className: 'cpd-applicant-status pending' };
        case 'ACCEPTED':
            return { label: 'Được chọn', className: 'cpd-applicant-status accepted' };
        case 'REJECTED':
            return { label: 'Không được chọn', className: 'cpd-applicant-status rejected' };
        default:
            return { label: status || '---', className: 'cpd-applicant-status default' };
    }
};

const CustomerPostDetailPage = () => {
    const navigate = useNavigate();
    const { postId } = useParams();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [data, setData] = useState(null);
    const [applicants, setApplicants] = useState([]);
    const [loadingApplicants, setLoadingApplicants] = useState(false);
    const [applicantsError, setApplicantsError] = useState('');
    const [selectingApplicationId, setSelectingApplicationId] = useState(null);
    const [actionMessage, setActionMessage] = useState('');
    const [helperProfile, setHelperProfile] = useState(null);
    const [helperProfileLoading, setHelperProfileLoading] = useState(false);
    const [helperProfileError, setHelperProfileError] = useState('');
    const [helperProfileOpen, setHelperProfileOpen] = useState(false);
    const [selectedApplicant, setSelectedApplicant] = useState(null);
    const [helperReviewStats, setHelperReviewStats] = useState(null);
    const [helperReviewsList, setHelperReviewsList] = useState([]);
    const [brokenApplicantAvatars, setBrokenApplicantAvatars] = useState({});
    const [isSelectedApplicantAvatarBroken, setIsSelectedApplicantAvatarBroken] = useState(false);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                let res;
                if (postId.startsWith('DIR-')) {
                    const bookingId = postId.replace('DIR-', '');
                    res = await apiClient.get(`/api/v1/bookings/${bookingId}`);
                    const booking = extractPayload(res);
                    // Map Booking data to pseudo-Job structure
                    const pseudoJob = {
                        postId: postId,
                        title: booking.description ? `Đặt trực tiếp: ${booking.description.substring(0, 35)}` : 'Đặt thợ trực tiếp',
                        categoryName: booking.serviceName,
                        serviceNames: booking.subServiceNames || '',
                        description: booking.description,
                        status: booking.status,
                        createdAt: booking.createdAt,
                        workDate: booking.workDate,
                        startTime: booking.startTime,
                        durationHours: booking.durationHours,
                        offerPrice: booking.totalPrice || booking.finalPrice,
                        addressDetail: booking.address,
                        wardName: booking.wardName,
                        districtName: booking.districtName,
                        provinceName: booking.provinceName,
                        isPremium: booking.isPremium,
                        hasPets: booking.hasPets,
                        bringTools: booking.bringTools,
                        workSize: booking.workSize,
                        bookingId: booking.bookingId,
                        bookingStatus: booking.status,
                        customerArrivalConfirmed: booking.customerArrivalConfirmed,
                        arrivalProofImage: booking.arrivalProofImage,
                        isDirect: true
                    };
                    setData(pseudoJob);
                } else {
                    res = await apiClient.get(`/api/v1/jobs/${postId}`);
                    const job = extractPayload(res);
                    setData(job || null);
                }
            } catch (err) {
                setData(null);
                setError(err?.message || 'Không thể tải chi tiết bài đăng.');
            } finally {
                setLoading(false);
            }
        };

        if (!postId) {
            setLoading(false);
            setError('Thiếu mã bài đăng.');
            return;
        }
        load();
    }, [postId]);

    useEffect(() => {
        const loadApplicants = async () => {
            if (!postId || postId.startsWith('DIR-')) return;
            setLoadingApplicants(true);
            setApplicantsError('');
            try {
                const res = await BookingService.getApplicants(postId);
                const list = extractPayload(res);
                setApplicants(Array.isArray(list) ? list : []);
            } catch (err) {
                setApplicants([]);
                setApplicantsError(err?.message || 'Không thể tải danh sách ứng viên.');
            } finally {
                setLoadingApplicants(false);
            }
        };

        loadApplicants();
    }, [postId]);

    const viewModel = useMemo(() => {
        const job = data || {};
        const addressText = [job?.addressDetail, job?.wardName, job?.districtName, job?.provinceName]
            .filter(Boolean)
            .join(', ');

        return {
            postId: job?.postId ?? '',
            bookingId: job?.bookingId ?? null,
            bookingStatus: job?.bookingStatus ?? null,
            customerArrivalConfirmed: Boolean(job?.customerArrivalConfirmed),
            arrivalProofImage: job?.arrivalProofImage || null,
            title: job?.title || `Bài đăng #${job?.postId ?? ''}`,
            categoryName: job?.categoryName || 'Dịch vụ',
            serviceNames: job?.serviceNames || '',
            description: job?.description || '',
            status: job?.status || '---',
            createdAt: job?.createdAt,
            workDate: job?.workDate,
            startTime: job?.startTime,
            durationHours: job?.durationHours,
            offerPrice: job?.offerPrice,
            addressText: addressText || '---',
            isPremium: Boolean(job?.isPremium),
            hasPets: Boolean(job?.hasPets),
            bringTools: Boolean(job?.bringTools),
            workSize: job?.workSize,
            isDirect: Boolean(job?.isDirect)
        };
    }, [data]);

    const statusConf = getStatusConfig(viewModel.status);
    const canSelectApplicant = viewModel.status === 'PUBLISHED' || viewModel.status === 'PENDING';

    const reloadApplicants = async () => {
        try {
            const res = await BookingService.getApplicants(postId);
            const list = extractPayload(res);
            setApplicants(Array.isArray(list) ? list : []);
            setApplicantsError('');
        } catch (err) {
            setApplicants([]);
            setApplicantsError(err?.message || 'Không thể tải danh sách ứng viên.');
        }
    };

    const reloadJobDetail = async () => {
        try {
            const res = await apiClient.get(`/api/v1/jobs/${postId}`);
            const job = extractPayload(res);
            setData(job || null);
            setError('');
        } catch (err) {
            setData(null);
            setError(err?.message || 'Không thể tải chi tiết bài đăng.');
        }
    };

    const handleSelectApplicant = async (applicationId) => {
        if (!canSelectApplicant || !applicationId) return;
        setSelectingApplicationId(applicationId);
        setActionMessage('');
        try {
            const res = await BookingService.selectApplicant(postId, applicationId);
            setActionMessage(res?.message || 'Chọn thợ thành công.');
            const bookingId = res?.data?.bookingId ?? null;
            await Promise.all([reloadJobDetail(), reloadApplicants()]);
            if (bookingId) {
                navigate(`/customer/bookings/${bookingId}`);
            }
        } catch (err) {
            setActionMessage(err?.message || 'Không thể chọn thợ. Vui lòng thử lại.');
        } finally {
            setSelectingApplicationId(null);
        }
    };

    const closeHelperModal = () => {
        setHelperProfileOpen(false);
        setHelperProfile(null);
        setHelperProfileError('');
        setSelectedApplicant(null);
        setIsSelectedApplicantAvatarBroken(false);
        setHelperReviewStats(null);
        setHelperReviewsList([]);
    };

    const handleOpenHelperProfile = async (applicant) => {
        const helperId = applicant?.helperId;
        if (!helperId) return;
        setSelectedApplicant(applicant || null);
        setIsSelectedApplicantAvatarBroken(false);
        setHelperProfileOpen(true);
        setHelperProfileLoading(true);
        setHelperProfileError('');
        setHelperProfile(null);
        setHelperReviewStats(null);
        setHelperReviewsList([]);
        const settled = await Promise.allSettled([
            ProfileService.getPublicHelperProfile(helperId),
            ReviewService.getHelperReviewStats(helperId),
            ReviewService.getHelperReviews(helperId, { page: 0, size: 15, sort: 'createdAt,desc' }),
        ]);
        const [profRes, statRes, revRes] = settled;
        if (profRes.status === 'fulfilled') {
            setHelperProfile(extractPayload(profRes.value) || null);
        } else {
            setHelperProfile(null);
            setHelperProfileError(profRes.reason?.message || 'Không thể tải hồ sơ thợ.');
        }
        if (statRes.status === 'fulfilled') {
            setHelperReviewStats(extractPayload(statRes.value) || null);
        } else {
            setHelperReviewStats(null);
        }
        if (revRes.status === 'fulfilled') {
            const list = extractPayload(revRes.value);
            setHelperReviewsList(Array.isArray(list) ? list : []);
        } else {
            setHelperReviewsList([]);
        }
        setHelperProfileLoading(false);
    };

    return (
        <CustomerLayout>
            <div className="cpd-container slide-up">
                <div className="cpd-header">
                    <div className="cpd-header-main">
                        <h1 className="cpd-title">Chi tiết bài đăng</h1>
                        <div className="cpd-sub">
                            <span className="cpd-chip">{viewModel.categoryName}</span>
                            <span className="cpd-status" style={{ color: statusConf.color, background: statusConf.bg }}>
                                {statusConf.label}
                            </span>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="cpd-card">
                        <div className="cpd-loading">Đang tải chi tiết...</div>
                    </div>
                ) : error ? (
                    <div className="cpd-card cpd-error">
                        <h3>Không tải được chi tiết</h3>
                        <p>{error}</p>
                        <button className="cpd-primary" type="button" onClick={() => navigate('/customer/manage-posts')}>
                            Về quản lý bài đăng
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="cpd-grid">
                            <div className="cpd-card">
                                <div className="cpd-section">
                                    <div className="cpd-kv">
                                        <div className="cpd-k">Mã bài đăng</div>
                                        <div className="cpd-v">#{viewModel.postId}</div>
                                    </div>
                                    <div className="cpd-kv">
                                        <div className="cpd-k">Tiêu đề</div>
                                        <div className="cpd-v">{viewModel.title}</div>
                                    </div>
                                    <div className="cpd-kv">
                                        <div className="cpd-k">Ngày đăng</div>
                                        <div className="cpd-v">{formatDate(viewModel.createdAt)}</div>
                                    </div>
                                </div>

                                <div className="cpd-divider" />

                                <div className="cpd-section">
                                    <div className="cpd-kv">
                                        <div className="cpd-k">Địa chỉ</div>
                                        <div className="cpd-v">{viewModel.addressText}</div>
                                    </div>
                                    <div className="cpd-kv">
                                        <div className="cpd-k">Ngày làm</div>
                                        <div className="cpd-v">{viewModel.workDate || '---'}</div>
                                    </div>
                                    <div className="cpd-kv">
                                        <div className="cpd-k">Giờ bắt đầu</div>
                                        <div className="cpd-v">{viewModel.startTime || '---'}</div>
                                    </div>
                                    <div className="cpd-kv">
                                        <div className="cpd-k">Thời lượng</div>
                                        <div className="cpd-v">{viewModel.durationHours ? `${viewModel.durationHours} giờ` : '---'}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="cpd-card">
                                <div className="cpd-section">
                                    <div className="cpd-price-label">Giá đề xuất</div>
                                    <div className="cpd-price">{formatCurrency(viewModel.offerPrice)}</div>
                                    <div className="cpd-meta">
                                        {viewModel.isPremium && <span className="cpd-pill">Premium</span>}
                                        {viewModel.hasPets && <span className="cpd-pill">Có thú cưng</span>}
                                        {viewModel.bringTools && <span className="cpd-pill">Cần mang dụng cụ</span>}
                                        {viewModel.workSize ? <span className="cpd-pill">Diện tích: {viewModel.workSize}</span> : null}
                                    </div>
                                </div>

                                <div className="cpd-divider" />

                                <div className="cpd-section">
                                    <div className="cpd-kv">
                                        <div className="cpd-k">Dịch vụ con</div>
                                        <div className="cpd-v">{viewModel.serviceNames || '---'}</div>
                                    </div>
                                    <div className="cpd-kv">
                                        <div className="cpd-k">Ghi chú</div>
                                        <div className="cpd-v">{viewModel.description || '---'}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="cpd-actions">
                            <button className="cpd-secondary" type="button" onClick={() => navigate('/customer/manage-posts')}>
                                Danh sách bài đăng
                            </button>
                            {Number(viewModel.bookingId) > 0 ? (
                                <button
                                    className="cpd-primary"
                                    type="button"
                                    onClick={() => navigate(`/customer/bookings/${viewModel.bookingId}`)}
                                >
                                    {viewModel.customerArrivalConfirmed
                                        ? 'Xem xác nhận helper đã đến'
                                        : 'Xem chi tiết đơn làm việc'}
                                </button>
                            ) : null}
                        </div>

                        {viewModel.arrivalProofImage ? (
                            <div className="cpd-card" style={{ marginTop: 12 }}>
                                <h3 style={{ marginTop: 0 }}>Ảnh địa điểm thợ đã gửi</h3>
                                <img
                                    src={viewModel.arrivalProofImage}
                                    alt="Ảnh địa điểm helper gửi"
                                    style={{ width: '100%', borderRadius: 12, border: '1px solid #e2e8f0' }}
                                />
                                <p style={{ marginTop: 8, color: '#475569' }}>
                                    Chủ nhà có thể vào chi tiết booking để xác nhận thợ đã đến đúng địa chỉ.
                                </p>
                            </div>
                        ) : null}

                        {!viewModel.isDirect && (
                            <div className="cpd-card cpd-applicants-card">
                                <div className="cpd-applicants-header">
                                    <h3>Danh sách người đã apply</h3>
                                    <span>{applicants.length} ứng viên</span>
                                </div>

                                {actionMessage ? <p className="cpd-action-message">{actionMessage}</p> : null}

                                {loadingApplicants ? (
                                    <p className="cpd-applicants-loading">Đang tải danh sách ứng viên...</p>
                                ) : applicantsError ? (
                                    <p className="cpd-applicants-error">{applicantsError}</p>
                                ) : applicants.length === 0 ? (
                                    <p className="cpd-applicants-empty">Chưa có helper nào ứng tuyển vào bài đăng này.</p>
                                ) : (
                                    <div className="cpd-applicants-list">
                                        {applicants.map((applicant) => (
                                            <div key={applicant.applicationId} className="cpd-applicant-item">
                                                <div className="cpd-applicant-main">
                                                    <div className="cpd-applicant-avatar">
                                                        {applicant?.avatarUrl && !brokenApplicantAvatars[applicant.applicationId] ? (
                                                            <img
                                                                className="cpd-helper-avatar-img"
                                                                src={applicant.avatarUrl}
                                                                alt={applicant.fullName || 'thợ'}
                                                                onError={() =>
                                                                    setBrokenApplicantAvatars((prev) => ({
                                                                        ...prev,
                                                                        [applicant.applicationId]: true,
                                                                    }))
                                                                }
                                                            />
                                                        ) : (
                                                            (applicant?.fullName || 'H').charAt(0).toUpperCase()
                                                        )}
                                                    </div>
                                                    <div className="cpd-applicant-info">
                                                        {applicant.hasOverlap && (
                                                            <div className="cpd-overlap-badge" title="Thợ này đã có đơn hàng khác trong khung giờ này">
                                                                Trùng lịch làm việc
                                                            </div>
                                                        )}
                                                        <div className="cpd-applicant-title-row">
                                                            <p className="cpd-applicant-name">{applicant.fullName || 'thợ'}</p>
                                                            <span className={getApplicantStatusConfig(applicant.status).className}>
                                                                {getApplicantStatusConfig(applicant.status).label}
                                                            </span>
                                                        </div>
                                                        <p className="cpd-applicant-meta">
                                                            ⭐ {Number(applicant.rating || 0).toFixed(1)} ({applicant.reviewCount || 0} đánh giá)
                                                        </p>
                                                        <p className="cpd-applicant-bio">
                                                            {applicant.bio || 'Chưa có phần giới thiệu.'}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="cpd-applicant-actions">
                                                    <button
                                                        type="button"
                                                        className="cpd-secondary"
                                                        onClick={() => handleOpenHelperProfile(applicant)}
                                                    >
                                                        Xem hồ sơ
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="cpd-primary"
                                                        disabled={
                                                            !canSelectApplicant ||
                                                            selectingApplicationId === applicant.applicationId ||
                                                            applicant.status !== 'PENDING' ||
                                                            applicant.hasOverlap
                                                        }
                                                        onClick={() => handleSelectApplicant(applicant.applicationId)}
                                                    >
                                                        {!canSelectApplicant
                                                            ? 'Đã chốt thợ'
                                                            : applicant.hasOverlap
                                                                ? 'Trùng lịch'
                                                                : selectingApplicationId === applicant.applicationId
                                                                    ? 'Đang chọn...'
                                                                    : 'Chọn thợ này'}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {helperProfileOpen ? (
                <div className="cpd-helper-modal-overlay" onClick={closeHelperModal}>
                    <div className="cpd-helper-modal cpd-helper-modal--wide" onClick={(e) => e.stopPropagation()}>
                        <div className="cpd-helper-modal-header">
                            <h3>Hồ sơ thợ</h3>
                            <button type="button" className="cpd-back" onClick={closeHelperModal}>
                                Đóng
                            </button>
                        </div>

                        {helperProfileLoading ? (
                            <p className="cpd-applicants-loading">Đang tải hồ sơ thợ...</p>
                        ) : (
                            <div className="cpd-helper-profile-content">
                                {helperProfileError ? (
                                    <p className="cpd-applicants-error" role="alert">
                                        {helperProfileError}
                                    </p>
                                ) : null}

                                {selectedApplicant ? (
                                    <div className="cpd-helper-hero">
                                        <div className="cpd-helper-avatar-wrap">
                                            {selectedApplicant?.avatarUrl && !isSelectedApplicantAvatarBroken ? (
                                                <img
                                                    className="cpd-helper-avatar-img"
                                                    src={selectedApplicant.avatarUrl}
                                                    alt={selectedApplicant?.fullName || 'Helper'}
                                                    onError={() => setIsSelectedApplicantAvatarBroken(true)}
                                                />
                                            ) : (
                                                <div className="cpd-helper-avatar-fallback">
                                                    {(selectedApplicant?.fullName || 'T').charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                        <div className="cpd-helper-headline">
                                            <h4>{selectedApplicant?.fullName || 'thợ'}</h4>
                                            <div className="cpd-helper-badges">
                                                <span className="cpd-helper-badge">
                                                    ⭐{' '}
                                                    {Number(
                                                        helperReviewStats?.averageRating ??
                                                        helperProfile?.ratingAverage ??
                                                        selectedApplicant?.rating ??
                                                        0
                                                    ).toFixed(1)}{' '}
                                                    (
                                                    {helperReviewStats?.totalReviews ??
                                                        helperProfile?.totalReviews ??
                                                        selectedApplicant?.reviewCount ??
                                                        0}{' '}
                                                    đánh giá)
                                                </span>
                                                {helperProfile ? (
                                                    <>
                                                        <span
                                                            className={`cpd-helper-badge ${helperProfile?.isOnline ? 'online' : 'offline'}`}
                                                        >
                                                            {helperProfile?.isOnline ? 'Đang online' : 'Đang offline'}
                                                        </span>
                                                        <span className="cpd-helper-badge">
                                                            KYC: {helperProfile?.kycStatus || 'Chưa xác minh'}
                                                        </span>
                                                    </>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                ) : null}

                                {helperProfile ? (
                                    <>
                                        <div className="cpd-helper-metrics">
                                            <div className="cpd-helper-metric-item">
                                                <span>Kinh nghiệm</span>
                                                <strong>{helperProfile?.experienceYears ?? 0} năm</strong>
                                            </div>
                                            <div className="cpd-helper-metric-item">
                                                <span>Quê quán</span>
                                                <strong>{helperProfile?.hometownName || '---'}</strong>
                                            </div>
                                            <div className="cpd-helper-metric-item">
                                                <span>Ngày sinh</span>
                                                <strong>{formatDateOfBirth(helperProfile?.dateOfBirth)}</strong>
                                            </div>
                                        </div>

                                        <div className="cpd-helper-section">
                                            <h5>Kỹ năng dịch vụ</h5>
                                            <div className="cpd-helper-chip-list">
                                                {(helperProfile?.categories || []).length > 0 ? (
                                                    helperProfile.categories.map((cat) => (
                                                        <span key={cat?.id || cat?.name} className="cpd-helper-chip">
                                                            {cat?.name || 'Dịch vụ'}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="cpd-helper-muted">Chưa cập nhật kỹ năng.</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="cpd-helper-section">
                                            <h5>Khu vực làm việc</h5>
                                            <div className="cpd-helper-chip-list">
                                                {(helperProfile?.workingDistricts || []).length > 0 ? (
                                                    helperProfile.workingDistricts.map((district, idx) => (
                                                        <span
                                                            key={`${district?.districtName || 'district'}-${idx}`}
                                                            className="cpd-helper-chip location"
                                                        >
                                                            {district?.districtName || district?.name || 'Khu vực'}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="cpd-helper-muted">Chưa cập nhật khu vực làm việc.</span>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                ) : null}

                                <div className="cpd-helper-section cpd-helper-reviews-block">
                                    <div className="cpd-helper-reviews-head">
                                        <h5>Đánh giá từ khách hàng</h5>
                                        {helperReviewStats != null && (helperReviewStats.totalReviews ?? 0) > 0 ? (
                                            <span className="cpd-helper-reviews-summary">
                                                TB{' '}
                                                <strong>
                                                    {helperReviewStats.averageRating != null
                                                        ? Number(helperReviewStats.averageRating).toFixed(1)
                                                        : '—'}
                                                </strong>
                                                /5 · {helperReviewStats.totalReviews} lượt
                                            </span>
                                        ) : null}
                                    </div>
                                    {helperReviewsList.length === 0 ? (
                                        <p className="cpd-helper-muted cpd-helper-reviews-empty">
                                            Chưa có đánh giá công khai nào để hiển thị.
                                        </p>
                                    ) : (
                                        <ul className="cpd-helper-reviews-list">
                                            {helperReviewsList.map((rev) => (
                                                <li key={rev.id} className="cpd-helper-review-item">
                                                    <div className="cpd-helper-review-top">
                                                        <span className="cpd-helper-review-name">{rev.customerName || 'Khách hàng'}</span>
                                                        <CpdStars rating={rev.rating} />
                                                    </div>
                                                    <span className="cpd-helper-review-date">{formatDateTime(rev.createdAt)}</span>
                                                    {rev.comment ? <p className="cpd-helper-review-text">{rev.comment}</p> : null}
                                                    {rev.tags ? (
                                                        <div className="cpd-helper-review-tags">
                                                            {rev.tags
                                                                .split(',')
                                                                .map((t) => t.trim())
                                                                .filter(Boolean)
                                                                .map((t, i) => (
                                                                    <span key={`${t}-${i}`} className="cpd-helper-review-tag">
                                                                        {t}
                                                                    </span>
                                                                ))}
                                                        </div>
                                                    ) : null}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                <div className="cpd-helper-section">
                                    {helperProfile ? (
                                        <>
                                            <h5>Giới thiệu</h5>
                                            <p className="cpd-helper-bio-text">{helperProfile?.bio || 'thợ chưa cập nhật phần giới thiệu.'}</p>
                                        </>
                                    ) : null}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : null}
        </CustomerLayout>
    );
};

export default CustomerPostDetailPage;
