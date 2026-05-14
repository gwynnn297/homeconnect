import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import logoHomieConnect from '../assets/LogoHomieConnect.png';
import ProfileService from '../services/ProfileService';
import NotificationService from '../services/NotificationService';
import NotificationModal from './NotificationModal';
import { getTabForNotification, getTabsForRole } from '../constants/notificationRoleConfig';
import './HeaderComponent.css';

const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map((w) => w[0]).filter(Boolean).slice(-2).join('').toUpperCase();
};

const HeaderComponent = () => {
    const navigate = useNavigate();
    const [showDropdown, setShowDropdown] = useState(false);
    const userInfoRef = useRef(null);

    // Notifications state
    const [showNotifications, setShowNotifications] = useState(false);
    const notificationRef = useRef(null);
    const [allNotifications, setAllNotifications] = useState([]);
    const [pagination, setPagination] = useState({
        currentPage: 0,
        totalPages: 0,
        loadingInitial: false,
        loadingMore: false,
    });
    const [activeNotificationTab, setActiveNotificationTab] = useState('ALL');
    const [unreadCount, setUnreadCount] = useState(0);
    const [toast, setToast] = useState(null);

    // Reactive user info state
    const [userInfo, setUserInfo] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('user')) || {};
        } catch { return {}; }
    });

    const userRole = userInfo?.role || 'CUSTOMER';
    const notificationTabs = getTabsForRole(userRole);

    // Hàm fetch avatar + name từ API — dùng khi mount và khi có 'profile:updated'
    const fetchUserProfile = useCallback(() => {
        ProfileService.getMyProfile()
            .then((res) => {
                const data = res?.data;
                if (!data) return;
                setUserInfo((prev) => ({
                    ...prev,
                    fullName: data.fullName || prev.fullName,
                    avatarUrl: data.avatarUrl ?? prev.avatarUrl,
                }));
                // Sync to localStorage
                try {
                    const stored = JSON.parse(localStorage.getItem('user') || '{}');
                    if (data.avatarUrl !== undefined) stored.avatarUrl = data.avatarUrl;
                    if (data.fullName) stored.fullName = data.fullName;
                    localStorage.setItem('user', JSON.stringify(stored));
                } catch { /* ignore */ }
            })
            .catch(() => { /* silent fail */ });
    }, []);

    // Fetch khi mount
    useEffect(() => {
        fetchUserProfile();
    }, [fetchUserProfile, userInfo?.role]);

    // Lắng nghe CustomEvent 'profile:updated' từ cùng tab (Profile page dispatch sau khi lưu)
    useEffect(() => {
        window.addEventListener('profile:updated', fetchUserProfile);
        return () => window.removeEventListener('profile:updated', fetchUserProfile);
    }, [fetchUserProfile]);

    // Lắng nghe storage event từ tab khác
    useEffect(() => {
        const onStorage = () => {
            try {
                const u = JSON.parse(localStorage.getItem('user') || '{}');
                setUserInfo(u);
            } catch { /* ignore */ }
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    const fetchNotifications = useCallback(async (page = 1, append = false) => {
        if (!userInfo?.role) return;
        setPagination((prev) => ({
            ...prev,
            loadingInitial: page === 1 ? true : prev.loadingInitial,
            loadingMore: page > 1 ? true : prev.loadingMore,
        }));

        try {
            const res = await NotificationService.getNotifications({ page, limit: 15 });
            const payload = res?.data || {};
            const incoming = Array.isArray(payload?.data) ? payload.data : [];
            setAllNotifications((prev) => {
                const merged = append ? [...prev, ...incoming] : incoming;
                const uniqueById = new Map();
                const withoutId = [];
                merged.forEach((item) => {
                    if (item?.notificationId != null) {
                        uniqueById.set(item.notificationId, item);
                    } else {
                        withoutId.push(item);
                    }
                });
                return [...Array.from(uniqueById.values()), ...withoutId];
            });
            setPagination({
                currentPage: Number(payload?.current_page || page),
                totalPages: Number(payload?.total_pages || 0),
                loadingInitial: false,
                loadingMore: false,
            });
        } catch (error) {
            console.error("Failed to fetch notifications:", error);
            setPagination((prev) => ({
                ...prev,
                loadingInitial: false,
                loadingMore: false,
            }));
        }
    }, [userInfo?.role]);

    const markNotificationAsRead = useCallback(async (notificationId) => {
        if (notificationId == null) return;
        try {
            const res = await NotificationService.markAsRead(notificationId);
            const updatedNotification = res?.data;
            setAllNotifications((prev) =>
                prev.map((n) => {
                    if (n?.notificationId !== notificationId) return n;
                    return updatedNotification ? { ...n, ...updatedNotification } : { ...n, isRead: true };
                })
            );
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    }, []);

    const markAllNotificationsAsRead = useCallback(async () => {
        try {
            await NotificationService.markAllAsRead();
            setAllNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        } catch (error) {
            console.error('Failed to mark all notifications as read:', error);
        }
    }, []);

    const extractTargetFromNotification = useCallback((notif) => {
        const content = `${notif?.title ?? ''} ${notif?.content ?? ''}`;
        const type = String(notif?.type || '').toUpperCase();

        // ===== CÁC LOẠI THÔNG BÁO BÀI ĐĂNG (Post ID) =====
        // Gửi cho Customer sau khi đăng tin: "Tin #123: Có X thợ..."
        // Gửi cho Helper về Job mới: "Job #123: ..."
        const postNotifTypes = [
            'MATCHING_FOUND', 'NO_HELPER_FOUND',  // Customer - kết quả tìm thợ
            'MATCHING',                            // Helper - việc mới phù hợp
            'JOB_CANCELLED', 'JOB_UPDATED',        // Helper - việc bị hủy/cập nhật
            'JOB_ADMIN_CANCEL',                    // Customer - admin hủy tin
            'INVITATION_CANCELLED',                // Helper - lời mời bị hủy
        ];
        if (postNotifTypes.includes(type)) {
            // Bắt số đầu tiên sau dấu # (backend đã nhúng #postId vào nội dung)
            const m = content.match(/#\s*(?:DIR-)?(\d+)/i);
            const postId = m?.[1] ? Number(m[1]) : null;
            return { targetPostId: postId, targetBookingId: null };
        }

        // ===== CÁC LOẠI THÔNG BÁO DIRECT BOOKING =====
        // Gửi cho Customer/Helper về yêu cầu đặt thợ trực tiếp
        // Điều hướng về: /customer/manage-posts/DIR-ID (để nằm trong Quản lý bài đăng)
        if (type === 'DIRECT_BOOKING' || type === 'DIRECT_BOOKING_TIMEOUT' || type === 'DIRECT_BOOKING_REJECTED') {
            const m = content.match(/#\s*(?:DIR-)?(\d+)/i);
            const idNum = m?.[1] ? m[1] : null;
            return { targetPostId: idNum ? `DIR-${idNum}` : null, targetBookingId: null };
        }

        // ===== CÁC LOẠI THÔNG BÁO VẬN HÀNH BOOKING =====
        // (Ca đang làm, Lịch sử, Giải ngân, Khiếu nại...)
        const bookingTypes = [
            'ARRIVAL_CONFIRMED', 'PENDING_COMPLETION', 'PAYMENT_RECEIVED',
            'DISPUTED', 'DISPUTE_REFUND', 'DISPUTE_REJECT', 'AUTO_COMPLETED',
            'DIRECT_BOOKING_ACCEPTED', 'WORK_STARTED', 'WORK_DONE_BY_HELPER', 'WORK_COMPLETED',
            'DISPUTE_OPENED'
        ];

        // Ưu tiên bắt "Booking #xxx" hoặc "Đơn hàng #xxx" hoặc "Đơn #xxx"
        const bookingIdMatch = content.match(/(?:Booking|Đơn hàng|Đơn)\s+#(\d+)/i);
        const firstIdMatch = content.match(/#\s*(?:DIR-)?(\d+)/i);
        const id = (bookingIdMatch?.[1] || firstIdMatch?.[1])
            ? Number(bookingIdMatch?.[1] || firstIdMatch?.[1])
            : null;

        if (id == null) {
            return { targetPostId: null, targetBookingId: null };
        }

        if (
            bookingTypes.includes(type) ||
            type.startsWith('WORK_') ||
            type.startsWith('BOOKING_')
        ) {
            // Với Customer, nếu là đơn trực tiếp, vẫn ưu tiên về trang Manage Posts để xem chi tiết bài đăng
            if (userInfo?.role === 'CUSTOMER' && content.includes('DIR-')) {
                return { targetPostId: `DIR-${id}`, targetBookingId: null };
            }
            return { targetPostId: null, targetBookingId: id };
        }

        // Mặc định: postId cho các luồng khác
        const postIdMatch = content.match(/#\s*(?:DIR-)?(\d+)/i);
        const postId2 = postIdMatch?.[1] ? Number(postIdMatch[1]) : null;
        return { targetPostId: postId2, targetBookingId: null };
    }, []);

    const extractJobInfoFromNotification = useCallback((notif) => {
        const type = notif?.type || 'UNKNOWN';
        const content = `${notif?.title ?? ''} ${notif?.content ?? ''}`;

        let idRaw = null;
        let isDirect = false;

        let match = content.match(/#DIR-(\d+)/i);
        if (match) {
            idRaw = match[1];
            isDirect = true;
        } else {
            match = content.match(/#(\d+)/);
            if (match) {
                idRaw = match[1];
                if (type.startsWith('DIRECT_BOOKING')) {
                    isDirect = true;
                }
            }
        }

        const id = idRaw ? (isDirect ? `DIR-${idRaw}` : Number(idRaw)) : null;
        return { id, type, isDirect };
    }, []);

    const openJobFromNotification = useCallback(async (notif) => {
        setShowNotifications(false);
        setShowDropdown(false);

        if (notif?.notificationId != null) {
            await markNotificationAsRead(notif.notificationId);
        }

        // ====== ĐÂY LÀ ĐOẠN GIỮ NGUYÊN CODE BẠN PULL ======
        const { id, type, isDirect } = extractJobInfoFromNotification(notif);
        const { targetPostId, targetBookingId } = extractTargetFromNotification(notif);

        const rawIdForHelper = typeof id === 'string' && isDirect && id.startsWith('DIR-')
            ? id.substring(4)
            : id;

        if (userInfo?.role === 'CUSTOMER') {
            if (targetBookingId) {
                navigate(`/customer/bookings/${targetBookingId}`);
            } else if (targetPostId) {
                navigate(`/customer/manage-posts/${targetPostId}`);
            } else if (id) {
                navigate(`/customer/manage-posts/${id}`);
            } else {
                navigate('/customer/manage-posts');
            }
            return;
        }

        if (userInfo?.role === 'HELPER') {
            const navigationState = {
                targetPostId: targetPostId || rawIdForHelper,
                targetBookingId: targetBookingId,   // Bảo tồn chức năng targetBookingId của bạn
                notificationType: type,
                fromNotification: true,
                notificationToken: `${notif?.notificationId ?? 'unknown'}-${Date.now()}`
            };
            navigate('/helper/new-jobs', { state: navigationState });
        }
    }, [extractJobInfoFromNotification, extractTargetFromNotification, userInfo?.role, markNotificationAsRead, navigate]);

    useEffect(() => {
        fetchNotifications(1, false);
    }, [fetchNotifications, userInfo?.role]);

    useEffect(() => {
        if (!notificationTabs.some((tab) => tab.key === activeNotificationTab)) {
            setActiveNotificationTab(notificationTabs[0]?.key || 'ALL');
        }
    }, [activeNotificationTab, notificationTabs]);

    const visibleNotifications = allNotifications.filter((n) => {
        if (activeNotificationTab === 'ALL') return true;
        return getTabForNotification(userRole, n) === activeNotificationTab;
    });

    const hasLoadedAll = pagination.totalPages > 0 && pagination.currentPage >= pagination.totalPages;

    const handleNotificationListScroll = (e) => {
        const el = e.currentTarget;
        const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 24;
        if (!nearBottom || pagination.loadingInitial || pagination.loadingMore || hasLoadedAll) {
            return;
        }
        fetchNotifications(pagination.currentPage + 1, true);
    };

    useEffect(() => {
        if (!userInfo?.role) return;
        const token = localStorage.getItem('token');
        if (!token) return;

        const url = NotificationService.getStreamUrl(token);
        const eventSource = new EventSource(url);

        // Backend gửi SSE theo event name:
        // - event: connected
        // - event: notification
        // Nên không dùng onmessage (mặc định chỉ bắt 'message').
        eventSource.addEventListener('notification', (event) => {
            try {
                const newNotification = JSON.parse(event.data);
                setAllNotifications((prev) => {
                    const deduped = prev.filter((item) => item.notificationId !== newNotification.notificationId);
                    return [newNotification, ...deduped];
                });
            } catch (err) {
                console.error("SSE error parsing notification data", err);
            }
        });

        eventSource.addEventListener('connected', () => {
            // no-op
        });

        return () => eventSource.close();
    }, [userInfo?.role]);

    // Nhận notification realtime từ SocketContext bridge
    useEffect(() => {
        const handleSocketNotification = (event) => {
            const newNotification = event?.detail;
            if (!newNotification || typeof newNotification !== 'object') return;
            
            // Cập nhật danh sách thông báo
            setAllNotifications((prev) => {
                const deduped = prev.filter((item) => item.notificationId !== newNotification.notificationId);
                return [newNotification, ...deduped];
            });

            // Hiển thị toast popup nếu chưa mở dropdown thông báo
            if (!showNotifications) {
                setToast({
                    message: newNotification.content || newNotification.title,
                    type: 'info'
                });
            }
        };

        window.addEventListener('notification:received', handleSocketNotification);
        return () => window.removeEventListener('notification:received', handleSocketNotification);
    }, []);

    useEffect(() => {
        setUnreadCount(allNotifications.filter((n) => n?.isRead === false).length);
    }, [allNotifications]);

    const switchNotificationTab = (nextTab) => {
        setActiveNotificationTab(nextTab);
    };

    const handleToggleNotifications = () => {
        setShowNotifications(prev => !prev);
        setShowDropdown(false);
    };

    const displayName = userInfo?.fullName || userInfo?.name || userInfo?.username || userInfo?.email || 'Người dùng';
    const avatarUrl = userInfo?.avatarUrl || null;
    const avatarInitials = getInitials(displayName);

    const handleDashboard = () => {
        if (userInfo?.role === 'ADMIN') navigate('/admin/dashboard');
        else if (userInfo?.role === 'HELPER') navigate('/helper/dashboard');
        else if (userInfo?.role === 'CUSTOMER') navigate('/customer-dashboard');
        else navigate('/home');
    };

    const toggleDropdown = () => setShowDropdown((v) => !v);

    const handleProfile = () => {
        setShowDropdown(false);
        if (userInfo?.role === 'HELPER') {
            navigate('/helper/profile');
        } else if (userInfo?.role === 'CUSTOMER') {
            navigate('/customer/profile');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        navigate('/login');
    };

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (showDropdown && userInfoRef.current && !userInfoRef.current.contains(e.target)) {
                setShowDropdown(false);
            }
            if (showNotifications && notificationRef.current && !notificationRef.current.contains(e.target)) {
                setShowNotifications(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showDropdown, showNotifications]);

    return (
        <>
            <header className="header">
                <div className="logo">
                    <img className="logo-img" src={logoHomieConnect} alt="HomieConnectLogo" />
                </div>

                <div className="header-user-actions">
                    {/* Notification Bell */}
                    <div className="notification-wrapper" ref={notificationRef}>
                        <div className="notification-icon" title="Thông báo" onClick={handleToggleNotifications}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
                            </svg>
                            {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
                        </div>

                        {showNotifications && (
                            <div className="notification-dropdown">
                                <div className="notification-header">
                                    <h4>Thông báo</h4>
                                    {unreadCount > 0 && <span className="mark-read-btn" onClick={markAllNotificationsAsRead}>Đánh dấu đã đọc</span>}
                                </div>
                                <div className="notification-tabs">
                                    {notificationTabs.map((tab) => (
                                        <button
                                            key={tab.key}
                                            type="button"
                                            className={`notification-tab-btn ${activeNotificationTab === tab.key ? 'active' : ''}`}
                                            onClick={() => switchNotificationTab(tab.key)}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="notification-list" onScroll={handleNotificationListScroll}>
                                    {pagination.loadingInitial ? (
                                        <div className="notification-empty">Đang tải thông báo...</div>
                                    ) : visibleNotifications.length > 0 ? (
                                        visibleNotifications.map((notif, index) => (
                                            <div
                                                key={notif.notificationId ?? index}
                                                className={`notification-item ${notif?.isRead === false ? 'unread' : ''}`}
                                                role="button"
                                                tabIndex={0}
                                                onClick={() => openJobFromNotification(notif)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault();
                                                        openJobFromNotification(notif);
                                                    }
                                                }}
                                                title="Xem chi tiết công việc"
                                            >
                                                <div className="notification-content">
                                                    <p className="notification-title">{notif.title}</p>
                                                    <p className="notification-message">{notif.content}</p>
                                                    <span className="notification-time">{notif.createdAt ? new Date(notif.createdAt).toLocaleString('vi-VN') : 'Vừa xong'}</span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="notification-empty">Không có thông báo nào</div>
                                    )}
                                    {pagination.loadingMore && (
                                        <div className="notification-load-more">Đang tải thêm...</div>
                                    )}
                                    {!pagination.loadingInitial && !pagination.loadingMore && hasLoadedAll && visibleNotifications.length > 0 && (
                                        <div className="notification-load-more notification-load-more-end">Bạn đã xem hết thông báo</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* User Profile */}
                    <div className="user-info" ref={userInfoRef}>
                        <div
                            className="user-avatar"
                            onClick={handleProfile}
                            title={userInfo?.role !== 'ADMIN' ? "Hồ sơ cá nhân" : "Ảnh đại diện"}
                            style={{ cursor: userInfo?.role !== 'ADMIN' ? 'pointer' : 'default' }}
                        >
                            {avatarUrl
                                ? <img src={avatarUrl} alt="Avatar" className="user-avatar-img" />
                                : <span>{avatarInitials}</span>
                            }
                        </div>
                        <span className="username" onClick={toggleDropdown} style={{ cursor: 'pointer' }}>
                            {displayName}
                        </span>
                        <button className="dropdown-toggle" onClick={toggleDropdown} aria-label="Toggle user menu">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>

                        {/* Dropdown Menu */}
                        {showDropdown && (
                            <div className="user-dropdown">
                                {userInfo?.role !== 'ADMIN' && (
                                    <div className="dropdown-item" onClick={handleProfile}>
                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                            <path d="M8 8C10.21 8 12 6.21 12 4C12 1.79 10.21 0 8 0C5.79 0 4 1.79 4 4C4 6.21 5.79 8 8 8ZM8 10C5.33 10 0 11.34 0 14V16H16V14C16 11.34 10.67 10 8 10Z" fill="currentColor" />
                                        </svg>
                                        Hồ sơ
                                    </div>
                                )}
                                <div className="dropdown-divider"></div>
                                <div className="dropdown-item dropdown-item-danger" onClick={handleLogout}>
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                        <path d="M6 12H2V2H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        <path d="M10 9L14 5L10 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        <path d="M14 5H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    Đăng xuất
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </header>
            
            {toast && (
                <NotificationModal
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </>
    );
};

export default HeaderComponent;

