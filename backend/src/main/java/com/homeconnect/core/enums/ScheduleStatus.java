package com.homeconnect.core.enums;

/**
 * Trạng thái của một slot lịch làm việc của Helper
 */
public enum ScheduleStatus {
    AVAILABLE,   // Helper rảnh, có thể nhận lịch
    BUSY,        // Đã có khách đặt (Booking confirmed)
    CANCELLED    // Helper xin nghỉ ca này
}
