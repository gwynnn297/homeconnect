package com.homeconnect.core.enums;

/**
 * Các trạng thái của một đơn hàng (Booking)
 */
public enum BookingStatus {
    PENDING,     // Chờ xác nhận
    CONFIRMED,   // Đã xác nhận/Đã thanh toán
    ARRIVED,     // Thợ đã đến nhà khách
    IN_PROGRESS, // Đang thực hiện công việc
    COMPLETED,   // Đã hoàn thành
    CANCELLED    // Đã hủy
}

