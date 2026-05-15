import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import AdminService from '../../services/AdminService';
import './AdminWithdrawalsPage.css';

const STATUS_TABS = [
    { key: '', label: 'Tất cả' },
    { key: 'PENDING', label: 'Chờ duyệt' },
    { key: 'PROCESSING', label: 'Đang xử lý' },
    { key: 'COMPLETED', label: 'Hoàn thành' },
    { key: 'REJECTED', label: 'Đã từ chối' },
];

const STATUS_CONFIG = {
    PENDING: { label: 'Chờ duyệt', cls: 'warning' },
    PROCESSING: { label: 'Đang xử lý', cls: 'primary' },
    COMPLETED: { label: 'Hoàn thành', cls: 'success' },
    REJECTED: { label: 'Đã từ chối', cls: 'danger' },
};

const fmt = (n) => n == null ? '0 ₫' : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
const fmtDate = (d) => d ? new Date(d).toLocaleString('vi-VN') : 'N/A';

const AdminWithdrawalsPage = () => {
    const [activeTab, setActiveTab] = useState('');
    const [withdrawals, setWithdrawals] = useState([]);
    const [totalPages, setTotalPages] = useState(1);
    const [totalElements, setTotalElements] = useState(0);
    const [page, setPage] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    // Detail modal
    const [selected, setSelected] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [showDetail, setShowDetail] = useState(false);

    // Reject modal
    const [showReject, setShowReject] = useState(false);
    const [rejectTarget, setRejectTarget] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [actionMsg, setActionMsg] = useState(null); // { type: 'success'|'error', text }

    const fetchWithdrawals = useCallback(async () => {
        setIsLoading(true);
        try {
            const params = { page, size: 10 };
            if (activeTab) params.status = activeTab;
            const res = await AdminService.getWithdrawals(params);
            const data = res.data || res;
            setWithdrawals(data.withdrawals || []);
            setTotalPages(data.totalPages || 1);
            setTotalElements(data.totalElements || 0);
        } catch (e) {
            console.error('Lỗi tải danh sách rút tiền:', e);
        } finally {
            setIsLoading(false);
        }
    }, [activeTab, page]);

    useEffect(() => { fetchWithdrawals(); }, [fetchWithdrawals]);

    // Real-time listener for new withdrawal requests
    useEffect(() => {
        const handleNewWithdrawRequest = (e) => {
            console.log('[Admin] New withdrawal request received via socket:', e.detail);
            // Re-fetch to show new request immediately
            fetchWithdrawals();
        };

        window.addEventListener('withdraw:new_request', handleNewWithdrawRequest);
        return () => window.removeEventListener('withdraw:new_request', handleNewWithdrawRequest);
    }, [fetchWithdrawals]);

    const handleTabChange = (tab) => { setActiveTab(tab); setPage(0); };

    const handleViewDetail = async (requestId) => {
        setDetailLoading(true);
        setShowDetail(true);
        setSelected(null);
        try {
            const res = await AdminService.getWithdrawDetail(requestId);
            setSelected(res.data || res);
        } catch (e) {
            console.error('Lỗi tải chi tiết:', e);
        } finally {
            setDetailLoading(false);
        }
    };

    const handleApprove = async (requestId) => {
        if (!window.confirm('Xác nhận duyệt yêu cầu rút tiền này? Hãy chuyển khoản trước khi bấm duyệt.')) return;
        setActionLoading(true);
        try {
            const res = await AdminService.approveWithdrawal(requestId);
            const msg = res.message || 'Đã duyệt thành công!';
            setActionMsg({ type: 'success', text: msg });
            setShowDetail(false);
            fetchWithdrawals();
        } catch (e) {
            const errorMsg = e.response?.data?.message || 'Duyệt thất bại.';
            // Nếu đơn đã được Webhook xử lý xong thì không coi là lỗi
            if (errorMsg.includes('tự động xử lý')) {
                setActionMsg({ type: 'success', text: errorMsg });
                setShowDetail(false);
                fetchWithdrawals();
            } else {
                setActionMsg({ type: 'error', text: errorMsg });
            }
        } finally {
            setActionLoading(false);
        }
    };

    const openReject = (request) => { setRejectTarget(request); setRejectReason(''); setShowReject(true); };

    const handleReject = async () => {
        if (!rejectReason.trim()) {
            setActionMsg({ type: 'error', text: 'Vui lòng nhập lý do từ chối.' });
            return;
        }
        setActionLoading(true);
        try {
            await AdminService.rejectWithdrawal(rejectTarget.requestId, rejectReason.trim());
            setActionMsg({ type: 'success', text: 'Đã từ chối và hoàn tiền cho người dùng.' });
            setShowReject(false);
            setShowDetail(false);
            fetchWithdrawals();
        } catch (e) {
            setActionMsg({ type: 'error', text: e.response?.data?.message || 'Từ chối thất bại.' });
        } finally {
            setActionLoading(false);
        }
    };

    const StatusBadge = ({ status }) => {
        const cfg = STATUS_CONFIG[status] || { label: status, cls: 'muted' };
        return <span className={`aw-badge aw-badge-${cfg.cls}`}>{cfg.label}</span>;
    };

    return (
        <AdminLayout>
            <div className="aw-page">

                {/* HEADER */}
                <div className="aw-header">
                    <div>
                        <h1 className="aw-title">Quản lý Rút tiền</h1>
                        <p className="aw-subtitle">Duyệt hoặc từ chối các yêu cầu rút tiền của Thợ</p>
                    </div>
                    <button className="aw-btn-refresh" onClick={fetchWithdrawals} disabled={isLoading}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline>
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                        </svg>
                        Làm mới
                    </button>
                </div>

                {/* ACTION MSG */}
                {actionMsg && (
                    <div className={`aw-alert aw-alert-${actionMsg.type}`} onClick={() => setActionMsg(null)}>
                        {actionMsg.type === 'success'
                            ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        }
                        <span>{actionMsg.text}</span>
                        <button className="aw-close-btn" onClick={() => setActionMsg(null)}>✕</button>
                    </div>
                )}

                {/* TABS */}
                <div className="aw-card">
                    <div className="aw-tabs">
                        {STATUS_TABS.map(t => (
                            <button
                                key={t.key}
                                className={`aw-tab ${activeTab === t.key ? 'active' : ''}`}
                                onClick={() => handleTabChange(t.key)}
                            >
                                {t.label}
                            </button>
                        ))}
                        <span className="aw-count">{totalElements} yêu cầu</span>
                    </div>

                    {/* TABLE */}
                    <div className="aw-table-wrap">
                        {isLoading ? (
                            <div className="aw-loading">
                                <div className="aw-spinner"></div>
                                <p>Đang tải dữ liệu...</p>
                            </div>
                        ) : withdrawals.length === 0 ? (
                            <div className="aw-empty">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <rect x="2" y="7" width="20" height="14" rx="2"></rect><path d="M16 3L12 7 8 3"></path>
                                </svg>
                                <p>Không có yêu cầu nào.</p>
                            </div>
                        ) : (
                            <table className="aw-table">
                                <thead>
                                    <tr>
                                        <th>#ID</th>
                                        <th>Thợ</th>
                                        <th>Số tiền</th>
                                        <th>Ngân hàng</th>
                                        <th>Số TK</th>
                                        <th>Trạng thái</th>
                                        <th>Ngày tạo</th>
                                        <th>Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {withdrawals.map(w => (
                                        <tr key={w.requestId}>
                                            <td className="aw-id">#{w.requestId}</td>
                                            <td className="aw-user">
                                                <span className="aw-avatar">{(w.userFullName || '?')[0]}</span>
                                                <span>{w.userFullName || `User #${w.userId}`}</span>
                                            </td>
                                            <td className="aw-amount">{fmt(w.amount)}</td>
                                            <td>{w.bankName}</td>
                                            <td className="aw-acct">{w.bankAccount}</td>
                                            <td><StatusBadge status={w.status} /></td>
                                            <td className="aw-date">{fmtDate(w.createdAt)}</td>
                                            <td>
                                                <div className="aw-actions">
                                                    <button className="aw-btn aw-btn-detail-text" onClick={() => handleViewDetail(w.requestId)}>
                                                        Chi tiết
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* MODERN HARMONIOUS PAGINATION */}
                    {totalPages > 1 && (
                        <div className="aw-pagination-modern">
                            <button
                                className="aw-pagination-btn"
                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                disabled={page === 0}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
                                <span>Trước</span>
                            </button>

                            <div className="aw-pagination-info">
                                Trang <strong>{page + 1}</strong> trên <strong>{totalPages}</strong>
                            </div>

                            <button
                                className="aw-pagination-btn"
                                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                disabled={page >= totalPages - 1}
                            >
                                <span>Sau</span>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* DETAIL MODAL (PREMIUM DESIGN) */}
            {showDetail && (
                <div className="aw-modal-overlay" onClick={() => { setShowDetail(false); setSelected(null); }}>
                    <div className="aw-modal aw-modal-premium" onClick={e => e.stopPropagation()}>
                        <div className="aw-modal-header">
                            <div className="aw-header-title">
                                <span className="aw-header-badge">#{selected?.requestId}</span>
                                <h2>Chi tiết yêu cầu rút tiền</h2>
                            </div>
                            <button className="aw-modal-close" onClick={() => { setShowDetail(false); setSelected(null); }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        <div className="aw-modal-body">
                            {detailLoading ? (
                                <div className="aw-loading-full"><div className="aw-spinner"></div></div>
                            ) : selected ? (
                                <>
                                    <div className="aw-premium-grid">
                                        <div className="aw-info-column">
                                            <div className="aw-section-card">
                                                <div className="aw-section-header">Thông tin khách hàng</div>
                                                <div className="aw-field-group">
                                                    <div className="aw-field-row"><span>Họ & tên</span><strong>{selected.userFullName}</strong></div>
                                                    <div className="aw-field-row"><span>Tài khoản ID</span><strong>#{selected.userId}</strong></div>
                                                </div>
                                            </div>

                                            <div className="aw-section-card">
                                                <div className="aw-section-header">Thông tin thụ hưởng</div>
                                                <div className="aw-field-group">
                                                    <div className="aw-field-row"><span>Ngân hàng</span><strong>{selected.bankName}</strong></div>
                                                    <div className="aw-field-row"><span>Số tài khoản</span><strong className="aw-copyable">{selected.bankAccount}</strong></div>
                                                    <div className="aw-field-row"><span>Chủ tài khoản</span><strong>{selected.accountHolderName}</strong></div>
                                                </div>
                                            </div>

                                            <div className="aw-section-card">
                                                <div className="aw-section-header">Chi tiết giao dịch</div>
                                                <div className="aw-field-group">
                                                    <div className="aw-field-row">
                                                        <span>Số tiền</span>
                                                        <strong className="aw-amount-highlight">{fmt(selected.amount)}</strong>
                                                    </div>
                                                    <div className="aw-field-row"><span>Trạng thái</span><StatusBadge status={selected.status} /></div>
                                                    <div className="aw-field-row"><span>Khởi tạo lúc</span><strong>{fmtDate(selected.createdAt)}</strong></div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="aw-qr-column">
                                            {selected.qrCode ? (
                                                <div className="aw-modern-qr-card">
                                                    <div className="aw-qr-head">
                                                        <img src="https://vietqr.net/portal-v2/images/img_vietqr.png" alt="VietQR" height="18" />
                                                        <span>Chuyển khoản nhanh 24/7</span>
                                                    </div>
                                                    <div className="aw-qr-main">
                                                        <img src={selected.qrCode} alt="VietQR" className="aw-qr-img" />
                                                    </div>
                                                    <div className="aw-qr-foot">
                                                        <div className="aw-qr-data">
                                                            <div className="aw-qr-data-item">
                                                                <label>Nội dung:</label>
                                                                <code>{selected.adminNote?.includes('HOMIRT') ? selected.adminNote : `HOMIRT${selected.requestId}`}</code>
                                                            </div>
                                                            <div className="aw-qr-data-item">
                                                                <label>Số tiền:</label>
                                                                <strong>{fmt(selected.amount)}</strong>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="aw-no-qr">
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                                                    <p>Không có mã VietQR</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {selected.status === 'PENDING' && (
                                        <div className="aw-modal-premium-footer">
                                            <button className="aw-btn aw-btn-reject-modern" onClick={() => openReject(selected)} disabled={actionLoading}>
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"></path></svg>
                                                Từ chối yêu cầu
                                            </button>
                                            <button className="aw-btn aw-btn-approve-modern" onClick={() => handleApprove(selected.requestId)} disabled={actionLoading}>
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                Duyệt & Chuyển tiền ngay
                                            </button>
                                        </div>
                                    )}
                                </>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}

            {/* REJECT MODAL STILL NEEDED FOR INPUT */}
            {showReject && (
                <div className="aw-modal-overlay" onClick={() => setShowReject(false)}>
                    <div className="aw-modal aw-modal-sm" onClick={e => e.stopPropagation()}>
                        <div className="aw-modal-header">
                            <h2>Từ chối yêu cầu #{rejectTarget?.requestId}</h2>
                            <button className="aw-modal-close" onClick={() => setShowReject(false)}>✕</button>
                        </div>
                        <div className="aw-modal-body">
                            <div className="aw-reject-info">
                                Hành động này sẽ hoàn lại tiền vào ví của User.
                            </div>
                            <label className="aw-label">Lý do từ chối (bắt buộc)</label>
                            <textarea
                                className="aw-textarea"
                                rows="3"
                                placeholder="Nhập lý do để thông báo cho người dùng..."
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                            />
                            <div className="aw-modal-actions">
                                <button className="aw-btn aw-btn-danger aw-btn-lg" style={{ flex: 1 }} onClick={handleReject} disabled={actionLoading || !rejectReason.trim()}>
                                    Xác nhận Từ chối
                                </button>
                                <button className="aw-btn aw-btn-outline aw-btn-lg" onClick={() => setShowReject(false)}>
                                    Hủy
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};

export default AdminWithdrawalsPage;
