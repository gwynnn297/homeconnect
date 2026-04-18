/** Nhãn hiển thị cho thống kê admin (khớp enum backend) */

export const BOOKING_STATUS_LABELS = {
    PENDING: 'Chờ xác nhận',
    PENDING_ACCEPTANCE: 'Chờ thợ phản hồi',
    CONFIRMED: 'Đã xác nhận',
    ARRIVED: 'Thợ đã đến',
    IN_PROGRESS: 'Đang làm',
    PENDING_COMPLETION: 'Chờ khách xác nhận xong',
    COMPLETED: 'Hoàn thành',
    CANCELLED: 'Đã hủy',
    EXPIRED: 'Hết hạn phản hồi',
};

export const PAYMENT_STATUS_LABELS = {
    HOLDING: 'Đang giữ (Escrow)',
    RELEASED: 'Đã giải ngân cho thợ',
    REFUNDED: 'Đã hoàn cho khách',
};

export const JOB_POST_STATUS_LABELS = {
    PUBLISHED: 'Đang tìm thợ',
    ASSIGNED: 'Đã chốt thợ',
    COMPLETED: 'Hoàn thành',
    CANCELLED: 'Đã hủy',
    EXPIRED: 'Hết hạn',
};

export const WITHDRAW_STATUS_LABELS = {
    PENDING: 'Chờ duyệt',
    PROCESSING: 'Đang xử lý',
    COMPLETED: 'Đã chuyển',
    REJECTED: 'Từ chối / lỗi',
};
