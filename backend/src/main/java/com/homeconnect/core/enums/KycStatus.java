package com.homeconnect.core.enums;

/**
 * Enum trạng thái KYC (Xác thực danh tính)
 * Sử dụng trong bảng helper_profiles
 */
public enum KycStatus {
    PENDING("Chờ nộp hồ sơ"),
    WAITING_APPROVAL("Chờ duyệt"),
    IDENTITY_VERIFIED("AI đã xác minh danh tính"),
    VERIFIED("Đã xác thực"),
    REJECTED("Bị từ chối");
    
    private final String displayName;
    
    KycStatus(String displayName) {
        this.displayName = displayName;
    }
    
    public String getDisplayName() {
        return displayName;
    }
}