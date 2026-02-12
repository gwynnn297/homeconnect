package com.homeconnect.core.entity;

import com.homeconnect.core.enums.UserRole;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 💾 Cache cho OTP registration
 * Sử dụng HashMap cache trong memory (production nên dùng Redis)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OtpCache {
    private String email;
    private String otpCode;
    private LocalDateTime expiryTime;
    
    // Thông tin đăng ký tạm thời
    private String fullName;
    private String phone;
    private String passwordHash;
    private UserRole role;
    
    // Trạng thái OTP
    private int attemptCount; // Số lần thử sai
    private boolean isUsed; // Đã sử dụng chưa
    
    public boolean isExpired() {
        return LocalDateTime.now().isAfter(expiryTime);
    }
    
    public boolean isValid(String inputOtp) {
        return !isExpired() && !isUsed && otpCode.equals(inputOtp) && attemptCount < 5;
    }
}