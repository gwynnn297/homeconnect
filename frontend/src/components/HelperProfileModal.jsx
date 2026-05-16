import React, { useState, useEffect, useCallback } from 'react';
import ProfileService from '../services/ProfileService';
import { useSocket } from '../contexts/SocketContext';
import './HelperProfileModal.css';

const HelperProfileModal = ({ helper, onClose, onBookNow }) => {
    const [reviews, setReviews] = useState([]);
    const [schedule, setSchedule] = useState([]);
    const [loadingSchedule, setLoadingSchedule] = useState(false);
    const [imgError, setImgError] = useState(false);

    const { socket } = useSocket();

    const fetchData = useCallback(async () => {
        if (!helper?.id) return;
        setLoadingSchedule(true);
        try {
            const [reviewsRes, scheduleRes] = await Promise.all([
                ProfileService.getHelperReviews(helper.id),
                ProfileService.getHelperSchedule(helper.id, new Date().getMonth() + 1, new Date().getFullYear())
            ]);
            
            setReviews(reviewsRes?.data?.data || reviewsRes?.data || []);

            const rawList = scheduleRes?.data || (Array.isArray(scheduleRes) ? scheduleRes : []);
            
            const now = new Date();
            const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();

            const availableSlots = rawList
                .filter(slot => {
                    if (slot.status !== 'AVAILABLE') return false;
                    if (slot.workDate < todayStr) return false;
                    
                    // Nếu là ngày hôm nay, chỉ hiện các khung giờ bắt đầu sau ít nhất 30 phút nữa
                    if (slot.workDate === todayStr && slot.startTime) {
                        const [h, m] = slot.startTime.split(':').map(Number);
                        const slotMinutes = h * 60 + m;
                        const nowMinutes = currentHour * 60 + currentMinute;
                        
                        // Nếu thời gian bắt đầu cách hiện tại ít hơn 30 phút thì ẩn đi
                        if (slotMinutes - nowMinutes < 30) {
                            return false;
                        }
                    }
                    return true;
                })
                .sort((a, b) => a.workDate.localeCompare(b.workDate) || a.startTime.localeCompare(b.startTime));
            
            setSchedule(availableSlots);
        } catch (err) {
            console.error("Error fetching helper data:", err);
        } finally {
            setLoadingSchedule(false);
        }
    }, [helper?.id]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Real-time listener for schedule updates
    useEffect(() => {
        if (!socket || !helper?.id) return;

        const handleScheduleUpdate = (data) => {
            // data.helperId matches the current helper
            if (String(data.helperId) === String(helper.id)) {
                console.log("[HelperProfileModal] Schedule updated real-time for helper:", helper.id);
                fetchData();
            }
        };

        socket.on('helper_schedule_updated', handleScheduleUpdate);
        return () => {
            socket.off('helper_schedule_updated', handleScheduleUpdate);
        };
    }, [socket, helper?.id, fetchData]);

    const groupContiguousSlots = (slots) => {
        if (!slots || slots.length === 0) return {};
        
        const sorted = [...slots].sort((a, b) => a.workDate.localeCompare(b.workDate) || a.startTime.localeCompare(b.startTime));
        const dateGroups = {};

        sorted.forEach(slot => {
            if (!dateGroups[slot.workDate]) dateGroups[slot.workDate] = [];
            const dayRanges = dateGroups[slot.workDate];
            const lastRange = dayRanges[dayRanges.length - 1];

            if (lastRange && lastRange.endTime === slot.startTime) {
                lastRange.endTime = slot.endTime;
                // Calculate duration in hours
                const startH = parseInt(lastRange.startTime.split(':')[0]);
                const endH = parseInt(lastRange.endTime.split(':')[0]);
                lastRange.maxDuration = endH - startH;
            } else {
                const startH = parseInt(slot.startTime.split(':')[0]);
                const endH = parseInt(slot.endTime.split(':')[0]);
                dayRanges.push({
                    workDate: slot.workDate,
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                    maxDuration: endH - startH
                });
            }
        });
        return dateGroups;
    };

    const groupedSchedule = groupContiguousSlots(schedule);

    if (!helper) return null;

    return (
        <div className="hpm-overlay" onClick={onClose}>
            <div className="hpm-modal" onClick={e => e.stopPropagation()}>
                <button className="hpm-close-btn" onClick={onClose}>&times;</button>

                <div className="hpm-header">
                    <div className="hpm-avatar-row">
                        <div className="hpm-avatar-wrap">
                            {!imgError && helper.avatarUrl ? (
                                <img
                                    src={helper.avatarUrl}
                                    alt={helper.fullName}
                                    className="hpm-avatar"
                                    onError={() => setImgError(true)}
                                />
                            ) : (
                                <div className="hpm-avatar-fallback">
                                    {(helper.fullName || 'H').charAt(0).toUpperCase()}
                                </div>
                            )}
                            {helper.isOnline && <span className="hpm-online-dot"></span>}
                        </div>
                        <div className="hpm-title-info">
                            <div className="hpm-name-row">
                                <h3 className="hpm-name">{helper.fullName}</h3>
                                {helper.kycStatus === 'VERIFIED' && <span className="hpm-verified-badge" title="Đã xác minh">🛡️</span>}
                            </div>
                            <div className="hpm-rating-row">
                                <span className="hpm-star">⭐</span>
                                <span className="hpm-rating-val">{helper.ratingAverage || '5.0'}</span>
                                <span className="hpm-reviews">({helper.totalReviews || 0} đánh giá)</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="hpm-body">
                    <div className="hpm-stats-grid">
                        <div className="hpm-stat-box">
                            <span className="hpm-stat-label">Kinh nghiệm</span>
                            <span className="hpm-stat-value">{helper.experienceYears || 0} năm</span>
                        </div>
                        <div className="hpm-stat-box">
                            <span className="hpm-stat-label">Quê quán</span>
                            <span className="hpm-stat-value">{helper.hometownName || 'N/A'}</span>
                        </div>
                    </div>

                    <div className="hpm-section">
                        <h4 className="hpm-section-title">Giới thiệu</h4>
                        <p className="hpm-bio">{helper.bio || 'Chưa có lời giới thiệu.'}</p>
                    </div>

                    <div className="hpm-section">
                        <h4 className="hpm-section-title">Dịch vụ nhận làm</h4>
                        <div className="hpm-tag-list">
                            {helper.categories?.map(cat => (
                                <span key={cat.id || cat.categoryId} className="hpm-tag-pill">{cat.name}</span>
                            ))}
                        </div>
                    </div>

                    <div className="hpm-section">
                        <h4 className="hpm-section-title">Khu vực hoạt động</h4>
                        <div className="hpm-tag-list">
                            {helper.workingDistricts?.map(dist => (
                                <span key={dist.code} className="hpm-dist-tag">📍 {dist.name}</span>
                            ))}
                        </div>
                    </div>

                    <div className="hpm-section">
                        <h4 className="hpm-section-title">Lịch rảnh </h4>
                        <div className="hpm-schedule-container">
                            {Object.keys(groupedSchedule).length > 0 ? (
                                <div className="hpm-date-list">
                                    {Object.keys(groupedSchedule).map(date => (
                                        <div key={date} className="hpm-date-group">
                                            <div className="hpm-date-label">
                                                {new Date(date).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                                            </div>
                                            <div className="hpm-slot-grid">
                                                {groupedSchedule[date].map((range, idx) => (
                                                    <button 
                                                        key={`${date}-${idx}`} 
                                                        className="hpm-slot-pill"
                                                        title={`Rảnh ${range.maxDuration} tiếng`}
                                                        onClick={() => {
                                                            onClose();
                                                            onBookNow(helper, {
                                                                date: range.workDate,
                                                                time: range.startTime,
                                                                endTime: range.endTime,
                                                                maxDuration: range.maxDuration
                                                            });
                                                        }}
                                                    >
                                                        <span className="hpm-slot-time">
                                                            {range.startTime.substring(0, 5)} - {range.endTime.substring(0, 5)}
                                                        </span>
                                                        <span className="hpm-slot-dur">({range.maxDuration}h)</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="hpm-empty-hint">Thợ chưa đăng ký lịch rảnh hoặc đã kín lịch. Bạn vẫn có thể thử đặt trực tiếp.</p>
                            )}
                        </div>
                    </div>

                    <div className="hpm-section">
                        <h4 className="hpm-section-title">Đánh giá gần đây</h4>
                        <div className="hpm-reviews-list">
                            {reviews.length > 0 ? (
                                reviews.map(rev => (
                                    <div key={rev.id} className="hpm-review-item">
                                        <div className="hpm-rev-header">
                                            <span className="hpm-rev-stars">{"⭐".repeat(rev.rating)}</span>
                                            <span className="hpm-rev-date">
                                                {new Date(rev.createdAt).toLocaleDateString('vi-VN')}
                                            </span>
                                        </div>
                                        <p className="hpm-rev-comment">{rev.comment || "Không có nhận xét."}</p>
                                    </div>
                                ))
                            ) : (
                                <p className="hpm-empty-hint">Chưa có đánh giá nào.</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="hpm-footer">
                    <button className="hpm-book-btn" onClick={() => {
                        onClose();
                        onBookNow(helper);
                    }}>
                        Đặt lịch ngay
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HelperProfileModal;
