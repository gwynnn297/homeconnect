import React, { useState } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import NotificationModal from '../../components/NotificationModal';
import AdminService from '../../services/AdminService';
import './AdminNotificationsPage.css';

const AdminNotificationsPage = () => {
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [targetRole, setTargetRole] = useState('');
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState(null);
    const [deliveryStats, setDeliveryStats] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!title.trim()) {
            setToast({ type: 'warning', message: 'Vui lòng nhập tiêu đề' });
            return;
        }
        if (!message.trim()) {
            setToast({ type: 'warning', message: 'Vui lòng nhập nội dung thông báo' });
            return;
        }

        setLoading(true);
        try {
            const data = {
                title: title.trim(),
                message: message.trim(),
                targetRole: targetRole || null,
            };
            const response = await AdminService.broadcastNotification(data);

            setDeliveryStats({
                message: response.message || 'Đã gửi thông báo broadcast thành công',
                totalRecipients: response.totalRecipients,
                successCount: response.successCount,
                failureCount: response.failureCount,
            });
            setToast({
                type: 'success',
                message: response.message || 'Đã gửi thông báo broadcast thành công'
            });

            setTitle('');
            setMessage('');
            setTargetRole('');
        } catch (err) {
            setToast({ type: 'error', message: err.message || 'Lỗi khi gửi thông báo' });
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const getRoleLabel = (role) => {
        switch (role) {
            case 'CUSTOMER':
                return 'Khách hàng';
            case 'HELPER':
                return 'Người giúp việc';
            case 'ADMIN':
                return 'Quản trị viên';
            default:
                return 'Tất cả người dùng';
        }
    };

    return (
        <AdminLayout>
            <div className="admin-notifications-page">
                {toast && (
                    <NotificationModal
                        message={toast.message}
                        type={toast.type}
                        onClose={() => setToast(null)}
                    />
                )}
                <div className="container">
                    <header className="notifications-header">
                        <h1>Admin HomieConnect - Gửi Thông báo Broadcast</h1>
                        <p className="subtitle">Gửi email thông báo tới người dùng hệ thống</p>
                    </header>

                    <div className="notifications-grid">
                        <section className="notifications-form-card">
                            <form onSubmit={handleSubmit} className="notification-form">
                                <div className="form-body">
                                    <div className="form-group">
                                        <label>
                                            Tiêu đề Email <span className="required">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            placeholder="Ví dụ: Thông báo bảo trì hệ thống"
                                            maxLength="100"
                                            disabled={loading}
                                        />
                                        <span className="char-count">{title.length}/100</span>
                                    </div>

                                    <div className="form-group">
                                        <label>
                                            Nội dung thông báo <span className="required">*</span>
                                        </label>
                                        <textarea
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value)}
                                            placeholder="Nhập nội dung thông báo chi tiết..."
                                            rows="8"
                                            maxLength="1000"
                                            disabled={loading}
                                        />
                                        <span className="char-count">{message.length}/1000</span>
                                    </div>

                                    <div className="form-group">
                                        <label>
                                            Gửi tới <span className="optional">(tùy chọn)</span>
                                        </label>
                                        <select
                                            value={targetRole}
                                            onChange={(e) => setTargetRole(e.target.value)}
                                            disabled={loading}
                                        >
                                            <option value="">Tất cả người dùng</option>
                                            <option value="CUSTOMER">Khách hàng</option>
                                            <option value="HELPER">Người giúp việc</option>
                                            <option value="ADMIN">Quản trị viên</option>
                                        </select>
                                        <p className="help-text">
                                            Bỏ trống để gửi tới tất cả người dùng, hoặc chọn role
                                            cụ thể
                                        </p>
                                    </div>
                                </div>

                                <div className="form-actions">
                                    <button
                                        type="button"
                                        className="btn-reset"
                                        onClick={() => {
                                            setTitle('');
                                            setMessage('');
                                            setTargetRole('');
                                            setToast(null);
                                            setDeliveryStats(null);
                                        }}
                                        disabled={loading}
                                    >
                                        Xóa
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn-send"
                                        disabled={loading || !title.trim() || !message.trim()}
                                    >
                                        {loading ? 'Đang gửi...' : 'Gửi Thông báo'}
                                    </button>
                                </div>
                            </form>
                        </section>

                        <aside className="notifications-preview-card">
                            <div className="preview-header">
                                <h3>Xem trước Email</h3>
                                <p className="preview-sub">Kiểm tra nội dung trước khi gửi</p>
                            </div>

                            <div className="email-preview">
                                <div className="email-header">
                                    <p>
                                        <strong>Gửi tới:</strong> {getRoleLabel(targetRole)}
                                    </p>
                                </div>
                                <div className="email-content">
                                    <p><strong>Tiêu đề:</strong></p>
                                    <p className="preview-title">
                                        {title || '(Chưa nhập tiêu đề)'}
                                    </p>
                                    <p style={{ marginTop: '1rem' }}>
                                        <strong>Nội dung:</strong>
                                    </p>
                                    <p className="preview-message">
                                        {message || '(Chưa nhập nội dung)'}
                                    </p>
                                </div>
                            </div>

                            <div className="preview-stats">
                                <p>
                                    <strong>Gửi tới:</strong>{' '}
                                    {targetRole || 'Tất cả người dùng'}
                                </p>
                                {deliveryStats && (
                                    <div className="small-stats">
                                        <span>
                                            Thành công:{' '}
                                            <strong className="text-success">
                                                {deliveryStats.successCount}
                                            </strong>
                                        </span>
                                        <span>
                                            Thất bại:{' '}
                                            <strong className="text-fail">
                                                {deliveryStats.failureCount}
                                            </strong>
                                        </span>
                                    </div>
                                )}
                            </div>
                        </aside>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
};

export default AdminNotificationsPage;