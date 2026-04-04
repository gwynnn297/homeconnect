import React, { useCallback, useEffect, useState } from 'react';
import HelperLayout from '../../layouts/HelperLayout';
import ProfileService from '../../services/ProfileService';
import ReviewService from '../../services/ReviewService';
import './HelperReviewsPage.css';

const extractPayload = (res) => (res && typeof res === 'object' && 'data' in res ? res.data : res);

const formatDateTime = (value) => {
    if (!value) return '---';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '---';
    return d.toLocaleString('vi-VN');
};

const RATING_WORDS = {
    1: 'Chưa hài lòng',
    2: 'Cần cải thiện',
    3: 'Tạm được',
    4: 'Hài lòng',
    5: 'Tuyệt vời',
};

function StarsRow({ rating }) {
    const r = Math.min(5, Math.max(0, Number(rating) || 0));
    return (
        <span className="hrev-stars" aria-label={`${r} trên 5 sao`}>
            {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} className={n <= r ? 'hrev-stars__on' : 'hrev-stars__off'}>
                    ★
                </span>
            ))}
        </span>
    );
}

function DistributionBar({ star, count, max }) {
    const pct = max > 0 ? Math.round((count / max) * 100) : 0;
    return (
        <div className="hrev-dist-row">
            <span className="hrev-dist-label">{star}★</span>
            <div className="hrev-dist-track">
                <div className="hrev-dist-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="hrev-dist-count">{count}</span>
        </div>
    );
}

function ReviewCard({ review }) {
    const tags = review.tags
        ? review.tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
        : [];

    return (
        <article className="hrev-card">
            <div className="hrev-card__top">
                <div className="hrev-card__who">
                    <div className="hrev-card__avatar" aria-hidden>
                        {(review.customerName || 'K').charAt(0)}
                    </div>
                    <div>
                        <div className="hrev-card__name">{review.customerName || 'Khách hàng'}</div>
                        <div className="hrev-card__meta">{formatDateTime(review.createdAt)}</div>
                    </div>
                </div>
                <div className="hrev-card__score">
                    <StarsRow rating={review.rating} />
                    <span className="hrev-card__score-num">{review.rating}/5</span>
                    <span className="hrev-card__score-word">{RATING_WORDS[review.rating] || ''}</span>
                </div>
            </div>
            {review.comment ? <p className="hrev-card__comment">{review.comment}</p> : null}
            {tags.length > 0 ? (
                <div className="hrev-card__tags">
                    {tags.map((t, i) => (
                        <span key={`${t}-${i}`} className="hrev-tag">
                            {t}
                        </span>
                    ))}
                </div>
            ) : null}
            {review.evidencePhotoUrl ? (
                <div className="hrev-card__evidence">
                    <a href={review.evidencePhotoUrl} target="_blank" rel="noopener noreferrer" className="hrev-card__evidence-link">
                        Ảnh minh chứng từ khách →
                    </a>
                    <div className="hrev-card__evidence-preview">
                        <img src={review.evidencePhotoUrl} alt="" onError={(e) => { e.target.style.display = 'none'; }} />
                    </div>
                </div>
            ) : null}
        </article>
    );
}

const PAGE_SIZE = 15;

const HelperReviewsPage = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [helperId, setHelperId] = useState(null);

    const [stats, setStats] = useState(null);
    const [reviews, setReviews] = useState([]);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    const resolveHelperId = useCallback(async () => {
        try {
            const res = await ProfileService.getMyProfile();
            const p = extractPayload(res);
            if (p?.id != null) return Number(p.id);
        } catch {
            /* fall through */
        }
        try {
            const u = JSON.parse(localStorage.getItem('user') || '{}');
            if (u.userId != null) return Number(u.userId);
        } catch {
            /* ignore */
        }
        return null;
    }, []);

    const loadStats = useCallback(async (hid) => {
        const res = await ReviewService.getHelperReviewStats(hid);
        const s = extractPayload(res);
        setStats(s || null);
    }, []);

    const loadReviews = useCallback(
        async (hid, pageNum, append) => {
            const res = await ReviewService.getHelperReviews(hid, {
                page: pageNum,
                size: PAGE_SIZE,
                sort: 'createdAt,desc',
            });
            const list = extractPayload(res);
            const arr = Array.isArray(list) ? list : [];
            if (append) {
                setReviews((prev) => [...prev, ...arr]);
            } else {
                setReviews(arr);
            }
            setHasMore(arr.length >= PAGE_SIZE);
        },
        []
    );

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError('');
            try {
                const hid = await resolveHelperId();
                if (cancelled) return;
                if (hid == null) {
                    setError('Không xác định được tài khoản helper. Vui lòng đăng nhập lại.');
                    setLoading(false);
                    return;
                }
                setHelperId(hid);
                await Promise.all([loadStats(hid), loadReviews(hid, 0, false)]);
                setPage(0);
            } catch (e) {
                if (!cancelled) setError(e?.message || 'Không tải được đánh giá.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [resolveHelperId, loadStats, loadReviews]);

    const handleLoadMore = async () => {
        if (!helperId || loadingMore || !hasMore) return;
        const next = page + 1;
        setLoadingMore(true);
        try {
            await loadReviews(helperId, next, true);
            setPage(next);
        } catch (e) {
            setError(e?.message || 'Không tải thêm được.');
        } finally {
            setLoadingMore(false);
        }
    };

    const avg = stats?.averageRating != null ? Number(stats.averageRating).toFixed(1) : '—';
    const total = stats?.totalReviews ?? 0;
    const dist = stats?.ratingDistribution || {};
    const distCount = (k) => Number(dist[k] ?? dist[String(k)] ?? 0);
    const maxBar = Math.max(1, ...[1, 2, 3, 4, 5].map(distCount));

    return (
        <HelperLayout>
            <div className="hrev-page">
                <header className="hrev-header">
                    <h1 className="hrev-title">Đánh giá từ khách hàng</h1>
                    <p className="hrev-sub">Xem nhận xét sau mỗi ca hoàn thành. Tên khách có thể được ẩn danh theo chính sách hệ thống.</p>
                </header>

                {loading ? (
                    <div className="hrev-skeleton-wrap">
                        <div className="hrev-skeleton hrev-skeleton--hero" />
                        <div className="hrev-skeleton hrev-skeleton--line" />
                        <div className="hrev-skeleton hrev-skeleton--line short" />
                    </div>
                ) : error ? (
                    <div className="hrev-alert hrev-alert--error">{error}</div>
                ) : (
                    <>
                        <section className="hrev-hero">
                            <div className="hrev-hero__main">
                                <div className="hrev-hero__big">
                                    <span className="hrev-hero__avg">{avg}</span>
                                    <span className="hrev-hero__out">/5</span>
                                </div>
                                <StarsRow rating={Math.round(Number(stats?.averageRating) || 0)} />
                                <p className="hrev-hero__total">
                                    Dựa trên <strong>{total}</strong> đánh giá công khai
                                </p>
                            </div>
                            <div className="hrev-hero__dist">
                                <h2 className="hrev-hero__dist-title">Phân bổ số sao</h2>
                                {[5, 4, 3, 2, 1].map((star) => (
                                    <DistributionBar key={star} star={star} count={distCount(star)} max={maxBar} />
                                ))}
                            </div>
                        </section>

                        <section className="hrev-list-section">
                            <h2 className="hrev-list-title">Nhận xét gần đây</h2>
                            {reviews.length === 0 ? (
                                <div className="hrev-empty">
                                    <div className="hrev-empty__icon" aria-hidden>
                                        ★
                                    </div>
                                    <p className="hrev-empty__title">Chưa có đánh giá nào</p>
                                    <p className="hrev-empty__text">Hoàn thành thêm ca việc và nhận đánh giá từ khách để xây uy tín nhé.</p>
                                </div>
                            ) : (
                                <>
                                    <ul className="hrev-list">
                                        {reviews.map((r) => (
                                            <li key={r.id}>
                                                <ReviewCard review={r} />
                                            </li>
                                        ))}
                                    </ul>
                                    {hasMore ? (
                                        <div className="hrev-more-wrap">
                                            <button type="button" className="hrev-btn hrev-btn--secondary" disabled={loadingMore} onClick={handleLoadMore}>
                                                {loadingMore ? 'Đang tải…' : 'Tải thêm'}
                                            </button>
                                        </div>
                                    ) : null}
                                </>
                            )}
                        </section>
                    </>
                )}
            </div>
        </HelperLayout>
    );
};

export default HelperReviewsPage;
