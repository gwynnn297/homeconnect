package com.homeconnect.core.service;

import com.homeconnect.core.dto.request.*;
import com.homeconnect.core.dto.response.LoginResponse;
import com.homeconnect.core.dto.response.CaptchaResponse;
import com.homeconnect.core.entity.SecurityToken;
import com.homeconnect.core.entity.User;
import com.homeconnect.core.enums.UserRole;
import com.homeconnect.core.enums.UserStatus;
import com.homeconnect.core.repository.HelperProfileRepository;
import com.homeconnect.core.repository.SecurityTokenRepository;
import com.homeconnect.core.repository.UserRepository;
import com.homeconnect.core.security.JwtUtil;
import com.homeconnect.core.util.CaptchaUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional
public class AuthService {

    private final UserRepository userRepository;
    private final HelperProfileRepository helperProfileRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AuthenticationManager authenticationManager;

    private final SecurityTokenRepository securityTokenRepository;
    private final EmailService emailService;
    private final WalletService walletService;

    public void registerInit(RegisterInitRequest request) {
        UserRole role = request.getRole();
        if (role == null) {
            throw new RuntimeException("Role không hợp lệ (CUSTOMER | HELPER | ADMIN)");
        }

        User user = null;

        // Check if email already exists
        var existingEmailUser = userRepository.findByEmail(request.getEmail());
        if (existingEmailUser.isPresent()) {
            if (existingEmailUser.get().getStatus() == UserStatus.PENDING_OTP) {
                user = existingEmailUser.get();
            } else {
                throw new RuntimeException("Email đã được sử dụng");
            }
        }

        // Check if phone already exists (if a different user has this phone)
        var existingPhoneUser = userRepository.findByPhone(request.getPhone());
        if (existingPhoneUser.isPresent()) {
            if (user == null && existingPhoneUser.get().getStatus() == UserStatus.PENDING_OTP) {
                user = existingPhoneUser.get();
            } else if (user != null && !existingPhoneUser.get().getId().equals(user.getId())) {
                // Phone belongs to another user
                throw new RuntimeException("Số điện thoại đã được sử dụng");
            } else if (user == null) {
                throw new RuntimeException("Số điện thoại đã được sử dụng");
            }
        }

        if (user == null) {
            // Create new user in PENDING_OTP
            user = User.builder()
                    .fullName(request.getFullName())
                    .email(request.getEmail())
                    .phone(request.getPhone())
                    // temporary password; will be replaced at verify step
                    .passwordHash(passwordEncoder.encode(java.util.UUID.randomUUID().toString()))
                    .role(role)
                    .status(UserStatus.PENDING_OTP)
                    .build();
        } else {
            // Update existing pending user info
            user.setFullName(request.getFullName());
            user.setEmail(request.getEmail());
            user.setPhone(request.getPhone());
            user.setRole(role);
        }

        userRepository.save(user);

        // Generate 6-digit OTP
        String otp = String.valueOf((int) (Math.random() * 900000) + 100000);

        // Deactivate old OTPs
        securityTokenRepository.findByUserAndTokenTypeAndIsUsedFalse(user, "REGISTER_OTP")
                .ifPresent(token -> {
                    token.setIsUsed(true);
                    securityTokenRepository.save(token);
                });

        // Save new OTP
        SecurityToken securityToken = SecurityToken.builder()
                .user(user)
                .tokenValue(otp)
                .tokenType("REGISTER_OTP")
                .expiryDate(java.time.LocalDateTime.now().plusMinutes(5))
                .isUsed(false)
                .build();
        securityTokenRepository.save(securityToken);

        // Send Email OTP
        emailService.sendOtp(user.getEmail(), otp, user.getFullName());
    }

    public User registerVerify(RegisterVerifyRequest request) {
        // RegisterVerifyRequest có email, otpCode và password
        User user = userRepository.findByEmailOrPhone(request.getEmail(), request.getEmail())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng"));

        if (user.getStatus() != UserStatus.PENDING_OTP) {
            throw new RuntimeException("Tài khoản không ở trạng thái chờ OTP");
        }

        SecurityToken otpToken = securityTokenRepository
                .findByTokenValueAndTokenTypeAndIsUsedFalse(request.getOtpCode(), "REGISTER_OTP")
                .filter(t -> t.getUser().getId().equals(user.getId()))
                .filter(t -> t.getExpiryDate().isAfter(java.time.LocalDateTime.now()))
                .orElseThrow(() -> new RuntimeException("OTP không hợp lệ hoặc đã hết hạn"));

        otpToken.setIsUsed(true);
        securityTokenRepository.save(otpToken);

        // Set password từ request và activate account
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setStatus(UserStatus.ACTIVE);
        User savedUser = userRepository.save(user);

        // [BE-Wallet-01] Tự động tạo ví cho user ngay sau khi đăng ký thành công
        walletService.createWalletForUser(savedUser);

        return savedUser;
    }

    public CaptchaResponse generateCaptcha() {
        String text = CaptchaUtil.generateCaptchaText();

        SecurityToken token = SecurityToken.builder()
                .tokenValue(text)
                .tokenType("LOGIN_CAPTCHA")
                .expiryDate(java.time.LocalDateTime.now().plusMinutes(2))
                .isUsed(false)
                .build();
        securityTokenRepository.save(token);

        return CaptchaResponse.builder()
                .captchaId(token.getTokenId().toString())
                .captchaText(text) // In production, return an image
                .build();
    }

    public LoginResponse login(LoginRequest request) {
        // 0. Verify Captcha
        SecurityToken captchaToken = securityTokenRepository.findById(Integer.parseInt(request.getCaptchaId()))
                .filter(t -> "LOGIN_CAPTCHA".equals(t.getTokenType()))
                .filter(t -> !t.getIsUsed())
                .filter(t -> t.getExpiryDate().isAfter(java.time.LocalDateTime.now()))
                .orElseThrow(() -> new RuntimeException("Captcha không hợp lệ hoặc đã hết hạn"));

        if (!captchaToken.getTokenValue().equalsIgnoreCase(request.getCaptchaCode())) {
            throw new RuntimeException("Mã Captcha không chính xác");
        }

        // Use the captcha token
        captchaToken.setIsUsed(true);
        securityTokenRepository.save(captchaToken);

        // 1. Authenticate
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword()));

        // Find user
        User user = userRepository.findByEmailOrPhone(request.getEmail(), request.getEmail())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng"));
        // Check blocked/suspended status
        if (user.getStatus() != null && user.getStatus().isAccessBlocked()) {
            throw new RuntimeException("Account is blocked");
        }
        // Fetch kycStatus if helper
        String kycStatus = null;
        if ("HELPER".equalsIgnoreCase(user.getRole().name())) {
            kycStatus = helperProfileRepository.findByUser_Id(user.getId())
                    .map(profile -> profile.getKycStatus().name())
                    .orElse("PENDING");
        }

        // Generate Claims
        Map<String, Object> claims = new HashMap<>();
        claims.put("userId", user.getId());
        claims.put("role", user.getRole().name());
        claims.put("kycStatus", kycStatus);

        // Generate Token
        String token = jwtUtil.generateToken(user.getEmail(), claims);

        return LoginResponse.builder()
                .accessToken(token)
                .tokenType("Bearer")
                .expiresIn(3600000L) // Example: 1 hour
                .user(LoginResponse.UserInfo.builder()
                        .userId(user.getId().intValue())
                        .fullName(user.getFullName())
                        .email(user.getEmail())
                        .phone(user.getPhone())
                        .role(user.getRole().name())
                        .kycStatus(kycStatus)
                        .build())
                .build();
    }

    public void forgotPassword(ForgotPasswordRequest request) {
        User user = userRepository.findByEmailOrPhone(request.getEmail(), request.getEmail())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng"));

        // Generate 6-digit OTP
        String otp = String.valueOf((int) (Math.random() * 900000) + 100000);

        // Deactivate old OTPs
        securityTokenRepository.findByUserAndTokenTypeAndIsUsedFalse(user, "FORGOT_PASSWORD_OTP")
                .ifPresent(token -> {
                    token.setIsUsed(true);
                    securityTokenRepository.save(token);
                });

        // Save new OTP
        SecurityToken securityToken = SecurityToken.builder()
                .user(user)
                .tokenValue(otp)
                .tokenType("FORGOT_PASSWORD_OTP")
                .expiryDate(java.time.LocalDateTime.now().plusMinutes(5)) // Expire after 5 mins
                .isUsed(false)
                .build();
        securityTokenRepository.save(securityToken);

        // Send Email
        emailService.sendOtp(user.getEmail(), otp, user.getFullName());
    }

    public String verifyForgotOtp(VerifyOtpRequest request) {
        User user = userRepository.findByEmailOrPhone(request.getEmail(), request.getEmail())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng"));

        SecurityToken otpToken = securityTokenRepository
                .findByTokenValueAndTokenTypeAndIsUsedFalse(request.getOtp(), "FORGOT_PASSWORD_OTP")
                .filter(t -> t.getUser().getId().equals(user.getId()))
                .filter(t -> t.getExpiryDate().isAfter(java.time.LocalDateTime.now()))
                .orElseThrow(() -> new RuntimeException("OTP không hợp lệ hoặc đã hết hạn"));

        // Use the OTP
        otpToken.setIsUsed(true);
        securityTokenRepository.save(otpToken);

        // Generate temporary Reset Token
        String resetToken = java.util.UUID.randomUUID().toString();
        SecurityToken tokenEntity = SecurityToken.builder()
                .user(user)
                .tokenValue(resetToken)
                .tokenType("RESET_PASSWORD_TOKEN")
                .expiryDate(java.time.LocalDateTime.now().plusMinutes(10)) // Expire after 10 mins
                .isUsed(false)
                .build();
        securityTokenRepository.save(tokenEntity);

        return resetToken;
    }

    public void resetPassword(ResetPasswordRequest request) {
        SecurityToken resetToken = securityTokenRepository
                .findByTokenValueAndTokenTypeAndIsUsedFalse(request.getResetToken(), "RESET_PASSWORD_TOKEN")
                .filter(t -> t.getExpiryDate().isAfter(java.time.LocalDateTime.now()))
                .orElseThrow(() -> new RuntimeException("Reset token không hợp lệ hoặc đã hết hạn"));

        User user = resetToken.getUser();
        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        // Use the token
        resetToken.setIsUsed(true);
        securityTokenRepository.save(resetToken);
    }
}
