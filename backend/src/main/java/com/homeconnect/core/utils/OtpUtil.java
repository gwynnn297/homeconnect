package com.homeconnect.core.utils;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * 🔢 Utility class để generate và validate OTP
 */
public class OtpUtil {

    private static final SecureRandom random = new SecureRandom();
    private static final int OTP_LENGTH = 6;

    /**
     * Generate mã OTP 6 chữ số ngẫu nhiên
     * 
     * @return String OTP (VD: "123456")
     */
    public static String generateOtp() {
        StringBuilder otp = new StringBuilder();
        for (int i = 0; i < OTP_LENGTH; i++) {
            otp.append(random.nextInt(10));
        }
        return otp.toString();
    }

    /**
     * Kiểm tra OTP có hợp lệ hay không (6 chữ số)
     * 
     * @param otp OTP cần kiểm tra
     * @return true nếu hợp lệ
     */
    public static boolean isValidOtpFormat(String otp) {
        return otp != null
                && otp.length() == OTP_LENGTH
                && otp.matches("\\d{" + OTP_LENGTH + "}");
    }

    /**
     * Tạo expiry time cho OTP (5 phút từ bây giờ)
     * 
     * @return LocalDateTime
     */
    public static LocalDateTime generateOtpExpiry() {
        return LocalDateTime.now().plusMinutes(5);
    }

    /**
     * Kiểm tra OTP có hết hạn chưa
     * 
     * @param expiryTime Thời gian hết hạn
     * @return true nếu đã hết hạn
     */
    public static boolean isOtpExpired(LocalDateTime expiryTime) {
        return LocalDateTime.now().isAfter(expiryTime);
    }

    /**
     * Format thời gian để log
     * 
     * @param dateTime LocalDateTime
     * @return String formatted time
     */
    public static String formatDateTime(LocalDateTime dateTime) {
        return dateTime.format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss"));
    }
}