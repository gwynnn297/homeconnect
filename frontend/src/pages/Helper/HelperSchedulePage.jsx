import React, { useEffect, useMemo, useState } from 'react';
import './HelperSchedulePage.css';
import HelperLayout from '../../layouts/HelperLayout';
import HelperScheduleService from '../../services/HelperScheduleService';

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
    { label: 'CN', value: 7 },
    { label: 'T2', value: 1 },
    { label: 'T3', value: 2 },
    { label: 'T4', value: 3 },
    { label: 'T5', value: 4 },
    { label: 'T6', value: 5 },
    { label: 'T7', value: 6 }
];

const getMonthStartDate = (date) => formatIsoDate(new Date(date.getFullYear(), date.getMonth(), 1));
const getMonthEndDate = (date) => formatIsoDate(new Date(date.getFullYear(), date.getMonth() + 1, 0));

const convertJsDayToApiDay = (jsDay) => (jsDay === 0 ? 7 : jsDay);
const getTodayIsoDate = () => formatIsoDate(new Date());
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
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
    const [registerError, setRegisterError] = useState('');
    const [isSubmittingRegister, setIsSubmittingRegister] = useState(false);
    const [isAddShiftModalOpen, setIsAddShiftModalOpen] = useState(false);
    const [addShiftError, setAddShiftError] = useState('');
    const [isSubmittingAddShift, setIsSubmittingAddShift] = useState(false);
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
    const [isBulkUpdateMode, setIsBulkUpdateMode] = useState(false);
    const [openShiftMenuId, setOpenShiftMenuId] = useState(null);
    const [processingShiftId, setProcessingShiftId] = useState(null);
    const [shiftMenuStyle, setShiftMenuStyle] = useState({ top: 0, left: 0 });
    const [registerForm, setRegisterForm] = useState(() => ({
        startDate: getMonthStartDate(new Date()),
        endDate: getMonthEndDate(new Date()),
        daysOfWeek: [1],
        startTime: '08:00',
        endTime: '12:00'
    }));

    const monthDays = useMemo(() => buildMonthDays(currentMonth), [currentMonth]);
    const todayIsoDate = useMemo(() => getTodayIsoDate(), []);

    const selectedDay = monthDays[activeDayIdx];

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
            const current = statusMap[item.workDate] || { hasActive: false, hasCancelled: false };

            if (normalizedStatus === 'CANCELLED') {
                current.hasCancelled = true;
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

    const loadMonthlySchedule = async () => {
        try {
            setIsLoading(true);
            setErrorMessage('');

            const data = await HelperScheduleService.getMonthlySchedule({
                month: currentMonth.getMonth() + 1,
                year: currentMonth.getFullYear()
            });

            setMonthlySchedules(Array.isArray(data) ? data : []);
        } catch (error) {
            setMonthlySchedules([]);
            setErrorMessage(error?.message || 'Không thể tải lịch làm việc. Vui lòng thử lại.');
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
            setRegisterError(error?.message || 'Không thể đăng ký lịch. Vui lòng thử lại.');
        } finally {
            setIsSubmittingRegister(false);
        }
    };

    const openAddShiftModal = () => {
        if (!selectedDay) {
            return;
        }
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
    };

    const handleAddShiftFormChange = (field, value) => {
        setAddShiftForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmitAddShift = async () => {
        if (!selectedDay) {
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

            const selectedDate = new Date(`${selectedDay.isoDate}T00:00:00`);
            const dayOfWeek = convertJsDayToApiDay(selectedDate.getDay());

            await HelperScheduleService.registerSchedule({
                startDate: selectedDay.isoDate,
                endDate: selectedDay.isoDate,
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
            setAddShiftError(error?.message || 'Không thể đăng kí thêm ca cho ngày này.');
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
        if (!selectedDay || !updatingShiftId) {
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
                const editableSlotsOfDay = selectedDaySchedules
                    .filter((item) => item.status === 'AVAILABLE' || item.status === 'CANCELLED')
                    .map((item) => ({
                        id: item.id,
                        startTime: formatTime(item.startTime),
                        endTime: formatTime(item.endTime)
                    }));

                const targetSlot = selectedDaySchedules.find((item) => item.id === updatingShiftId);

                if (!targetSlot || (targetSlot.status !== 'AVAILABLE' && targetSlot.status !== 'CANCELLED')) {
                    setUpdateShiftError('Chỉ có thể cập nhật ca ở trạng thái Lịch trống hoặc Đã hủy.');
                    return;
                }

                const updatedSlots = editableSlotsOfDay.map((slot) => {
                    if (slot.id === updatingShiftId) {
                        return {
                            startTime: updateShiftForm.startTime,
                            endTime: updateShiftForm.endTime
                        };
                    }
                    return {
                        startTime: slot.startTime,
                        endTime: slot.endTime
                    };
                });

                await HelperScheduleService.updateDaySchedule({
                    date: selectedDay.isoDate,
                    slots: updatedSlots
                });
            }

            setIsUpdateShiftModalOpen(false);
            await loadMonthlySchedule();
        } catch (error) {
            setUpdateShiftError(error?.message || 'Không thể cập nhật ca làm việc.');
        } finally {
            setIsSubmittingUpdateShift(false);
        }
    };

    const handleCancelAction = async (shiftId, isBulk) => {
        const reason = window.prompt('Nhập lý do hủy đăng kí ca:', 'Bận việc cá nhân');
        if (reason === null) {
            setOpenShiftMenuId(null);
            return;
        }

        try {
            setProcessingShiftId(shiftId);
            setOpenShiftMenuId(null);
            setErrorMessage('');

            if (isBulk) {
                await HelperScheduleService.bulkCancelSchedule(shiftId, reason.trim() || 'No reason provided');
            } else {
                await HelperScheduleService.cancelSchedule(shiftId, reason.trim() || 'No reason provided');
            }

            await loadMonthlySchedule();
        } catch (error) {
            setErrorMessage(error?.message || 'Không thể hủy đăng kí ca. Vui lòng thử lại.');
        } finally {
            setProcessingShiftId(null);
        }
    };

    return (
        <HelperLayout>
            <div className="schedule-container">
                <h1 className="schedule-header">Lịch làm việc</h1>

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
                    <div className="days-overview-grid">
                        {monthDays.map((day, idx) => {
                            const hasRegisteredSchedules = registeredDateSet.has(day.isoDate);
                            const dayStatus = dayScheduleStatusMap[day.isoDate];
                            const isCancelledOnlyDay = Boolean(dayStatus?.hasCancelled && !dayStatus?.hasActive);

                            return (
                                <div
                                    key={day.isoDate}
                                    className={`day-item ${hasRegisteredSchedules ? 'has-schedule' : ''} ${isCancelledOnlyDay ? 'cancelled-only' : ''} ${idx === activeDayIdx ? 'active' : ''}`}
                                    onClick={() => setActiveDayIdx(idx)}
                                >
                                    <div className="day-name">{day.dayName}</div>
                                    <div className="day-date">{day.dateText}</div>
                                    {(hasRegisteredSchedules || isCancelledOnlyDay) && (
                                        <div className={`day-registered-dot ${isCancelledOnlyDay ? 'cancelled' : ''}`}></div>
                                    )}
                                </div>
                            );
                        })}
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

                        {!isLoading && !errorMessage && selectedDay && (
                            <div className="day-card">
                                <div className="day-card-header">
                                    <div className="day-card-header-left">
                                        <span className="header-icon">📅</span>
                                        {selectedDay.fullDateText}
                                    </div>
                                    <div className="day-card-header-actions">
                                        <button
                                            type="button"
                                            className="add-shift-button"
                                            onClick={openAddShiftModal}
                                            title="Đăng kí thêm ca cho ngày này"
                                            aria-label="Đăng kí thêm ca cho ngày này"
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>

                                {selectedDaySchedules.length > 0 ? (
                                    <div className="shift-list">
                                        {selectedDaySchedules.map((shift) => {
                                            const statusUi = STATUS_UI_MAP[shift.status] || {
                                                typeText: shift.status || 'Không xác định',
                                                typeClass: 'unregistered'
                                            };

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
                                        Không có khung giờ đăng kí cho ngày này.
                                    </div>
                                )}
                            </div>
                        )}

                        {!isLoading && !errorMessage && !selectedDay && (
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
                                        value={registerForm.startTime}
                                        onChange={(event) => handleRegisterFormChange('startTime', event.target.value)}
                                    />
                                </div>
                                <div className="register-field">
                                    <label htmlFor="registerEndTime">Giờ kết thúc</label>
                                    <input
                                        id="registerEndTime"
                                        type="time"
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
                                        value={addShiftForm.startTime}
                                        onChange={(event) => handleAddShiftFormChange('startTime', event.target.value)}
                                    />
                                </div>
                                <div className="register-field">
                                    <label htmlFor="addShiftEndTime">Giờ kết thúc</label>
                                    <input
                                        id="addShiftEndTime"
                                        type="time"
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
                                        value={updateShiftForm.startTime}
                                        onChange={(event) => handleUpdateShiftFormChange('startTime', event.target.value)}
                                    />
                                </div>
                                <div className="register-field">
                                    <label htmlFor="updateShiftEndTime">Giờ kết thúc</label>
                                    <input
                                        id="updateShiftEndTime"
                                        type="time"
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
        </HelperLayout>
    );
};

export default HelperSchedulePage;
