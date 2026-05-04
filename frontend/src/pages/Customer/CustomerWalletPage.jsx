import React, { useState, useEffect, useRef, useCallback } from 'react';
import CustomerLayout from '../../layouts/CustomerLayout';
import WalletService from '../../services/WalletService';
import NotificationModal from '../../components/NotificationModal';
import './CustomerWalletPage.css';
import '../Helper/HelperWalletPage.css'; // Dùng chung hw-modal styles


const CustomerWalletPage = () => {
    // ===== WALLET INFO =====
    const [wallet, setWallet] = useState(null);
    const [balanceLoading, setBalanceLoading] = useState(true);

    // ===== TRANSACTIONS =====
    const [transactions, setTransactions] = useState([]);
    const [txLoading, setTxLoading] = useState(false);
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    // ===== TAB =====
    const [activeTab, setActiveTab] = useState('deposit'); // 'deposit' | 'withdraw'

    // ===== DEPOSIT / QR =====
    const [depositAmount, setDepositAmount] = useState('');
    const [depositState, setDepositState] = useState('idle'); // idle, generating, waiting, success, error
    const [qrInfo, setQrInfo] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [countdown, setCountdown] = useState(600);
    const pollingIntervalRef = useRef(null);
    const countdownIntervalRef = useRef(null);
    const currentBalanceRef = useRef(null);

    // ===== WITHDRAW =====
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [withdrawState, setWithdrawState] = useState('idle'); // idle, confirm, processing, success, error
    const [withdrawError, setWithdrawError] = useState('');

    // ===== BANK ACCOUNTS =====
    const [bankAccounts, setBankAccounts] = useState([]);
    const [banksLoading, setBanksLoading] = useState(false);
    const [selectedBankId, setSelectedBankId] = useState(null);

    // ===== ADD BANK MODAL =====
    const [showAddBank, setShowAddBank] = useState(false);
    const [bankList, setBankList] = useState([]);
    const [bankSearch, setBankSearch] = useState('');
    const [selectedVietQR, setSelectedVietQR] = useState(null);
    const [newAccount, setNewAccount] = useState({ accountNumber: '', accountHolderName: '' });
    const [addBankLoading, setAddBankLoading] = useState(false);
    const [addBankError, setAddBankError] = useState('');
    const [toast, setToast] = useState(null);

    // ===== INITIAL LOAD =====
    useEffect(() => {
        fetchWalletData();
        fetchTransactions(0);
        fetchBankAccounts();
        return () => { stopPolling(); stopCountdown(); };
    }, []);

    // ===== FETCH HELPERS =====
    const fetchWalletData = async () => {
        try {
            setBalanceLoading(true);
            const res = await WalletService.getWalletInfo();
            const data = res.data || res;
            setWallet(data);
            currentBalanceRef.current = data.availableBalance;
        } catch (e) {
            console.error('Lỗi tải ví:', e);
        } finally {
            setBalanceLoading(false);
        }
    };

    const fetchTransactions = async (pageNum = 0) => {
        try {
            setTxLoading(true);
            const res = await WalletService.getTransactions({ page: pageNum, size: 10, sortBy: 'createdAt', sortDir: 'desc' });
            const data = res.data || res;
            if (data.transactions) {
                setTransactions(data.transactions);
                setTotalPages(data.totalPages || 1);
            } else if (data.content) {
                setTransactions(data.content);
                setTotalPages(data.totalPages || 1);
            } else {
                setTransactions(Array.isArray(data) ? data : []);
                setTotalPages(1);
            }
            setPage(pageNum);
        } catch (e) {
            console.error('Lỗi tải giao dịch:', e);
        } finally {
            setTxLoading(false);
        }
    };

    const fetchBankAccounts = async () => {
        setBanksLoading(true);
        try {
            const res = await WalletService.getBankAccounts();
            const data = res.data?.data || res.data || res || [];
            const accounts = Array.isArray(data) ? data : [];
            setBankAccounts(accounts);
            const def = accounts.find(a => a.isDefault) || accounts[0];
            if (def) setSelectedBankId(def.bankAccountId);
        } catch (e) {
            console.error('Lỗi tải ngân hàng:', e);
        } finally {
            setBanksLoading(false);
        }
    };

    // ===== FORMAT HELPERS =====
    const formatCurrency = (amount) => {
        if (amount === undefined || amount === null) return '0 ₫';
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    const formatTxType = (type) => {
        switch (type) {
            case 'DEPOSIT': return { label: 'Nạp tiền', cls: 'success' };
            case 'HOLD': return { label: 'Giữ tiền', cls: 'warning' };
            case 'PAYMENT': return { label: 'Thanh toán', cls: 'danger' };
            case 'REFUND': return { label: 'Hoàn tiền', cls: 'primary' };
            case 'WITHDRAW': return { label: 'Rút tiền', cls: 'muted' };
            default: return { label: type, cls: 'muted' };
        }
    };

    const formatTxDescription = (description) => {
        const raw = String(description || '');
        return raw
            .replace(/subsidy loyalty:/gi, 'Trợ giá :')
            .replace(/loyalty subsidy:/gi, 'Trợ giá :');
    };

    // ===== COUNTDOWN / POLLING =====
    const stopPolling = () => {
        if (pollingIntervalRef.current) { clearInterval(pollingIntervalRef.current); pollingIntervalRef.current = null; }
    };
    const stopCountdown = () => {
        if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null; }
    };
    const startCountdown = () => {
        stopCountdown();
        countdownIntervalRef.current = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    stopCountdown(); stopPolling();
                    setDepositState('error');
                    setErrorMessage('Hết thời gian chờ. Vui lòng tạo mã QR mới.');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };
    const startPolling = useCallback(() => {
        stopPolling();
        pollingIntervalRef.current = setInterval(async () => {
            try {
                const res = await WalletService.getWalletInfo();
                const data = res.data || res;
                setWallet(data);
                if (currentBalanceRef.current !== null && data.availableBalance > currentBalanceRef.current) {
                    const deposited = data.availableBalance - currentBalanceRef.current;
                    stopPolling(); stopCountdown();
                    currentBalanceRef.current = data.availableBalance;
                    setDepositState('success');
                    setSuccessMessage(`Nạp thành công ${formatCurrency(deposited)} vào ví!`);
                    fetchTransactions(0);
                }
            } catch (e) { console.error('Polling error:', e); }
        }, 4000);
    }, []);

    const renderCountdown = () => {
        const m = Math.floor(countdown / 60).toString().padStart(2, '0');
        const s = (countdown % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    // ===== DEPOSIT ACTIONS =====
    const handleAmountChange = (e) => {
        setDepositAmount(e.target.value.replace(/\D/g, ''));
        setErrorMessage('');
    };

    const handleGenerateQr = async () => {
        const amountNum = parseInt(depositAmount, 10);
        if (amountNum < 3000) {
            setErrorMessage('Số tiền nạp tối thiểu là 3.000 ₫.'); return;
        }
        if (amountNum > 50000000) { setErrorMessage('Số tiền nạp tối đa là 50.000.000 ₫.'); return; }
        try {
            setDepositState('generating'); setErrorMessage('');
            const res = await WalletService.generateQr(amountNum);
            setQrInfo(res.data || res);
            setDepositState('waiting');
            setCountdown(600);
            startCountdown(); startPolling();
        } catch (e) {
            setErrorMessage(e.message || 'Lỗi khi tạo mã QR.');
            setDepositState('error');
        }
    };

    const handleCopy = (text) => { navigator.clipboard.writeText(text); };

    const resetDeposit = () => {
        stopPolling(); stopCountdown();
        setDepositState('idle'); setDepositAmount(''); setQrInfo(null);
        setErrorMessage(''); setSuccessMessage('');
    };

    // ===== WITHDRAW ACTIONS =====
    const handleWithdrawAmountChange = (e) => {
        setWithdrawAmount(e.target.value.replace(/\D/g, ''));
        setWithdrawError('');
    };

    const handleRequestWithdraw = () => {
        const amountNum = parseInt(withdrawAmount, 10);
        if (!amountNum || isNaN(amountNum)) { setWithdrawError('Vui lòng nhập số tiền.'); return; }
        if (amountNum < 3000) { setWithdrawError('Số tiền rút tối thiểu là 3.000 ₫.'); return; }
        if (amountNum > (wallet?.availableBalance || 0)) { setWithdrawError('Số dư không đủ.'); return; }
        if (!selectedBankId && bankAccounts.length > 0) { setWithdrawError('Vui lòng chọn ngân hàng nhận tiền.'); return; }
        if (bankAccounts.length === 0) { setWithdrawError('Bạn chưa liên kết ngân hàng nào.'); return; }
        setWithdrawError('');
        setWithdrawState('confirm');
    };

    const confirmWithdraw = async () => {
        setWithdrawState('processing');
        try {
            await WalletService.requestWithdraw(parseInt(withdrawAmount, 10), selectedBankId);
            setWithdrawState('success');
            fetchWalletData();
            fetchTransactions(0);
        } catch (e) {
            setWithdrawError(e.response?.data?.message || 'Gửi yêu cầu thất bại.');
            setWithdrawState('error');
        }
    };

    const resetWithdraw = () => {
        setWithdrawState('idle'); setWithdrawAmount(''); setWithdrawError('');
    };

    // ===== BANK ACCOUNT ACTIONS =====
    const handleSetDefault = async (bankAccountId, e) => {
        e.stopPropagation();
        try {
            await WalletService.setDefaultBankAccount(bankAccountId);
            await fetchBankAccounts();
        } catch (e) {
            setToast({ type: 'error', message: e.response?.data?.message || 'Không thể đặt mặc định.' });
        }
    };

    const handleDeleteBank = async (bankAccountId, e) => {
        e.stopPropagation();
        if (!window.confirm('Bạn có chắc muốn xóa tài khoản này?')) return;
        try {
            await WalletService.deleteBankAccount(bankAccountId);
            await fetchBankAccounts();
        } catch (e) {
            setToast({ type: 'error', message: e.response?.data?.message || 'Không thể xóa.' });
        }
    };

    // Add bank modal
    useEffect(() => {
        if (showAddBank && bankList.length === 0) {
            WalletService.getBankList().then(setBankList).catch(console.error);
        }
    }, [showAddBank]);

    const filteredBankList = bankList.filter(b =>
        b.shortName?.toLowerCase().includes(bankSearch.toLowerCase()) ||
        b.name?.toLowerCase().includes(bankSearch.toLowerCase())
    );

    const handleAddBank = async () => {
        setAddBankError('');
        if (!selectedVietQR) { setAddBankError('Vui lòng chọn ngân hàng.'); return; }
        if (!newAccount.accountNumber.trim()) { setAddBankError('Vui lòng nhập số tài khoản.'); return; }
        if (!newAccount.accountHolderName.trim()) { setAddBankError('Vui lòng nhập tên chủ tài khoản.'); return; }
        setAddBankLoading(true);
        try {
            await WalletService.addBankAccount({
                bankName: selectedVietQR.shortName,
                bankCode: selectedVietQR.code,
                accountNumber: newAccount.accountNumber.trim(),
                accountHolderName: newAccount.accountHolderName.trim().toUpperCase(),
            });
            setShowAddBank(false);
            setSelectedVietQR(null);
            setNewAccount({ accountNumber: '', accountHolderName: '' });
            setBankSearch('');
            await fetchBankAccounts();
        } catch (e) {
            setAddBankError(e.response?.data?.message || 'Liên kết thất bại. Tên chủ tài khoản phải khớp với tên tài khoản HomeConnect.');
        } finally {
            setAddBankLoading(false);
        }
    };

    const selectedBank = bankAccounts.find(b => b.bankAccountId === selectedBankId);

    return (
        <CustomerLayout>
            <div className="vw-page">               

                {/* BALANCE CARDS */}
                <div className="vw-balance-grid">
                    <div className="vw-balance-card vw-main-balance">
                        <div className="vw-card-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
                            </svg>
                        </div>
                        <div className="vw-balance-info">
                            <span className="vw-balance-label">Số dư khả dụng</span>
                            <h3 className="vw-balance-amount">{balanceLoading ? '---' : formatCurrency(wallet?.availableBalance)}</h3>
                            <div className="vw-wallet-status">
                                Trạng thái: <span className={`vw-badge vw-badge-${(wallet?.status || 'ACTIVE').toLowerCase()}`}>
                                    {wallet?.status === 'ACTIVE' ? 'Hoạt động' : wallet?.status}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="vw-balance-card">
                        <div className="vw-card-icon vw-icon-warning">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                        </div>
                        <div className="vw-balance-info">
                            <span className="vw-balance-label">Tiền đang giữ</span>
                            <h3 className="vw-balance-amount vw-text-warning">{balanceLoading ? '---' : formatCurrency(wallet?.holdBalance)}</h3>
                        </div>
                    </div>
                    <div className="vw-balance-card">
                        <div className="vw-card-icon vw-icon-danger">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                                <polyline points="17 6 23 6 23 12"></polyline>
                            </svg>
                        </div>
                        <div className="vw-balance-info">
                            <span className="vw-balance-label">Tổng nợ</span>
                            <h3 className="vw-balance-amount vw-text-danger">{balanceLoading ? '---' : formatCurrency(wallet?.debtBalance)}</h3>
                        </div>
                    </div>
                </div>

                <div className="vw-content-layout">
                    {/* LEFT: TRANSACTIONS */}
                    <div className="vw-transactions-col">
                        <div className="vw-card">
                            <div className="vw-card-header">
                                <h3>Lịch sử giao dịch</h3>
                                <button className="vw-btn-icon" onClick={() => fetchTransactions(0)} title="Làm mới">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline>
                                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                                    </svg>
                                </button>
                            </div>
                            <div className="vw-card-body">
                                {txLoading ? (
                                    <div className="vw-empty-state"><div className="vw-spinner"></div><p>Đang tải...</p></div>
                                ) : transactions.length === 0 ? (
                                    <div className="vw-empty-state">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                            <line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>
                                        </svg>
                                        <p>Chưa có giao dịch nào.</p>
                                    </div>
                                ) : (
                                    <div className="vw-tx-list">
                                        {transactions.map(tx => {
                                            const typeInfo = formatTxType(tx.transactionType || tx.type);
                                            const isPositive = ['DEPOSIT', 'REFUND'].includes(tx.transactionType || tx.type);
                                            let dateStr = 'N/A';
                                            if (tx.createdAt) {
                                                const d = typeof tx.createdAt === 'string' ? new Date(tx.createdAt)
                                                    : new Date(tx.createdAt[0], tx.createdAt[1] - 1, tx.createdAt[2], tx.createdAt[3], tx.createdAt[4], tx.createdAt[5]);
                                                dateStr = d.toLocaleString('vi-VN');
                                            }
                                            return (
                                                <div className="vw-tx-item" key={tx.id || tx.transactionId}>
                                                    <div className={`vw-tx-icon vw-bg-${typeInfo.cls}-soft vw-text-${typeInfo.cls}`}>
                                                        {isPositive
                                                            ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
                                                            : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
                                                        }
                                                    </div>
                                                    <div className="vw-tx-content">
                                                        <div className="vw-tx-title">{formatTxDescription(tx.description)}</div>
                                                        <div className="vw-tx-meta">
                                                            <span className={`vw-tx-type vw-text-${typeInfo.cls}`}>{typeInfo.label}</span>
                                                            <span className="vw-tx-dot">&bull;</span>
                                                            <span className="vw-tx-time">{dateStr}</span>
                                                        </div>
                                                    </div>
                                                    <div className={`vw-tx-amount ${isPositive ? 'vw-text-success' : 'vw-text-main'}`}>
                                                        {isPositive ? '+' : '-'}{formatCurrency(tx.amount)}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                            {!txLoading && totalPages > 1 && (
                                <div className="vw-pagination">
                                    <button disabled={page === 0} onClick={() => fetchTransactions(page - 1)}>&lsaquo; Trước</button>
                                    <span>Trang {page + 1} / {totalPages}</span>
                                    <button disabled={page >= totalPages - 1} onClick={() => fetchTransactions(page + 1)}>Sau &rsaquo;</button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT: DEPOSIT / WITHDRAW TABS */}
                    <div className="vw-deposit-col">
                        {/* TAB SWITCHER */}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                            <button
                                className={`vw-btn ${activeTab === 'deposit' ? 'vw-btn-primary' : 'vw-btn-outline'}`}
                                style={{ flex: 1 }}
                                onClick={() => setActiveTab('deposit')}
                            >
                                💰 Nạp tiền
                            </button>
                            <button
                                className={`vw-btn ${activeTab === 'withdraw' ? 'vw-btn-primary' : 'vw-btn-outline'}`}
                                style={{ flex: 1 }}
                                onClick={() => setActiveTab('withdraw')}
                            >
                                🏦 Rút tiền
                            </button>
                        </div>

                        <div className="vw-card vw-sticky">
                            {/* ==================== TAB: NẠP TIỀN ==================== */}
                            {activeTab === 'deposit' && (
                                <>
                                    <div className="vw-card-header">
                                        <h3 style={{ display: 'flex', alignItems: 'center' }}>
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20, marginRight: 8 }}>
                                                <line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline>
                                            </svg>
                                            Nạp tiền vào ví
                                        </h3>
                                    </div>
                                    <div className="vw-card-body">
                                        {depositState === 'idle' && (
                                            <div className="vw-deposit-form">
                                                <label className="vw-input-label">Số tiền cần nạp (VNĐ)</label>
                                                <div className="vw-input-group">
                                                    <input
                                                        type="text"
                                                        value={depositAmount ? new Intl.NumberFormat('vi-VN').format(depositAmount) : ''}
                                                        onChange={handleAmountChange}
                                                        placeholder="0"
                                                        className="vw-input"
                                                    />
                                                    <span className="vw-input-suffix">₫</span>
                                                </div>
                                                <div className="vw-amount-suggestions">
                                                    {[50000, 100000, 200000, 500000].map(v => (
                                                        <button key={v} onClick={() => setDepositAmount(String(v))}>
                                                            {new Intl.NumberFormat('vi-VN').format(v)}₫
                                                        </button>
                                                    ))}
                                                </div>
                                                {errorMessage && (
                                                    <div className="vw-alert vw-alert-danger" style={{ marginTop: '12px' }}>
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                                        {errorMessage}
                                                    </div>
                                                )}
                                                <button className="vw-btn vw-btn-primary vw-btn-block" disabled={!depositAmount} onClick={handleGenerateQr} style={{ marginTop: '16px' }}>
                                                    Tạo mã nạp tiền
                                                </button>
                                                <p className="vw-deposit-hint">Hỗ trợ nạp tiền 24/7 qua chuyển khoản VietQR tự động.</p>
                                            </div>
                                        )}

                                        {depositState === 'generating' && (
                                            <div className="vw-deposit-state">
                                                <div className="vw-spinner vw-spinner-lg vw-text-primary"></div>
                                                <h4>Đang tạo mã QR...</h4>
                                                <p>Vui lòng đợi trong giây lát.</p>
                                            </div>
                                        )}

                                        {depositState === 'waiting' && qrInfo && (
                                            <div className="vw-qr-section">
                                                <div className="vw-qr-timer">
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                                    Mã hết hạn sau: <span>{renderCountdown()}</span>
                                                </div>
                                                <div className="vw-qr-box">
                                                    <img src={qrInfo.qrCodeUrl} alt="QR Code" className="vw-qr-img" />
                                                </div>
                                                <p className="vw-qr-inst">Mở ứng dụng ngân hàng và quét mã để thanh toán.</p>
                                                <div className="vw-qr-info">
                                                    <div className="vw-info-row">
                                                        <span className="vw-info-lbl">Ngân hàng</span>
                                                        <span className="vw-info-val">{qrInfo.bankCode}</span>
                                                    </div>
                                                    <div className="vw-info-row">
                                                        <span className="vw-info-lbl">Số tài khoản</span>
                                                        <div className="vw-info-copy">
                                                            <span className="vw-info-val">{qrInfo.accountNumber}</span>
                                                            <button className="vw-btn-copy" onClick={() => handleCopy(qrInfo.accountNumber)}>Copy</button>
                                                        </div>
                                                    </div>
                                                    <div className="vw-info-row">
                                                        <span className="vw-info-lbl">Số tiền</span>
                                                        <span className="vw-info-val vw-text-primary">{formatCurrency(qrInfo.amount)}</span>
                                                    </div>
                                                    <div className="vw-qr-alert">
                                                        <div className="vw-alert-title">NỘI DUNG CHUYỂN KHOẢN</div>
                                                        <div className="vw-alert-content">
                                                            <span className="vw-transfer-code">{qrInfo.transferContent}</span>
                                                            <button className="vw-btn-copy" onClick={() => handleCopy(qrInfo.transferContent)}>Copy</button>
                                                        </div>
                                                        <div className="vw-alert-warn">⚠️ Phải nhập chính xác nội dung này để được tự động cộng tiền.</div>
                                                    </div>
                                                </div>
                                                <div className="vw-polling-indicator">
                                                    <div className="vw-spinner vw-spinner-sm"></div>
                                                    <span>Hệ thống đang chờ bạn thanh toán...</span>
                                                </div>
                                                <button className="vw-btn vw-btn-outline vw-btn-block" onClick={resetDeposit}>Hủy giao dịch</button>
                                            </div>
                                        )}

                                        {depositState === 'success' && (
                                            <div className="vw-deposit-state">
                                                <div className="vw-icon-circle vw-bg-success-soft vw-text-success">
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                </div>
                                                <h4 className="vw-text-success">Nạp tiền thành công!</h4>
                                                <p>{successMessage}</p>
                                                <button className="vw-btn vw-btn-primary vw-btn-block" onClick={resetDeposit}>Thực hiện giao dịch mới</button>
                                            </div>
                                        )}

                                        {depositState === 'error' && (
                                            <div className="vw-deposit-state">
                                                <div className="vw-icon-circle vw-bg-danger-soft vw-text-danger">
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                </div>
                                                <h4 className="vw-text-danger">Giao dịch thất bại</h4>
                                                <p>{errorMessage}</p>
                                                <button className="vw-btn vw-btn-primary vw-btn-block" onClick={resetDeposit}>Quay lại thử lại</button>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}

                            {/* ==================== TAB: RÚT TIỀN ==================== */}
                            {activeTab === 'withdraw' && (
                                <>
                                    <div className="vw-card-header">
                                        <h3 style={{ display: 'flex', alignItems: 'center' }}>
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20, marginRight: 8 }}>
                                                <line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline>
                                            </svg>
                                            Rút tiền
                                        </h3>
                                    </div>
                                    <div className="vw-card-body">

                                        {withdrawState === 'idle' && (
                                            <div className="vw-deposit-form">
                                                {/* Danh sách ngân hàng */}
                                                <label className="vw-input-label">Tài khoản nhận tiền</label>
                                                {banksLoading ? (
                                                    <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '12px' }}>Đang tải...</p>
                                                ) : (
                                                    <div className="hw-bank-list">
                                                        {bankAccounts.length === 0 && (
                                                            <p className="hw-text-muted" style={{ fontSize: 13, marginBottom: 8 }}>Bạn chưa liên kết ngân hàng nào.</p>
                                                        )}
                                                        {bankAccounts.map(bank => (
                                                            <div
                                                                key={bank.bankAccountId}
                                                                className={`hw-bank-item ${selectedBankId === bank.bankAccountId ? 'active' : ''}`}
                                                                onClick={() => setSelectedBankId(bank.bankAccountId)}
                                                            >
                                                                <div className="hw-bank-icon">
                                                                    <img
                                                                        src={`https://api.vietqr.io/img/${bank.bankCode}.png`}
                                                                        alt={bank.bankName}
                                                                        style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 4 }}
                                                                        onError={(e) => {
                                                                            e.target.onerror = null;
                                                                            e.target.src = 'https://img.icons8.com/color/48/bank.png';
                                                                        }}
                                                                    />
                                                                </div>
                                                                <div className="hw-bank-details">
                                                                    <span className="hw-bank-name">{bank.bankName}</span>
                                                                    <span className="hw-bank-number">{bank.accountNumber} · {bank.accountHolderName}</span>
                                                                </div>
                                                                {bank.isDefault && <span className="hw-bank-default">Mặc định</span>}
                                                                <div style={{ display: 'flex', gap: 4 }}>
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
                                                                <div className={`hw-bank-radio ${selectedBankId === bank.bankAccountId ? 'checked' : ''}`}></div>
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

                                                {/* Số tiền rút */}
                                                <label className="vw-input-label">Số tiền rút (VNĐ)</label>
                                                <div className="vw-input-group">
                                                    <input
                                                        type="text"
                                                        value={withdrawAmount ? new Intl.NumberFormat('vi-VN').format(withdrawAmount) : ''}
                                                        onChange={handleWithdrawAmountChange}
                                                        placeholder="0"
                                                        className="vw-input"
                                                    />
                                                    <span className="vw-input-suffix">₫</span>
                                                </div>
                                                <div className="vw-amount-suggestions">
                                                    {[100000, 500000, 1000000].map(v => (
                                                        <button key={v} onClick={() => setWithdrawAmount(String(v))}>
                                                            {new Intl.NumberFormat('vi-VN').format(v)}₫
                                                        </button>
                                                    ))}
                                                    <button onClick={() => setWithdrawAmount(String(Math.floor(wallet?.availableBalance || 0)))}>
                                                        Tất cả
                                                    </button>
                                                </div>

                                                {withdrawError && (
                                                    <div className="vw-alert vw-alert-danger" style={{ marginTop: '12px' }}>
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                                        {withdrawError}
                                                    </div>
                                                )}

                                                <button
                                                    className="vw-btn vw-btn-primary vw-btn-block"
                                                    disabled={!withdrawAmount || bankAccounts.length === 0}
                                                    onClick={handleRequestWithdraw}
                                                    style={{ marginTop: '16px' }}
                                                >
                                                    Gửi yêu cầu rút tiền
                                                </button>
                                                <p className="vw-deposit-hint">Yêu cầu sẽ được Admin duyệt trong 1–3 ngày làm việc.</p>
                                            </div>
                                        )}

                                        {withdrawState === 'confirm' && (
                                            <div className="vw-deposit-form">
                                                <h4 style={{ marginBottom: '16px' }}>Xác nhận yêu cầu rút tiền</h4>
                                                <div style={{ background: 'var(--bg-light, #f8fafc)', borderRadius: '12px', padding: '16px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <span style={{ color: 'var(--muted)' }}>Số tiền rút</span>
                                                        <strong style={{ color: 'var(--danger)' }}>{formatCurrency(parseInt(withdrawAmount, 10))}</strong>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <span style={{ color: 'var(--muted)' }}>Ngân hàng</span>
                                                        <strong>{selectedBank?.bankName}</strong>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <span style={{ color: 'var(--muted)' }}>Số tài khoản</span>
                                                        <strong>{selectedBank?.accountNumber}</strong>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <span style={{ color: 'var(--muted)' }}>Chủ tài khoản</span>
                                                        <strong>{selectedBank?.accountHolderName}</strong>
                                                    </div>
                                                </div>
                                                <button className="vw-btn vw-btn-primary vw-btn-block" onClick={confirmWithdraw}>Xác nhận gửi yêu cầu</button>
                                                <button className="vw-btn vw-btn-outline vw-btn-block" onClick={resetWithdraw} style={{ marginTop: '10px' }}>Hủy</button>
                                            </div>
                                        )}

                                        {withdrawState === 'processing' && (
                                            <div className="vw-deposit-state">
                                                <div className="vw-spinner vw-spinner-lg vw-text-primary"></div>
                                                <h4>Đang xử lý...</h4>
                                            </div>
                                        )}

                                        {withdrawState === 'success' && (
                                            <div className="vw-deposit-state">
                                                <div className="vw-icon-circle vw-bg-success-soft vw-text-success">
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                </div>
                                                <h4 className="vw-text-success">Đã gửi yêu cầu rút tiền!</h4>
                                                <p>Yêu cầu sẽ được xử lý trong 1–3 ngày làm việc.</p>
                                                <button className="vw-btn vw-btn-primary vw-btn-block" onClick={resetWithdraw}>Trở lại</button>
                                            </div>
                                        )}

                                        {withdrawState === 'error' && (
                                            <div className="vw-deposit-state">
                                                <div className="vw-icon-circle vw-bg-danger-soft vw-text-danger">
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                </div>
                                                <h4 className="vw-text-danger">Gửi yêu cầu thất bại</h4>
                                                <p>{withdrawError}</p>
                                                <button className="vw-btn vw-btn-primary vw-btn-block" onClick={resetWithdraw}>Thử lại</button>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ==================== MODAL: THÊM NGÂN HÀNG (giống Helper) ==================== */}
            {showAddBank && (
                <div className="hw-modal-overlay" onClick={() => { setShowAddBank(false); setSelectedVietQR(null); setAddBankError(''); setNewAccount({ accountNumber: '', accountHolderName: '' }); }}>
                    <div className="hw-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="hw-modal-header" style={{ borderBottom: '1px solid var(--border)', minHeight: '60px' }}>
                            <div className="hw-modal-title" style={{ fontSize: '18px', fontWeight: '600', color: '#0F2C24', margin: 0 }}>
                                Liên kết tài khoản ngân hàng
                            </div>
                            <button className="hw-modal-close" onClick={() => { setShowAddBank(false); setSelectedVietQR(null); setAddBankError(''); setNewAccount({ accountNumber: '', accountHolderName: '' }); }} style={{ color: '#6B7280' }}>
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
                                    value={newAccount.accountNumber}
                                    onChange={(e) => setNewAccount(p => ({ ...p, accountNumber: e.target.value }))}
                                />
                            </div>
                            <div className="hw-form-group">
                                <label className="hw-input-label">Tên chủ tài khoản</label>
                                <input
                                    type="text"
                                    className="hw-input"
                                    style={{ fontSize: 14 }}
                                    placeholder="VD: NGUYEN VAN A"
                                    value={newAccount.accountHolderName}
                                    onChange={(e) => setNewAccount(p => ({ ...p, accountHolderName: e.target.value.toUpperCase() }))}
                                />
                                <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                                    ⚠️ Tên chủ tài khoản phải khớp với tên của bạn trên hệ thống (không dấu, chữ hoa).
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
        </CustomerLayout>
    );
};

export default CustomerWalletPage;


