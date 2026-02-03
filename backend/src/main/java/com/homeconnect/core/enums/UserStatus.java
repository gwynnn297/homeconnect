package com.homeconnect.core.enums;

/**
 * Enum trạng thái tài khoản người dùng
 * Sử dụng trong bảng users
 */
public enum UserStatus {
    PENDING_OTP("Chờ xác thực OTP"),
    ACTIVE("Đang hoạt động"),
    BLOCKED("Bị khóa");
    
    private final String displayName;
    
    UserStatus(String displayName) {
        this.displayName = displayName;
    }
    
    public String getDisplayName() {
        return displayName;
    }
}