import React, { useEffect, useMemo, useRef, useState } from 'react';
import './HelperSchedulePage.css';
import HelperLayout from '../../layouts/HelperLayout';
import HelperScheduleService from '../../services/HelperScheduleService';
import NotificationModal from '../../components/NotificationModal';

const formatMonthYear = (date) =>
    `Tháng ${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;

const formatIsoDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getWeekdayText = (date) => {
    const day = date.getDay();
    if (day === 0) {
        return 'CN';
    }
    return `Thứ ${day + 1}`;
};

const buildMonthDays = (monthDate) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const numberOfDays = new Date(year, month + 1, 0).getDate();

    return Array.from({ length: numberOfDays }, (_, index) => {
        const day = index + 1;
        const date = new Date(year, month, day);
        return {
            isoDate: formatIsoDate(date),
            dayName: getWeekdayText(date),
            dateText: String(day).padStart(2, '0'),
            fullDateText: `${getWeekdayText(date)}, ${String(day).padStart(2, '0')} Tháng ${String(month + 1).padStart(2, '0')}`
        };
    });
};

const formatTime = (timeValue) => (typeof timeValue === 'string' ? timeValue.slice(0, 5) : '');

const STATUS_UI_MAP = {
    AVAILABLE: { typeText: 'Lịch trống', typeClass: 'committed' },
    BUSY: { typeText: 'Đã nhận việc', typeClass: 'accepted' },
    CANCELLED: { typeText: 'Đã hủy', typeClass: 'unregistered' }
};

const WEEKDAY_OPTIONS = [
    // Backend expects: 2 (Thứ 2) ... 8 (Chủ nhật)
    { label: 'CN', value: 8 },
    { label: 'T2', value: 2 },
    { label: 'T3', value: 3 },
    { label: 'T4', value: 4 },
    { label: 'T5', value: 5 },
    { label: 'T6', value: 6 },
    { label: 'T7', value: 7 }
];

const getMonthStartDate = (date) => formatIsoDate(new Date(date.getFullYear(), date.getMonth(), 1));
const getMonthEndDate = (date) => formatIsoDate(new Date(date.getFullYear(), date.getMonth() + 1, 0));

const convertJsDayToApiDay = (jsDay) => {
    // JS Date.getDay(): 0 (CN) ... 6 (T7)
    // Backend daysOfWeek: 8 (CN) ... 7 (T7)
    return jsDay === 0 ? 8 : jsDay + 1;
};
const getTodayIsoDate = () => formatIsoDate(new Date());
const LEAVE_LIMIT_MESSAGE = 'Bạn đã vượt quá giới hạn 3 ca nghỉ trong tháng này.';
const LEAVE_LIMIT_PATTERN = /vượt quá giới hạn\s*3\s*ca nghỉ/i;
const getCurrentTimeHHmm = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};
const getDefaultActiveDayIdx = (monthDate) => {
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === monthDate.getFullYear()
        && today.getMonth() === monthDate.getMonth();

    if (!isCurrentMonth) {
        return 0;
    }

    const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
    return Math.min(Math.max(today.getDate() - 1, 0), daysInMonth - 1);
};

const HelperSchedulePage = () => {
    const [currentMonth, setCurrentMonth] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const [monthlySchedules, setMonthlySchedules] = useState([]);
    const [activeDayIdx, setActiveDayIdx] = useState(() => getDefaultActiveDayIdx(new Date()));
    const [dayPageOffset, setDayPageOffset] = useState(() => Math.floor(getDefaultActiveDayIdx(new Date()) / 10) * 10);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
    const [registerError, setRegisterError] = useState('');
    const [isSubmittingRegister, setIsSubmittingRegister] = useState(false);
    const [isAddShiftModalOpen, setIsAddShiftModalOpen] = useState(false);
    const [addShiftError, setAddShiftError] = useState('');
    const [isSubmittingAddShift, setIsSubmittingAddShift] = useState(false);
    const [addingShiftDay, setAddingShiftDay] = useState(null);
    const addingShiftDayRef = useRef(null);
    const [addShiftForm, setAddShiftForm] = useState({
        startTime: '08:00',
        endTime: '12:00'
    });
    const [isUpdateShiftModalOpen, setIsUpdateShiftModalOpen] = useState(false);
    const [updateShiftError, setUpdateShiftError] = useState('');
    const [isSubmittingUpdateShift, setIsSubmittingUpdateShift] = useState(false);
    const [updateShiftForm, setUpdateShiftForm] = useState({
        startTime: '08:00',
        endTime: '12:00'
    });
    const [updatingShiftId, setUpdatingShiftId] = useState(null);
    const [updatingShiftDate, setUpdatingShiftDate] = useState(null);
    const [isBulkUpdateMode, setIsBulkUpdateMode] = useState(false);

    const [isCancelShiftModalOpen, setIsCancelShiftModalOpen] = useState(false);
    const [cancelShiftReason, setCancelShiftReason] = useState('Bận việc cá nhân');
    const [cancelingShiftId, setCancelingShiftId] = useState(null);
    const [cancelingShiftIsBulk, setCancelingShiftIsBulk] = useState(false);
    const [isSubmittingCancelShift, setIsSubmittingCancelShift] = useState(false);

    const [openShiftMenuId, setOpenShiftMenuId] = useState(null);
    const [processingShiftId, setProcessingShiftId] = useState(null);
    const [shiftMenuStyle, setShiftMenuStyle] = useState({ top: 0, left: 0 });
    const [toast, setToast] = useState(null);
    const [registerForm, setRegisterForm] = useState(() => ({
        startDate: getMonthStartDate(new Date()),
        endDate: getMonthEndDate(new Date()),
        daysOfWeek: [2], // mặc định Thứ 2
        startTime: '08:00',
        endTime: '12:00'
    }));

    // Chỉ auto-scroll khi user bấm chọn một ngày trong lưới.
    const [scrollRequest, setScrollRequest] = useState(0);

    const DAYS_PER_PAGE = 11;

    const monthDays = useMemo(() => buildMonthDays(currentMonth), [currentMonth]);
    const todayIsoDate = useMemo(() => getTodayIsoDate(), []);

    const selectedDay = monthDays[activeDayIdx];

    const maxDayPageOffset = useMemo(
        () => Math.floor((monthDays.length - 1) / DAYS_PER_PAGE) * DAYS_PER_PAGE,
        [monthDays.length]
    );

    const visibleDayPage = useMemo(
        () => monthDays.slice(dayPageOffset, dayPageOffset + DAYS_PER_PAGE),
        [monthDays, dayPageOffset]
    );

    const visibleMonthlySchedules = useMemo(
        () => monthlySchedules,
        [monthlySchedules]
    );

    const dayScheduleStatusMap = useMemo(() => {
        const statusMap = {};

        visibleMonthlySchedules.forEach((item) => {
            if (!item.workDate) {
                return;
            }

            const normalizedStatus = String(item.status || '').toUpperCase();
            const current = statusMap[item.workDate] || {
                hasActive: false,
                hasAvailable: false,
                hasCancelled: false
            };

            if (normalizedStatus === 'CANCELLED') {
                current.hasCancelled = true;
            } else if (normalizedStatus === 'AVAILABLE') {
                current.hasAvailable = true;
                current.hasActive = true;
            } else {
                current.hasActive = true;
            }

            statusMap[item.workDate] = current;
        });

        return statusMap;
    }, [visibleMonthlySchedules]);

    const registeredDateSet = useMemo(
        () => new Set(
            Object.entries(dayScheduleStatusMap)
                .filter(([, value]) => value.hasActive)
                .map(([workDate]) => workDate)
        ),
        [dayScheduleStatusMap]
    );

    const selectedDaySchedules = useMemo(() => {
        if (!selectedDay) {
            return [];
        }

        return visibleMonthlySchedules
            .filter((item) => item.workDate === selectedDay.isoDate)
            .sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));
    }, [visibleMonthlySchedules, selectedDay]);

    const getShiftUpdateLockReason = (shift) => {
        if (!shift) return 'Không thể cập nhật ca này.';
        const shiftDate = String(shift.workDate || '');
        const shiftStartTime = formatTime(shift.startTime);
        const hasBooking = shift.bookingId !== null && shift.bookingId !== undefined;
        const today = todayIsoDate;
        const nowHHmm = getCurrentTimeHHmm();
        const hasStartedOrPast = shiftDate < today || (shiftDate === today && shiftStartTime <= nowHHmm);
        if (hasBooking) return 'Không thể sửa ca đã có đơn hàng.';
        if (hasStartedOrPast) return 'Không thể sửa ca đã bắt đầu hoặc đã qua.';
        return '';
    };

    const showApiNotification = (message) => {
        const text = String(message || '');

        if (LEAVE_LIMIT_PATTERN.test(text)) {
            setToast({
                type: 'warning',
                message: LEAVE_LIMIT_MESSAGE
            });
            return;
        }

        setToast({
            type: 'error',
            message: text || 'Đã có lỗi xảy ra. Vui lòng thử lại.'
        });
    };

    const loadMonthlySchedule = async () => {
        try {
            setIsLoading(true);
            setErrorMessage('');

            const res = await HelperScheduleService.getMonthlySchedule({
                month: currentMonth.getMonth() + 1,
                year: currentMonth.getFullYear()
            });

            // Extract list from res.data because of backend ApiResponse wrapper
            const list = res?.data || (Array.isArray(res) ? res : []);
            setMonthlySchedules(list);
        } catch (error) {
            setMonthlySchedules([]);
            const message = error?.message || 'Không thể tải lịch làm việc. Vui lòng thử lại.';
            setErrorMessage(message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadMonthlySchedule();
    }, [currentMonth]);

    useEffect(() => {
        setActiveDayIdx(getDefaultActiveDayIdx(currentMonth));
    }, [currentMonth]);

    useEffect(() => {
        if (!selectedDay) return;
        if (scrollRequest === 0) return;
        const el = document.getElementById(`day-card-${selectedDay.isoDate}`);
        if (el) {
            // Tránh bị che bởi header/sticky toolbar (scrollIntoView thường căn đúng mép trên).
            const HEADER_OFFSET_PX = 90;
            const targetTop = window.scrollY + el.getBoundingClientRect().top - HEADER_OFFSET_PX;
            window.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
            setScrollRequest(0);
        }
    }, [selectedDay, scrollRequest, dayPageOffset]);

    useEffect(() => {
        const handleOutsideClick = () => {
            setOpenShiftMenuId(null);
        };

        document.addEventListener('click', handleOutsideClick);
        return () => document.removeEventListener('click', handleOutsideClick);
    }, []);

    useEffect(() => {
        const closeMenu = () => setOpenShiftMenuId(null);
        window.addEventListener('resize', closeMenu);
        window.addEventListener('scroll', closeMenu, true);
        return () => {
            window.removeEventListener('resize', closeMenu);
            window.removeEventListener('scroll', closeMenu, true);
        };
    }, []);

    const goToPreviousMonth = () => {
        setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    };

    const goToNextMonth = () => {
        setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    };

    const goToPrevDayPage = () => {
        setDayPageOffset((prev) => Math.max(0, prev - DAYS_PER_PAGE));
    };

    const goToNextDayPage = () => {
        setDayPageOffset((prev) => Math.min(maxDayPageOffset, prev + DAYS_PER_PAGE));
    };

    const openRegisterModal = () => {
        const selectedDate = selectedDay?.isoDate
            ? new Date(`${selectedDay.isoDate}T00:00:00`)
            : currentMonth;
        const selectedWeekday = convertJsDayToApiDay(selectedDate.getDay());

        setRegisterForm({
            startDate: selectedDay?.isoDate || getMonthStartDate(currentMonth),
            endDate: getMonthEndDate(currentMonth),
            daysOfWeek: [selectedWeekday],
            startTime: '08:00',
            endTime: '12:00'
        });
        setRegisterError('');
        setIsRegisterModalOpen(true);
    };

    const closeRegisterModal = () => {
        if (isSubmittingRegister) {
            return;
        }
        setIsRegisterModalOpen(false);
        setRegisterError('');
    };

    const toggleDayOfWeek = (dayValue) => {
        setRegisterForm((prev) => {
            const exists = prev.daysOfWeek.includes(dayValue);
            if (exists) {
                if (prev.daysOfWeek.length === 1) {
                    return prev;
                }
                return {
                    ...prev,
                    daysOfWeek: prev.daysOfWeek.filter((item) => item !== dayValue)
                };
            }
            return {
                ...prev,
                daysOfWeek: [...prev.daysOfWeek, dayValue]
            };
        });
    };

    const handleRegisterFormChange = (field, value) => {
        setRegisterForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmitRegister = async () => {
        if (registerForm.startDate > registerForm.endDate) {
            setRegisterError('Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.');
            return;
        }

        if (registerForm.startTime >= registerForm.endTime) {
            setRegisterError('Giờ bắt đầu phải nhỏ hơn giờ kết thúc.');
            return;
        }

        if (!registerForm.daysOfWeek.length) {
            setRegisterError('Vui lòng chọn ít nhất một ngày trong tuần.');
            return;
        }

        try {
            setIsSubmittingRegister(true);
            setRegisterError('');

            await HelperScheduleService.registerSchedule({
                startDate: registerForm.startDate,
                endDate: registerForm.endDate,
                daysOfWeek: [...registerForm.daysOfWeek].sort((a, b) => a - b),
                slots: [
                    {
                        startTime: registerForm.startTime,
                        endTime: registerForm.endTime
                    }
                ]
            });

            setIsRegisterModalOpen(false);
            await loadMonthlySchedule();
        } catch (error) {
            const message = error?.message || 'Không thể đăng ký lịch. Vui lòng thử lại.';
            showApiNotification(message);
        } finally {
            setIsSubmittingRegister(false);
        }
    };

    const openAddShiftModal = (day) => {
        const targetDay = day || selectedDay;
        if (!targetDay) {
            return;
        }
        setAddingShiftDay(targetDay);
        addingShiftDayRef.current = targetDay;
        setAddShiftForm({
            startTime: '08:00',
            endTime: '12:00'
        });
        setAddShiftError('');
        setIsAddShiftModalOpen(true);
    };

    const closeAddShiftModal = () => {
        if (isSubmittingAddShift) {
            return;
        }
        setIsAddShiftModalOpen(false);
        setAddShiftError('');
        setAddingShiftDay(null);
        addingShiftDayRef.current = null;
    };

    const handleAddShiftFormChange = (field, value) => {
        setAddShiftForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmitAddShift = async () => {
        const targetDay = addingShiftDayRef.current || addingShiftDay || selectedDay;
        if (!targetDay) {
            setAddShiftError('Không tìm thấy ngày để đăng kí ca.');
            return;
        }

        if (addShiftForm.startTime >= addShiftForm.endTime) {
            setAddShiftError('Giờ bắt đầu phải nhỏ hơn giờ kết thúc.');
            return;
        }

        try {
            setIsSubmittingAddShift(true);
            setAddShiftError('');

            const targetDate = new Date(`${targetDay.isoDate}T00:00:00`);
            const dayOfWeek = convertJsDayToApiDay(targetDate.getDay());

            await HelperScheduleService.registerSchedule({
                startDate: targetDay.isoDate,
                endDate: targetDay.isoDate,
                daysOfWeek: [dayOfWeek],
                slots: [
                    {
                        startTime: addShiftForm.startTime,
                        endTime: addShiftForm.endTime
                    }
                ]
            });

            setIsAddShiftModalOpen(false);
            await loadMonthlySchedule();
        } catch (error) {
            const message = error?.message || 'Không thể đăng kí thêm ca cho ngày này.';
            showApiNotification(message);
        } finally {
            setIsSubmittingAddShift(false);
        }
    };

    const toggleShiftMenu = (event, shiftId) => {
        event.stopPropagation();

        if (openShiftMenuId === shiftId) {
            setOpenShiftMenuId(null);
            return;
        }

        const triggerRect = event.currentTarget.getBoundingClientRect();
        const estimatedMenuHeight = 176;
        const estimatedMenuWidth = 220;
        const viewportPadding = 8;

        const shouldOpenUpward = window.innerHeight - triggerRect.bottom < estimatedMenuHeight
            && triggerRect.top > estimatedMenuHeight;

        const top = shouldOpenUpward
            ? triggerRect.top - estimatedMenuHeight - 6
            : triggerRect.bottom + 6;

        const preferredLeft = triggerRect.right - estimatedMenuWidth;
        const boundedLeft = Math.min(
            Math.max(preferredLeft, viewportPadding),
            window.innerWidth - estimatedMenuWidth - viewportPadding
        );

        setShiftMenuStyle({
            top: Math.max(top, viewportPadding),
            left: boundedLeft
        });

        setOpenShiftMenuId(shiftId);
    };

    const openUpdateShiftModal = (shift, isBulk) => {
        if (!shift) {
            return;
        }

        setOpenShiftMenuId(null);
        setUpdatingShiftId(shift.id);
        setUpdatingShiftDate(shift.workDate || null);
        setIsBulkUpdateMode(isBulk);
        setUpdateShiftForm({
            startTime: formatTime(shift.startTime) || '08:00',
            endTime: formatTime(shift.endTime) || '12:00'
        });
        setUpdateShiftError('');
        setIsUpdateShiftModalOpen(true);
    };

    const closeUpdateShiftModal = () => {
        if (isSubmittingUpdateShift) {
            return;
        }
        setIsUpdateShiftModalOpen(false);
        setUpdateShiftError('');
    };

    const handleUpdateShiftFormChange = (field, value) => {
        setUpdateShiftForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmitUpdateShift = async () => {
        const workDate = updatingShiftDate || selectedDay?.isoDate;
        if (!workDate || !updatingShiftId) {
            setUpdateShiftError('Không tìm thấy ca cần cập nhật.');
            return;
        }

        if (updateShiftForm.startTime >= updateShiftForm.endTime) {
            setUpdateShiftError('Giờ bắt đầu phải nhỏ hơn giờ kết thúc.');
            return;
        }

        try {
            setIsSubmittingUpdateShift(true);
            setUpdateShiftError('');

            if (isBulkUpdateMode) {
                await HelperScheduleService.updateGroupSchedule(updatingShiftId, [
                    {
                        startTime: updateShiftForm.startTime,
                        endTime: updateShiftForm.endTime
                    }
                ]);
            } else {
                const targetSlot = visibleMonthlySchedules.find((item) => item.id === updatingShiftId);

                if (!targetSlot || (targetSlot.status !== 'AVAILABLE' && targetSlot.status !== 'CANCELLED')) {
                    setUpdateShiftError('Chỉ có thể cập nhật ca ở trạng thái Lịch trống hoặc Đã hủy.');
                    return;
                }

                const lockReason = getShiftUpdateLockReason(targetSlot);
                if (lockReason) {
                    setUpdateShiftError(lockReason);
                    return;
                }

                await HelperScheduleService.updateSingleSchedule(updatingShiftId, {
                    startTime: updateShiftForm.startTime,
                    endTime: updateShiftForm.endTime
                });
            }

            setIsUpdateShiftModalOpen(false);
            await loadMonthlySchedule();
        } catch (error) {
            const message = error?.message || 'Không thể cập nhật ca làm việc.';
            showApiNotification(message);
        } finally {
            setIsSubmittingUpdateShift(false);
        }
    };

    const handleCancelAction = (shiftId, isBulk) => {
        setOpenShiftMenuId(null);
        setCancelingShiftId(shiftId);
        setCancelingShiftIsBulk(isBulk);
        setCancelShiftReason('Bận việc cá nhân');
        setIsCancelShiftModalOpen(true);
    };

    const closeCancelShiftModal = () => {
        if (isSubmittingCancelShift) return;
        setIsCancelShiftModalOpen(false);
        setCancelingShiftId(null);
    };

    const confirmCancelShift = async () => {
        if (!cancelingShiftId) return;

        try {
            setIsSubmittingCancelShift(true);
            setProcessingShiftId(cancelingShiftId);
            setErrorMessage('');

            if (cancelingShiftIsBulk) {
                await HelperScheduleService.bulkCancelSchedule(cancelingShiftId, cancelShiftReason.trim() || 'Không có lý do');
            } else {
                await HelperScheduleService.cancelSchedule(cancelingShiftId, cancelShiftReason.trim() || 'Không có lý do');
            }

            await loadMonthlySchedule();
            setIsCancelShiftModalOpen(false);
        } catch (error) {
            const message = error?.message || 'Không thể hủy đăng kí ca. Vui lòng thử lại.';
            showApiNotification(message);
        } finally {
            setIsSubmittingCancelShift(false);
            setProcessingShiftId(null);
        }
    };

    return (
        <HelperLayout>
            {toast && (
                <NotificationModal
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
            <div className="schedule-container">
                <h1 className="schedule-header">Lịch làm việc</h1>

                {/* Info Banner */}
                <div className="info-banner" onClick={openRegisterModal}>
                    <div className="banner-content">
                        <div className="banner-icon">i</div>
                        <div>
                            <h3 className="banner-title">Đăng ký lịch </h3>
                            <p className="banner-subtitle">Tăng cơ hội nhận việc</p>
                        </div>
                    </div>
                    <div className="banner-arrow">›</div>
                </div>

                {/* Toolbar / Filters Area */}
                <div className="schedule-filters">
                    <div className="month-navigation">
                        <button
                            type="button"
                            className="month-nav-button"
                            onClick={goToPreviousMonth}
                            aria-label="Chuyển sang tháng trước"
                        >
                            ‹
                        </button>
                        <div className="month-year-display">{formatMonthYear(currentMonth)}</div>
                        <button
                            type="button"
                            className="month-nav-button"
                            onClick={goToNextMonth}
                            aria-label="Chuyển sang tháng sau"
                        >
                            ›
                        </button>
                    </div>
                </div>

                

                {/* Days Overview Grid based on Date Range */}
                <div className="days-overview-container">
                    <div className="section-title-row">
                        <h2 className="section-title">Chi tiết các ngày trong tháng</h2>
                        <button
                            type="button"
                            className="register-schedule-button"
                            onClick={openRegisterModal}
                        >
                            Đăng kí
                        </button>
                    </div>
                    <div className="days-overview-pager">
                        <button
                            type="button"
                            className="days-page-nav-button"
                            onClick={goToPrevDayPage}
                            disabled={dayPageOffset === 0}
                            aria-label="Trang ngày trước"
                        >
                            ‹
                        </button>
                        <div className="days-overview-grid">
                            {visibleDayPage.map((day) => {
                                const idx = monthDays.indexOf(day);
                                const hasRegisteredSchedules = registeredDateSet.has(day.isoDate);
                                const dayStatus = dayScheduleStatusMap[day.isoDate];
                                const isMixedScheduleDay = Boolean(dayStatus?.hasCancelled && dayStatus?.hasAvailable);
                                const isCancelledOnlyDay = Boolean(dayStatus?.hasCancelled && !dayStatus?.hasActive);

                                return (
                                    <div
                                        key={day.isoDate}
                                        className={`day-item ${hasRegisteredSchedules ? 'has-schedule' : ''} ${isCancelledOnlyDay ? 'cancelled-only' : ''} ${isMixedScheduleDay ? 'mixed-schedule' : ''} ${idx === activeDayIdx ? 'active' : ''}`}
                                    onClick={() => {
                                        setActiveDayIdx(idx);
                                        setScrollRequest((r) => r + 1);
                                    }}
                                    >
                                        <div className="day-name">{day.dayName}</div>
                                        <div className="day-date">{day.dateText}</div>
                                        {(hasRegisteredSchedules || isCancelledOnlyDay) && (
                                            <div className={`day-registered-dot ${isMixedScheduleDay ? 'mixed' : ''} ${isCancelledOnlyDay ? 'cancelled' : ''}`}></div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <button
                            type="button"
                            className="days-page-nav-button"
                            onClick={goToNextDayPage}
                            disabled={dayPageOffset >= maxDayPageOffset}
                            aria-label="Trang ngày sau"
                        >
                            ›
                        </button>
                    </div>
                    <div className="days-pager-indicator">
                        {Math.floor(dayPageOffset / DAYS_PER_PAGE) + 1} / {Math.ceil(monthDays.length / DAYS_PER_PAGE)}
                    </div>
                </div>

                {/* Schedule Details for Each Day */}
                <div className="schedule-details-container">
                    <h2 className="section-title">Danh sách khung giờ đăng kí</h2>
                    <div className="schedule-details">
                        {isLoading && (
                            <div className="schedule-message">Đang tải lịch làm việc...</div>
                        )}

                        {!isLoading && errorMessage && (
                            <div className="schedule-message error">{errorMessage}</div>
                        )}

                        {!isLoading && !errorMessage && monthDays.map((day, idx) => {
                            const daySchedules = visibleMonthlySchedules
                                .filter((item) => item.workDate === day.isoDate)
                                .sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));

                            return (
                                <div
                                    key={day.isoDate}
                                    className={`day-card ${idx === activeDayIdx ? 'active' : ''}`}
                                    id={`day-card-${day.isoDate}`}
                                >
                                    <div className="day-card-header">
                                        <div
                                            className="day-card-header-left"
                                            onClick={() => setActiveDayIdx(idx)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <span className="header-icon">📅</span>
                                            {day.fullDateText}
                                        </div>
                                        <div className="day-card-header-actions">
                                            <button
                                                type="button"
                                                className="add-shift-button"
                                                onClick={() => openAddShiftModal(day)}
                                                title="Đăng kí thêm ca cho ngày này"
                                                aria-label="Đăng kí thêm ca cho ngày này"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>

                                    {daySchedules.length > 0 ? (
                                        <div className="shift-list">
                                            {daySchedules.map((shift) => {
                                                const statusUi = STATUS_UI_MAP[shift.status] || {
                                                    typeText: shift.status || 'Không xác định',
                                                    typeClass: 'unregistered'
                                                };
                                                const updateLockReason = getShiftUpdateLockReason(shift);
                                                const isLockedForUpdate = Boolean(updateLockReason);

                                                return (
                                                    <div key={shift.id} className="shift-item">
                                                        <div className="shift-info">
                                                            <div className={`status-dot ${statusUi.typeClass}`}></div>
                                                            <div className="shift-time-details">
                                                                <div className="shift-time">
                                                                    {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                                                                </div>
                                                                <div className={`shift-status-text ${statusUi.typeClass}`}>
                                                                    {statusUi.typeText}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="shift-action-wrapper" onClick={(event) => event.stopPropagation()}>
                                                            <button
                                                                type="button"
                                                                className="shift-action"
                                                                onClick={(event) => toggleShiftMenu(event, shift.id)}
                                                                disabled={processingShiftId === shift.id}
                                                            >
                                                                {processingShiftId === shift.id ? '...' : '⋮'}
                                                            </button>

                                                            {openShiftMenuId === shift.id && (
                                                                <div
                                                                    className="shift-action-dropdown"
                                                                    style={shiftMenuStyle}
                                                                >
                                                                    <button
                                                                        type="button"
                                                                        className="shift-action-dropdown-item"
                                                                        disabled={isLockedForUpdate}
                                                                        title={isLockedForUpdate ? updateLockReason : ''}
                                                                        onClick={() => openUpdateShiftModal(shift, false)}
                                                                    >
                                                                        Cập nhật ca này
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="shift-action-dropdown-item"
                                                                        onClick={() => openUpdateShiftModal(shift, true)}
                                                                    >
                                                                        Cập nhật nhiều ca
                                                                    </button>
                                                                    {shift.status !== 'CANCELLED' && (
                                                                        <>
                                                                            <button
                                                                                type="button"
                                                                                className="shift-action-dropdown-item"
                                                                                onClick={() => handleCancelAction(shift.id, false)}
                                                                            >
                                                                                Hủy đăng kí ca này
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                className="shift-action-dropdown-item"
                                                                                onClick={() => handleCancelAction(shift.id, true)}
                                                                            >
                                                                                Hủy đăng kí nhiều ca
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="empty-shift-message">
                                            Chưa có ca đăng kí.
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {!isLoading && !errorMessage && monthDays.length === 0 && (
                            <div className="schedule-message">
                                Không có dữ liệu ngày trong tháng này.
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {isRegisterModalOpen && (
                <div className="schedule-modal-overlay" onClick={closeRegisterModal}>
                    <div
                        className="schedule-register-modal"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="schedule-register-modal-header">Đăng ký lịch</div>

                        <div className="schedule-register-modal-body">
                            <div className="register-row register-row-dates">
                                <div className="register-field">
                                    <label htmlFor="registerStartDate">Từ ngày</label>
                                    <input
                                        id="registerStartDate"
                                        type="date"
                                        value={registerForm.startDate}
                                        min={todayIsoDate}
                                        onChange={(event) => handleRegisterFormChange('startDate', event.target.value)}
                                    />
                                </div>
                                <div className="register-field">
                                    <label htmlFor="registerEndDate">Đến ngày</label>
                                    <input
                                        id="registerEndDate"
                                        type="date"
                                        value={registerForm.endDate}
                                        min={registerForm.startDate || todayIsoDate}
                                        onChange={(event) => handleRegisterFormChange('endDate', event.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="register-row">
                                <div className="register-title">Ngày trong tuần</div>
                                <div className="weekday-chip-list">
                                    {WEEKDAY_OPTIONS.map((weekday) => (
                                        <button
                                            type="button"
                                            key={weekday.value}
                                            className={`weekday-chip ${registerForm.daysOfWeek.includes(weekday.value) ? 'active' : ''}`}
                                            onClick={() => toggleDayOfWeek(weekday.value)}
                                        >
                                            {weekday.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="register-row register-row-times">
                                <div className="register-field">
                                    <label htmlFor="registerStartTime">Giờ bắt đầu</label>
                                    <input
                                        id="registerStartTime"
                                        type="time"
                                        lang="en-GB"
                                        step="60"
                                        value={registerForm.startTime}
                                        onChange={(event) => handleRegisterFormChange('startTime', event.target.value)}
                                    />
                                </div>
                                <div className="register-field">
                                    <label htmlFor="registerEndTime">Giờ kết thúc</label>
                                    <input
                                        id="registerEndTime"
                                        type="time"
                                        lang="en-GB"
                                        step="60"
                                        value={registerForm.endTime}
                                        onChange={(event) => handleRegisterFormChange('endTime', event.target.value)}
                                    />
                                </div>
                            </div>

                            {registerError && <div className="register-error-message">{registerError}</div>}
                        </div>

                        <div className="schedule-register-modal-footer">
                            <button
                                type="button"
                                className="register-cancel-button"
                                onClick={closeRegisterModal}
                                disabled={isSubmittingRegister}
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="button"
                                className="register-submit-button"
                                onClick={handleSubmitRegister}
                                disabled={isSubmittingRegister}
                            >
                                {isSubmittingRegister ? 'Đang đăng ký...' : 'Đăng ký'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isAddShiftModalOpen && (
                <div className="schedule-modal-overlay" onClick={closeAddShiftModal}>
                    <div
                        className="schedule-register-modal add-shift-modal"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="schedule-register-modal-header">Đăng kí thêm ca trong ngày</div>

                        <div className="schedule-register-modal-body">
                            <div className="register-row register-row-times">
                                <div className="register-field">
                                    <label htmlFor="addShiftStartTime">Giờ bắt đầu</label>
                                    <input
                                        id="addShiftStartTime"
                                        type="time"
                                        lang="en-GB"
                                        step="60"
                                        value={addShiftForm.startTime}
                                        onChange={(event) => handleAddShiftFormChange('startTime', event.target.value)}
                                    />
                                </div>
                                <div className="register-field">
                                    <label htmlFor="addShiftEndTime">Giờ kết thúc</label>
                                    <input
                                        id="addShiftEndTime"
                                        type="time"
                                        lang="en-GB"
                                        step="60"
                                        value={addShiftForm.endTime}
                                        onChange={(event) => handleAddShiftFormChange('endTime', event.target.value)}
                                    />
                                </div>
                            </div>

                            {addShiftError && <div className="register-error-message">{addShiftError}</div>}
                        </div>

                        <div className="schedule-register-modal-footer">
                            <button
                                type="button"
                                className="register-cancel-button"
                                onClick={closeAddShiftModal}
                                disabled={isSubmittingAddShift}
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="button"
                                className="register-submit-button"
                                onClick={handleSubmitAddShift}
                                disabled={isSubmittingAddShift}
                            >
                                {isSubmittingAddShift ? 'Đang lưu...' : 'Đăng kí ca'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isUpdateShiftModalOpen && (
                <div className="schedule-modal-overlay" onClick={closeUpdateShiftModal}>
                    <div
                        className="schedule-register-modal add-shift-modal"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="schedule-register-modal-header">
                            {isBulkUpdateMode ? 'Cập nhật nhiều ca' : 'Cập nhật ca này'}
                        </div>

                        <div className="schedule-register-modal-body">
                            <div className="register-row register-row-times">
                                <div className="register-field">
                                    <label htmlFor="updateShiftStartTime">Giờ bắt đầu</label>
                                    <input
                                        id="updateShiftStartTime"
                                        type="time"
                                        lang="en-GB"
                                        step="60"
                                        value={updateShiftForm.startTime}
                                        onChange={(event) => handleUpdateShiftFormChange('startTime', event.target.value)}
                                    />
                                </div>
                                <div className="register-field">
                                    <label htmlFor="updateShiftEndTime">Giờ kết thúc</label>
                                    <input
                                        id="updateShiftEndTime"
                                        type="time"
                                        lang="en-GB"
                                        step="60"
                                        value={updateShiftForm.endTime}
                                        onChange={(event) => handleUpdateShiftFormChange('endTime', event.target.value)}
                                    />
                                </div>
                            </div>

                            {updateShiftError && <div className="register-error-message">{updateShiftError}</div>}
                        </div>

                        <div className="schedule-register-modal-footer">
                            <button
                                type="button"
                                className="register-cancel-button"
                                onClick={closeUpdateShiftModal}
                                disabled={isSubmittingUpdateShift}
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="button"
                                className="register-submit-button"
                                onClick={handleSubmitUpdateShift}
                                disabled={isSubmittingUpdateShift}
                            >
                                {isSubmittingUpdateShift ? 'Đang cập nhật...' : 'Cập nhật'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isCancelShiftModalOpen && (
                <div className="schedule-modal-overlay" onClick={closeCancelShiftModal}>
                    <div
                        className="schedule-register-modal"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="schedule-register-modal-header">Lý do hủy đăng kí ca</div>
                        <div className="schedule-register-modal-body">
                            <div className="register-field">
                                <label htmlFor="cancelShiftReason">Nhập lý do hủy</label>
                                <textarea
                                    id="cancelShiftReason"
                                    value={cancelShiftReason}
                                    onChange={(e) => setCancelShiftReason(e.target.value)}
                                    rows="3"
                                    placeholder="Ví dụ: Bận việc riêng..."
                                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd', resize: 'vertical' }}
                                />
                            </div>
                        </div>
                        <div className="schedule-register-modal-footer">
                            <button
                                type="button"
                                className="register-cancel-button"
                                onClick={closeCancelShiftModal}
                                disabled={isSubmittingCancelShift}
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="button"
                                className="register-submit-button"
                                onClick={confirmCancelShift}
                                disabled={isSubmittingCancelShift || !cancelShiftReason.trim()}
                            >
                                {isSubmittingCancelShift ? 'Đang hủy...' : 'Đồng ý hủy'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </HelperLayout>
    );
};

export default HelperSchedulePage;
