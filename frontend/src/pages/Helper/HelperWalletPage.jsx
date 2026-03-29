import React, { useState, useEffect } from 'react';
import HelperLayout from '../../layouts/HelperLayout';
import WalletService from '../../services/WalletService';
import './HelperWalletPage.css';

const MOCK_BANK_ACCOUNTS = [
    { id: 1, bankName: 'Vietcombank', accountNumber: '****6789', accountHolder: 'NGUYEN VAN A', isDefault: true },
    { id: 2, bankName: 'Techcombank', accountNumber: '****1234', accountHolder: 'NGUYEN VAN A', isDefault: false },
];

const HelperWalletPage = () => {
    const [wallet, setWallet] = useState({});
    const [transactions, setTransactions] = useState([]);
    const [bankAccounts] = useState(MOCK_BANK_ACCOUNTS);
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchWalletData();
    }, [page]);

    const fetchWalletData = async () => {
        setIsLoading(true);
        try {
            const wData = await WalletService.getWalletInfo();
            setWallet({
                availableBalance: wData.availableBalance || 0,
                totalEarnings: wData.totalEarnings || 0,
                status: wData.isFrozen ? 'FROZEN' : 'ACTIVE',
            });

            const txData = await WalletService.getTransactions({ page: page, size: 5 });
            if (txData) {
                setTransactions(txData.transactions?.map(t => ({
                    id: t.transactionId,
                    transactionType: t.type,
                    description: t.description,
                    amount: t.amount,
                    createdAt: t.createdAt
                })) || []);
                setTotalPages(txData.totalPages || 1);
            }
        } catch (error) {
            console.error("Lỗi khi tải dữ liệu ví:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Withdrawal states
    const [withdrawState, setWithdrawState] = useState('idle'); // idle, confirm, processing, success, error
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [selectedBank, setSelectedBank] = useState(MOCK_BANK_ACCOUNTS[0]);
    const [errorMessage, setErrorMessage] = useState('');

    // Add bank modal
    const [showAddBank, setShowAddBank] = useState(false);
    const [newBank, setNewBank] = useState({ bankName: '', accountNumber: '', accountHolder: '' });

    const formatCurrency = (amount) => {
        if (amount === undefined || amount === null) return '0 ₫';
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    const formatTxType = (type) => {
        switch (type) {
            case 'RELEASE': return { label: 'Nhận lương', type: 'success' };
            case 'EARNING': return { label: 'Thu nhập', type: 'success' };
            case 'WITHDRAWAL': return { label: 'Rút tiền', type: 'primary' };
            case 'REFUND': return { label: 'Hoàn tiền', type: 'primary' };
            case 'DEPOSIT': return { label: 'Nạp tiền', type: 'success' };
            case 'HOLD': return { label: 'Giữ tiền', type: 'muted' };
            case 'PENALTY': return { label: 'Chịu phạt', type: 'danger' };
            default: return { label: type, type: 'muted' };
        }
    };

    const handleAmountChange = (e) => {
        const value = e.target.value.replace(/\D/g, '');
        setWithdrawAmount(value);
        setErrorMessage('');
    };

    const handleWithdraw = () => {
        const amountNum = parseInt(withdrawAmount, 10);
        if (!amountNum || isNaN(amountNum)) {
            setErrorMessage('Vui lòng nhập số tiền hợp lệ.');
            return;
        }
        if (amountNum < 50000) {
            setErrorMessage('Số tiền rút tối thiểu là 50.000đ.');
            return;
        }
        if (amountNum > wallet.availableBalance) {
            setErrorMessage('Số dư không đủ để rút.');
            return;
        }
        setWithdrawState('confirm');
    };

    const confirmWithdraw = () => {
        setWithdrawState('processing');
        // Mock API call
        setTimeout(() => {
            setWithdrawState('success');
        }, 2000);
    };

    const resetWithdraw = () => {
        setWithdrawState('idle');
        setWithdrawAmount('');
        setErrorMessage('');
    };

    const handleAddBank = () => {
        if (!newBank.bankName || !newBank.accountNumber || !newBank.accountHolder) {
            return;
        }
        setShowAddBank(false);
        setNewBank({ bankName: '', accountNumber: '', accountHolder: '' });
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        const d = new Date(dateStr);
        return d.toLocaleString('vi-VN');
    };

    return (
        <HelperLayout>
            <div className="hw-page">
                <div className="hw-header">
                    <h2 className="hw-title">Ví của tôi</h2>
                    <p className="hw-subtitle">Quản lý thu nhập, rút tiền và theo dõi lịch sử giao dịch.</p>
                </div>

                {/* TOP SECTION: BALANCE CARDS */}
                <div className="hw-balance-grid">
                    <div className="hw-balance-card hw-main-balance">
                        <div className="hw-card-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
                            </svg>
                        </div>
                        <div className="hw-balance-info">
                            <span className="hw-balance-label">Số dư khả dụng</span>
                            <h3 className="hw-balance-amount">
                                {formatCurrency(wallet?.availableBalance)}
                            </h3>
                            <div className="hw-wallet-status">
                                Trạng thái:&nbsp;
                                <span className={`hw-badge hw-badge-${(wallet?.status || 'ACTIVE').toLowerCase()}`}>
                                    {wallet?.status === 'ACTIVE' ? 'Hoạt động' : wallet?.status}
                                </span>
                            </div>
                        </div>
                    </div>


                    <div className="hw-balance-card">
                        <div className="hw-card-icon hw-icon-success">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                                <polyline points="17 6 23 6 23 12"></polyline>
                            </svg>
                        </div>
                        <div className="hw-balance-info">
                            <span className="hw-balance-label">Tổng thu nhập</span>
                            <h3 className="hw-balance-amount hw-text-success">
                                {formatCurrency(wallet?.totalEarnings)}
                            </h3>
                        </div>
                    </div>
                </div>

                <div className="hw-content-layout">
                    {/* LEFT COLUMN: TRANSACTIONS */}
                    <div className="hw-transactions-col">
                        <div className="hw-card">
                            <div className="hw-card-header">
                                <h3>Lịch sử giao dịch</h3>
                                <button className="hw-btn-icon" title="Làm mới" onClick={fetchWalletData} disabled={isLoading}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="23 4 23 10 17 10"></polyline>
                                        <polyline points="1 20 1 14 7 14"></polyline>
                                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                                    </svg>
                                </button>
                            </div>

                            <div className="hw-card-body">
                                {transactions.length === 0 ? (
                                    <div className="hw-empty-state">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                            <line x1="16" y1="2" x2="16" y2="6"></line>
                                            <line x1="8" y1="2" x2="8" y2="6"></line>
                                            <line x1="3" y1="10" x2="21" y2="10"></line>
                                        </svg>
                                        <p>Chưa có giao dịch nào gần đây.</p>
                                    </div>
                                ) : (
                                    <div className="hw-tx-list">
                                        {transactions.map(tx => {
                                            const typeInfo = formatTxType(tx.transactionType);
                                            const isPositive = ['EARNING', 'REFUND', 'RELEASE', 'DEPOSIT'].includes(tx.transactionType);

                                            return (
                                                <div className="hw-tx-item" key={tx.id}>
                                                    <div className={`hw-tx-icon hw-bg-${typeInfo.type}-soft hw-text-${typeInfo.type}`}>
                                                        {isPositive ? (
                                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
                                                        ) : tx.transactionType === 'HOLD' ? (
                                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                                        ) : (
                                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
                                                        )}
                                                    </div>
                                                    <div className="hw-tx-content">
                                                        <div className="hw-tx-title">{tx.description}</div>
                                                        <div className="hw-tx-meta">
                                                            <span className={`hw-tx-type hw-text-${typeInfo.type}`}>{typeInfo.label}</span>
                                                            <span className="hw-tx-dot">&bull;</span>
                                                            <span className="hw-tx-time">{formatDate(tx.createdAt)}</span>
                                                        </div>
                                                    </div>
                                                    <div className={`hw-tx-amount ${isPositive ? 'hw-text-success' : 'hw-text-main'}`}>
                                                        {isPositive ? '+' : '-'}{formatCurrency(tx.amount)}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {totalPages > 1 && (
                                <div className="hw-pagination">
                                    <button disabled={page === 0} onClick={() => setPage(page - 1)}>
                                        &lsaquo; Trước
                                    </button>
                                    <span>Trang {page + 1} / {totalPages}</span>
                                    <button disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                                        Sau &rsaquo;
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: WITHDRAW ACTION */}
                    <div className="hw-withdraw-col">
                        {/* Withdraw Card */}
                        <div className="hw-card hw-sticky">
                            <div className="hw-card-header">
                                <h3>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20, marginRight: 8, verticalAlign: 'middle' }}>
                                        <line x1="12" y1="5" x2="12" y2="19"></line>
                                        <polyline points="19 12 12 19 5 12"></polyline>
                                    </svg>
                                    Rút tiền
                                </h3>
                            </div>

                            <div className="hw-card-body">
                                {withdrawState === 'idle' && (
                                    <div className="hw-withdraw-form">
                                        {/* Bank account selection */}
                                        <label className="hw-input-label">Tài khoản nhận tiền</label>
                                        <div className="hw-bank-list">
                                            {bankAccounts.map(bank => (
                                                <div
                                                    key={bank.id}
                                                    className={`hw-bank-item ${selectedBank?.id === bank.id ? 'active' : ''}`}
                                                    onClick={() => setSelectedBank(bank)}
                                                >
                                                    <div className="hw-bank-icon">
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                                                            <line x1="1" y1="10" x2="23" y2="10"></line>
                                                        </svg>
                                                    </div>
                                                    <div className="hw-bank-details">
                                                        <span className="hw-bank-name">{bank.bankName}</span>
                                                        <span className="hw-bank-number">{bank.accountNumber} · {bank.accountHolder}</span>
                                                    </div>
                                                    {bank.isDefault && <span className="hw-bank-default">Mặc định</span>}
                                                    <div className={`hw-bank-radio ${selectedBank?.id === bank.id ? 'checked' : ''}`}></div>
                                                </div>
                                            ))}
                                            <button className="hw-add-bank-btn" onClick={() => setShowAddBank(true)}>
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <line x1="12" y1="5" x2="12" y2="19"></line>
                                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                                </svg>
                                                Thêm tài khoản mới
                                            </button>
                                        </div>

                                        <label className="hw-input-label" style={{ marginTop: 20 }}>Số tiền rút (VNĐ)</label>
                                        <div className="hw-input-group">
                                            <input
                                                type="text"
                                                value={withdrawAmount ? new Intl.NumberFormat('vi-VN').format(withdrawAmount) : ''}
                                                onChange={handleAmountChange}
                                                placeholder="0"
                                                className="hw-input"
                                            />
                                            <span className="hw-input-suffix">₫</span>
                                        </div>

                                        <div className="hw-amount-suggestions">
                                            <button onClick={() => setWithdrawAmount('100000')}>100.000₫</button>
                                            <button onClick={() => setWithdrawAmount('500000')}>500.000₫</button>
                                            <button onClick={() => setWithdrawAmount('1000000')}>1.000.000₫</button>
                                            <button onClick={() => setWithdrawAmount(String(wallet.availableBalance))}>Tất cả</button>
                                        </div>

                                        <div className="hw-balance-hint">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="12" cy="12" r="10"></circle>
                                                <path d="M12 16v-4"></path>
                                                <path d="M12 8h.01"></path>
                                            </svg>
                                            Số dư khả dụng: <strong>{formatCurrency(wallet.availableBalance)}</strong>
                                        </div>

                                        {errorMessage && (
                                            <div className="hw-alert hw-alert-danger">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                                {errorMessage}
                                            </div>
                                        )}

                                        <button
                                            className="hw-btn hw-btn-primary hw-btn-block"
                                            disabled={!withdrawAmount}
                                            onClick={handleWithdraw}
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                                <polyline points="19 12 12 19 5 12"></polyline>
                                            </svg>
                                            Rút tiền
                                        </button>
                                        <p className="hw-withdraw-hint">
                                            Tiền sẽ được chuyển về tài khoản ngân hàng trong vòng 1-3 ngày làm việc.
                                        </p>
                                    </div>
                                )}

                                {withdrawState === 'confirm' && (
                                    <div className="hw-confirm-section">
                                        <div className="hw-confirm-icon">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                                                <line x1="12" y1="9" x2="12" y2="13"></line>
                                                <line x1="12" y1="17" x2="12.01" y2="17"></line>
                                            </svg>
                                        </div>
                                        <h4>Xác nhận rút tiền</h4>
                                        <p className="hw-confirm-desc">Vui lòng kiểm tra lại thông tin trước khi xác nhận.</p>

                                        <div className="hw-confirm-details">
                                            <div className="hw-confirm-row">
                                                <span className="hw-confirm-label">Số tiền rút</span>
                                                <span className="hw-confirm-value hw-text-primary">{formatCurrency(parseInt(withdrawAmount, 10))}</span>
                                            </div>
                                            <div className="hw-confirm-row">
                                                <span className="hw-confirm-label">Ngân hàng</span>
                                                <span className="hw-confirm-value">{selectedBank?.bankName}</span>
                                            </div>
                                            <div className="hw-confirm-row">
                                                <span className="hw-confirm-label">Số tài khoản</span>
                                                <span className="hw-confirm-value">{selectedBank?.accountNumber}</span>
                                            </div>
                                            <div className="hw-confirm-row">
                                                <span className="hw-confirm-label">Chủ tài khoản</span>
                                                <span className="hw-confirm-value">{selectedBank?.accountHolder}</span>
                                            </div>
                                            <div className="hw-confirm-row">
                                                <span className="hw-confirm-label">Phí rút tiền</span>
                                                <span className="hw-confirm-value hw-text-success">Miễn phí</span>
                                            </div>
                                        </div>

                                        <div className="hw-confirm-actions">
                                            <button className="hw-btn hw-btn-primary hw-btn-block" onClick={confirmWithdraw}>
                                                Xác nhận rút tiền
                                            </button>
                                            <button className="hw-btn hw-btn-outline hw-btn-block" onClick={resetWithdraw}>
                                                Hủy
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {withdrawState === 'processing' && (
                                    <div className="hw-withdraw-state">
                                        <div className="hw-spinner hw-spinner-lg hw-text-primary"></div>
                                        <h4>Đang xử lý yêu cầu...</h4>
                                        <p>Vui lòng đợi trong giây lát.</p>
                                    </div>
                                )}

                                {withdrawState === 'success' && (
                                    <div className="hw-withdraw-state">
                                        <div className="hw-icon-circle hw-bg-success-soft hw-text-success">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                        </div>
                                        <h4 className="hw-text-success">Yêu cầu rút tiền thành công!</h4>
                                        <p>Số tiền <strong>{formatCurrency(parseInt(withdrawAmount, 10))}</strong> sẽ được chuyển về tài khoản {selectedBank?.bankName} {selectedBank?.accountNumber} trong 1-3 ngày làm việc.</p>
                                        <button className="hw-btn hw-btn-primary hw-btn-block" onClick={resetWithdraw}>
                                            Thực hiện giao dịch mới
                                        </button>
                                    </div>
                                )}

                                {withdrawState === 'error' && (
                                    <div className="hw-withdraw-state">
                                        <div className="hw-icon-circle hw-bg-danger-soft hw-text-danger">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                        </div>
                                        <h4 className="hw-text-danger">Giao dịch thất bại</h4>
                                        <p>{errorMessage || 'Đã xảy ra lỗi. Vui lòng thử lại sau.'}</p>
                                        <button className="hw-btn hw-btn-primary hw-btn-block" onClick={resetWithdraw}>
                                            Quay lại thử lại
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Add Bank Modal */}
                {showAddBank && (
                    <div className="hw-modal-overlay" onClick={() => setShowAddBank(false)}>
                        <div className="hw-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="hw-modal-header">
                                <h3>Thêm tài khoản ngân hàng</h3>
                                <button className="hw-modal-close" onClick={() => setShowAddBank(false)}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>
                            <div className="hw-modal-body">
                                <div className="hw-form-group">
                                    <label className="hw-input-label">Tên ngân hàng</label>
                                    <input
                                        type="text"
                                        className="hw-input"
                                        placeholder="VD: Vietcombank"
                                        value={newBank.bankName}
                                        onChange={(e) => setNewBank({ ...newBank, bankName: e.target.value })}
                                    />
                                </div>
                                <div className="hw-form-group">
                                    <label className="hw-input-label">Số tài khoản</label>
                                    <input
                                        type="text"
                                        className="hw-input"
                                        placeholder="VD: 0123456789"
                                        value={newBank.accountNumber}
                                        onChange={(e) => setNewBank({ ...newBank, accountNumber: e.target.value })}
                                    />
                                </div>
                                <div className="hw-form-group">
                                    <label className="hw-input-label">Chủ tài khoản</label>
                                    <input
                                        type="text"
                                        className="hw-input"
                                        placeholder="VD: NGUYEN VAN A"
                                        value={newBank.accountHolder}
                                        onChange={(e) => setNewBank({ ...newBank, accountHolder: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="hw-modal-footer">
                                <button className="hw-btn hw-btn-outline" onClick={() => setShowAddBank(false)}>Hủy</button>
                                <button className="hw-btn hw-btn-primary" onClick={handleAddBank}>Thêm tài khoản</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </HelperLayout>
    );
};

export default HelperWalletPage;
