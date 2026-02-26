import React, { useState, useEffect } from 'react';
import KYCModal from '../../components/KYCModal';
import HelperLayout from '../../layouts/HelperLayout';
import './HelperDashboardPage.css';

const HelperDashboardPage = () => {
    const [showKYCModal, setShowKYCModal] = useState(false);
    const [kycStatus, setKycStatus] = useState(null);

    useEffect(() => {
        // Lấy thông tin user từ localStorage
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const status = user.kycStatus || 'PENDING'; // Backend mặc định trả về 'PENDING'
        setKycStatus(status);

        // Nếu chưa nộp KYC (PENDING) → hiển thị modal
        if (status === 'PENDING') {
            setShowKYCModal(true);
        }
    }, []);

    const handleKYCSuccess = () => {
        setShowKYCModal(false);
        setKycStatus('WAITING_APPROVAL');
    };

    const handleCloseKYC = () => {
        setShowKYCModal(false);
    };

    // Render trạng thái KYC - 4 trạng thái: PENDING, WAITING_APPROVAL, VERIFIED, REJECTED
    const renderKYCStatus = () => {
        switch (kycStatus) {
            case 'PENDING':
                // Trường hợp chưa nộp hồ sơ KYC
                return (
                    <div className="helper-status-card">
                        <div className="helper-status-icon pending">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#346252" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="8.5" cy="7" r="4" />
                                <path d="M20 8v6" />
                                <path d="M23 11h-6" />
                            </svg>
                        </div>
                        <h2 className="helper-status-title">Chưa xác minh danh tính</h2>
                        <p className="helper-status-desc">
                            Bạn cần hoàn tất xác minh danh tính (KYC) để có thể nhận việc trên HomieConnect.
                        </p>
                        <button className="helper-retry-btn" onClick={() => setShowKYCModal(true)}>
                            Xác minh ngay
                        </button>
                    </div>
                );

            case 'WAITING_APPROVAL':
                // Trường hợp đã nộp hồ sơ, đang chờ admin duyệt
                return (
                    <div className="helper-status-card">
                        <div className="helper-status-icon waiting">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                            </svg>
                        </div>
                        <h2 className="helper-status-title">Hồ sơ đang chờ duyệt</h2>
                        <p className="helper-status-desc">
                            Hồ sơ KYC của bạn đã được gửi thành công và đang chờ Admin phê duyệt.
                            Bạn sẽ nhận được thông báo khi hồ sơ được xử lý.
                        </p>
                    </div>
                );

            case 'VERIFIED':
                // Trường hợp hồ sơ đã được admin duyệt, có thể nhận việc
                return (
                    <div className="helper-status-card">
                        <div className="helper-status-icon verified">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                        </div>
                        <h2 className="helper-status-title">Đã xác minh</h2>
                        <p className="helper-status-desc">
                            Tài khoản của bạn đã được xác minh thành công. Bạn có thể bắt đầu nhận việc!
                        </p>
                    </div>
                );

            case 'REJECTED':
                // Trường hợp hồ sơ bị từ chối, cần nộp lại
                return (
                    <div className="helper-status-card">
                        <div className="helper-status-icon rejected">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="15" y1="9" x2="9" y2="15" />
                                <line x1="9" y1="9" x2="15" y2="15" />
                            </svg>
                        </div>
                        <h2 className="helper-status-title">Hồ sơ bị từ chối</h2>
                        <p className="helper-status-desc">
                            Hồ sơ KYC của bạn đã bị từ chối. Vui lòng nộp lại hồ sơ với thông tin chính xác.
                        </p>
                        <button className="helper-retry-btn" onClick={() => setShowKYCModal(true)}>
                            Nộp lại hồ sơ
                        </button>
                    </div>
                );

            default:
                // Fallback cho các trường hợp không mong muốn
                return null;
        }
    };

    return (
        <HelperLayout>
            <div className="helper-dashboard-main">
                {/* <h1 className="helper-page-title">Dashboard</h1> */}
                {renderKYCStatus()}
            </div>

            {/* KYC Modal */}
            <KYCModal
                isOpen={showKYCModal}
                onClose={handleCloseKYC}
                onSuccess={handleKYCSuccess}
            />
        </HelperLayout>
    );
};

export default HelperDashboardPage;