package com.homeconnect.core.enums;

/**
 * Enum vai trò người dùng
 * Sử dụng trong bảng users
 */
public enum UserRole {
    CUSTOMER("Khách hàng"),
    HELPER("Người giúp việc"), 
    ADMIN("Quản trị viên");
    
    private final String displayName;
    
    UserRole(String displayName) {
        this.displayName = displayName;
    }
    
    public String getDisplayName() {
        return displayName;
    }
}