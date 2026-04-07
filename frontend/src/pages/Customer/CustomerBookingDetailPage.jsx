import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CustomerLayout from '../../layouts/CustomerLayout';
import BookingService from '../../services/BookingService';
import ReviewService from '../../services/ReviewService';
import './CustomerBookingDetailPage.css';

const extractPayload = (res) => (res && typeof res === 'object' && 'data' in res ? res.data : res);

const RATING_TEXT = {
    1: 'Chưa hài lòng',
    2: 'Cần cải thiện',
    3: 'Tạm được',
    4: 'Hài lòng',
    5: 'Tuyệt vời',
};

const QUICK_TAGS = ['Đúng giờ', 'Chu đáo', 'Chuyên nghiệp', 'Sạch sẽ', 'Thân thiện'];

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

const getInitials = (name) => {
    if (!name || !String(name).trim()) return '?';
    const parts = String(name).trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const getBookingStatusUI = (status) => {
    const s = String(status || '').toUpperCase();
    switch (s) {
        case 'PENDING':
        case 'PENDING_ACCEPTANCE':
            return { label: 'Chờ xác nhận', tone: 'warning' };
        case 'PENDING_COMPLETION':
            return { label: 'Chờ bạn xác nhận', tone: 'warning' };
        case 'CONFIRMED':
            return { label: 'Đã xác nhận', tone: 'success' };
        case 'ARRIVED':
            return { label: 'Helper đã đến nhà', tone: 'success' };
        case 'IN_PROGRESS':
            return { label: 'Đang thực hiện công việc', tone: 'success' };
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

const canEditReviewByTime = (review) => {
    if (!review?.createdAt) return false;
    const created = new Date(review.createdAt);
    if (Number.isNaN(created.getTime())) return false;
    return Date.now() < created.getTime() + 24 * 60 * 60 * 1000;
};

function StarPicker({ value, onChange, disabled, idPrefix = 'star' }) {
    const [hover, setHover] = useState(0);
    const display = hover || value;

    return (
        <div className="cbd-star-block">
            <div className="cbd-star-row" role="group" aria-label="Chọn số sao từ 1 đến 5">
                {[1, 2, 3, 4, 5].map((n) => (
                    <button
                        key={n}
                        type="button"
                        id={`${idPrefix}-${n}`}
                        className={`cbd-star-btn ${n <= display ? 'cbd-star-btn--active' : ''}`}
                        disabled={disabled}
                        onMouseEnter={() => !disabled && setHover(n)}
                        onMouseLeave={() => setHover(0)}
                        onFocus={() => setHover(n)}
                        onBlur={() => setHover(0)}
                        onClick={() => onChange(n)}
                        aria-pressed={n <= value}
                    >
                        ★
                    </button>
                ))}
            </div>
            <div className="cbd-star-caption">
                <span className="cbd-star-score">{value}/5</span>
                <span className="cbd-star-words">{RATING_TEXT[display] || RATING_TEXT[value]}</span>
            </div>
        </div>
    );
}

function StarsReadOnly({ rating }) {
    const r = Math.min(5, Math.max(0, Number(rating) || 0));
    return (
        <span className="cbd-stars-readonly" aria-label={`${r} trên 5 sao`}>
            {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} className={n <= r ? 'cbd-stars-readonly__on' : 'cbd-stars-readonly__off'}>
                    ★
                </span>
            ))}
            <span className="cbd-stars-readonly__label">{RATING_TEXT[r]}</span>
        </span>
    );
}

function EvidencePreview({ url }) {
    const [broken, setBroken] = useState(false);
    if (!url || broken) return null;
    return (
        <div className="cbd-evidence-preview">
            <img src={url} alt="Ảnh minh chứng đánh giá" onError={() => setBroken(true)} />
        </div>
    );
}

const CustomerBookingDetailPage = () => {
    const navigate = useNavigate();
    const { bookingId } = useParams();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [booking, setBooking] = useState(null);
    const [confirmingArrival, setConfirmingArrival] = useState(false);

    const [confirming, setConfirming] = useState(false);
    const [reviewLoading, setReviewLoading] = useState(false);
    const [existingReview, setExistingReview] = useState(null);
    const [submittingReview, setSubmittingReview] = useState(false);
    const [editingReview, setEditingReview] = useState(false);

    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [tags, setTags] = useState('');
    const [evidencePhotoUrl, setEvidencePhotoUrl] = useState('');

    const [actionError, setActionError] = useState('');
    const [actionSuccess, setActionSuccess] = useState('');

    const reloadBooking = useCallback(async () => {
        if (!bookingId) return;
        const res = await BookingService.getBookingDetail(bookingId);
        setBooking(extractPayload(res) || null);
    }, [bookingId]);

    const loadReview = useCallback(async () => {
        if (!bookingId) return;
        setReviewLoading(true);
        try {
            const res = await ReviewService.getReviewByBooking(bookingId);
            const data = extractPayload(res);
            setExistingReview(data && typeof data === 'object' && data.id != null ? data : null);
        } catch {
            setExistingReview(null);
        } finally {
            setReviewLoading(false);
        }
    }, [bookingId]);

    useEffect(() => {
        const loadBooking = async () => {
            if (!bookingId) return;
            setLoading(true);
            setError('');
            try {
                await reloadBooking();
            } catch (err) {
                setBooking(null);
                setError(err?.message || 'Không thể tải chi tiết đơn hàng.');
            } finally {
                setLoading(false);
            }
        };

        loadBooking();
    }, [bookingId, reloadBooking]);

    useEffect(() => {
        const st = String(booking?.status || '').toUpperCase();
        if (st !== 'COMPLETED') {
            setExistingReview(null);
            return;
        }
        loadReview();
    }, [booking?.status, loadReview]);

    useEffect(() => {
        if (existingReview && editingReview) {
            setRating(existingReview.rating ?? 5);
            setComment(existingReview.comment ?? '');
            setTags(existingReview.tags ?? '');
            setEvidencePhotoUrl(existingReview.evidencePhotoUrl ?? '');
        }
    }, [existingReview, editingReview]);

    const clearFeedback = () => {
        setActionError('');
        setActionSuccess('');
    };

    const toggleQuickTag = (label) => {
        const parts = tags
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        const has = parts.includes(label);
        const next = has ? parts.filter((p) => p !== label) : [...parts, label];
        setTags(next.join(', '));
    };

    const isQuickTagActive = (label) =>
        tags
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .includes(label);

    const handleConfirmComplete = async () => {
        if (!bookingId) return;
        clearFeedback();
        setConfirming(true);
        try {
            await BookingService.confirmComplete(bookingId);
            setActionSuccess('Đã xác nhận hoàn thành. Bạn có thể gửi đánh giá bên dưới.');
            await reloadBooking();
        } catch (err) {
            setActionError(err?.message || 'Không xác nhận được. Thử lại sau.');
        } finally {
            setConfirming(false);
        }
    };

    const handleSubmitReview = async (e) => {
        e.preventDefault();
        if (!bookingId) return;
        clearFeedback();
        setSubmittingReview(true);
        try {
            await ReviewService.submitReview({
                bookingId: Number(bookingId),
                rating,
                comment: comment.trim() || undefined,
                tags: tags.trim() || undefined,
                evidencePhotoUrl: evidencePhotoUrl.trim() || undefined,
            });
            setActionSuccess('Cảm ơn bạn đã gửi đánh giá!');
            await loadReview();
            setComment('');
            setTags('');
            setEvidencePhotoUrl('');
            setRating(5);
        } catch (err) {
            setActionError(err?.message || 'Gửi đánh giá thất bại.');
        } finally {
            setSubmittingReview(false);
        }
    };

    const handleUpdateReview = async (e) => {
        e.preventDefault();
        if (!existingReview?.id) return;
        clearFeedback();
        setSubmittingReview(true);
        try {
            await ReviewService.updateReview(existingReview.id, {
                rating,
                comment: comment.trim() || undefined,
                tags: tags.trim() || undefined,
                evidencePhotoUrl: evidencePhotoUrl.trim() || undefined,
            });
            setActionSuccess('Đã cập nhật đánh giá.');
            setEditingReview(false);
            await loadReview();
        } catch (err) {
            setActionError(err?.message || 'Cập nhật đánh giá thất bại.');
        } finally {
            setSubmittingReview(false);
        }
    };

    const statusUI = getBookingStatusUI(booking?.status);
    const paymentUI = getPaymentStatusUI(booking?.paymentStatus);
    const normalizedStatus = String(booking?.status || '').toUpperCase();
    const statusUpper = normalizedStatus;
    const showConfirmBanner = statusUpper === 'PENDING_COMPLETION';
    const showReviewSection = statusUpper === 'COMPLETED';
    const editableWindow = existingReview && canEditReviewByTime(existingReview);
    const helperName = booking?.helperName || 'Helper';
    const hasArrivalSignal = Boolean(booking?.arrivalProofImage) || Boolean(booking?.arrivedAt) || ['ARRIVED', 'IN_PROGRESS'].includes(normalizedStatus);
    const hasConfirmedFlag = Boolean(booking?.customerArrivalConfirmed);
    const isInconsistentArrivalState = hasConfirmedFlag && normalizedStatus === 'ARRIVED';
    const isArrivalConfirmed = hasConfirmedFlag && !isInconsistentArrivalState;
    const canShowArrivalConfirmSection = hasArrivalSignal;
    const canSubmitArrivalConfirm = canShowArrivalConfirmSection
        && Boolean(booking?.arrivalProofImage)
        && (!hasConfirmedFlag || isInconsistentArrivalState);

    const handleConfirmArrival = async () => {
        if (!booking?.bookingId || confirmingArrival) return;
        setConfirmingArrival(true);
        setError('');
        try {
            const res = await BookingService.confirmArrival(booking.bookingId);
            const data = res?.data ?? res;
            setBooking(data || booking);
        } catch (err) {
            setError(err?.message || 'Không thể xác nhận helper đã đến.');
        } finally {
            setConfirmingArrival(false);
        }
    };

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
                        <div className="cbd-loading cbd-loading--pulse">Đang tải đơn hàng...</div>
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
                        {actionError ? (
                            <div className="cbd-feedback cbd-feedback--error" role="alert">
                                <span className="cbd-feedback__icon" aria-hidden>
                                    !
                                </span>
                                <span>{actionError}</span>
                            </div>
                        ) : null}
                        {actionSuccess ? (
                            <div className="cbd-feedback cbd-feedback--success" role="status">
                                <span className="cbd-feedback__icon cbd-feedback__icon--ok" aria-hidden>
                                    ✓
                                </span>
                                <span>{actionSuccess}</span>
                            </div>
                        ) : null}

                        {showConfirmBanner ? (
                            <div className="cbd-action-banner cbd-action-banner--pending">
                                <div className="cbd-action-banner__visual" aria-hidden>
                                    <span className="cbd-action-banner__emoji">✓</span>
                                </div>
                                <div className="cbd-action-banner__body">
                                    <div className="cbd-action-banner__kicker">Bước cuối cùng</div>
                                    <strong className="cbd-action-banner__title">Thợ đã báo hoàn thành công việc</strong>
                                    <p className="cbd-action-banner__desc">
                                        Kiểm tra chất lượng công việc tại địa điểm. Khi hài lòng, hãy xác nhận để kết thúc đơn — sau đó bạn có thể{' '}
                                        <strong>đánh giá helper</strong> (tối đa 7 ngày).
                                    </p>
                                </div>
                                <button
                                    className="cbd-btn cbd-btn--primary cbd-btn--lg"
                                    type="button"
                                    disabled={confirming}
                                    onClick={handleConfirmComplete}
                                >
                                    {confirming ? 'Đang xử lý…' : 'Xác nhận hoàn thành'}
                                </button>
                            </div>
                        ) : null}

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
                                    <div className="cbd-k">Thời điểm đã đến</div>
                                    <div className="cbd-v">{formatDateTime(booking?.arrivedAt)}</div>
                                </div>
                                <div className="cbd-kv">
                                    <div className="cbd-k">Địa chỉ</div>
                                    <div className="cbd-v">{booking?.address || '---'}</div>
                                </div>
                            </div>

                            {booking?.arrivalProofImage && (
                                <div className="cbd-card">
                                    <div className="cbd-section-title">Ảnh địa điểm helper đã gửi</div>
                                    <img
                                        src={booking.arrivalProofImage}
                                        alt="Ảnh địa điểm helper gửi"
                                        style={{ width: '100%', borderRadius: 12, border: '1px solid #e2e8f0' }}
                                    />
                                </div>
                            )}

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
                                <div className="cbd-kv">
                                    <div className="cbd-k">Xác nhận địa điểm</div>
                                    <div className="cbd-v">
                                        {isArrivalConfirmed
                                            ? 'Đã xác nhận đúng nhà'
                                            : isInconsistentArrivalState
                                                ? 'Đã xác minh, đang chờ đồng bộ trạng thái'
                                                : 'Chưa xác nhận'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {canShowArrivalConfirmSection && (
                            <div className="cbd-actions" style={{ marginTop: 8 }}>
                                {isArrivalConfirmed ? (
                                    <button className="cbd-btn cbd-btn--primary" type="button" disabled>
                                        Đã xác minh helper đến đúng nhà
                                    </button>
                                ) : (
                                    <button
                                        className="cbd-btn cbd-btn--primary"
                                        type="button"
                                        onClick={handleConfirmArrival}
                                        disabled={confirmingArrival || !canSubmitArrivalConfirm}
                                    >
                                        {confirmingArrival
                                            ? 'Đang xác nhận...'
                                            : canSubmitArrivalConfirm
                                                ? (isInconsistentArrivalState
                                                    ? 'Đồng bộ trạng thái sang Đang thực hiện'
                                                    : 'Xác nhận helper đã đến đúng nhà')
                                                : 'Chưa có ảnh địa điểm để xác nhận'}
                                    </button>
                                )}

                                {!isArrivalConfirmed && !canSubmitArrivalConfirm && (
                                    <div style={{ color: '#b45309', fontSize: 14 }}>
                                        Nút xác nhận sẽ bật khi hệ thống đã nhận được ảnh địa điểm helper gửi.
                                    </div>
                                )}

                                {isInconsistentArrivalState && (
                                    <div style={{ color: '#b45309', fontSize: 14 }}>
                                        Hệ thống phát hiện trạng thái chưa đồng bộ. Bấm nút để cập nhật sang Đang thực hiện.
                                    </div>
                                )}

                                {isArrivalConfirmed && (
                                    <div style={{ color: '#065f46', fontSize: 14 }}>
                                        Bạn đã xác minh thành công
                                        {booking?.customerArrivalConfirmedAt ? ` lúc ${formatDateTime(booking.customerArrivalConfirmedAt)}.` : '.'}
                                    </div>
                                )}
                            </div>
                        )}

                        {showReviewSection ? (
                            <section className="cbd-review-shell" aria-labelledby="cbd-review-heading">
                                <div className="cbd-review-card">
                                    <div className="cbd-review-card__accent" aria-hidden />

                                    <div className="cbd-review-hero">
                                        <div className="cbd-review-hero__icon" aria-hidden>
                                            ★
                                        </div>
                                        <div className="cbd-review-hero__text">
                                            <h2 id="cbd-review-heading" className="cbd-review-hero__title">
                                                Đánh giá helper
                                            </h2>
                                            <p className="cbd-review-hero__sub">
                                                Ý kiến của bạn giúp cộng đồng chọn thợ phù hợp hơn. Mỗi đơn <strong>một lần</strong> gửi, trong{' '}
                                                <strong>7 ngày</strong>; có thể <strong>sửa trong 24 giờ</strong> sau khi gửi.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="cbd-review-helper">
                                        <div className="cbd-review-helper__avatar" aria-hidden>
                                            {getInitials(helperName)}
                                        </div>
                                        <div>
                                            <div className="cbd-review-helper__label">Bạn đang đánh giá</div>
                                            <div className="cbd-review-helper__name">{helperName}</div>
                                        </div>
                                    </div>

                                    {reviewLoading ? (
                                        <div className="cbd-review-skeleton">
                                            <div className="cbd-review-skeleton__line cbd-review-skeleton__line--long" />
                                            <div className="cbd-review-skeleton__line" />
                                            <div className="cbd-review-skeleton__line cbd-review-skeleton__line--short" />
                                        </div>
                                    ) : existingReview && !editingReview ? (
                                        <div className="cbd-review-done">
                                            <div className="cbd-review-done__badge">
                                                <span className="cbd-review-done__check" aria-hidden>
                                                    ✓
                                                </span>
                                                <span>Đã gửi đánh giá</span>
                                            </div>
                                            <div className="cbd-review-done__head">
                                                <StarsReadOnly rating={existingReview.rating} />
                                                {editableWindow ? (
                                                    <button
                                                        type="button"
                                                        className="cbd-btn cbd-btn--ghost cbd-btn--rounded"
                                                        onClick={() => {
                                                            clearFeedback();
                                                            setEditingReview(true);
                                                        }}
                                                    >
                                                        Chỉnh sửa
                                                    </button>
                                                ) : null}
                                            </div>
                                            {existingReview.comment ? (
                                                <blockquote className="cbd-review-quote">{existingReview.comment}</blockquote>
                                            ) : (
                                                <p className="cbd-review-quote cbd-review-quote--empty">Không có nhận xét kèm theo.</p>
                                            )}
                                            {existingReview.tags ? (
                                                <div className="cbd-tag-display">
                                                    {existingReview.tags
                                                        .split(',')
                                                        .map((t) => t.trim())
                                                        .filter(Boolean)
                                                        .map((t, i) => (
                                                            <span key={`${t}-${i}`} className="cbd-tag-pill">
                                                                {t}
                                                            </span>
                                                        ))}
                                                </div>
                                            ) : null}
                                            {existingReview.evidencePhotoUrl ? (
                                                <div className="cbd-review-extra">
                                                    <span className="cbd-review-extra__label">Ảnh minh chứng</span>
                                                    <EvidencePreview url={existingReview.evidencePhotoUrl} />
                                                    <a
                                                        className="cbd-link-ghost"
                                                        href={existingReview.evidencePhotoUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                    >
                                                        Mở liên kết đầy đủ →
                                                    </a>
                                                </div>
                                            ) : null}
                                            <p className="cbd-review-meta cbd-review-meta--muted">Gửi lúc {formatDateTime(existingReview.createdAt)}</p>
                                        </div>
                                    ) : (
                                        <form
                                            className="cbd-review-form"
                                            onSubmit={existingReview && editingReview ? handleUpdateReview : handleSubmitReview}
                                        >
                                            <div className="cbd-field">
                                                <span className="cbd-label">Mức độ hài lòng (bắt buộc)</span>
                                                <StarPicker
                                                    value={rating}
                                                    onChange={setRating}
                                                    disabled={submittingReview}
                                                    idPrefix={editingReview ? 'edit-star' : 'new-star'}
                                                />
                                            </div>

                                            <label className="cbd-field">
                                                <span className="cbd-label">Nhận xét chi tiết</span>
                                                <textarea
                                                    className="cbd-textarea"
                                                    rows={4}
                                                    value={comment}
                                                    onChange={(ev) => setComment(ev.target.value)}
                                                    disabled={submittingReview}
                                                    placeholder="Ví dụ: Thợ đến đúng giờ, làm cẩn thận, giao tiếp lịch sự…"
                                                    maxLength={2000}
                                                />
                                                <span className="cbd-char-count">{comment.length}/2000</span>
                                            </label>

                                            <div className="cbd-field">
                                                <span className="cbd-label">Gợi ý nhanh (chọn nhiều)</span>
                                                <div className="cbd-chip-row" role="group" aria-label="Thẻ gợi ý">
                                                    {QUICK_TAGS.map((tag) => (
                                                        <button
                                                            key={tag}
                                                            type="button"
                                                            className={`cbd-chip ${isQuickTagActive(tag) ? 'cbd-chip--on' : ''}`}
                                                            disabled={submittingReview}
                                                            onClick={() => toggleQuickTag(tag)}
                                                        >
                                                            {tag}
                                                        </button>
                                                    ))}
                                                </div>
                                                <span className="cbd-field-hint">Các thẻ được gộp thành một chuỗi gửi lên server (đúng định dạng backend).</span>
                                            </div>

                                            <label className="cbd-field">
                                                <span className="cbd-label">Thẻ tùy chỉnh (tùy chọn)</span>
                                                <input
                                                    className="cbd-input"
                                                    type="text"
                                                    value={tags}
                                                    onChange={(ev) => setTags(ev.target.value)}
                                                    disabled={submittingReview}
                                                    placeholder="Có thể chỉnh sửa hoặc thêm thẻ, phân tách bằng dấu phẩy"
                                                    maxLength={500}
                                                />
                                            </label>

                                            <label className="cbd-field">
                                                <span className="cbd-label">URL ảnh minh chứng (tùy chọn)</span>
                                                <input
                                                    className="cbd-input"
                                                    type="url"
                                                    value={evidencePhotoUrl}
                                                    onChange={(ev) => setEvidencePhotoUrl(ev.target.value)}
                                                    disabled={submittingReview}
                                                    placeholder="https://…"
                                                />
                                                <EvidencePreview url={evidencePhotoUrl.trim()} />
                                            </label>

                                            <div className="cbd-review-form__actions">
                                                {editingReview ? (
                                                    <button
                                                        type="button"
                                                        className="cbd-btn cbd-btn--rounded"
                                                        disabled={submittingReview}
                                                        onClick={() => {
                                                            setEditingReview(false);
                                                            clearFeedback();
                                                        }}
                                                    >
                                                        Hủy
                                                    </button>
                                                ) : null}
                                                <button
                                                    className="cbd-btn cbd-btn--primary cbd-btn--lg cbd-btn--rounded"
                                                    type="submit"
                                                    disabled={submittingReview}
                                                >
                                                    {submittingReview ? 'Đang gửi…' : editingReview ? 'Lưu thay đổi' : 'Gửi đánh giá'}
                                                </button>
                                            </div>
                                        </form>
                                    )}
                                </div>
                            </section>
                        ) : null}

                        <div className="cbd-actions">
                            <button className="cbd-btn cbd-btn--rounded" type="button" onClick={() => navigate('/customer/manage-posts')}>
                                Danh sách bài đăng
                            </button>
                            <button className="cbd-btn cbd-btn--primary cbd-btn--rounded" type="button" onClick={() => navigate('/customer-dashboard')}>
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
