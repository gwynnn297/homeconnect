package com.homeconnect.core.service;

import com.homeconnect.core.entity.OtpCache;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 🗄️ Service quản lý OTP Cache trong memory
 * Production nên dùng Redis cho distributed cache
 */
@Service
@Slf4j
public class OtpCacheService {

    // Cache OTP trong memory (production dùng Redis)
    private final ConcurrentHashMap<String, OtpCache> otpCache = new ConcurrentHashMap<>();

    /**
     * Lưu OTP vào cache
     */
    public void saveOtp(String email, OtpCache otpData) {
        otpCache.put(email.toLowerCase(), otpData);
        log.info("💾 Đã lưu OTP cho email: {}, expires: {}",
                email, otpData.getExpiryTime());

        // Auto cleanup sau 10 phút
        scheduleCleanup(email, otpData.getExpiryTime().plusMinutes(5));
    }

    /**
     * Lấy OTP từ cache
     */
    public OtpCache getOtp(String email) {
        OtpCache cached = otpCache.get(email.toLowerCase());

        // Tự động xóa nếu hết hạn
        if (cached != null && cached.isExpired()) {
            otpCache.remove(email.toLowerCase());
            log.info("🗑️ Đã xóa OTP hết hạn cho email: {}", email);
            return null;
        }

        return cached;
    }

    /**
     * Xác thực OTP
     */
    public boolean verifyOtp(String email, String inputOtp) {
        OtpCache cached = getOtp(email);

        if (cached == null) {
            log.warn("Không tìm thấy OTP cho email: {}", email);
            return false;
        }

        // Tăng attempt count
        cached.setAttemptCount(cached.getAttemptCount() + 1);

        if (cached.isValid(inputOtp)) {
            cached.setUsed(true); // Mark as used
            log.info("OTP hợp lệ cho email: {}", email);
            return true;
        } else {
            log.warn("OTP không hợp lệ cho email: {} (attempt: {})",
                    email, cached.getAttemptCount());

            // Xóa cache nếu thử quá 5 lần
            if (cached.getAttemptCount() >= 5) {
                otpCache.remove(email.toLowerCase());
                log.warn("🚫 Đã xóa OTP do thử sai quá 5 lần: {}", email);
            }

            return false;
        }
    }

    /**
     * Xóa OTP khỏi cache
     */
    public void removeOtp(String email) {
        otpCache.remove(email.toLowerCase());
        log.info("🗑️ Đã xóa OTP cho email: {}", email);
    }

    /**
     * Lấy số lượng OTP đang cache
     */
    public int getCacheSize() {
        return otpCache.size();
    }

    /**
     * Tự động dọn dẹp OTP hết hạn
     */
    private void scheduleCleanup(String email, LocalDateTime cleanupTime) {
        // Simple cleanup - production nên dùng scheduled task
        new Thread(() -> {
            try {
                Thread.sleep(300_000); // 5 phút
                OtpCache cached = otpCache.get(email.toLowerCase());
                if (cached != null && cached.isExpired()) {
                    otpCache.remove(email.toLowerCase());
                    log.info("🧹 Auto cleanup OTP cho email: {}", email);
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }).start();
    }
}