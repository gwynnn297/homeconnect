package com.homeconnect.core.controller;

import com.homeconnect.core.dto.request.BroadcastNotificationRequest;
import com.homeconnect.core.dto.request.HelperReviewRequest;
import com.homeconnect.core.dto.response.*;
import com.homeconnect.core.enums.KycStatus;
import com.homeconnect.core.service.AdminService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * AdminController - API dành cho Admin quản lý hệ thống
 * Bao gồm: Helper approval workflow, quản lý user, thống kê
 */
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@Tag(name = "Admin Management", description = "APIs cho Admin quản lý hệ thống")
public class AdminController {

    private final AdminService adminService;

    /**
     * BE-Admin-02: Helper Approval Workflow
     * API để Admin review và approve/reject KYC của Helper
     */
    @Operation(summary = "Review Helper KYC", description = "Admin review hồ sơ KYC và approve/reject Helper")
    @PatchMapping("/helpers/{helperId}/review")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<HelperReviewResponse> reviewHelper(
            @PathVariable Long helperId,
            @Valid @RequestBody HelperReviewRequest request,
            Authentication authentication) {

        String adminEmail = authentication.getName();
        HelperReviewResponse response = adminService.reviewHelperKyc(helperId, request, adminEmail);
        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/v1/admin/helpers
     * Lấy danh sách Helper với filter và pagination
     */
    @Operation(summary = "Danh sách Helper", description = "Lấy danh sách Helper với filter theo KYC status")
    @GetMapping("/helpers")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<HelperListResponse> getHelpers(
            @Parameter(description = "Filter theo KYC status: PENDING, WAITING_APPROVAL, VERIFIED, REJECTED") @RequestParam(required = false) KycStatus status,

            @Parameter(description = "Số trang (bắt đầu từ 0)") @RequestParam(defaultValue = "0") int page,

            @Parameter(description = "Số lượng item mỗi trang") @RequestParam(defaultValue = "20") int size,

            @Parameter(description = "Sắp xếp theo: user.createdAt, user.fullName, updatedAt, kycStatus") @RequestParam(defaultValue = "user.createdAt") String sortBy,

            @Parameter(description = "Hướng sắp xếp: asc hoặc desc") @RequestParam(defaultValue = "desc") String sortDir) {

        Sort.Direction direction = sortDir.equalsIgnoreCase("asc") ? Sort.Direction.ASC : Sort.Direction.DESC;
        Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sortBy));

        HelperListResponse response = adminService.getHelpers(status, pageable);
        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/v1/admin/helpers/{id}
     * Xem chi tiết hồ sơ Helper
     */
    @Operation(summary = "Chi tiết Helper", description = "Xem chi tiết đầy đủ hồ sơ Helper bao gồm KYC, dịch vụ, khu vực làm việc")
    @GetMapping("/helpers/{helperId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<HelperDetailResponse> getHelperDetail(
            @PathVariable Long helperId) {

        HelperDetailResponse response = adminService.getHelperDetail(helperId);
        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/v1/admin/statistics
     * Thống kê tổng quan hệ thống
     */
    @Operation(summary = "Thống kê hệ thống", description = "Dashboard thống kê: users, helpers theo KYC status, services, locations")
    @GetMapping("/statistics")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AdminStatisticsResponse> getStatistics() {
        AdminStatisticsResponse response = adminService.getStatistics();
        return ResponseEntity.ok(response);
    }

    /**
     * POST /api/v1/admin/notifications/broadcast
     * Gửi thông báo broadcast tới nhiều user
     */
    @Operation(summary = "Gửi thông báo broadcast", description = "Gửi email thông báo tới tất cả user hoặc filter theo role")
    @PostMapping("/notifications/broadcast")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<BroadcastNotificationResponse> broadcastNotification(
            @Valid @RequestBody BroadcastNotificationRequest request) {

        BroadcastNotificationResponse response = adminService.broadcastNotification(request);
        return ResponseEntity.ok(response);
    }
}