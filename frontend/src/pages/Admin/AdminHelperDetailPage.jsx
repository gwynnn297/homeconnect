import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import AdminService from '../../services/AdminService';
import NotificationModal from '../../components/NotificationModal';
import './AdminHelperDetailPage.css';

const AdminHelperDetailPage = () => {
    const { helperId } = useParams();
    const navigate = useNavigate();
    
    const [helper, setHelper] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [reviewAction, setReviewAction] = useState('VERIFIED');
    const [rejectionReason, setRejectionReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [toast, setToast] = useState(null);

    useEffect(() => {
        const fetchDetail = async () => {
            setLoading(true);
            try {
                const response = await AdminService.getHelperDetail(helperId);
                setHelper(response);
            } catch (err) {
                setError(err.message || 'Lỗi khi tải chi tiết Helper');
            } finally {
                setLoading(false);
            }
        };
        fetchDetail();
    }, [helperId]);

    const handleReview = async () => {
        if (reviewAction === 'REJECTED' && !rejectionReason.trim()) {
            setToast({ type: 'warning', message: 'Vui lòng nhập lý do từ chối' });
            return;
        }

        setSubmitting(true);
        try {
            if (reviewAction === 'VERIFIED') {
                await AdminService.approveCv(helperId);
            } else {
                const data = {
                    action: reviewAction,
                    rejectionReason: reviewAction === 'REJECTED' ? rejectionReason : null
                };
                await AdminService.reviewHelper(helperId, data);
            }
            setToast({ type: 'success', message: `Đã ${reviewAction === 'VERIFIED' ? 'xác minh' : 'từ chối'} Helper thành công` });
            setShowReviewModal(false);
            setTimeout(() => navigate('/admin/helpers'), 600);
        } catch (err) {
            setToast({ type: 'error', message: 'Lỗi: ' + (err.message || 'Không thể xử lý yêu cầu') });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return (
        <AdminLayout>
            <div className="admin-helper-detail-main">
                <p className="text-center">Đang tải dữ liệu...</p>
            </div>
        </AdminLayout>
    );

    if (error) return (
        <AdminLayout>
            <div className="admin-helper-detail-main">
                <div className="error-message">{error}</div>
            </div>
        </AdminLayout>
    );

    const getStatusLabel = (status) => {
        switch (status) {
            case 'PENDING':
                return 'Chưa nộp';
            case 'WAITING_APPROVAL':
                return 'Chờ duyệt';
            case 'IDENTITY_VERIFIED':
                return 'AI Verified';
            case 'VERIFIED':
                return 'Đã xác minh';
            case 'REJECTED':
                return 'Bị từ chối';
            default:
                return status;
        }
    };

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'PENDING':
                return 'status-pending';
            case 'WAITING_APPROVAL':
                return 'status-waiting';
            case 'IDENTITY_VERIFIED':
                return 'status-ai-verified';
            case 'VERIFIED':
                return 'status-verified';
            case 'REJECTED':
                return 'status-rejected';
            default:
                return '';
        }
    };

    return (
        <AdminLayout>
            <div className="admin-helper-detail-main">
                <div className="detail-header">
                    <h1>Chi tiết Helper #{helper.helperId}</h1>
                </div>

                {/* Basic Info */}
                <div className="detail-section">
                    <h2>Thông tin cơ bản</h2>
                    <div className="info-grid">
                        <div className="info-item">
                            <label>Tên</label>
                            <p>{helper.fullName}</p>
                        </div>
                        <div className="info-item">
                            <label>Email</label>
                            <p>{helper.email}</p>
                        </div>
                        <div className="info-item">
                            <label>Điện thoại</label>
                            <p>{helper.phone}</p>
                        </div>
                        <div className="info-item">
                            <label>Trạng thái tài khoản</label>
                            <p>{helper.status}</p>
                        </div>
                        <div className="info-item">
                            <label>Ngày tạo</label>
                            <p>{new Date(helper.createdAt).toLocaleDateString('vi-VN')}</p>
                        </div>
                        <div className="info-item">
                            <label>Năm kinh nghiệm</label>
                            <p>{helper.experienceYears} năm</p>
                        </div>
                    </div>
                    {helper.avatarUrl && (
                        <div className="avatar-section">
                            <p>Avatar:</p>
                            <img src={helper.avatarUrl} alt={helper.fullName} className="avatar-image" />
                        </div>
                    )}
                </div>

                {/* Profile Info */}
                <div className="detail-section">
                    <h2>Thông tin hồ sơ</h2>
                    <div className="info-grid">
                        <div className="info-item full-width">
                            <label>Tiểu sử</label>
                            <p>{helper.bio}</p>
                        </div>
                        <div className="info-item">
                            <label>Ngày sinh</label>
                            <p>{new Date(helper.dateOfBirth).toLocaleDateString('vi-VN')}</p>
                        </div>
                        <div className="info-item">
                            <label>Địa chỉ chi tiết</label>
                            <p>{helper.addressDetail}</p>
                        </div>
                        <div className="info-item">
                            <label>Quê quán</label>
                            <p>{helper.hometown?.name}</p>
                        </div>
                        <div className="info-item">
                            <label>Thành phố hiện tại</label>
                            <p>{helper.currentCity?.name}</p>
                        </div>
                    </div>
                </div>

                {/* KYC Status */}
                <div className="detail-section">
                    <h2>Thông tin KYC</h2>
                    <div className="info-grid">
                        <div className="info-item">
                            <label>Trạng thái KYC</label>
                            <p>
                                <span className={`status-badge ${getStatusBadgeClass(helper.kycStatus)}`}>
                                    {getStatusLabel(helper.kycStatus)}
                                </span>
                            </p>
                        </div>
                        <div className="info-item">
                            <label>CMND/CCCD</label>
                            <p>{helper.cccdNumber || helper.identityNumber}</p>
                        </div>
                        {helper.aiVerified && (
                            <div className="info-item">
                                <label>AI Verification</label>
                                <p><span className="ai-verified-pill">✓ AI Verified</span></p>
                            </div>
                        )}
                        {helper.rejectionReason && (
                            <div className="info-item full-width">
                                <label>Lý do từ chối</label>
                                <p className="rejection-reason">{helper.rejectionReason}</p>
                            </div>
                        )}
                    </div>

                    {/* Identity Documents */}
                    <div className="documents-section">
                        <h3>Giấy tờ tùy thân</h3>
                        <div className="document-grid">
                            {helper.identityFrontUrl && (
                                <div className="document-item">
                                    <p>
                                        Mặt trước CMND/CCCD
                                        {helper.aiVerified && <span className="ai-verified-pill document-pill">✓ AI Verified</span>}
                                    </p>
                                    <img src={helper.identityFrontUrl} alt="Mặt trước" />
                                </div>
                            )}
                            {helper.identityBackUrl && (
                                <div className="document-item">
                                    <p>Mặt sau CMND/CCCD</p>
                                    <img src={helper.identityBackUrl} alt="Mặt sau" />
                                </div>
                            )}
                            {helper.selfieUrl && (
                                <div className="document-item">
                                    <p>Ảnh chân dung</p>
                                    <img src={helper.selfieUrl} alt="Ảnh chân dung" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Services */}
                <div className="detail-section">
                    <h2>Dịch vụ ({helper.services?.length || 0})</h2>
                    {helper.services && helper.services.length > 0 ? (
                        <div className="services-list">
                            {helper.services.map((service) => (
                                <div key={service.serviceId} className="service-item">
                                    {service.iconUrl && <img src={service.iconUrl} alt={service.name} />}
                                    <span>{service.name}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p>Không có dịch vụ nào</p>
                    )}
                </div>

                {/* Working Districts */}
                <div className="detail-section">
                    <h2>Khu vực làm việc ({helper.workingDistricts?.length || 0})</h2>
                    {helper.workingDistricts && helper.workingDistricts.length > 0 ? (
                        <div className="districts-list">
                            {helper.workingDistricts.map((district) => (
                                <span key={district.locationId} className="district-tag">
                                    {district.name}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <p>Không có khu vực nào</p>
                    )}
                </div>

                {/* Action Buttons */}
                {(helper.kycStatus === 'IDENTITY_VERIFIED' || helper.kycStatus === 'WAITING_APPROVAL') && (
                    <div className="action-buttons">
                        <button 
                            className="btn-approve"
                            onClick={() => { setReviewAction('VERIFIED'); setShowReviewModal(true); }}
                        >
                            ✓ Xác minh
                        </button>
                        <button 
                            className="btn-reject"
                            onClick={() => { setReviewAction('REJECTED'); setShowReviewModal(true); }}
                        >
                            ✕ Từ chối
                        </button>
                    </div>
                )}

                {/* Review Modal */}
                {showReviewModal && (
                    <div className="modal-overlay" onClick={() => setShowReviewModal(false)}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <h3>
                                {reviewAction === 'VERIFIED' ? 'Xác minh Helper' : 'Từ chối Helper'}
                            </h3>
                            
                            {reviewAction === 'REJECTED' && (
                                <div className="form-group">
                                    <label>Lý do từ chối (bắt buộc)</label>
                                    <textarea
                                        value={rejectionReason}
                                        onChange={(e) => setRejectionReason(e.target.value)}
                                        placeholder="Nhập lý do từ chối..."
                                        rows="4"
                                    />
                                </div>
                            )}

                            <p className="confirm-text">
                                Bạn có chắc chắn muốn {reviewAction === 'VERIFIED' ? 'xác minh' : 'từ chối'} Helper này?
                            </p>

                            <div className="modal-actions">
                                <button 
                                    className="btn-cancel"
                                    onClick={() => setShowReviewModal(false)}
                                    disabled={submitting}
                                >
                                    Hủy
                                </button>
                                <button 
                                    className={reviewAction === 'VERIFIED' ? 'btn-approve' : 'btn-reject'}
                                    onClick={handleReview}
                                    disabled={submitting}
                                >
                                    {submitting ? 'Đang xử lý...' : 'Xác nhận'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {toast && (
                    <NotificationModal
                        type={toast.type}
                        message={toast.message}
                        onClose={() => setToast(null)}
                    />
                )}
            </div>
        </AdminLayout>
    );
};

export default AdminHelperDetailPage;
