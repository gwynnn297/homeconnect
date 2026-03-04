package com.homeconnect.core.controller;

import com.homeconnect.core.dto.request.BroadcastNotificationRequest;
import com.homeconnect.core.dto.request.HelperReviewRequest;
import com.homeconnect.core.dto.request.admin.CreateCategoryRequest;
import com.homeconnect.core.dto.request.admin.CreateServiceRequest;
import com.homeconnect.core.dto.request.admin.UpdateCategoryRequest;
import com.homeconnect.core.dto.request.admin.UpdateServiceRequest;
import com.homeconnect.core.dto.response.*;
import com.homeconnect.core.dto.response.admin.ServiceCategoryResponse;
import com.homeconnect.core.dto.response.admin.ServiceResponse;
import com.homeconnect.core.enums.KycStatus;
import com.homeconnect.core.service.AdminService;

import java.util.List;
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

    /**
     * GET /api/v1/admin/service-categories
     * BE-Admin-01: Lấy danh sách danh mục dịch vụ để Admin lựa chọn
     */
    @Operation(summary = "Danh sách danh mục dịch vụ", description = "Lấy danh sách các nhóm dịch vụ (Vệ sinh, Sửa chữa...)")
    @GetMapping("/service-categories")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<ServiceCategoryResponse>>> getServiceCategories() {
        List<ServiceCategoryResponse> response = adminService.getServiceCategories();
        return ResponseEntity.ok(ApiResponse.<List<ServiceCategoryResponse>>builder()
                .message("Lấy danh sách danh mục thành công")
                .data(response)
                .build());
    }

    /**
     * POST /api/v1/admin/service-categories
     * BE-Admin-01: Admin thêm mục lớn (Category) và các dịch vụ nhỏ bên trong
     */
    @Operation(summary = "Tạo Danh mục & Dịch vụ", description = "Admin thêm danh mục lớn kèm danh sách các dịch vụ con bên trong")
    @PostMapping("/service-categories")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<ServiceCategoryResponse>> createCategory(
            @Valid @RequestBody CreateCategoryRequest request) {
        return ResponseEntity.status(201)
                .body(ApiResponse.<ServiceCategoryResponse>builder()
                        .message("Tạo danh mục và dịch vụ thành công")
                        .data(adminService.createCategoryWithServices(request))
                        .build());
    }

    @Operation(summary = "Cập nhật danh mục dịch vụ", description = "Admin cập nhật thông tin của một danh mục dịch vụ")
    @PatchMapping("/service-categories/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<ServiceCategoryResponse>> updateCategory(
            @PathVariable Integer id,
            @Valid @RequestBody UpdateCategoryRequest request) {
        return ResponseEntity.ok(ApiResponse.<ServiceCategoryResponse>builder()
                .message("Cập nhật danh mục thành công")
                .data(adminService.updateCategory(id, request))
                .build());
    }

    @Operation(summary = "Xóa danh mục dịch vụ", description = "Admin xóa một danh mục dịch vụ")
    @DeleteMapping("/service-categories/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteCategory(@PathVariable Integer id) {
        adminService.deleteCategory(id);
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .message("Xóa danh mục thành công")
                .build());
    }

    /**
     * GET /api/v1/admin/service-categories/{categoryId}/services
     * BE-Admin-01: Liệt kê các dịch vụ nhỏ thuộc một danh mục lớn
     */
    @Operation(summary = "Danh sách dịch vụ theo danh mục", description = "Lấy toàn bộ dịch vụ nhỏ thuộc một danh mục cụ thể")
    @GetMapping("/service-categories/{categoryId}/services")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<ServiceResponse>>> getServicesByCategory(
            @PathVariable Integer categoryId) {
        
        List<ServiceResponse> response = adminService.getServicesByCategory(categoryId);
        return ResponseEntity.ok(ApiResponse.<List<ServiceResponse>>builder()
                .message("Lấy danh sách dịch vụ thành công")
                .data(response)
                .build());
    }

    /**
     * POST /api/v1/admin/services
     * BE-Admin-01: Tạo mới dịch vụ hệ thống
     */
    @Operation(summary = "Tạo mới dịch vụ hệ thống", description = "Admin thêm dịch vụ mới, quy định đơn vị tính và giá cơ bản")
    @PostMapping("/services")
    @PreAuthorize("hasRole('ADMIN')")
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
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<ServiceResponse>> getServiceDetail(
            @PathVariable Integer serviceId) {

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
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<ServiceResponse>> updateService(
            @PathVariable Integer serviceId,
            @Valid @RequestBody UpdateServiceRequest request) {

        ServiceResponse response = adminService.updateService(serviceId, request);

        return ResponseEntity.ok(ApiResponse.<ServiceResponse>builder()
                .message("Cập nhật dịch vụ thành công")
                .data(response)
                .build());
    }

    @Operation(summary = "Xóa dịch vụ nhỏ", description = "Admin xóa một dịch vụ khỏi hệ thống")
    @DeleteMapping("/services/{serviceId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteService(@PathVariable Integer serviceId) {
        adminService.deleteService(serviceId);
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .message("Xóa dịch vụ thành công")
                .build());
    }
}