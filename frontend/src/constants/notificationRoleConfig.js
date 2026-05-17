const ROLE_TABS = {
    CUSTOMER: [
        { key: 'ALL', label: 'Tất cả' },
        { key: 'BOOKINGS', label: 'Đơn của bạn' },
        { key: 'SYSTEM', label: 'Hệ thống' },
    ],
    HELPER: [
        { key: 'ALL', label: 'Tất cả' },
        { key: 'WORK', label: 'Việc làm' },
        { key: 'SYSTEM', label: 'Hệ thống' },
    ],
    ADMIN: [
        { key: 'ALL', label: 'Tất cả' },
        { key: 'OPERATIONS', label: 'Vận hành' },
        { key: 'SYSTEM', label: 'Hệ thống' },
    ],
};

const TYPE_GROUPS = {
    BOOKING_RELATED: new Set([
        'BOOKING',
        'BOOKING_STATUS',
        'BOOKING_ACCEPTED',
        'BOOKING_REJECTED',
        'BOOKING_CANCELLED',
        'BOOKING_CONFIRMED',
        'HELPER_CHECKIN',
        'ARRIVAL_CONFIRMED',
        'WORK_DONE_BY_HELPER',
        'WORK_COMPLETED',
        'JOB',
        'JOB_POST',
        'JOB_CANCELLED',
        'JOB_ADMIN_CANCEL',
        'APPLICATION',
        'ASSIGNMENT',
    ]),
    WORK_RELATED: new Set([
        'MATCHING',
        'HELPER_CHECKIN',
        'ARRIVAL_CONFIRMED',
        'BOOKING',
        'BOOKING_STATUS',
        'BOOKING_ACCEPTED',
        'BOOKING_REJECTED',
        'WORK_DONE_BY_HELPER',
        'WORK_COMPLETED',
        'JOB',
        'JOB_POST',
        'JOB_CANCELLED',
        'APPLICATION',
        'ASSIGNMENT',
    ]),
    ADMIN_OPERATIONS: new Set([
        'FRAUD_ALERT',
        'DISPUTE',
        'VIOLATION',
        'ADMIN_BOOKING_UNFLAG',
        'ADMIN_REVIEW',
        'REPORT',
    ]),
    SYSTEM: new Set(['SYSTEM', 'BROADCAST', 'PAYMENT', 'WALLET', 'KYC', 'ACCOUNT', 'SECURITY']),
};

export const normalizeNotificationType = (rawType) => String(rawType || '').trim().toUpperCase();

export const getTabsForRole = (role) => ROLE_TABS[role] || ROLE_TABS.CUSTOMER;

export const getTabForNotification = (role, notification) => {
    const type = normalizeNotificationType(notification?.type);

    if (role === 'HELPER') {
        if (
            TYPE_GROUPS.WORK_RELATED.has(type) ||
            type.startsWith('BOOKING_') ||
            type.startsWith('WORK_') ||
            type.startsWith('JOB_')
        ) {
            return 'WORK';
        }
        return 'SYSTEM';
    }

    if (role === 'ADMIN') {
        if (TYPE_GROUPS.ADMIN_OPERATIONS.has(type)) return 'OPERATIONS';
        return 'SYSTEM';
    }

    // CUSTOMER default
    if (
        TYPE_GROUPS.BOOKING_RELATED.has(type) ||
        type.startsWith('BOOKING_') ||
        type.startsWith('WORK_') ||
        type.startsWith('JOB_')
    ) {
        return 'BOOKINGS';
    }
    return 'SYSTEM';
};
