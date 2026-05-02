import React, { useState, useEffect } from 'react';
import ProfileService from '../services/ProfileService';
import './HelperProfileModal.css';

const HelperProfileModal = ({ helper, onClose, onBookNow }) => {
    const [reviews, setReviews] = useState([]);
    const [imgError, setImgError] = useState(false);

    useEffect(() => {
        if (!helper?.id) return;
        const fetchReviews = async () => {
            try {
                const res = await ProfileService.getHelperReviews(helper.id);
                setReviews(res?.data?.data || res?.data || []);
            } catch (err) {
                console.error("Error fetching reviews:", err);
            }
        };
        fetchReviews();
    }, [helper?.id]);

    if (!helper) return null;

    return (
        <div className="hpm-overlay" onClick={onClose}>
            <div className="hpm-modal" onClick={e => e.stopPropagation()}>
                <button className="hpm-close-btn" onClick={onClose}>&times;</button>

                <div className="hpm-header">
                    <div className="hpm-avatar-row">
                        <div className="hpm-avatar-wrap">
                            {!imgError && helper.avatarUrl ? (
                                <img
                                    src={helper.avatarUrl}
                                    alt={helper.fullName}
                                    className="hpm-avatar"
                                    onError={() => setImgError(true)}
                                />
                            ) : (
                                <div className="hpm-avatar-fallback">
                                    {(helper.fullName || 'H').charAt(0).toUpperCase()}
                                </div>
                            )}
                            {helper.isOnline && <span className="hpm-online-dot"></span>}
                        </div>
                        <div className="hpm-title-info">
                            <div className="hpm-name-row">
                                <h3 className="hpm-name">{helper.fullName}</h3>
                                {helper.kycStatus === 'VERIFIED' && <span className="hpm-verified-badge" title="Đã xác minh">🛡️</span>}
                            </div>
                            <div className="hpm-rating-row">
                                <span className="hpm-star">⭐</span>
                                <span className="hpm-rating-val">{helper.ratingAverage || '5.0'}</span>
                                <span className="hpm-reviews">({helper.totalReviews || 0} đánh giá)</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="hpm-body">
                    <div className="hpm-stats-grid">
                        <div className="hpm-stat-box">
                            <span className="hpm-stat-label">Kinh nghiệm</span>
                            <span className="hpm-stat-value">{helper.experienceYears || 0} năm</span>
                        </div>
                        <div className="hpm-stat-box">
                            <span className="hpm-stat-label">Quê quán</span>
                            <span className="hpm-stat-value">{helper.hometownName || 'N/A'}</span>
                        </div>
                    </div>

                    <div className="hpm-section">
                        <h4 className="hpm-section-title">Giới thiệu</h4>
                        <p className="hpm-bio">{helper.bio || 'Chưa có lời giới thiệu.'}</p>
                    </div>

                    <div className="hpm-section">
                        <h4 className="hpm-section-title">Dịch vụ nhận làm</h4>
                        <div className="hpm-tag-list">
                            {helper.categories?.map(cat => (
                                <span key={cat.id || cat.categoryId} className="hpm-tag-pill">{cat.name}</span>
                            ))}
                        </div>
                    </div>

                    <div className="hpm-section">
                        <h4 className="hpm-section-title">Khu vực hoạt động</h4>
                        <div className="hpm-tag-list">
                            {helper.workingDistricts?.map(dist => (
                                <span key={dist.code} className="hpm-dist-tag">📍 {dist.name}</span>
                            ))}
                        </div>
                    </div>

                    <div className="hpm-section">
                        <h4 className="hpm-section-title">Đánh giá gần đây</h4>
                        <div className="hpm-reviews-list">
                            {reviews.length > 0 ? (
                                reviews.map(rev => (
                                    <div key={rev.id} className="hpm-review-item">
                                        <div className="hpm-rev-header">
                                            <span className="hpm-rev-stars">{"⭐".repeat(rev.rating)}</span>
                                            <span className="hpm-rev-date">
                                                {new Date(rev.createdAt).toLocaleDateString('vi-VN')}
                                            </span>
                                        </div>
                                        <p className="hpm-rev-comment">{rev.comment || "Không có nhận xét."}</p>
                                    </div>
                                ))
                            ) : (
                                <p className="hpm-empty-hint">Chưa có đánh giá nào.</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="hpm-footer">
                    <button className="hpm-book-btn" onClick={() => {
                        onClose();
                        onBookNow(helper);
                    }}>
                        Đặt lịch ngay
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HelperProfileModal;
