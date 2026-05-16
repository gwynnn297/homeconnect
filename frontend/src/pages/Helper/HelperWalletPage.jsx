import React, { useState, useEffect, useCallback } from 'react';
import HelperLayout from '../../layouts/HelperLayout';
import WalletService from '../../services/WalletService';
import NotificationModal from '../../components/NotificationModal';
import './HelperWalletPage.css';

const HelperWalletPage = () => {
    // ── Wallet & Transactions ──
    const [wallet, setWallet] = useState({});
    const [transactions, setTransactions] = useState([]);
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    // ── Bank Accounts ──
    const [bankAccounts, setBankAccounts] = useState([]);
    const [banksLoading, setBanksLoading] = useState(false);

    // ── Withdraw ──
    const [withdrawState, setWithdrawState] = useState('idle'); // idle | confirm | processing | success | error
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [selectedBank, setSelectedBank] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');

    // ── Add Bank Modal ──
    const [showAddBank, setShowAddBank] = useState(false);
    const [bankList, setBankList] = useState([]);      // danh sách từ VietQR
    const [bankSearch, setBankSearch] = useState('');
    const [selectedVietQR, setSelectedVietQR] = useState(null);
    const [newBankAccount, setNewBankAccount] = useState({ accountNumber: '', accountHolderName: '' });
    const [addBankLoading, setAddBankLoading] = useState(false);
    const [addBankError, setAddBankError] = useState('');
    const [toast, setToast] = useState(null);

    // ── Helpers ──
    const fmt = (n) => n == null ? '0 ₫' : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
    const fmtDate = (d) => d ? new Date(d).toLocaleString('vi-VN') : 'N/A';

    const txTypeInfo = (type) => {
        const map = {
            RELEASE: { label: 'Nhận lương', cls: 'success', up: true },
            EARNING: { label: 'Thu nhập', cls: 'success', up: true },
            WITHDRAW: { label: 'Rút tiền', cls: 'danger', up: false },
            WITHDRAWAL: { label: 'Rút tiền', cls: 'danger', up: false },
            REFUND: { label: 'Hoàn tiền', cls: 'primary', up: true },
            DEPOSIT: { label: 'Nạp tiền', cls: 'success', up: true },
            HOLD: { label: 'Đang chờ rút', cls: 'warning', up: false },
            PENALTY: { label: 'Chịu phạt', cls: 'danger', up: false },
        };
        return map[type] || { label: type, cls: 'muted', up: false };
    };

    const formatTxDescription = (description) => {
        const raw = String(description || '');
        let text = raw;

        // 1. Xử lý thất bại trước
        if (text.toLowerCase().includes('failed') || text.toLowerCase().includes('rejected')) {
            return text
                .replace(/Withdraw money/gi, 'Rút tiền')
                .replace(/Failed/gi, 'thất bại')
                .replace(/Rejected/gi, 'bị từ chối')
                .replace(/via xGate/gi, 'qua ngân hàng')
                .replace(/xGate/gi, 'ngân hàng')
                .trim();
        }

        // 2. Thành công
        return text
            .replace(/Earnings from booking/gi, 'Thu nhập từ đơn hàng')
            .replace(/Release from booking/gi, 'Tiền công đơn hàng')
            .replace(/Penalty for booking/gi, 'Khấu trừ phí đơn hàng')
            .replace(/Refund for booking/gi, 'Hoàn tiền đơn hàng')
            .replace(/Withdraw money to bank/gi, 'Rút tiền thành công về ngân hàng')
            .replace(/Withdraw money/gi, 'Rút tiền thành công')
            .replace(/Payment/gi, 'Thanh toán')
            .replace(/Thợ No-Show/gi, 'Thợ vắng mặt')
            .replace(/No-Show/gi, 'Vắng mặt')
            .replace(/hold/gi, 'tạm giữ')
            .replace(/via xGate/gi, 'qua ngân hàng')
            .replace(/xGate/gi, 'ngân hàng')
            .replace(/#([a-f0-9-]+)/gi, ' #$1'); 
    };

    // ── Fetch wallet + transactions ──
    const fetchWalletData = useCallback(async () => {
        setIsLoading(true);
        try {
            const wData = await WalletService.getWalletInfo();
            setWallet({
                availableBalance: wData.availableBalance || 0,
                holdBalance: wData.holdBalance || 0,
                totalEarnings: wData.totalEarnings || 0,
                status: wData.isFrozen ? 'FROZEN' : 'ACTIVE',
            });
            const txData = await WalletService.getTransactions({ page, size: 5 });
            if (txData) {
                setTransactions((txData.transactions || []).map(t => ({
                    id: t.transactionId, type: t.type, description: t.description,
                    amount: t.amount, createdAt: t.createdAt,
                })));
                setTotalPages(txData.totalPages || 1);
            }
        } catch (e) {
            console.error('Lỗi tải ví:', e);
        } finally {
            setIsLoading(false);
        }
    }, [page]);

    // ── Fetch bank accounts ──
    const fetchBankAccounts = async () => {
        setBanksLoading(true);
        try {
            const res = await WalletService.getBankAccounts();
            const accounts = res.data || res || [];
            setBankAccounts(accounts);
            const def = accounts.find(a => a.isDefault);
            setSelectedBank(def || accounts[0] || null);
        } catch (e) {
            console.error('Lỗi tải ngân hàng:', e);
        } finally {
            setBanksLoading(false);
        }
    };

    useEffect(() => { fetchWalletData(); }, [fetchWalletData]);
    useEffect(() => { fetchBankAccounts(); }, []);

    useEffect(() => {
        const handleWalletUpdate = () => {
            fetchWalletData();
        };
        window.addEventListener('wallet:updated', handleWalletUpdate);
        return () => window.removeEventListener('wallet:updated', handleWalletUpdate);
    }, [fetchWalletData]);

    // ── Load VietQR bank list when modal opens ──
    useEffect(() => {
        if (showAddBank && bankList.length === 0) {
            WalletService.getBankList().then(setBankList).catch(console.error);
        }
    }, [showAddBank]);

    // ── Actions: Set default ──
    const handleSetDefault = async (bankAccountId, e) => {
        e.stopPropagation();
        try {
            await WalletService.setDefaultBankAccount(bankAccountId);
            await fetchBankAccounts();
        } catch (e) {
            setToast({ type: 'error', message: e.response?.data?.message || 'Không thể đặt mặc định.' });
        }
    };

    // ── Actions: Delete bank ──
    const handleDeleteBank = async (bankAccountId, e) => {
        e.stopPropagation();
        if (!window.confirm('Bạn có chắc muốn xóa tài khoản ngân hàng này?')) return;
        try {
            await WalletService.deleteBankAccount(bankAccountId);
            await fetchBankAccounts();
        } catch (e) {
            setToast({ type: 'error', message: e.response?.data?.message || ('Không thể xóa: ' + (e.message || '')) });
        }
    };

    // ── Actions: Add bank ──
    const handleAddBank = async () => {
        setAddBankError('');
        if (!selectedVietQR) { setAddBankError('Vui lòng chọn ngân hàng.'); return; }
        if (!newBankAccount.accountNumber.trim()) { setAddBankError('Vui lòng nhập số tài khoản.'); return; }
        if (!newBankAccount.accountHolderName.trim()) { setAddBankError('Vui lòng nhập tên chủ tài khoản.'); return; }
        setAddBankLoading(true);
        try {
            await WalletService.addBankAccount({
                bankName: selectedVietQR.shortName,
                bankCode: selectedVietQR.code,
                accountNumber: newBankAccount.accountNumber.trim(),
                accountHolderName: newBankAccount.accountHolderName.trim().toUpperCase(),
            });
            setShowAddBank(false);
            setSelectedVietQR(null);
            setNewBankAccount({ accountNumber: '', accountHolderName: '' });
            setBankSearch('');
            await fetchBankAccounts();
        } catch (e) {
            setAddBankError(e.response?.data?.message || 'Liên kết thất bại. Kiểm tra lại thông tin.');
        } finally {
            setAddBankLoading(false);
        }
    };

    // ── Actions: Withdraw ──
    const handleWithdraw = () => {
        const amountNum = parseInt(withdrawAmount, 10);
        if (!amountNum || isNaN(amountNum)) { setErrorMessage('Vui lòng nhập số tiền hợp lệ.'); return; }
        if (amountNum < 3000) { setErrorMessage('Số tiền rút tối thiểu là 3.000 ₫.'); return; }
        if (amountNum > wallet.availableBalance) { setErrorMessage('Số dư không đủ để rút.'); return; }
        setErrorMessage('');
        setWithdrawState('confirm');
    };

    const confirmWithdraw = async () => {
        setWithdrawState('processing');
        try {
            await WalletService.requestWithdraw(parseInt(withdrawAmount, 10), selectedBank?.bankAccountId || null);
            setWithdrawState('success');
            fetchWalletData();
        } catch (e) {
            setErrorMessage(e.response?.data?.message || 'Gửi yêu cầu thất bại.');
            setWithdrawState('error');
        }
    };

    const resetWithdraw = () => {
        setWithdrawState('idle');
        setWithdrawAmount('');
        setErrorMessage('');
    };

    const filteredBankList = bankList.filter(b =>
        b.shortName?.toLowerCase().includes(bankSearch.toLowerCase()) ||
        b.name?.toLowerCase().includes(bankSearch.toLowerCase())
    );

    return (
        <HelperLayout>
            <div className="hw-page">

                {/* ── BALANCE CARDS ── */}
                <div className="hw-balance-grid">
                    <div className="hw-balance-card hw-main-balance">
                        <div className="hw-card-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
                            </svg>
                        </div>
                        <div className="hw-balance-info">
                            <span className="hw-balance-label">Số dư khả dụng</span>
                            <h3 className="hw-balance-amount">{fmt(wallet.availableBalance)}</h3>
                            <div className="hw-wallet-status">
                                Trạng thái:&nbsp;
                                <span className={`hw-badge hw-badge-${(wallet.status || 'ACTIVE').toLowerCase()}`}>
                                    {wallet.status === 'ACTIVE' ? 'Hoạt động' : wallet.status}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="hw-balance-card">
                        <div className="hw-card-icon hw-icon-warning">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                        </div>
                        <div className="hw-balance-info">
                            <span className="hw-balance-label">Đang giữ</span>
                            <h3 className="hw-balance-amount hw-text-warning">{fmt(wallet.holdBalance)}</h3>
                        </div>
                    </div>

                    <div className="hw-balance-card">
                        <div className="hw-card-icon hw-icon-success">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline>
                            </svg>
                        </div>
                        <div className="hw-balance-info">
                            <span className="hw-balance-label">Tổng thu nhập</span>
                            <h3 className="hw-balance-amount hw-text-success">{fmt(wallet.totalEarnings)}</h3>
                        </div>
                    </div>
                </div>

                <div className="hw-content-layout">

                    {/* ── LEFT: TRANSACTIONS ── */}
                    <div className="hw-transactions-col">
                        <div className="hw-card">
                            <div className="hw-card-header">
                                <h3>Lịch sử giao dịch</h3>
                                <button className="hw-btn-icon" title="Làm mới" onClick={fetchWalletData} disabled={isLoading}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline>
                                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                                    </svg>
                                </button>
                            </div>
                            <div className="hw-card-body">
                                {isLoading ? (
                                    <div className="hw-withdraw-state"><div className="hw-spinner hw-spinner-lg hw-text-primary"></div></div>
                                ) : transactions.length === 0 ? (
                                    <div className="hw-empty-state">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line>
                                            <line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>
                                        </svg>
                                        <p>Chưa có giao dịch nào gần đây.</p>
                                    </div>
                                ) : (
                                    <div className="hw-tx-list">
                                        {transactions.map(tx => {
                                            const info = txTypeInfo(tx.type);
                                            return (
                                                <div className="hw-tx-item" key={tx.id}>
                                                    <div className={`hw-tx-icon hw-bg-${info.cls}-soft hw-text-${info.cls}`}>
                                                        {info.up
                                                            ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
                                                            : tx.type === 'HOLD'
                                                                ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                                                : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
                                                        }
                                                    </div>
                                                    <div className="hw-tx-content">
                                                        <div className="hw-tx-title">{formatTxDescription(tx.description)}</div>
                                                        <div className="hw-tx-meta">
                                                            <span className={`hw-tx-type hw-text-${info.cls}`}>{info.label}</span>
                                                            <span className="hw-tx-dot">&bull;</span>
                                                            <span className="hw-tx-time">{fmtDate(tx.createdAt)}</span>
                                                        </div>
                                                    </div>
                                                    <div className={`hw-tx-amount ${info.up ? 'hw-text-success' : 'hw-text-main'}`}>
                                                        {info.up ? '+' : '-'}{fmt(tx.amount)}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                            {totalPages > 1 && (
                                <div className="hw-pagination">
                                    <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>&lsaquo; Trước</button>
                                    <span>Trang {page + 1} / {totalPages}</span>
                                    <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Sau &rsaquo;</button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── RIGHT: WITHDRAW ── */}
                    <div className="hw-withdraw-col">

                        {/* WITHDRAW CARD */}
                        <div className="hw-card hw-sticky">
                            <div className="hw-card-header">
                                <h3>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20, marginRight: 8, verticalAlign: 'middle' }}>
                                        <line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline>
                                    </svg>
                                    Rút tiền
                                </h3>
                            </div>
                            <div className="hw-card-body">

                                {withdrawState === 'idle' && (
                                    <div className="hw-withdraw-form">
                                        <label className="hw-input-label">Tài khoản nhận tiền</label>
                                        {banksLoading ? (
                                            <p className="hw-text-muted" style={{ fontSize: 13 }}>Đang tải danh sách ngân hàng...</p>
                                        ) : (
                                            <div className="hw-bank-list">
                                                {bankAccounts.length === 0 && (
                                                    <p className="hw-text-muted" style={{ fontSize: 13, marginBottom: 8 }}>Bạn chưa liên kết ngân hàng nào.</p>
                                                )}
                                                {bankAccounts.map(bank => (
                                                    <div
                                                        key={bank.bankAccountId}
                                                        className={`hw-bank-item ${selectedBank?.bankAccountId === bank.bankAccountId ? 'active' : ''}`}
                                                        onClick={() => setSelectedBank(bank)}
                                                    >
                                                        <div className="hw-bank-icon">
                                                            <img
                                                                src={`https://api.vietqr.io/img/${bank.bankCode}.png`}
                                                                alt={bank.bankName}
                                                                style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 4 }}
                                                                onError={(e) => {
                                                                    e.target.onerror = null;
                                                                    e.target.src = 'https://img.icons8.com/color/48/bank.png'; // Fallback icon
                                                                }}
                                                            />
                                                        </div>
                                                        <div className="hw-bank-details">
                                                            <span className="hw-bank-name">{bank.bankName}</span>
                                                            <span className="hw-bank-number">{bank.accountNumber} · {bank.accountHolderName}</span>
                                                        </div>
                                                        {bank.isDefault && <span className="hw-bank-default">Mặc định</span>}
                                                        <div style={{ display: 'flex', gap: 4 }}>
                                                            {!bank.isDefault && (
                                                                <button
                                                                    className="hw-btn-icon"
                                                                    title="Đặt mặc định"
                                                                    onClick={(e) => handleSetDefault(bank.bankAccountId, e)}
                                                                    style={{ color: 'var(--primary)' }}
                                                                >
                                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                                                                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                                                                    </svg>
                                                                </button>
                                                            )}
                                                            <button
                                                                className="hw-btn-icon"
                                                                title="Xóa ngân hàng"
                                                                onClick={(e) => handleDeleteBank(bank.bankAccountId, e)}
                                                                style={{ color: 'var(--danger)' }}
                                                            >
                                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                                                                    <polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14H6L5 6"></path>
                                                                    <path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4h6v2"></path>
                                                                </svg>
                                                            </button>
                                                        </div>
                                                        <div className={`hw-bank-radio ${selectedBank?.bankAccountId === bank.bankAccountId ? 'checked' : ''}`}></div>
                                                    </div>
                                                ))}
                                                <button className="hw-add-bank-btn" onClick={() => setShowAddBank(true)}>
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>
                                                    </svg>
                                                    Thêm tài khoản mới
                                                </button>
                                            </div>
                                        )}

                                        <label className="hw-input-label" style={{ marginTop: 20 }}>Số tiền rút (VNĐ)</label>
                                        <div className="hw-input-group">
                                            <input
                                                type="text"
                                                value={withdrawAmount ? new Intl.NumberFormat('vi-VN').format(withdrawAmount) : ''}
                                                onChange={(e) => { setWithdrawAmount(e.target.value.replace(/\D/g, '')); setErrorMessage(''); }}
                                                placeholder="0"
                                                className="hw-input"
                                            />
                                            <span className="hw-input-suffix">₫</span>
                                        </div>

                                        <div className="hw-amount-suggestions">
                                            {[100000, 500000, 1000000].map(v => (
                                                <button key={v} onClick={() => setWithdrawAmount(String(v))}>
                                                    {new Intl.NumberFormat('vi-VN').format(v)}₫
                                                </button>
                                            ))}
                                            <button onClick={() => setWithdrawAmount(String(Math.floor(wallet.availableBalance || 0)))}>Tất cả</button>
                                        </div>

                                        <div className="hw-balance-hint">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path>
                                            </svg>
                                            Số dư khả dụng: <strong>{fmt(wallet.availableBalance)}</strong>
                                        </div>

                                        {errorMessage && (
                                            <div className="hw-alert hw-alert-danger">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                                {errorMessage}
                                            </div>
                                        )}

                                        <button
                                            className="hw-btn hw-btn-primary hw-btn-block"
                                            disabled={!withdrawAmount || bankAccounts.length === 0}
                                            onClick={handleWithdraw}
                                        >
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
                                                <line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline>
                                            </svg>
                                            Rút tiền
                                        </button>
                                        <p className="hw-withdraw-hint">Tiền sẽ được chuyển về tài khoản ngân hàng trong vòng 1-3 ngày làm việc.</p>
                                    </div>
                                )}

                                {withdrawState === 'confirm' && (
                                    <div className="hw-confirm-section">
                                        <div className="hw-confirm-icon">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                                                <line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>
                                            </svg>
                                        </div>
                                        <h4>Xác nhận rút tiền</h4>
                                        <p className="hw-confirm-desc">Vui lòng kiểm tra lại thông tin trước khi xác nhận.</p>
                                        <div className="hw-confirm-details">
                                            <div className="hw-confirm-row">
                                                <span className="hw-confirm-label">Số tiền rút</span>
                                                <span className="hw-confirm-value hw-text-primary">{fmt(parseInt(withdrawAmount, 10))}</span>
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
                                                <span className="hw-confirm-value">{selectedBank?.accountHolderName}</span>
                                            </div>
                                            <div className="hw-confirm-row">
                                                <span className="hw-confirm-label">Phí rút tiền</span>
                                                <span className="hw-confirm-value hw-text-success">Miễn phí</span>
                                            </div>
                                        </div>
                                        <div className="hw-confirm-actions">
                                            <button className="hw-btn hw-btn-primary hw-btn-block" onClick={confirmWithdraw}>Xác nhận rút tiền</button>
                                            <button className="hw-btn hw-btn-outline hw-btn-block" onClick={resetWithdraw}>Hủy</button>
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
                                        <p>Số tiền <strong>{fmt(parseInt(withdrawAmount, 10))}</strong> sẽ được chuyển về tài khoản trong 1-3 ngày làm việc.</p>
                                        <button className="hw-btn hw-btn-primary hw-btn-block" onClick={resetWithdraw}>Thực hiện giao dịch mới</button>
                                    </div>
                                )}

                                {withdrawState === 'error' && (
                                    <div className="hw-withdraw-state">
                                        <div className="hw-icon-circle hw-bg-danger-soft hw-text-danger">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                        </div>
                                        <h4 className="hw-text-danger">Giao dịch thất bại</h4>
                                        <p>{errorMessage || 'Đã xảy ra lỗi. Vui lòng thử lại sau.'}</p>
                                        <button className="hw-btn hw-btn-primary hw-btn-block" onClick={resetWithdraw}>Quay lại thử lại</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── ADD BANK MODAL ── */}
            {showAddBank && (
                <div className="hw-modal-overlay" onClick={() => setShowAddBank(false)}>
                    <div className="hw-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="hw-modal-header" style={{ borderBottom: '1px solid var(--border)', minHeight: '60px' }}>
                            <div className="hw-modal-title" style={{ fontSize: '18px', fontWeight: '600', color: '#0F2C24', margin: 0 }}>
                                Liên kết tài khoản ngân hàng
                            </div>
                            <button className="hw-modal-close" onClick={() => setShowAddBank(false)} style={{ color: '#6B7280' }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
                                    <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                        <div className="hw-modal-body">

                            {/* Bước 1: Chọn ngân hàng */}
                            <div className="hw-form-group">
                                <label className="hw-input-label">Chọn ngân hàng</label>
                                {selectedVietQR ? (
                                    <div className="hw-bank-item active" style={{ marginBottom: 8 }}>
                                        {selectedVietQR.logo && <img src={selectedVietQR.logo} alt={selectedVietQR.shortName} style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 6 }} />}
                                        <div className="hw-bank-details">
                                            <span className="hw-bank-name">{selectedVietQR.shortName}</span>
                                            <span className="hw-bank-number">{selectedVietQR.name}</span>
                                        </div>
                                        <button className="hw-btn-icon" onClick={() => setSelectedVietQR(null)} title="Chọn lại">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <input
                                            type="text"
                                            className="hw-input"
                                            style={{ fontSize: 14, marginBottom: 8 }}
                                            placeholder="Tìm kiếm ngân hàng... (VD: Vietcombank)"
                                            value={bankSearch}
                                            onChange={(e) => setBankSearch(e.target.value)}
                                        />
                                        <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10, background: '#fff' }}>
                                            {filteredBankList.length === 0 && <p style={{ padding: 16, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Đang tải danh sách ngân hàng...</p>}
                                            {filteredBankList.map(b => (
                                                <div
                                                    key={b.code}
                                                    onClick={() => { setSelectedVietQR(b); setBankSearch(''); }}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-soft)'}
                                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                >
                                                    {b.logo && <img src={b.logo} alt={b.shortName} style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 6 }} />}
                                                    <div>
                                                        <div style={{ fontWeight: 600, fontSize: 14 }}>{b.shortName}</div>
                                                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{b.name}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Bước 2: Nhập thông tin */}
                            <div className="hw-form-group">
                                <label className="hw-input-label">Số tài khoản</label>
                                <input
                                    type="text"
                                    className="hw-input"
                                    style={{ fontSize: 14 }}
                                    placeholder="VD: 0123456789"
                                    value={newBankAccount.accountNumber}
                                    onChange={(e) => setNewBankAccount(p => ({ ...p, accountNumber: e.target.value }))}
                                />
                            </div>
                            <div className="hw-form-group">
                                <label className="hw-input-label">Tên chủ tài khoản</label>
                                                <input
                                    type="text"
                                    className="hw-input"
                                    style={{ fontSize: 14 }}
                                    placeholder="VD: NGUYEN VAN A"
                                    value={newBankAccount.accountHolderName}
                                    onChange={(e) => setNewBankAccount(p => ({ ...p, accountHolderName: e.target.value.toUpperCase() }))}
                                />
                                <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                                    Tên chủ tài khoản phải khớp với tên của bạn trên hệ thống (không dấu, chữ hoa).
                                </p>
                            </div>



                            {addBankError && (
                                <div className="hw-alert hw-alert-danger">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                    {addBankError}
                                </div>
                            )}
                        </div>
                        <div className="hw-modal-footer">
                            <button className="hw-btn hw-btn-outline" onClick={() => setShowAddBank(false)}>Hủy</button>
                            <button className="hw-btn hw-btn-primary" onClick={handleAddBank} disabled={addBankLoading}>
                                {addBankLoading ? 'Đang liên kết...' : 'Liên kết ngân hàng'}
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
        </HelperLayout>
    );
};

export default HelperWalletPage;
