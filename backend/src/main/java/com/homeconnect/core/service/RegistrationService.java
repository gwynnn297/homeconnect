package com.homeconnect.core.service;

import com.homeconnect.core.dto.request.RegisterInitRequest;
import com.homeconnect.core.dto.request.RegisterVerifyRequest;
import com.homeconnect.core.dto.response.RegisterResponse;
import com.homeconnect.core.entity.HelperProfile;
import com.homeconnect.core.entity.OtpCache;
import com.homeconnect.core.entity.User;
import com.homeconnect.core.entity.Wallet;
import com.homeconnect.core.enums.KycStatus;
import com.homeconnect.core.enums.UserRole;
import com.homeconnect.core.enums.UserStatus;
import com.homeconnect.core.repository.UserRepository;
import com.homeconnect.core.utils.OtpUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

// Service xử lý đăng ký tài khoản với OTP
@Service
@RequiredArgsConstructor
@Slf4j
public class RegistrationService {
    
    private final UserRepository userRepository;
    private final EmailService emailService;
    private final OtpCacheService otpCacheService;
    private final PasswordEncoder passwordEncoder;
    private final WalletService walletService;
    private final HelperProfileService helperProfileService;

    /**
     * Bước 1: Validate form -> Check trùng Phone/Email -> Sinh OTP -> Gửi Email -> Lưu Cache
     */
    public RegisterResponse registerInit(RegisterInitRequest request) {
        try {
            log.info("🚀 Bắt đầu đăng ký init cho email: {}", request.getEmail());
            
            // 1. Validate form (đã có @Valid annotation)
            
            // 2. Check trùng Phone/Email
            if (userRepository.existsByEmail(request.getEmail())) {
                return RegisterResponse.error("Email đã được đăng ký");
            }
            
            if (userRepository.existsByPhone(request.getPhone())) {
                return RegisterResponse.error("Số điện thoại đã được đăng ký");
            }
            
            // 3. Sinh OTP
            String otpCode = OtpUtil.generateOtp();
            log.info("🔢 Generated OTP {} cho email: {}", otpCode, request.getEmail());
            
            // 4. Gửi Email OTP
            boolean emailSent = emailService.sendOtp(
                request.getEmail(), 
                otpCode, 
                request.getFullName()
            );
            
            if (!emailSent) {
                return RegisterResponse.error("Lỗi gửi email OTP. Vui lòng thử lại.");
            }
            
            // 5. Lưu Cache với thông tin đăng ký
            OtpCache otpCache = OtpCache.builder()
                .email(request.getEmail())
                .otpCode(otpCode)
                .expiryTime(OtpUtil.generateOtpExpiry())
                .fullName(request.getFullName())
                .phone(request.getPhone())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(request.getRole())
                .attemptCount(0)
                .isUsed(false)
                .build();
            
            otpCacheService.saveOtp(request.getEmail(), otpCache);
            
            log.info("Đã gửi OTP thành công đến email: {}", request.getEmail());
            
            return RegisterResponse.success(
                "Mã xác thực đã được gửi đến email " + request.getEmail() + 
                ". Vui lòng kiểm tra và nhập mã OTP trong vòng 5 phút."
            );
            
        } catch (Exception e) {
            log.error("Lỗi registerInit cho email {}: {}", request.getEmail(), e.getMessage());
            return RegisterResponse.error("Có lỗi xảy ra. Vui lòng thử lại.");
        }
    }

    /**
     * Bước 2: Check OTP -> Insert User -> Insert Wallet -> Insert HelperProfile (nếu Helper)
     */
    @Transactional
    public RegisterResponse registerVerify(RegisterVerifyRequest request) {
        try {
            log.info("🔍 Bắt đầu verify OTP cho email: {}", request.getEmail());
            
            // 1. Lấy thông tin từ cache
            OtpCache cached = otpCacheService.getOtp(request.getEmail());
            
            if (cached == null) {
                return RegisterResponse.error("Mã OTP không tồn tại hoặc đã hết hạn");
            }
            
            // 2. Verify OTP
            if (!otpCacheService.verifyOtp(request.getEmail(), request.getOtpCode())) {
                return RegisterResponse.error("Mã OTP không chính xác");
            }
            
            // 3. Insert User
            User user = new User();
            user.setFullName(cached.getFullName());
            user.setPhone(cached.getPhone());
            user.setEmail(cached.getEmail());
            user.setPasswordHash(cached.getPasswordHash());
            user.setRole(cached.getRole());
            user.setStatus(UserStatus.ACTIVE); // Active ngay sau khi verify OTP
            
            User savedUser = userRepository.save(user);
            log.info("Đã tạo User ID: {} cho email: {}", savedUser.getId(), request.getEmail());
            
            // 4. Insert Wallet (tự động cho mọi user)
            Wallet wallet = walletService.createWalletForUser(savedUser);
            log.info("Đã tạo Wallet ID: {} cho User ID: {}", wallet.getWalletId(), savedUser.getId());
            
            // 5. Insert HelperProfile (nếu là Helper)
            if (cached.getRole() == UserRole.HELPER) {
                HelperProfile helperProfile = helperProfileService.createHelperProfile(savedUser);
                log.info("🔧 Đã tạo HelperProfile ID: {} cho User ID: {}", 
                        helperProfile.getProfileId(), savedUser.getId());
            }
            
            // 6. Xóa cache
            otpCacheService.removeOtp(request.getEmail());
            
            log.info("Đăng ký hoàn tất thành công cho email: {}", request.getEmail());
            
            return RegisterResponse.success(
                "Đăng ký tài khoản thành công! Chào mừng bạn đến với HomeConnect.",
                savedUser.getId()
            );
            
        } catch (Exception e) {
            log.error("Lỗi registerVerify cho email {}: {}", request.getEmail(), e.getMessage());
            return RegisterResponse.error("Có lỗi xảy ra khi tạo tài khoản. Vui lòng thử lại.");
        }
    }
}