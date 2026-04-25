package com.homeconnect.core.enums;

/**
 * Enum trạng thái tài khoản người dùng
 * Sử dụng trong bảng users
 */
public enum UserStatus {
    PENDING_OTP("Chờ xác thực OTP"),
    DRAFT("Đang điền hồ sơ"),
    PROFILE_COMPLETED("Đã hoàn tất hồ sơ & dịch vụ"),
    PENDING_REVIEW("Chờ phê duyệt hồ sơ"),
    ACTIVE("Đang hoạt động"),
    BANNED("Bị khóa bởi admin"),
    SUSPENDED("Tạm đình chỉ"),
    WITHDRAW_ONLY("Chỉ được rút tiền"),
    BLOCKED("Bị khóa (legacy)"),
    REJECTED("Bị từ chối hồ sơ");

    private final String displayName;

    UserStatus(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }

    public boolean isAccessBlocked() {
        return this == BANNED || this == SUSPENDED || this == BLOCKED;
    }
}