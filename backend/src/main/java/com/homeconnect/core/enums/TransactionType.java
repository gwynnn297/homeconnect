package com.homeconnect.core.enums;

/**
 * Enum TransactionType - Loại giao dịch ví
 */
public enum TransactionType {
    DEPOSIT, // Nạp tiền
    WITHDRAW, // Rút tiền
    PAYMENT, // Thanh toán
    REFUND, // Hoàn tiền
    HOLD, // Giữ tiền (khi đặt việc)
    RELEASE // Giải phóng tiền giữ
}
