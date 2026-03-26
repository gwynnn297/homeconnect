import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import HelperLayout from '../../layouts/HelperLayout';
import NotificationModal from '../../components/NotificationModal';
import HelperJobService from '../../services/HelperJobService';
import './HelperNewJobPage.css';

const TABS = [
    { id: 'NEW', label: 'Việc mới' },
    { id: 'PENDING', label: 'Chờ xác nhận' },
    { id: 'CONFIRMED', label: 'Xác nhận' }
];

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

const buildLocationText = (job) =>
    [job?.wardName, job?.districtName, job?.provinceName].filter(Boolean).join(', ') || 'N/A';

const HelperNewJobPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('NEW');
    const [jobs, setJobs] = useState([]);
    const [selectedJob, setSelectedJob] = useState(null);
    const [toast, setToast] = useState(null);
    const [loadingApply, setLoadingApply] = useState(false);
    const [loadingJobs, setLoadingJobs] = useState(false);
    const [jobsError, setJobsError] = useState('');
    const [hasLoadedJobsOnce, setHasLoadedJobsOnce] = useState(false);
    const handledNotificationTokenRef = useRef(null);

    const handleViewJob = (job) => {
        setSelectedJob(job);
    };

    const handleCloseModal = () => {
        if (!loadingApply) {
            setSelectedJob(null);
        }
    };

    const handleApplyJob = () => {
        setLoadingApply(true);
        HelperJobService.applyForJob(selectedJob?.postId)
            .then(() => {
                setToast({
                    message: `Bạn đã ứng tuyển thành công công việc: ${selectedJob?.title || `#${selectedJob?.postId}`}! Vui lòng chờ khách hàng xác nhận.`,
                    type: 'success'
                });
                // Xoá job khỏi danh sách nếu ứng tuyển thành công
                setJobs((prevJobs) => prevJobs.filter((j) => j?.postId !== selectedJob?.postId));
                setSelectedJob(null);
            })
            .catch((e) => {
                const msg = e?.message || e?.error || e?.msg || 'Ứng tuyển thất bại. Vui lòng thử lại.';
                setToast({ message: typeof msg === 'string' ? msg : 'Ứng tuyển thất bại. Vui lòng thử lại.', type: 'error' });
            })
            .finally(() => setLoadingApply(false));
    };

    useEffect(() => {
        let cancelled = false;

        const loadJobs = async () => {
            setJobsError('');

            // Only "Việc mới" is wired to backend per requirement
            if (activeTab !== 'NEW') {
                setJobs([]);
                setHasLoadedJobsOnce(true);
                return;
            }

            setLoadingJobs(true);
            try {
                const res = await HelperJobService.getAllJobs();
                const data = res?.data;
                const list = Array.isArray(data) ? data : [];
                if (!cancelled) setJobs(list);
            } catch (e) {
                const msg = e?.message || e?.error || e?.msg || 'Không thể tải danh sách việc.';
                if (!cancelled) {
                    setJobs([]);
                    setJobsError(typeof msg === 'string' ? msg : 'Không thể tải danh sách việc.');
                }
            } finally {
                if (!cancelled) {
                    setLoadingJobs(false);
                    setHasLoadedJobsOnce(true);
                }
            }
        };

        loadJobs();
        return () => { cancelled = true; };
    }, [activeTab]);

    useEffect(() => {
        const targetPostId = location?.state?.targetPostId;
        const cameFromNotification = Boolean(location?.state?.fromNotification);
        const notificationToken = location?.state?.notificationToken ?? null;
        if (!cameFromNotification) return;
        if (notificationToken && handledNotificationTokenRef.current === notificationToken) return;
        if (!hasLoadedJobsOnce) return;
        if (loadingJobs || jobsError) return;

        if (activeTab !== 'NEW') {
            setActiveTab('NEW');
            return;
        }

        if (targetPostId == null) {
            setToast({
                message: 'Không xác định được bài đăng từ thông báo.',
                type: 'error'
            });
        } else {
            const matchedJob = jobs.find((job) => Number(job?.postId) === Number(targetPostId));
            if (matchedJob) {
                setSelectedJob(matchedJob);
            } else {
                setToast({
                    message: `Không tìm thấy công việc #${targetPostId} (có thể đã hết hạn hoặc không còn hiển thị).`,
                    type: 'error'
                });
            }
        }

        handledNotificationTokenRef.current = notificationToken;
        navigate(location.pathname, { replace: true, state: null });
    }, [
        location,
        navigate,
        jobs,
        hasLoadedJobsOnce,
        loadingJobs,
        jobsError,
        activeTab
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
                                {t.label}
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
                        <div key={job.postId} className="hnj-card" onClick={() => handleViewJob(job)}>
                            <div className="hnj-card-top">
                                <div className="hnj-customer-info">
                                    <div className="hnj-avatar" aria-hidden="true" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', color: '#0f172a', fontWeight: 700 }}>
                                        #{job.postId}
                                    </div>
                                    <div className="hnj-customer-details">
                                        <h3 className="hnj-customer-name">{job.title || `Job #${job.postId}`}</h3>
                                        <span className="hnj-posted-time">
                                            {job.createdAt ? new Date(job.createdAt).toLocaleString('vi-VN') : ''}
                                        </span>
                                    </div>
                                </div>
                                <div className="hnj-price-badge">{formatCurrencyVnd(job.offerPrice)}</div>
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
                                <div className="hnj-distance">
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="3 11 21 11"></polyline>
                                        <polyline points="10 4 3 11 10 18"></polyline>
                                    </svg>
                                    {job.status || 'PUBLISHED'}
                                </div>
                                <button className="hnj-view-btn">
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
                                {activeTab === 'NEW'
                                    ? 'Không có công việc đang mở lúc này.'
                                    : 'Chức năng sẽ được cập nhật.'}
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
                                <div className="hnj-job-overview">
                                    <span className="hnj-service-tag" style={{ fontSize: '15px', marginBottom: 0 }}>
                                        {selectedJob.categoryName || selectedJob.serviceNames || 'Dịch vụ'} &bull; #{selectedJob.postId}
                                    </span>
                                    <div className="hnj-price-badge" style={{ fontSize: '18px' }}>
                                        {formatCurrencyVnd(selectedJob.offerPrice)}
                                    </div>
                                </div>

                                <div className="hnj-detail-section">
                                    <div className="hnj-detail-grid">
                                        <div className="hnj-detail-item">
                                            <span className="hnj-detail-label">Ngày làm việc</span>
                                            <span className="hnj-detail-value">{formatWorkDate(selectedJob.workDate)}</span>
                                        </div>
                                        <div className="hnj-detail-item">
                                            <span className="hnj-detail-label">Thời gian làm việc</span>
                                            <span className="hnj-detail-value">
                                                {selectedJob.startTime || 'N/A'}
                                                {selectedJob.durationHours ? ` (${selectedJob.durationHours} giờ)` : ''}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="hnj-detail-item" style={{ marginTop: '16px' }}>
                                        <span className="hnj-detail-label">Địa điểm làm việc</span>
                                        <span className="hnj-detail-value">{buildLocationText(selectedJob)}</span>
                                    </div>
                                </div>

                                <div className="hnj-desc-box">
                                    <h3 className="hnj-desc-title">Mô tả công việc & Yêu cầu</h3>
                                    <div className="hnj-desc-text">
                                        {selectedJob.description || 'Không có mô tả.'}
                                    </div>
                                </div>
                            </div>

                            <div className="hnj-modal-footer">
                                <button className="hnj-btn-cancel" onClick={handleCloseModal} disabled={loadingApply}>
                                    Đóng
                                </button>
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
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </HelperLayout>
    );
};

export default HelperNewJobPage;
