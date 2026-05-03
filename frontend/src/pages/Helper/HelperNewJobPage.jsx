import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import HelperLayout from '../../layouts/HelperLayout';
import NotificationModal from '../../components/NotificationModal';
import SmartCheckinModal from '../../components/SmartCheckinModal';
import BookingService from '../../services/BookingService';
import CheckoutService from '../../services/CheckoutService';
import CloudinaryService from '../../services/CloudinaryService';
import HelperJobService from '../../services/HelperJobService';
import { buildHelperJobModalModel } from '../../utils/helperJobPostDetail';
import './HelperNewJobPage.css';

const extractPayload = (res) => (res && typeof res === 'object' && 'data' in res ? res.data : res);

const TABS = [
    { id: 'NEW', label: 'Việc mới' },
    { id: 'PENDING', label: 'Chờ xác nhận' },
    { id: 'CONFIRMED', label: 'Ca đang làm' },
    { id: 'COMPLETED', label: 'Lịch sử ca' }
];

const TAB_UI = {
    NEW: {
        title: 'Việc mới đang mở',
        desc: 'Công việc phù hợp bạn có thể ứng tuyển ngay.',
        badgeLabel: 'Có thể ứng tuyển',
        badgeClass: 'new',
        icon: 'briefcase'
    },
    PENDING: {
        title: 'Đang chờ khách xác nhận',
        desc: 'Bạn đã ứng tuyển, đang chờ khách hàng ra quyết định.',
        badgeLabel: 'Đang chờ xác nhận',
        badgeClass: 'pending',
        icon: 'clock'
    },
    CONFIRMED: {
        title: 'Theo dõi quá trình thực hiện',
        desc: 'Quản lý ca làm theo từng bước: đến nơi, bắt đầu, checkout và chờ khách xác nhận.',
        badgeLabel: 'Đang theo dõi ca làm',
        badgeClass: 'confirmed',
        icon: 'check'
    },
    COMPLETED: {
        title: 'Lịch sử ca đã hoàn tất',
        desc: 'Theo dõi các ca đã hoàn thành và trạng thái thanh toán/khiếu nại.',
        badgeLabel: 'Đã hoàn thành',
        badgeClass: 'done',
        icon: 'check'
    }
};

const formatCurrencyVnd = (value) => {
    if (value === undefined || value === null || Number.isNaN(Number(value))) return 'N/A';
    return `${Number(value).toLocaleString('vi-VN')} đ`;
};

const formatWorkDate = (value) => {
    if (!value) return 'N/A';
    // backend returns yyyy-mm-dd (LocalDate)
    const [y, m, d] = String(value).split('-');
    if (y && m && d) return `${d}/${m}/${y}`;
    return String(value);
};

const buildLocationText = (job) => {
    const fullAddress = typeof job?.fullAddress === 'string' ? job.fullAddress.trim() : '';
    if (fullAddress) return fullAddress;

    const detailedAddress = [
        job?.addressDetail,
        job?.wardName,
        job?.districtName,
        job?.provinceName
    ].filter(Boolean).join(', ');
    return detailedAddress || 'N/A';
};

const isCompletedJob = (job) => String(job?.status || '').toUpperCase() === 'COMPLETED' || String(job?.bookingStatus || '').toUpperCase() === 'COMPLETED';

const getTabMeta = (tabId) => TAB_UI[tabId] || TAB_UI.NEW;

const getDisplayStatus = (tabId, jobStatus, isDirect = false) => {
    const fallback = getTabMeta(tabId);

    if (isDirect && String(jobStatus).toUpperCase() === 'PENDING_ACCEPTANCE') {
        return {
            ...fallback,
            badgeLabel: 'Yêu cầu trực tiếp',
            badgeClass: 'new', // Màu xanh lá cho nổi bật
            icon: 'briefcase'
        };
    }

    if (tabId === 'NEW') return fallback;
    if (tabId === 'PENDING') return fallback;
    if (tabId === 'CONFIRMED') {
        if (jobStatus === 'CANCELLED' || jobStatus === 'EXPIRED') {
            return {
                ...fallback,
                badgeLabel: jobStatus === 'EXPIRED' ? 'Đã hết hạn' : 'Đã hủy',
                badgeClass: 'pending',
                icon: 'clock'
            };
        }
        return fallback;
    }

    if (tabId === 'COMPLETED') {
        if (String(jobStatus).toUpperCase() === 'CANCELLED') {
            return {
                ...fallback,
                badgeLabel: 'Đã từ chối',
                badgeClass: 'rejected',
                icon: 'clock'
            };
        }
        return fallback;
    }

    return fallback;
};

const getCheckinBadgeMeta = (tabId, job) => {
    const bookingStatus = String(job?.bookingStatus || '').toUpperCase();
    if (bookingStatus === 'DISPUTED') {
        return {
            badgeLabel: 'Đang bị khiếu nại',
            badgeClass: 'pending',
            icon: 'clock'
        };
    }
    if (tabId === 'CONFIRMED' && bookingStatus === 'ARRIVED') {
        return {
            badgeLabel: 'Đã đến nhà',
            badgeClass: 'arrived',
            icon: 'check'
        };
    }

    if (tabId === 'CONFIRMED' && bookingStatus === 'IN_PROGRESS' && job?.customerArrivalConfirmed) {
        return {
            badgeLabel: 'Khách đã xác minh địa điểm',
            badgeClass: 'verified',
            icon: 'check'
        };
    }
    if (tabId === 'CONFIRMED' && bookingStatus === 'IN_PROGRESS') {
        return {
            badgeLabel: 'Đang thực hiện công việc',
            badgeClass: 'confirmed',
            icon: 'check'
        };
    }
    if (tabId === 'CONFIRMED' && bookingStatus === 'PENDING_COMPLETION') {
        return {
            badgeLabel: 'Đã checkout, chờ khách xác nhận',
            badgeClass: 'pending',
            icon: 'clock'
        };
    }

    return getDisplayStatus(tabId, job?.status, job?.isDirect);
};

const StatusIcon = ({ type }) => {
    if (type === 'clock') {
        return (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9"></circle>
                <polyline points="12 7 12 12 15 14"></polyline>
            </svg>
        );
    }

    if (type === 'check') {
        return (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9"></circle>
                <polyline points="8 12 11 15 16 9"></polyline>
            </svg>
        );
    }

    if (type === 'briefcase') {
        return (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="9" width="20" height="12" rx="2"></rect>
                <path d="M8 9V7a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <path d="M12 14v2"></path>
            </svg>
        );
    }

    return (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9"></circle>
        </svg>
    );
};

const HelperNewJobPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('NEW');
    const [jobs, setJobs] = useState([]);
    const [selectedJob, setSelectedJob] = useState(null);
    const [toast, setToast] = useState(null);
    const [openCheckinModal, setOpenCheckinModal] = useState(false);
    const [selectedBookingId, setSelectedBookingId] = useState(null);
    const [loadingApply, setLoadingApply] = useState(false);
    const [loadingJobs, setLoadingJobs] = useState(false);
    const [jobsError, setJobsError] = useState('');
    const [hasLoadedJobsOnce, setHasLoadedJobsOnce] = useState(false);
    const [loadedJobsTab, setLoadedJobsTab] = useState(activeTab);
    const [tabCounts, setTabCounts] = useState({ NEW: 0, PENDING: 0, CONFIRMED: 0, COMPLETED: 0 });
    const handledNotificationTokenRef = useRef(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const refreshForTokenRef = useRef(null);
    const [showDisputeModal, setShowDisputeModal] = useState(false);
    const [disputeMessage, setDisputeMessage] = useState('');
    const [disputeEvidenceUrl, setDisputeEvidenceUrl] = useState('');
    const [disputeUploading, setDisputeUploading] = useState(false);
    const [disputeError, setDisputeError] = useState('');
    const [submittingDispute, setSubmittingDispute] = useState(false);
    const [showCheckoutModal, setShowCheckoutModal] = useState(false);
    const [checkoutPhotoUrl, setCheckoutPhotoUrl] = useState('');
    const [checkoutReason, setCheckoutReason] = useState('');
    const [checkoutUploading, setCheckoutUploading] = useState(false);
    const [checkoutError, setCheckoutError] = useState('');
    const [submittingCheckout, setSubmittingCheckout] = useState(false);
    const tabMeta = getTabMeta(activeTab);

    const handleViewJob = (job) => {
        setSelectedJob(job);
    };

    const handleCloseModal = () => {
        if (!loadingApply) {
            setSelectedJob(null);
        }
    };

    const isPendingDirect = (job) => {
        return job?.isDirect && String(job?.status || '').toUpperCase() === 'PENDING_ACCEPTANCE';
    };

    const handleRespondDirect = async (e, bookingId, accept) => {
        e.stopPropagation();
        if (!bookingId) return;
        setLoadingJobs(true);
        try {
            await BookingService.respondToBooking(bookingId, accept);
            setToast({
                type: 'success',
                message: accept ? 'Đã chấp nhận đơn đặt trực tiếp!' : 'Đã từ chối đơn đặt trực tiếp.'
            });
            // Tải lại trang để update danh sách & counts
            window.location.reload();
        } catch (err) {
            setToast({
                type: 'error',
                message: err?.message || 'Thao tác thất bại.'
            });
            setLoadingJobs(false);
        }
    };

    const handleApplyJob = () => {
        if (!selectedJob || activeTab !== 'NEW') return;
        setLoadingApply(true);
        HelperJobService.applyForJob(selectedJob?.postId)
            .then(() => {
                setToast({
                    message: `Bạn đã ứng tuyển thành công công việc: ${selectedJob?.title || `#${selectedJob?.postId}`}! Vui lòng chờ khách hàng xác nhận.`,
                    type: 'success'
                });
                // Xoá job khỏi danh sách nếu ứng tuyển thành công
                setJobs((prevJobs) => prevJobs.filter((j) => j?.postId !== selectedJob?.postId));
                setTabCounts((prev) => ({
                    ...prev,
                    NEW: Math.max(0, prev.NEW - 1),
                    PENDING: prev.PENDING + 1
                }));
                setSelectedJob(null);
            })
            .catch((e) => {
                const msg = e?.message || e?.error || e?.msg || 'Ứng tuyển thất bại. Vui lòng thử lại.';
                setToast({ message: typeof msg === 'string' ? msg : 'Ứng tuyển thất bại. Vui lòng thử lại.', type: 'error' });
            })
            .finally(() => setLoadingApply(false));
    };

    const handleOpenCheckin = (job) => {
        const bookingId = Number(job?.bookingId);
        if (!bookingId) {
            setToast({
                type: 'warning',
                message: 'Công việc này chưa có booking để check-in.'
            });
            return;
        }

        setSelectedBookingId(bookingId);
        setOpenCheckinModal(true);
    };

    const handleOpenCheckoutModal = () => {
        if (!selectedJob?.bookingId) return;
        setCheckoutPhotoUrl('');
        setCheckoutReason('');
        setCheckoutError('');
        setShowCheckoutModal(true);
    };

    const handleCheckoutEvidenceChange = async (e) => {
        const file = e.target.files?.[0];
        setCheckoutError('');
        if (!file) {
            setCheckoutPhotoUrl('');
            return;
        }

        setCheckoutUploading(true);
        try {
            const url = await CloudinaryService.uploadImage(file, 'checkout');
            setCheckoutPhotoUrl(url || '');
        } catch (err) {
            setCheckoutError(err?.message || 'Tải ảnh checkout thất bại.');
            setCheckoutPhotoUrl('');
        } finally {
            setCheckoutUploading(false);
        }
    };

    const handleSubmitCheckout = async (e) => {
        e?.preventDefault();
        if (!selectedJob?.bookingId) return;
        if (!checkoutPhotoUrl.trim()) {
            setCheckoutError('Ảnh hoàn thành là bắt buộc.');
            return;
        }

        setSubmittingCheckout(true);
        setCheckoutError('');
        try {
            await CheckoutService.checkOut(selectedJob.bookingId, {
                checkoutPhotoUrl: checkoutPhotoUrl.trim(),
                checkoutReason: checkoutReason.trim() || undefined,
            });
            setToast({ type: 'success', message: `Đã checkout thành công cho booking #${selectedJob.bookingId}.` });
            setShowCheckoutModal(false);

            const nextBookingPatch = {
                bookingStatus: 'PENDING_COMPLETION',
                checkoutPhotoUrl: checkoutPhotoUrl.trim(),
                checkoutReason: checkoutReason.trim() || null,
                checkedOutAt: new Date().toISOString(),
            };
            setSelectedJob((prev) => (prev
                ? { ...prev, ...nextBookingPatch }
                : prev));
            setJobs((prevJobs) => prevJobs.map((job) => (
                Number(job?.bookingId) === Number(selectedJob.bookingId)
                    ? { ...job, ...nextBookingPatch }
                    : job
            )));
        } catch (err) {
            setCheckoutError(err?.message || 'Checkout thất bại. Vui lòng thử lại.');
        } finally {
            setSubmittingCheckout(false);
        }
    };

    const handleOpenDisputeModal = () => {
        if (!selectedJob?.bookingId) return;
        setDisputeMessage('');
        setDisputeEvidenceUrl('');
        setDisputeError('');
        setShowDisputeModal(true);
    };

    const handleDisputeEvidenceChange = async (e) => {
        const file = e.target.files?.[0];
        setDisputeError('');
        if (!file) {
            setDisputeEvidenceUrl('');
            return;
        }

        setDisputeUploading(true);
        try {
            const url = await CloudinaryService.uploadImage(file, 'dispute-defense');
            setDisputeEvidenceUrl(url || '');
        } catch (err) {
            setDisputeError(err?.message || 'Tải ảnh minh chứng thất bại.');
            setDisputeEvidenceUrl('');
        } finally {
            setDisputeUploading(false);
        }
    };

    const handleSubmitDisputeResponse = async (e) => {
        e?.preventDefault();
        if (!selectedJob?.bookingId) return;
        if (!disputeMessage.trim() || disputeMessage.trim().length < 10) {
            setDisputeError('Giải trình cần tối thiểu 10 ký tự.');
            return;
        }

        setSubmittingDispute(true);
        setDisputeError('');
        try {
            await BookingService.submitDisputeResponse(selectedJob.bookingId, {
                message: disputeMessage.trim(),
                evidenceUrl: disputeEvidenceUrl.trim() || undefined,
            });
            setToast({ type: 'success', message: `Đã gửi giải trình cho booking #${selectedJob.bookingId}.` });
            setShowDisputeModal(false);
            setSelectedJob((prev) => prev
                ? { ...prev, helperDisputeAt: new Date().toISOString(), helperDisputeMessage: disputeMessage.trim(), helperDisputeEvidenceUrl: disputeEvidenceUrl.trim() || null }
                : prev);
            setJobs((prevJobs) => prevJobs.map((job) => (
                Number(job?.bookingId) === Number(selectedJob.bookingId)
                    ? { ...job, helperDisputeAt: new Date().toISOString(), helperDisputeMessage: disputeMessage.trim(), helperDisputeEvidenceUrl: disputeEvidenceUrl.trim() || null }
                    : job
            )));
        } catch (err) {
            setDisputeError(err?.message || 'Không gửi được giải trình.');
        } finally {
            setSubmittingDispute(false);
        }
    };

    useEffect(() => {
        let cancelled = false;

        const loadJobs = async () => {
            setJobsError('');
            const userRaw = localStorage.getItem('user');
            let user = null;
            try {
                user = userRaw ? JSON.parse(userRaw) : null;
            } catch {
                user = null;
            }
            const userRole = user?.role;

            if (userRole !== 'HELPER') {
                setJobs([]);
                setTabCounts({ NEW: 0, PENDING: 0, CONFIRMED: 0, COMPLETED: 0 });
                setJobsError('Bạn không có quyền truy cập trang này. Vui lòng đăng nhập bằng tài khoản Helper.');
                setHasLoadedJobsOnce(true);
                return;
            }

            setLoadingJobs(true);
            try {
                const apiTabs = ['NEW', 'PENDING', 'CONFIRMED'];
                // 1. Lấy jobs từ marketplaces (theo job_applications) và direct bookings
                const [jobResults, directRes] = await Promise.all([
                    Promise.all(apiTabs.map(async (tId) => {
                        try {
                            const res = await HelperJobService.getJobsByTab(tId);
                            const data = extractPayload(res);
                            return { tab: tId, ok: true, list: Array.isArray(data) ? data : [] };
                        } catch (e) {
                            const statusCode = e?.status || e?.code || e?.response?.status;
                            if ((tId === 'PENDING' || tId === 'CONFIRMED') && (statusCode === 403 || statusCode === 404)) {
                                return { tab: tId, ok: true, list: [] };
                            }
                            return { tab: tId, ok: false, error: e };
                        }
                    })),
                    BookingService.getMyDirectBookings().catch(() => ({ data: [] }))
                ]);

                if (cancelled) return;

                const directList = extractPayload(directRes) || [];
                const nextCounts = { NEW: 0, PENDING: 0, CONFIRMED: 0, COMPLETED: 0 };
                const listByTab = { NEW: [], PENDING: [], CONFIRMED: [], COMPLETED: [] };
                let err = '';

                // Phân loại marketplace jobs
                for (const r of jobResults) {
                    if (r.ok) {
                        if (r.tab === 'CONFIRMED') {
                            listByTab.CONFIRMED.push(...r.list.filter(job => !isCompletedJob(job)));
                            listByTab.COMPLETED.push(...r.list.filter(job => isCompletedJob(job)));
                        } else {
                            listByTab[r.tab].push(...r.list);
                        }
                    } else if (r.tab === activeTab || (r.tab === 'CONFIRMED' && activeTab === 'COMPLETED')) {
                        const e = r.error;
                        const statusCode = e?.status || e?.code || e?.response?.status;
                        err = statusCode === 403
                            ? 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.'
                            : (e?.message || 'Không thể tải danh sách việc.');
                    }
                }

                // Phân loại direct bookings (không có job_post)
                directList.forEach(db => {
                    const status = String(db.status || '').toUpperCase();
                    // Map data để khớp với JobPostResponse structure mà UI đang dùng
                    const jobWrap = {
                        ...db,
                        postId: `D-${db.bookingId}`, // Use a shorter synthetic ID
                        isDirect: true,
                        bookingId: db.bookingId,
                        offerPrice: db.totalPrice != null ? Math.round(Number(db.totalPrice)) : null,
                        title: `Yêu cầu từ ${db.customerName || 'Khách hàng'}`,
                        categoryId: db.categoryId,
                        categoryName: db.serviceName || 'Dịch vụ',
                        workDate: db.workDate,
                        startTime: db.startTime,
                        durationHours: db.durationHours,
                        fullAddress: db.address,
                        workSize: db.workSize,
                        description: db.description,
                        serviceIds: db.serviceIds,
                        serviceNames: db.subServiceNames || '',
                        bookingStatus: status, // Essential for progress buttons (Arrival/Checkout)
                        canCheckin: db.canCheckin,
                        customerArrivalConfirmed: db.customerArrivalConfirmed,
                        createdAt: db.createdAt || new Date()
                    };

                    if (status === 'PENDING_ACCEPTANCE') {
                        listByTab.PENDING.push(jobWrap);
                    } else if (status === 'COMPLETED' || status === 'CANCELLED') {
                        listByTab.COMPLETED.push(jobWrap);
                    } else if (['CONFIRMED', 'ARRIVED', 'IN_PROGRESS', 'PENDING_COMPLETION', 'DISPUTED', 'RESOLVED'].includes(status)) {
                        listByTab.CONFIRMED.push(jobWrap);
                    }
                });

                // Cập nhật counts
                Object.keys(listByTab).forEach(k => {
                    nextCounts[k] = listByTab[k].length;
                });

                setTabCounts(nextCounts);
                setJobs(listByTab[activeTab] || []);
                setJobsError(err);
            } catch (e) {
                if (!cancelled) {
                    const msg = e?.message || e?.error || e?.msg || 'Không thể tải danh sách việc.';
                    setJobs([]);
                    setTabCounts({ NEW: 0, PENDING: 0, CONFIRMED: 0, COMPLETED: 0 });
                    setJobsError(typeof msg === 'string' ? msg : 'Không thể tải danh sách việc.');
                }
            } finally {
                if (!cancelled) {
                    setLoadingJobs(false);
                    setHasLoadedJobsOnce(true);
                    setLoadedJobsTab(activeTab);
                }
            }
        };

        loadJobs();
        return () => { cancelled = true; };
    }, [activeTab, refreshTrigger]);

    useEffect(() => {
        const targetPostId = location?.state?.targetPostId;
        const targetBookingId = location?.state?.targetBookingId;
        const targetId = location?.state?.targetPostId;
        const type = location?.state?.notificationType;
        const cameFromNotification = Boolean(location?.state?.fromNotification);
        const notificationToken = location?.state?.notificationToken ?? null;

        if (!cameFromNotification || !hasLoadedJobsOnce || loadingJobs || jobsError) return;
        if (notificationToken && handledNotificationTokenRef.current === notificationToken) return;

        // VẤN ĐỀ LAG Ở ĐÂY: Bạn từng để logic ép tab thành 'NEW' phía trên, rồi phía dưới lại đổi về 'PENDING'
        // Làm React lặp vô tận (Infinite Loop). Giờ gom hết việc chuyển Tab về DƯỚI ĐÂY nhé!

        let targetTab = null;
        if (type === 'DIRECT_BOOKING' || type === 'DIRECT_BOOKING_TIMEOUT') {
            targetTab = 'PENDING';
        } else if (type === 'BOOKING_ACCEPTED' || type === 'DIRECT_BOOKING_ACCEPTED' || type === 'WORK_STARTED' || type === 'WORK_DONE_BY_HELPER') {
            targetTab = 'CONFIRMED';
        } else if (type === 'MARKETPLACE_MATCH' || type === 'NEW_JOB_AVAILABLE') {
            targetTab = 'NEW';
        } else if (type === 'BOOKING_REJECTED' || type === 'DIRECT_BOOKING_REJECTED') {
            targetTab = 'COMPLETED';
        }

        // Nếu thông báo là targetBookingId mà không thuộc các loại trên (hoặc không xác định), ép vô CONFIRMED
        if (targetBookingId != null && !targetTab) {
            targetTab = 'CONFIRMED';
        }

        // Đảm bảo tab phải tự reset nếu chưa đến đúng chỗ
        if (targetTab && activeTab !== targetTab) {
            setActiveTab(targetTab);
            return; // Chờ đổi tab xong Component sẽ Render lại và chạy tiếp dòng bên dưới
        }

        if (targetTab && loadedJobsTab !== targetTab) {
            return; // Chờ API load xong list Jobs cho tab vừa đổi
        }

        // Bắt đầu đi tìm id trong list:
        if (targetBookingId == null && targetPostId == null) {
            setToast({
                message: 'Không xác định được bài đăng từ thông báo.',
                type: 'error'
            });
        } else if (targetBookingId != null) {
            const matchedBookingJob = jobs.find((job) => Number(job?.bookingId) === Number(targetBookingId));
            if (matchedBookingJob) {
                setSelectedJob(matchedBookingJob);
            } else {
                setToast({
                    message: `Không tìm thấy booking #${targetBookingId} (có thể chưa vào ca đang làm hoặc đã hoàn tất).`,
                    type: 'error'
                });
            }
        } else {
            if (targetId != null) {
                const matchedJob = jobs.find((job) =>
                    Number(job?.postId) === Number(targetId) ||
                    job?.postId === `D-${targetId}` ||
                    (job?.isDirect && Number(job?.bookingId) === Number(targetId))
                );

                if (matchedJob) {
                    setSelectedJob(matchedJob);
                } else if (activeTab === targetTab || !targetTab) {
                    if (refreshForTokenRef.current !== notificationToken) {
                        refreshForTokenRef.current = notificationToken;
                        setRefreshTrigger(prev => prev + 1);
                        return;
                    } else {
                        setToast({
                            message: `Không tìm thấy công việc #${targetId} trong danh mục này (có thể đã bị hủy hoặc đã được người khác nhận).`,
                            type: 'error'
                        });
                    }
                }
            }

            handledNotificationTokenRef.current = notificationToken;
            navigate(location.pathname, { replace: true, state: null });
        }

    }, [
        location,
        navigate,
        jobs,
        hasLoadedJobsOnce,
        loadingJobs,
        loadedJobsTab,
        jobsError,
        activeTab,
        refreshTrigger
    ]);


    return (
        <HelperLayout>
            <div className="hnj-page-container">
                {toast && (
                    <NotificationModal
                        message={toast.message}
                        type={toast.type}
                        onClose={() => setToast(null)}
                    />
                )}

                <div className="hnj-header">
                    <div className="hnj-tabs" role="tablist" aria-label="Helper job tabs">
                        {TABS.map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                className={`hnj-tab ${activeTab === t.id ? 'hnj-tab--active' : ''}`}
                                onClick={() => setActiveTab(t.id)}
                                role="tab"
                                aria-selected={activeTab === t.id}
                            >
                                <span>{t.label}</span>
                                <span className="hnj-tab-count">{tabCounts[t.id] ?? 0}</span>
                            </button>
                        ))}
                    </div>
                    <div className="hnj-filters">
                        <button className="hnj-filter-btn">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                            </svg>
                            Bộ lọc
                        </button>
                    </div>
                </div>
                <div className={`hnj-status-strip hnj-status-strip--${tabMeta.badgeClass}`}>
                    <div className="hnj-status-strip-icon">
                        <StatusIcon type={tabMeta.icon} />
                    </div>
                    <div className="hnj-status-strip-content">
                        <h3>{tabMeta.title}</h3>
                        <p>{tabMeta.desc}</p>
                    </div>
                    <div className="hnj-status-strip-total">{jobs.length} công việc</div>
                </div>

                <div className="hnj-grid">
                    {loadingJobs && (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#64748b' }}>
                            Đang tải danh sách việc…
                        </div>
                    )}

                    {!loadingJobs && jobsError && (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#9f1239' }}>
                            {jobsError}
                        </div>
                    )}

                    {!loadingJobs && !jobsError && jobs.map((job) => (
                        <div key={job.postId} className={`hnj-card hnj-card--${getCheckinBadgeMeta(activeTab, job).badgeClass}`} onClick={() => handleViewJob(job)}>
                            <div className="hnj-card-top">
                                <div className="hnj-customer-info">
                                    <div className="hnj-avatar" aria-hidden="true" style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                                        color: '#334155',
                                        fontWeight: 800,
                                        fontSize: job.postId?.length > 4 ? '11px' : '14px',
                                        border: '1px solid #cbd5e1'
                                    }}>
                                        #{job.postId}
                                    </div>
                                    <div className="hnj-customer-details">
                                        <h3 className="hnj-customer-name" style={{ fontSize: '15px' }}>{job.title || `Job #${job.postId}`}</h3>
                                        <span className="hnj-posted-time">
                                            {job.createdAt ? new Date(job.createdAt).toLocaleString('vi-VN') : ''}
                                        </span>
                                    </div>
                                </div>
                                <div className="hnj-price-badge">{formatCurrencyVnd(job.offerPrice)}</div>
                            </div>
                            <div className="hnj-card-status-row">
                                <span className={`hnj-state-pill hnj-state-pill--${getCheckinBadgeMeta(activeTab, job).badgeClass}`}>
                                    <StatusIcon type={getCheckinBadgeMeta(activeTab, job).icon} />
                                    {getCheckinBadgeMeta(activeTab, job).badgeLabel}
                                </span>
                                {job?.isVipCustomer && (
                                    <span className="hnj-state-pill hnj-state-pill--verified">
                                        <StatusIcon type="check" />
                                        VIP
                                    </span>
                                )}
                                {job?.isPremium && (
                                    <span className="hnj-state-pill hnj-state-pill--premium" style={{ background: '#fffbeb', color: '#92400e', borderColor: '#fef3c7' }}>
                                        ⭐ Premium
                                    </span>
                                )}
                            </div>

                            <div className="hnj-card-body">
                                <span className="hnj-service-tag">
                                    {job.categoryName || job.serviceNames || 'Dịch vụ'}
                                </span>

                                <div className="hnj-info-row">
                                    <svg className="hnj-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                        <line x1="16" y1="2" x2="16" y2="6"></line>
                                        <line x1="8" y1="2" x2="8" y2="6"></line>
                                        <line x1="3" y1="10" x2="21" y2="10"></line>
                                    </svg>
                                    <span>
                                        {formatWorkDate(job.workDate)} &bull; {job.startTime || 'N/A'}
                                        {job.durationHours ? ` (${job.durationHours} giờ)` : ''}
                                    </span>
                                </div>

                                <div className="hnj-info-row">
                                    <svg className="hnj-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                        <circle cx="12" cy="10" r="3"></circle>
                                    </svg>
                                    <span className="hnj-address-text" title={buildLocationText(job)}>{buildLocationText(job)}</span>
                                </div>
                            </div>

                            <div className="hnj-card-footer">
                                {activeTab === 'CONFIRMED' && Number(job?.bookingId) > 0 && Boolean(job?.canCheckin) && (
                                    <button
                                        type="button"
                                        className="hnj-checkin-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenCheckin(job);
                                        }}
                                    >
                                        Check-in ngay
                                    </button>
                                )}
                                {activeTab === 'CONFIRMED'
                                    && Number(job?.bookingId) > 0
                                    && String(job?.bookingStatus || '').toUpperCase() === 'IN_PROGRESS' && (
                                        <button
                                            type="button"
                                            className="hnj-checkout-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedJob(job);
                                                handleOpenCheckoutModal();
                                            }}
                                        >
                                            Checkout
                                        </button>
                                    )}

                                <button className="hnj-view-btn" onClick={() => handleViewJob(job)}>
                                    Xem chi tiết
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M5 12h14"></path>
                                        <path d="M12 5l7 7-7 7"></path>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))}

                    {!loadingJobs && !jobsError && jobs.length === 0 && (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px', color: '#64748b' }}>
                            <h3>Không có dữ liệu</h3>
                            <p>
                                {activeTab === 'NEW' && 'Không có công việc đang mở lúc này.'}
                                {activeTab === 'PENDING' && 'Bạn chưa có công việc nào đang chờ khách hàng xác nhận.'}
                                {activeTab === 'CONFIRMED' && 'Bạn chưa có công việc nào đang làm hoặc đã được xác nhận.'}
                                {activeTab === 'COMPLETED' && 'Bạn chưa hoàn thành công việc nào.'}
                            </p>
                        </div>
                    )}
                </div>

                {/* MODAL VIEW DETAILED JOB */}
                {selectedJob && (
                    <div className="hnj-modal-overlay" onMouseDown={handleCloseModal}>
                        <div className="hnj-modal-content" onMouseDown={(e) => e.stopPropagation()}>
                            <div className="hnj-modal-header">
                                <h2 className="hnj-job-main-title">Chi tiết công việc</h2>
                                <button className="hnj-modal-close" onClick={handleCloseModal} disabled={loadingApply}>
                                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>

                            <div className="hnj-modal-body">
                                {(() => {
                                    const detail = buildHelperJobModalModel(selectedJob);
                                    if (!detail) return null;
                                    const pillMeta = getCheckinBadgeMeta(activeTab, selectedJob);
                                    const bookingStatus = String(selectedJob?.bookingStatus || '').toUpperCase();
                                    const hasDispute = bookingStatus === 'DISPUTED';
                                    const disputeEvidence = selectedJob?.disputeEvidenceUrl || '';
                                    const helperResponseAt = selectedJob?.helperDisputeAt;
                                    const hasScope = detail.workBullets.length > 0 || detail.workLists.length > 0;
                                    const flagEntries = [
                                        detail.flags.premium && { key: 'premium', label: 'Gói cao cấp' },
                                        detail.flags.pets && { key: 'pets', label: 'Có thú cưng' },
                                        detail.flags.bringTools && { key: 'tools', label: 'Mang dụng cụ theo yêu cầu' },
                                    ].filter(Boolean);

                                    return (
                                        <>
                                            <div className="hnj-modal-hero">
                                                <div className="hnj-modal-hero-top">
                                                    <div className="hnj-modal-hero-text">
                                                        {detail.postRef && (
                                                            <span className="hnj-modal-post-ref">{detail.postRef}</span>
                                                        )}
                                                        <h3 className="hnj-modal-job-title">{detail.title}</h3>
                                                        <p className="hnj-modal-service-line">{detail.serviceLine}</p>
                                                    </div>
                                                    {detail.offerPrice && (
                                                        <div className="hnj-modal-price-block">
                                                            <span className="hnj-modal-price-label">Thù lao dự kiến</span>
                                                            <span className="hnj-modal-price-value">{detail.offerPrice}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className={`hnj-state-pill hnj-state-pill--${pillMeta.badgeClass} hnj-state-pill--modal`}>
                                                    <StatusIcon type={pillMeta.icon} />
                                                    {pillMeta.badgeLabel}
                                                </div>
                                            </div>

                                            <div className="hnj-modal-meta-grid">
                                                <div className="hnj-modal-meta-card">
                                                    <div className="hnj-modal-meta-icon" aria-hidden="true">
                                                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <rect x="3" y="4" width="18" height="18" rx="2" />
                                                            <path d="M16 2v4M8 2v4M3 10h18" />
                                                        </svg>
                                                    </div>
                                                    <div className="hnj-modal-meta-body">
                                                        <span className="hnj-modal-meta-label">Thời gian làm</span>
                                                        <strong className="hnj-modal-meta-strong">
                                                            {detail.schedule.date || '—'}
                                                        </strong>
                                                        <span className="hnj-modal-meta-sub">
                                                            {[detail.schedule.time, detail.schedule.duration].filter(Boolean).join(' · ') || '—'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="hnj-modal-meta-card">
                                                    <div className="hnj-modal-meta-icon hnj-modal-meta-icon--pin" aria-hidden="true">
                                                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                                            <circle cx="12" cy="10" r="3" />
                                                        </svg>
                                                    </div>
                                                    <div className="hnj-modal-meta-body">
                                                        <span className="hnj-modal-meta-label">Địa điểm</span>
                                                        <strong className="hnj-modal-meta-strong">{detail.location.area}</strong>
                                                        {detail.location.extra && (
                                                            <span className="hnj-modal-meta-sub hnj-modal-meta-sub--address">
                                                                {detail.location.extra}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {detail.booking && (
                                                <div className="hnj-modal-booking-bar">
                                                    <span className="hnj-modal-booking-label">Booking</span>
                                                    <span className="hnj-modal-booking-id">#{detail.booking.id}</span>
                                                    {detail.booking.status && (
                                                        <span className="hnj-modal-booking-status">{detail.booking.status}</span>
                                                    )}
                                                </div>
                                            )}

                                            {hasScope && (
                                                <section className="hnj-modal-scope" aria-labelledby="hnj-scope-heading">
                                                    <h3 id="hnj-scope-heading" className="hnj-modal-section-title">
                                                        Chi tiết công việc
                                                    </h3>
                                                    {detail.workBullets.length > 0 && (
                                                        <ul className="hnj-modal-bullet-list">
                                                            {detail.workBullets.map((line) => (
                                                                <li key={line}>{line}</li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                    {detail.workLists.map((block) => (
                                                        <div key={block.title} className="hnj-modal-sublist">
                                                            <h4 className="hnj-modal-sublist-title">{block.title}</h4>
                                                            <ol className="hnj-modal-ordered-list">
                                                                {block.items.map((item, i) => (
                                                                    <li key={`${block.title}-${i}`}>{item}</li>
                                                                ))}
                                                            </ol>
                                                        </div>
                                                    ))}
                                                </section>
                                            )}

                                            <div className="hnj-modal-flags">
                                                {flagEntries.length > 0 ? (
                                                    <div className="hnj-modal-chip-row" role="list">
                                                        {flagEntries.map((f) => (
                                                            <span key={f.key} className="hnj-modal-chip" role="listitem">
                                                                {f.label}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="hnj-modal-flags-note">Không có ghi chú đặc biệt (thú cưng / dụng cụ / gói premium).</p>
                                                )}
                                            </div>

                                            <div className="hnj-desc-box hnj-desc-box--modal">
                                                <h3 className="hnj-desc-title">Mô tả &amp; yêu cầu từ khách</h3>
                                                <div className="hnj-desc-text">
                                                    {selectedJob.description?.trim() || 'Khách chưa ghi thêm mô tả chi tiết.'}
                                                </div>
                                            </div>

                                            {hasDispute && (
                                                <div className="hnj-dispute-box">
                                                    <h3 className="hnj-desc-title">Khách đang khiếu nại</h3>
                                                    <p className="hnj-desc-text">{selectedJob?.disputeReason || 'Không có mô tả chi tiết.'}</p>
                                                    {disputeEvidence ? (
                                                        <a className="hnj-link" href={disputeEvidence} target="_blank" rel="noreferrer">
                                                            Mở ảnh minh chứng của khách →
                                                        </a>
                                                    ) : null}
                                                    {helperResponseAt ? (
                                                        <p className="hnj-dispute-note">Bạn đã gửi giải trình vào {new Date(helperResponseAt).toLocaleString('vi-VN')}.</p>
                                                    ) : (
                                                        <p className="hnj-dispute-note">Vui lòng gửi giải trình trong 24 giờ để admin xem xét.</p>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>

                            <div className="hnj-modal-footer">
                                {!isPendingDirect(selectedJob) && (
                                    <button className="hnj-btn-cancel" onClick={handleCloseModal} disabled={loadingApply}>
                                        Đóng
                                    </button>
                                )}

                                {isPendingDirect(selectedJob) && activeTab === 'PENDING' && (
                                    <div style={{
                                        display: 'flex',
                                        gap: '16px',
                                        width: '100%',
                                        marginTop: '12px',
                                        padding: '4px 0'
                                    }}>
                                        <button
                                            className="hnj-btn-cancel"
                                            style={{
                                                flex: 1,
                                                height: '48px',
                                                borderRadius: '12px',
                                                fontSize: '15px',
                                                fontWeight: '600',
                                                border: '2px solid #e2e8f0',
                                                color: '#64748b',
                                                background: '#f8fafc',
                                                transition: 'all 0.2s ease'
                                            }}
                                            onMouseOver={(e) => {
                                                e.currentTarget.style.background = '#fff1f1';
                                                e.currentTarget.style.borderColor = '#fee2e2';
                                                e.currentTarget.style.color = '#ef4444';
                                            }}
                                            onMouseOut={(e) => {
                                                e.currentTarget.style.background = '#f8fafc';
                                                e.currentTarget.style.borderColor = '#e2e8f0';
                                                e.currentTarget.style.color = '#64748b';
                                            }}
                                            onClick={(e) => {
                                                handleRespondDirect(e, selectedJob.bookingId, false);
                                                handleCloseModal();
                                            }}
                                        >
                                            Từ chối đơn
                                        </button>
                                        <button
                                            className="hnj-btn-apply"
                                            style={{
                                                flex: 1.2,
                                                height: '48px',
                                                borderRadius: '12px',
                                                fontSize: '15px',
                                                fontWeight: '700',
                                                background: '#2F5D50',
                                                borderColor: '#2F5D50',
                                                color: '#fff',
                                                boxShadow: '0 4px 6px -1px rgba(47, 93, 80, 0.2)',
                                                transition: 'all 0.2s ease'
                                            }}
                                            onMouseOver={(e) => {
                                                e.currentTarget.style.background = '#254a40';
                                                e.currentTarget.style.transform = 'translateY(-1px)';
                                                e.currentTarget.style.boxShadow = '0 6px 12px -2px rgba(47, 93, 80, 0.3)';
                                            }}
                                            onMouseOut={(e) => {
                                                e.currentTarget.style.background = '#2F5D50';
                                                e.currentTarget.style.transform = 'translateY(0)';
                                                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(47, 93, 80, 0.2)';
                                            }}
                                            onClick={(e) => {
                                                handleRespondDirect(e, selectedJob.bookingId, true);
                                                handleCloseModal();
                                            }}
                                        >
                                            Chấp nhận &amp; Làm ngay
                                        </button>
                                    </div>
                                )}

                                {activeTab === 'NEW' && (
                                    <button className="hnj-btn-apply" onClick={handleApplyJob} disabled={loadingApply}>
                                        {loadingApply ? (
                                            <>
                                                <div className="hnj-spinner"></div>
                                                Đang ứng tuyển...
                                            </>
                                        ) : (
                                            <>
                                                Ứng tuyển ngay
                                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                                </svg>
                                            </>
                                        )}
                                    </button>
                                )}
                                {activeTab === 'CONFIRMED' && Number(selectedJob?.bookingId) > 0 && Boolean(selectedJob?.canCheckin) && (
                                    <button
                                        type="button"
                                        className="hnj-btn-checkin"
                                        onClick={() => handleOpenCheckin(selectedJob)}
                                    >
                                        Check-in booking #{selectedJob.bookingId}
                                    </button>
                                )}
                                {activeTab === 'CONFIRMED'
                                    && Number(selectedJob?.bookingId) > 0
                                    && String(selectedJob?.bookingStatus || '').toUpperCase() === 'IN_PROGRESS' && (
                                        <button
                                            type="button"
                                            className="hnj-btn-checkout"
                                            onClick={handleOpenCheckoutModal}
                                        >
                                            Checkout booking #{selectedJob.bookingId}
                                        </button>
                                    )}
                                {String(selectedJob?.bookingStatus || '').toUpperCase() === 'DISPUTED'
                                    && !selectedJob?.helperDisputeAt && (
                                        <button
                                            type="button"
                                            className="hnj-btn-apply"
                                            onClick={handleOpenDisputeModal}
                                        >
                                            Gửi giải trình
                                        </button>
                                    )}
                            </div>
                        </div>
                    </div>
                )}

                {showDisputeModal && (
                    <div className="hnj-modal-overlay" onMouseDown={() => !submittingDispute && setShowDisputeModal(false)}>
                        <div className="hnj-modal-content hnj-modal-content--compact" onMouseDown={(e) => e.stopPropagation()}>
                            <div className="hnj-modal-header">
                                <h2 className="hnj-job-main-title">Gửi giải trình khiếu nại</h2>
                                <button
                                    className="hnj-modal-close"
                                    onClick={() => setShowDisputeModal(false)}
                                    disabled={submittingDispute}
                                >
                                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>
                            <form className="hnj-dispute-form" onSubmit={handleSubmitDisputeResponse}>
                                <label className="hnj-field">
                                    <span className="hnj-label">Giải trình</span>
                                    <textarea
                                        className="hnj-textarea"
                                        rows={4}
                                        value={disputeMessage}
                                        onChange={(e) => setDisputeMessage(e.target.value)}
                                        placeholder="Trình bày chi tiết tình huống và công việc đã hoàn thành..."
                                        maxLength={2000}
                                        disabled={submittingDispute}
                                    />
                                </label>
                                <label className="hnj-field">
                                    <span className="hnj-label">Ảnh minh chứng (không bắt buộc)</span>
                                    <input
                                        className="hnj-input"
                                        type="file"
                                        accept="image/*"
                                        onChange={handleDisputeEvidenceChange}
                                        disabled={submittingDispute || disputeUploading}
                                    />
                                </label>
                                {disputeUploading && (
                                    <p className="hnj-dispute-note">Đang tải ảnh lên…</p>
                                )}
                                {disputeEvidenceUrl && (
                                    <a className="hnj-link" href={disputeEvidenceUrl} target="_blank" rel="noreferrer">
                                        Mở ảnh đã tải lên →
                                    </a>
                                )}
                                {disputeError && (
                                    <p className="hnj-dispute-error">{disputeError}</p>
                                )}
                                <div className="hnj-modal-footer">
                                    <button type="button" className="hnj-btn-cancel" onClick={() => setShowDisputeModal(false)} disabled={submittingDispute}>
                                        Đóng
                                    </button>
                                    <button type="submit" className="hnj-btn-apply" disabled={submittingDispute}>
                                        {submittingDispute ? 'Đang gửi...' : 'Gửi giải trình'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {showCheckoutModal && (
                    <div className="hnj-modal-overlay" onMouseDown={() => !submittingCheckout && setShowCheckoutModal(false)}>
                        <div className="hnj-modal-content hnj-modal-content--compact" onMouseDown={(e) => e.stopPropagation()}>
                            <div className="hnj-modal-header">
                                <h2 className="hnj-job-main-title">Checkout công việc</h2>
                                <button
                                    className="hnj-modal-close"
                                    onClick={() => setShowCheckoutModal(false)}
                                    disabled={submittingCheckout}
                                >
                                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>
                            <form className="hnj-dispute-form" onSubmit={handleSubmitCheckout}>
                                <label className="hnj-field">
                                    <span className="hnj-label">Ảnh hoàn thành (bắt buộc)</span>
                                    <input
                                        className="hnj-input"
                                        type="file"
                                        accept="image/*"
                                        onChange={handleCheckoutEvidenceChange}
                                        disabled={submittingCheckout || checkoutUploading}
                                    />
                                </label>
                                {checkoutUploading && (
                                    <p className="hnj-dispute-note">Đang tải ảnh checkout lên…</p>
                                )}
                                {checkoutPhotoUrl && (
                                    <a className="hnj-link" href={checkoutPhotoUrl} target="_blank" rel="noreferrer">
                                        Mở ảnh checkout đã tải lên →
                                    </a>
                                )}
                                <label className="hnj-field">
                                    <span className="hnj-label">Lý do hoàn thành sớm (nếu có)</span>
                                    <textarea
                                        className="hnj-textarea"
                                        rows={3}
                                        value={checkoutReason}
                                        onChange={(e) => setCheckoutReason(e.target.value)}
                                        placeholder="Nếu tổng thời gian làm dưới 80%, bạn bắt buộc nhập lý do tại đây."
                                        maxLength={500}
                                        disabled={submittingCheckout}
                                    />
                                </label>
                                {checkoutError && (
                                    <p className="hnj-dispute-error">{checkoutError}</p>
                                )}
                                <div className="hnj-modal-footer">
                                    <button type="button" className="hnj-btn-cancel" onClick={() => setShowCheckoutModal(false)} disabled={submittingCheckout}>
                                        Đóng
                                    </button>
                                    <button type="submit" className="hnj-btn-checkout" disabled={submittingCheckout || checkoutUploading}>
                                        {submittingCheckout ? 'Đang checkout...' : 'Xác nhận checkout'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                <SmartCheckinModal
                    isOpen={openCheckinModal}
                    bookingId={selectedBookingId}
                    onClose={() => {
                        setOpenCheckinModal(false);
                        setSelectedBookingId(null);
                    }}
                    onSuccess={() => {
                        setJobs((prev) => prev.map((job) => (
                            Number(job?.bookingId) === Number(selectedBookingId)
                                ? { ...job, bookingStatus: 'ARRIVED', canCheckin: false, customerArrivalConfirmed: false }
                                : job
                        )));
                        setSelectedJob((prev) => {
                            if (!prev) return prev;
                            return Number(prev?.bookingId) === Number(selectedBookingId)
                                ? { ...prev, bookingStatus: 'ARRIVED', canCheckin: false, customerArrivalConfirmed: false }
                                : prev;
                        });
                        setToast({
                            type: 'success',
                            message: `Check-in thành công cho booking #${selectedBookingId}.`
                        });
                        setOpenCheckinModal(false);
                        setSelectedBookingId(null);
                    }}
                />
            </div>
        </HelperLayout >
    );
};

export default HelperNewJobPage;
