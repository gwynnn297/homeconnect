import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CustomerLayout from '../../layouts/CustomerLayout';
import ProfileService from '../../services/ProfileService';
import DirectBookingModal from '../../components/DirectBookingModal';
import NotificationModal from '../../components/NotificationModal';
import './PublicHelperDetailPage.css';

const PublicHelperDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [helper, setHelper] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showBooking, setShowBooking] = useState(false);
    const [toast, setToast] = useState(null);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await ProfileService.getPublicHelperProfile(id);
                setHelper(res?.data?.data || res?.data);
            } catch (err) {
                console.error("Error fetching helper profile:", err);
                setToast({ type: 'error', message: 'Không thể tải hồ sơ thợ.' });
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, [id]);

    if (loading) {
        return (
            <CustomerLayout>
                <div className="hp-loading">
                    <div className="hp-spinner"></div>
                    <p>Đang tải hồ sơ thợ...</p>
                </div>
            </CustomerLayout>
        );
    }

    if (!helper) {
        return (
            <CustomerLayout>
                <div className="hp-error-state">
                    <h3>Hồ sơ không tồn tại</h3>
                    <button onClick={() => navigate('/customer/search-helper')}>Quay lại bảng tin</button>
                </div>
            </CustomerLayout>
        );
    }

    return (
        <CustomerLayout>
            <div className="hp-container">
                {toast && <NotificationModal message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

                <div className="hp-content-grid">
                    {/* Left Column: Main Info */}
                    <div className="hp-main-col">
                        <header className="hp-header">
                            <button className="hp-back-btn" onClick={() => navigate(-1)}>← Quay lại</button>
                            <div className="hp-profile-card">
                                <div className="hp-avatar-wrap">
                                    <img src={helper.avatarUrl || '/default-avatar.png'} alt={helper.fullName} className="hp-avatar" />
                                    {helper.isOnline && <span className="hp-online-dot"></span>}
                                </div>
                                <div className="hp-basic-info">
                                    <div className="hp-name-row">
                                        <h1 className="hp-name">{helper.fullName}</h1>
                                        {helper.kycStatus === 'VERIFIED' && <span className="hp-verified-badge" title="Đã xác minh danh tính">🛡️</span>}
                                    </div>
                                    <div className="hp-stats-row">
                                        <span className="hp-stat-item">⭐ <strong>{helper.ratingAverage || '5.0'}</strong> ({helper.totalReviews || 0} đánh giá)</span>
                                        <span className="hp-stat-divider">|</span>
                                        <span className="hp-stat-item">💼 <strong>{helper.experienceYears || 0}</strong> năm kinh nghiệm</span>
                                    </div>
                                    <p className="hp-hometown">🏠 Quê quán: {helper.hometownName || 'N/A'}</p>
                                </div>
                            </div>
                        </header>

                        <section className="hp-section">
                            <h3 className="hp-section-title">✨ Giới thiệu</h3>
                            <p className="hp-bio">{helper.bio || 'Thợ chưa cập nhật lời giới thiệu...'}</p>
                        </section>

                        <section className="hp-section">
                            <h3 className="hp-section-title">🛠 Kỹ năng & Dịch vụ</h3>
                            <div className="hp-cat-tags">
                                {helper.categories?.map(cat => (
                                    <div key={cat.id || cat.categoryId} className="hp-cat-pill">
                                        {cat.name}
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="hp-section">
                            <h3 className="hp-section-title">📍 Khu vực làm việc</h3>
                            <div className="hp-dist-list">
                                {helper.workingDistricts?.length > 0 ? (
                                    helper.workingDistricts.map(dist => (
                                        <span key={dist.code} className="hp-dist-tag">📍 {dist.name}</span>
                                    ))
                                ) : (
                                    <p className="hp-empty-hint">Chưa cập nhật khu vực làm việc cụ thể.</p>
                                )}
                            </div>
                        </section>
                    </div>

                    {/* Right Column: Actions & Summary */}
                    <aside className="hp-side-col">
                        <div className="hp-action-card">
                            <div className="hp-price-hint">Giá chỉ từ <strong>60.000đ</strong>/giờ</div>
                            <button className="hp-book-btn" onClick={() => setShowBooking(true)}>
                                Đặt lịch ngay
                            </button>
                            <p className="hp-action-desc">Cam kết dịch vụ chất lượng, an tâm cho gia đình bạn.</p>
                        </div>

                        <div className="hp-trust-card">
                            <h4>Tại sao chọn {helper.fullName}?</h4>
                            <ul>
                                <li>✅ Đã xác minh danh tính (KYC)</li>
                                <li>✅ Hồ sơ kinh nghiệm rõ ràng</li>
                                <li>✅ Đã qua đào tạo kỹ năng</li>
                                <li>✅ Bảo hiểm dịch vụ HomieConnect</li>
                            </ul>
                        </div>
                    </aside>
                </div>

                {showBooking && (
                    <DirectBookingModal
                        helper={helper}
                        onClose={() => setShowBooking(false)}
                        onSuccess={() => {
                            setToast({ type: 'success', message: 'Yêu cầu đặt thợ đã được gửi!' });
                            setShowBooking(false);
                        }}
                    />
                )}
            </div>
        </CustomerLayout>
    );
};

export default PublicHelperDetailPage;
