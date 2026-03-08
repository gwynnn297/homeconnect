package com.homeconnect.core.controller;

import com.homeconnect.core.dto.request.*;
import com.homeconnect.core.dto.response.*;
import com.homeconnect.core.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

// Controller xử lý xác thực và đăng ký tài khoản
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Xác thực", description = "API xác thực và đăng ký tài khoản")
public class AuthController {

        private final AuthService authService;

        // ========== BE03: Đăng ký bước 1 - Gửi OTP ==========
        @PostMapping("/register-init")
        @Operation(summary = "Đăng ký bước 1 - Gửi OTP", description = "Validate thông tin đăng ký và gửi mã OTP qua email", responses = {
                        @ApiResponse(responseCode = "200", description = "Gửi OTP thành công"),
                        @ApiResponse(responseCode = "400", description = "Dữ liệu không hợp lệ hoặc email/phone đã tồn tại")
        })
        public ResponseEntity<RegisterInitResponse> registerInit(
                        @Valid @RequestBody RegisterInitRequest request) {
                try {
                        authService.registerInit(request);
                        RegisterInitResponse response = RegisterInitResponse.builder()
                                        .success(true)
                                        .message("Mã OTP đã được gửi tới email của bạn. Vui lòng kiểm tra hộp thư.")
                                        .build();
                        return ResponseEntity.ok(response);
                } catch (RuntimeException e) {
                        RegisterInitResponse response = RegisterInitResponse.builder()
                                        .success(false)
                                        .message(e.getMessage())
                                        .build();
                        return ResponseEntity.badRequest().body(response);
                }
        }

        // ========== BE04: Đăng ký bước 2 - Xác thực OTP ==========
        @PostMapping("/register-verify")
        @Operation(summary = "Đăng ký Bước 2 - Xác thực OTP", description = "Xác thực mã OTP và hoàn tất đăng ký tài khoản", responses = {
                        @ApiResponse(responseCode = "200", description = "Đăng ký thành công"),
                        @ApiResponse(responseCode = "400", description = "OTP không chính xác hoặc đã hết hạn")
        })
        public ResponseEntity<RegisterVerifyResponse> registerVerify(
                        @Valid @RequestBody RegisterVerifyRequest request) {
                try {
                        var user = authService.registerVerify(request);

                        RegisterVerifyResponse.UserInfo userInfo = RegisterVerifyResponse.UserInfo.builder()
                                        .userId(user.getId().intValue())
                                        .fullName(user.getFullName())
                                        .email(user.getEmail())
                                        .phone(user.getPhone())
                                        .role(user.getRole().name())
                                        .status(user.getStatus().name())
                                        .build();

                        RegisterVerifyResponse response = RegisterVerifyResponse.builder()
                                        .success(true)
                                        .message("Đăng ký thành công! Tài khoản của bạn đã được kích hoạt.")
                                        .user(userInfo)
                                        .build();
                        return ResponseEntity.ok(response);
                } catch (RuntimeException e) {
                        RegisterVerifyResponse response = RegisterVerifyResponse.builder()
                                        .success(false)
                                        .message(e.getMessage())
                                        .build();
                        return ResponseEntity.badRequest().body(response);
                }
        }

        // ========== Đăng nhập ==========
        @PostMapping("/login")
        @Operation(summary = "Đăng nhập", description = "Đăng nhập vào hệ thống bằng email/phone và mật khẩu", responses = {
                        @ApiResponse(responseCode = "200", description = "Đăng nhập thành công"),
                        @ApiResponse(responseCode = "401", description = "Thông tin đăng nhập không đúng")
        })
        public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
                return ResponseEntity.ok(authService.login(request));
        }

        // ========== Quên mật khẩu ==========
        @PostMapping("/forgot-password")
        @Operation(summary = "Quên mật khẩu", description = "Gửi mã OTP đến email để đặt lại mật khẩu", responses = {
                        @ApiResponse(responseCode = "200", description = "OTP đã được gửi"),
                        @ApiResponse(responseCode = "400", description = "Không tìm thấy tài khoản")
        })
        public ResponseEntity<ForgotPasswordResponse> forgotPassword(
                        @Valid @RequestBody ForgotPasswordRequest request) {
                authService.forgotPassword(request);
                ForgotPasswordResponse response = ForgotPasswordResponse.builder()
                                .success(true)
                                .message("Mã OTP đã được gửi tới email của bạn. Vui lòng kiểm tra hộp thư.")
                                .build();
                return ResponseEntity.ok(response);
        }

        @PostMapping("/verify-forgot-otp")
        @Operation(summary = "Xác thực OTP quên mật khẩu", description = "Xác thực mã OTP và nhận reset token", responses = {
                        @ApiResponse(responseCode = "200", description = "Xác thực thành công"),
                        @ApiResponse(responseCode = "400", description = "OTP không hợp lệ")
        })
        public ResponseEntity<VerifyForgotOtpResponse> verifyForgotOtp(@Valid @RequestBody VerifyOtpRequest request) {
                String resetToken = authService.verifyForgotOtp(request);
                VerifyForgotOtpResponse response = VerifyForgotOtpResponse.builder()
                                .success(true)
                                .resetToken(resetToken)
                                .build();
                return ResponseEntity.ok(response);
        }

        @PostMapping("/reset-password")
        @Operation(summary = "Đặt lại mật khẩu", description = "Đặt lại mật khẩu mới bằng reset token", responses = {
                        @ApiResponse(responseCode = "200", description = "Đặt lại mật khẩu thành công"),
                        @ApiResponse(responseCode = "400", description = "Reset token không hợp lệ")
        })
        public ResponseEntity<ResetPasswordResponse> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
                authService.resetPassword(request);
                ResetPasswordResponse response = ResetPasswordResponse.builder()
                                .success(true)
                                .message("Mật khẩu của bạn đã được đặt lại thành công")
                                .build();
                return ResponseEntity.ok(response);
        }
}