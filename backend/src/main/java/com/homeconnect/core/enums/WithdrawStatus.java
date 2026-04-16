package com.homeconnect.core.enums;

/**
 * Enum WithdrawStatus - Trạng thái yêu cầu rút tiền
 */
public enum WithdrawStatus {
    PENDING,    // Chờ Admin duyệt
    PROCESSING, // Đang xử lý tự động (Gọi API xGate)
    COMPLETED,  // Đã chuyển tiền thành công
    REJECTED    // Bị từ chối hoặc chuyển tiền lỗi
}
