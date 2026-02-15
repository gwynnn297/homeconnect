package com.homeconnect.core.service;

/**
 * Interface cho dịch vụ Email
 */
public interface EmailService {
    /**
     * Gửi mã OTP xác thực
     * @param toEmail Email người nhận
     * @param otpCode Mã OTP
     * @param fullName Tên người nhận
     * @return true nếu gửi thành công
     */
    boolean sendOtp(String toEmail, String otpCode, String fullName);
}
