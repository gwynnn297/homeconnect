package com.homeconnect.core.enums;

/**
 * Enum ReferenceType - Loại tham chiếu của giao dịch
 */
public enum ReferenceType {
    JOB_POST, // Liên quan đến tin đăng việc
    BOOKING, // Liên quan đến booking
    DEPOSIT, // Liên quan đến deposit
    WITHDRAWAL, // Liên quan đến yêu cầu rút tiền
    WEBHOOK // Từ webhook payment gateway
}
