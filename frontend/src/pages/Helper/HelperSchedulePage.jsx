import React, { useState } from 'react';
import './HelperSchedulePage.css';
import HelperLayout from '../../layouts/HelperLayout';

const TABS = ['Lịch làm việc', 'Lịch mới', 'Lịch đã nhận'];

const MOCK_DAYS = [
    { dayName: 'Thứ 3', date: '25', fullDate: '25 Tháng 06' },
    { dayName: 'Thứ 4', date: '26', fullDate: '26 Tháng 06' },
    { dayName: 'Thứ 5', date: '27', fullDate: '27 Tháng 06' },
    { dayName: 'Thứ 6', date: '28', fullDate: '28 Tháng 06' },
    { dayName: 'Thứ 7', date: '29', fullDate: '29 Tháng 06' },
    { dayName: 'CN', date: '30', fullDate: '30 Tháng 06' },
    { dayName: 'Thứ 2', date: '01', fullDate: '01 Tháng 07' },
];

const MOCK_SCHEDULE_DETAILS = [
    {
        fullDateText: 'Thứ 3, 25 Tháng 06',
        shifts: [
            { id: 1, time: '08:00 - 12:00', typeText: 'Lịch cam kết', typeClass: 'committed' },
            { id: 2, time: '13:00 - 17:00', typeText: 'Lịch chưa đăng ký', typeClass: 'unregistered' },
            { id: 3, time: '17:00 - 21:00', typeText: 'Đã nhận việc', typeClass: 'accepted' },
        ]
    },
    {
        fullDateText: 'Thứ 4, 26 Tháng 06',
        shifts: [
            { id: 4, time: '08:00 - 12:00', typeText: 'Lịch chưa đăng ký', typeClass: 'unregistered' },
            { id: 5, time: '13:00 - 17:00', typeText: 'Lịch chưa đăng ký', typeClass: 'unregistered' },
            { id: 6, time: '17:00 - 21:00', typeText: 'Lịch chưa đăng ký', typeClass: 'unregistered' },
        ]
    }
];

const HelperSchedulePage = () => {
    const [activeTab, setActiveTab] = useState(TABS[0]);
    const [fromDate, setFromDate] = useState('2024-06-25');
    const [toDate, setToDate] = useState('2024-07-01');
    const [activeDayIdx, setActiveDayIdx] = useState(0);

    return (
        <HelperLayout>
            <div className="schedule-container">
                <h1 className="schedule-header">Lịch làm việc</h1>

                {/* Toolbar / Filters Area */}
                <div className="schedule-filters">             
                    <div className="date-range-picker">
                        <div className="date-input-group">
                            <label htmlFor="fromDate">Từ ngày</label>
                            <input
                                type="date"
                                id="fromDate"
                                value={fromDate}
                                onChange={(e) => setFromDate(e.target.value)}
                            />
                        </div>
                        <div className="date-input-group">
                            <label htmlFor="toDate">Đến ngày</label>
                            <input
                                type="date"
                                id="toDate"
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Info Banner */}
                <div className="info-banner">
                    <div className="banner-content">
                        <div className="banner-icon">i</div>
                        <div>
                            <h3 className="banner-title">Đăng ký lịch cam kết</h3>
                            <p className="banner-subtitle">Tăng cơ hội nhận việc</p>
                        </div>
                    </div>
                    <div className="banner-arrow">›</div>
                </div>

                {/* Days Overview Grid based on Date Range */}
                <div className="days-overview-container">
                    <h2 className="section-title">Chi tiết các ngày trong khoảng lựa chọn</h2>
                    <div className="days-overview-grid">
                        {MOCK_DAYS.map((day, idx) => (
                            <div
                                key={idx}
                                className={`day-item ${idx === activeDayIdx ? 'active' : ''}`}
                                onClick={() => setActiveDayIdx(idx)}
                            >
                                <div className="day-name">{day.dayName}</div>
                                <div className="day-date">{day.date}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Schedule Details for Each Day */}
                <div className="schedule-details-container">
                    <h2 className="section-title">Danh sách khung giờ đăng kí</h2>
                    <div className="schedule-details">
                        {MOCK_SCHEDULE_DETAILS.map((daySchedule, idx) => (
                            <div key={idx} className="day-card">
                                <div className="day-card-header">
                                    <span className="header-icon">📅</span>
                                    {daySchedule.fullDateText}
                                </div>
                                <div className="shift-list">
                                    {daySchedule.shifts.map(shift => (
                                        <div key={shift.id} className="shift-item">
                                            <div className="shift-info">
                                                <div className={`status-dot ${shift.typeClass}`}></div>
                                                <div className="shift-time-details">
                                                    <div className="shift-time">{shift.time}</div>
                                                    <div className={`shift-status-text ${shift.typeClass}`}>
                                                        {shift.typeText}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="shift-action">
                                                ⋮
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </HelperLayout>
    );
};

export default HelperSchedulePage;
