package com.homeconnect.core.enums;

/**
 * Các trạng thái của một đơn hàng (Booking)
 */
public enum BookingStatus {
    PENDING,     // Chờ xác nhận
    CONFIRMED,   // Đã xác nhận/Đã thanh toán
    COMPLETED,   // Đã hoàn thành công việc
    CANCELLED    // Đã hủy (bởi khách hoặc helper)
}
