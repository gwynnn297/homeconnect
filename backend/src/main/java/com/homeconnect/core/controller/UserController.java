package com.homeconnect.core.controller;

import com.homeconnect.core.dto.request.UpdateKycRequest;
import com.homeconnect.core.dto.response.UpdateKycResponse;
import com.homeconnect.core.service.HelperProfileService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

/**
 * Controller quản lý hồ sơ người dùng
 */
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Người dùng", description = "API quản lý thông tin người dùng")
public class UserController {

    private final HelperProfileService helperProfileService;

    @PutMapping("/update-kyc")
    @Operation(summary = "Nộp hồ sơ KYC (Cho Helper)", description = "Cập nhật thông tin định danh và chuyển trạng thái sang WAITING_APPROVAL", responses = {
            @ApiResponse(responseCode = "200", description = "Nộp hồ sơ thành công"),
            @ApiResponse(responseCode = "400", description = "Dữ liệu không hợp lệ"),
            @ApiResponse(responseCode = "403", description = "Không có quyền thực hiện (Role không phải HELPER)")
    })
    public ResponseEntity<UpdateKycResponse> updateKyc(@Valid @RequestBody UpdateKycRequest request) {
        try {
            // Lấy email từ Authentication (được thiết lập bởi JwtAuthenticationFilter)
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication == null || !authentication.isAuthenticated()) {
                return ResponseEntity.status(401).body(UpdateKycResponse.builder()
                        .success(false)
                        .message("Người dùng chưa đăng nhập")
                        .build());
            }

            String email = authentication.getName();

            helperProfileService.updateKyc(email, request);

            return ResponseEntity.ok(UpdateKycResponse.builder()
                    .success(true)
                    .message("Hồ sơ KYC đã được gửi đi và đang chờ Admin duyệt.")
                    .build());
        } catch (RuntimeException e) {
            log.warn("Lỗi khi cập nhật KYC: {}", e.getMessage());
            return ResponseEntity.badRequest().body(UpdateKycResponse.builder()
                    .success(false)
                    .message(e.getMessage())
                    .build());
        }
    }
}
