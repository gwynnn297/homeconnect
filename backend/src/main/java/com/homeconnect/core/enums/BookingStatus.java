package com.homeconnect.core.enums;

/**
 * Các trạng thái của một đơn hàng (Booking)
 */
public enum BookingStatus {
    PENDING,             // Chờ xác nhận
    PENDING_ACCEPTANCE,  // Thợ được đặt trực tiếp và cần phản hồi
    CONFIRMED,           // Đã xác nhận/Đã thanh toán
    ARRIVED,             // Thợ đã đến nhà khách
    IN_PROGRESS,         // Đang thực hiện công việc
    PENDING_COMPLETION,  // Thợ báo xong, chờ khách xác nhận
    COMPLETED,           // Đã hoàn thành (Khách xác nhận)
    DISPUTED,            // Khách khiếu nại, chờ admin xử lý
    RESOLVED,            // Đã xử lý khiếu nại
    CANCELLED,           // Đã hủy
    EXPIRED              // Hết hạn phản hồi (10 phút)
}
