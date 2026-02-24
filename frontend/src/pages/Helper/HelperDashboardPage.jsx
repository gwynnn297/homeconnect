import React, { useState, useEffect } from 'react';
import KYCModal from '../../components/KYCModal';

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
                    <div style={styles.statusCard}>
                        <div style={{ ...styles.statusIcon, backgroundColor: '#eff6ff' }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#346252" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="8.5" cy="7" r="4" />
                                <path d="M20 8v6" />
                                <path d="M23 11h-6" />
                            </svg>
                        </div>
                        <h2 style={styles.statusTitle}>Chưa xác minh danh tính</h2>
                        <p style={styles.statusDesc}>
                            Bạn cần hoàn tất xác minh danh tính (KYC) để có thể nhận việc trên HomieConnect.
                        </p>
                        <button style={styles.retryBtn} onClick={() => setShowKYCModal(true)}>
                            Xác minh ngay
                        </button>
                    </div>
                );
                
            case 'WAITING_APPROVAL':
                // Trường hợp đã nộp hồ sơ, đang chờ admin duyệt
                return (
                    <div style={styles.statusCard}>
                        <div style={{ ...styles.statusIcon, backgroundColor: '#fef3c7' }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                            </svg>
                        </div>
                        <h2 style={styles.statusTitle}>Hồ sơ đang chờ duyệt</h2>
                        <p style={styles.statusDesc}>
                            Hồ sơ KYC của bạn đã được gửi thành công và đang chờ Admin phê duyệt.
                            Bạn sẽ nhận được thông báo khi hồ sơ được xử lý.
                        </p>
                    </div>
                );
                
            case 'VERIFIED':
                // Trường hợp hồ sơ đã được admin duyệt, có thể nhận việc
                return (
                    <div style={styles.statusCard}>
                        <div style={{ ...styles.statusIcon, backgroundColor: '#dcfce7' }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                        </div>
                        <h2 style={styles.statusTitle}>Đã xác minh</h2>
                        <p style={styles.statusDesc}>
                            Tài khoản của bạn đã được xác minh thành công. Bạn có thể bắt đầu nhận việc!
                        </p>
                    </div>
                );
                
            case 'REJECTED':
                // Trường hợp hồ sơ bị từ chối, cần nộp lại
                return (
                    <div style={styles.statusCard}>
                        <div style={{ ...styles.statusIcon, backgroundColor: '#fef2f2' }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="15" y1="9" x2="9" y2="15" />
                                <line x1="9" y1="9" x2="15" y2="15" />
                            </svg>
                        </div>
                        <h2 style={styles.statusTitle}>Hồ sơ bị từ chối</h2>
                        <p style={styles.statusDesc}>
                            Hồ sơ KYC của bạn đã bị từ chối. Vui lòng nộp lại hồ sơ với thông tin chính xác.
                        </p>
                        <button style={styles.retryBtn} onClick={() => setShowKYCModal(true)}>
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
        <div style={styles.container}>
            {/* Header */}
            <header style={styles.header}>
                <div style={styles.logo}>
                    <svg style={{ width: 28, height: 28, color: '#346252' }} viewBox="0 0 24 24" fill="currentColor">
                        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
                    </svg>
                    <span style={styles.logoText}>HomieConnect</span>
                </div>
                <div style={styles.headerRight}>
                    <span style={styles.roleBadge}>Helper</span>
                </div>
            </header>

            {/* Main Content */}
            <main style={styles.main}>
                <h1 style={styles.pageTitle}>Dashboard</h1>
                {renderKYCStatus()}
            </main>

            {/* KYC Modal */}
            <KYCModal
                isOpen={showKYCModal}
                onClose={handleCloseKYC}
                onSuccess={handleKYCSuccess}
            />
        </div>
    );
};

// Inline styles matching project color scheme
const styles = {
    container: {
        minHeight: '100vh',
        backgroundColor: '#f8fafc',
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
    },
    header: {
        backgroundColor: '#ffffff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem 5%',
        boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
    },
    logo: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
    },
    logoText: {
        fontSize: '1.35rem',
        fontWeight: 'bold',
        color: '#346252',
    },
    headerRight: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    roleBadge: {
        backgroundColor: '#f0faf5',
        color: '#346252',
        padding: '6px 16px',
        borderRadius: '999px',
        fontSize: '0.85rem',
        fontWeight: 600,
        border: '1px solid #bbf7d0',
    },
    main: {
        maxWidth: '800px',
        margin: '2rem auto',
        padding: '0 1.5rem',
    },
    pageTitle: {
        fontSize: '1.75rem',
        fontWeight: 700,
        color: '#1e293b',
        marginBottom: '1.5rem',
    },
    statusCard: {
        backgroundColor: '#ffffff',
        borderRadius: '20px',
        padding: '2.5rem',
        textAlign: 'center',
        boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
        border: '1px solid #e2e8f0',
    },
    statusIcon: {
        width: '64px',
        height: '64px',
        borderRadius: '18px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        margin: '0 auto 1.25rem',
    },
    statusTitle: {
        fontSize: '1.3rem',
        fontWeight: 700,
        color: '#1e293b',
        marginBottom: '0.75rem',
    },
    statusDesc: {
        fontSize: '0.95rem',
        color: '#64748b',
        lineHeight: 1.6,
        maxWidth: '500px',
        margin: '0 auto',
    },
    retryBtn: {
        marginTop: '1.5rem',
        padding: '0.75rem 2rem',
        border: 'none',
        borderRadius: '14px',
        fontSize: '0.95rem',
        fontWeight: 600,
        color: '#fff',
        background: 'linear-gradient(135deg, #346252, #3d7561)',
        cursor: 'pointer',
        transition: 'all 0.25s',
    },
};

export default HelperDashboardPage;