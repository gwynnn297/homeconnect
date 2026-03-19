package com.homeconnect.core.controller;

import com.homeconnect.core.dto.request.BroadcastNotificationRequest;
import com.homeconnect.core.dto.request.HelperReviewRequest;
import com.homeconnect.core.dto.request.admin.CreateCategoryRequest;
import com.homeconnect.core.dto.request.admin.CreateServiceRequest;
import com.homeconnect.core.dto.request.admin.UpdateCategoryRequest;
import com.homeconnect.core.dto.request.admin.UpdateServiceRequest;
import com.homeconnect.core.dto.response.*;
import com.homeconnect.core.dto.response.admin.ServiceResponse;
import com.homeconnect.core.dto.response.service.CategoryResponse;
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

import java.util.List;

/**
 * AdminController - API dành cho Admin quản lý hệ thống
 * Bao gồm: Helper approval workflow, quản lý user, thống kê
 */
@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin Management", description = "APIs cho Admin quản lý hệ thống")
public class AdminController {

    private final AdminService adminService;

    /**
     * BE-Admin-02: Helper Approval Workflow
     * API để Admin review và approve/reject KYC của Helper
     */
    @Operation(summary = "Review Helper KYC", description = "Admin review hồ sơ KYC và approve/reject Helper")
    @PatchMapping("/helpers/{helperId}/review")
    public ResponseEntity<HelperReviewResponse> reviewHelper(
            @PathVariable("helperId") Long helperId,
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
    public ResponseEntity<HelperListResponse> getHelpers(
            @Parameter(description = "Filter theo KYC status: PENDING, WAITING_APPROVAL, VERIFIED, REJECTED") @RequestParam(value = "status", required = false) KycStatus status,

            @Parameter(description = "Số trang (bắt đầu từ 0)") @RequestParam(value = "page", defaultValue = "0") int page,

            @Parameter(description = "Số lượng item mỗi trang") @RequestParam(value = "size", defaultValue = "20") int size,

            @Parameter(description = "Sắp xếp theo: user.createdAt, user.fullName, updatedAt, kycStatus") @RequestParam(value = "sortBy", defaultValue = "user.createdAt") String sortBy,

            @Parameter(description = "Hướng sắp xếp: asc hoặc desc") @RequestParam(value = "sortDir", defaultValue = "desc") String sortDir) {

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
    public ResponseEntity<HelperDetailResponse> getHelperDetail(
            @PathVariable("helperId") Long helperId) {

        HelperDetailResponse response = adminService.getHelperDetail(helperId);
        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/v1/admin/statistics
     * Thống kê tổng quan hệ thống
     */
    @Operation(summary = "Thống kê hệ thống", description = "Dashboard thống kê: users, helpers theo KYC status, services, locations")
    @GetMapping("/statistics")
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
    public ResponseEntity<BroadcastNotificationResponse> broadcastNotification(
            @Valid @RequestBody BroadcastNotificationRequest request) {

        BroadcastNotificationResponse response = adminService.broadcastNotification(request);
        return ResponseEntity.ok(response);
    }

    /**
     * POST /api/v1/admin/services
     * BE-Admin-01: Tạo mới dịch vụ hệ thống
     */
    @Operation(summary = "Tạo mới dịch vụ hệ thống", description = "Admin thêm dịch vụ mới, quy định đơn vị tính và giá cơ bản")
    @PostMapping("/services")
    public ResponseEntity<ApiResponse<ServiceResponse>> createService(
            @Valid @RequestBody CreateServiceRequest request) {

        ServiceResponse response = adminService.createService(request);

        return ResponseEntity.status(201)
                .body(ApiResponse.<ServiceResponse>builder()
                        .message("Tạo danh mục dịch vụ mới thành công")
                        .data(response)
                        .build());
    }

    /**
     * GET /api/v1/admin/services/{serviceId}
     * BE-Admin-01: Xem chi tiết cấu hình của một dịch vụ lẻ
     */
    @Operation(summary = "Chi tiết dịch vụ", description = "Xem cấu hình chi tiết (giá, đơn vị, trạng thái) của một dịch vụ")
    @GetMapping("/services/{serviceId}")
    public ResponseEntity<ApiResponse<ServiceResponse>> getServiceDetail(
            @PathVariable("serviceId") Integer serviceId) {

        ServiceResponse response = adminService.getServiceDetail(serviceId);
        return ResponseEntity.ok(ApiResponse.<ServiceResponse>builder()
                .message("Lấy thông tin dịch vụ thành công")
                .data(response)
                .build());
    }

    /**
     * PATCH /api/v1/admin/services/{serviceId}
     * BE-Admin-01: Cập nhật thông tin dịch vụ (Giá sàn, Tên, Trạng thái...)
     */
    @Operation(summary = "Cập nhật dịch vụ", description = "Admin thay đổi giá sàn, đơn vị tính hoặc bật/tắt dịch vụ")
    @PatchMapping("/services/{serviceId}")
    public ResponseEntity<ApiResponse<ServiceResponse>> updateService(
            @PathVariable("serviceId") Integer serviceId,
            @Valid @RequestBody UpdateServiceRequest request) {

        ServiceResponse response = adminService.updateService(serviceId, request);

        return ResponseEntity.ok(ApiResponse.<ServiceResponse>builder()
                .message("Cập nhật dịch vụ thành công")
                .data(response)
                .build());
    }

    @Operation(summary = "Xóa dịch vụ nhỏ", description = "Admin xóa một dịch vụ khỏi hệ thống")
    @DeleteMapping("/services/{serviceId}")
    public ResponseEntity<ApiResponse<Void>> deleteService(@PathVariable("serviceId") Integer serviceId) {
        adminService.deleteService(serviceId);
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .message("Xóa dịch vụ thành công")
                .build());
    }
}