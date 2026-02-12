package com.homeconnect.core.controller;

import com.homeconnect.core.dto.request.RegisterInitRequest;
import com.homeconnect.core.dto.request.RegisterVerifyRequest;
import com.homeconnect.core.dto.response.RegisterResponse;
import com.homeconnect.core.service.RegistrationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

// Controller xử lý đăng ký tài khoản với OTP
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Xác thực", description = "API xác thực và đăng ký tài khoản")
public class AuthController {

    private final RegistrationService registrationService;

    // Bước 1: Khởi tạo đăng ký - validate form và gửi OTP
    @PostMapping("/register-init")
    @Operation(summary = " Đăng ký bước 1 - Gửi OTP", description = "Validate thông tin đăng ký và gửi mã OTP qua email", responses = {
            @ApiResponse(responseCode = "200", description = "Gửi OTP thành công"),
            @ApiResponse(responseCode = "400", description = "Dữ liệu không hợp lệ hoặc email/phone đã tồn tại")
    })
    public ResponseEntity<RegisterResponse> registerInit(
            @Valid @RequestBody RegisterInitRequest request) {
        log.info("POST /register-init cho email: {}", request.getEmail());

        RegisterResponse response = registrationService.registerInit(request);

        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        } else {
            return ResponseEntity.badRequest().body(response);
        }
    }

    // Bước 2: Xác thực OTP và tạo tài khoản
    @PostMapping("/register-verify")
    @Operation(summary = "Đăng ký Bước 2 - Xác thực OTP", description = "Xác thực mã OTP và tạo tài khoản + ví + helper profile", responses = {
            @ApiResponse(responseCode = "200", description = "Đăng ký thành công"),
            @ApiResponse(responseCode = "400", description = "OTP không chính xác hoặc đã hết hạn")
    })
    public ResponseEntity<RegisterResponse> registerVerify(
            @Valid @RequestBody RegisterVerifyRequest request) {
        log.info("POST /register-verify cho email: {}", request.getEmail());

        RegisterResponse response = registrationService.registerVerify(request);

        if (response.isSuccess()) {
            return ResponseEntity.ok(response);
        } else {
            return ResponseEntity.badRequest().body(response);
        }
    }
}