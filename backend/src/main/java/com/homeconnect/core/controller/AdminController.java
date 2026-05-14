package com.homeconnect.core.controller;

import com.homeconnect.core.dto.request.BroadcastNotificationRequest;
import com.homeconnect.core.dto.request.HelperReviewRequest;
import com.homeconnect.core.dto.request.admin.AdminResolveDisputeRequest;
import com.homeconnect.core.dto.request.admin.AdminCancelBookingRequest;
import com.homeconnect.core.dto.request.admin.AdminCancelJobPostRequest;
import com.homeconnect.core.dto.request.admin.AdminUpdateUserStatusRequest;
import com.homeconnect.core.dto.request.admin.CreateCategoryRequest;
import com.homeconnect.core.dto.request.admin.CreateServiceRequest;
import com.homeconnect.core.dto.request.admin.UpdateCategoryRequest;
import com.homeconnect.core.dto.request.admin.UpdateServiceRequest;
import com.homeconnect.core.dto.response.*;
import com.homeconnect.core.dto.response.admin.AdminBookingDetailResponse;
import com.homeconnect.core.dto.response.admin.AdminBookingListResponse;
import com.homeconnect.core.dto.response.admin.AdminAuditLogListResponse;
import com.homeconnect.core.dto.response.admin.AdminJobPostEditLogListResponse;
import com.homeconnect.core.dto.response.admin.AdminJobPostDetailResponse;
import com.homeconnect.core.dto.response.admin.AdminJobPostListResponse;
import com.homeconnect.core.dto.response.admin.AdminDisputeListResponse;
import com.homeconnect.core.dto.response.admin.AdminFraudAlertListResponse;
import com.homeconnect.core.dto.response.admin.AdminUserDetailResponse;
import com.homeconnect.core.dto.response.admin.AdminUserListItemResponse;
import com.homeconnect.core.dto.response.admin.AdminUserListResponse;
import com.homeconnect.core.dto.response.admin.AdminViolationListResponse;
import com.homeconnect.core.dto.response.admin.ServiceResponse;
import com.homeconnect.core.dto.response.service.CategoryResponse;
import com.homeconnect.core.enums.BookingStatus;
import com.homeconnect.core.enums.KycStatus;
import com.homeconnect.core.enums.UserRole;
import com.homeconnect.core.enums.UserStatus;
import com.homeconnect.core.exception.BadRequestException;
import com.homeconnect.core.repository.UserRepository;
import com.homeconnect.core.service.AdminService;
import com.homeconnect.core.service.BookingService;
import com.homeconnect.core.service.JobService;

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
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
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
    private final com.homeconnect.core.service.WalletService walletService;
    private final BookingService bookingService;
    private final JobService jobService;
    private final UserRepository userRepository;

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

        @Operation(summary = "Approve Helper CV", description = "Đổi trạng thái từ IDENTITY_VERIFIED sang VERIFIED")
        @PatchMapping("/helpers/{helperId}/approve-cv")
        public ResponseEntity<HelperReviewResponse> approveHelperCv(
                        @PathVariable("helperId") Long helperId,
                        Authentication authentication) {

                String adminEmail = authentication.getName();
                HelperReviewResponse response = adminService.approveHelperCv(helperId, adminEmail);
                return ResponseEntity.ok(response);
        }

    /**
     * GET /api/v1/admin/helpers
     * Lấy danh sách Helper với filter và pagination
     */
    @Operation(summary = "Danh sách Helper", description = "Lấy danh sách Helper với filter theo KYC status")
    @GetMapping("/helpers")
    public ResponseEntity<HelperListResponse> getHelpers(
            @Parameter(description = "Filter theo KYC status: PENDING, WAITING_APPROVAL, IDENTITY_VERIFIED, VERIFIED, REJECTED") @RequestParam(value = "status", required = false) KycStatus status,

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

    @Operation(summary = "Audit logs của admin", description = "Lọc log theo admin thao tác, event type, target type và khoảng thời gian")
    @GetMapping("/audit-logs")
    public ResponseEntity<AdminAuditLogListResponse> getAdminAuditLogs(
            @RequestParam(required = false) Long actorId,
            @RequestParam(required = false) String eventType,
            @RequestParam(required = false) String targetType,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ResponseEntity.ok(adminService.getAdminAuditLogs(actorId, eventType, targetType, from, to, pageable));
    }

    @Operation(summary = "Danh sách vi phạm vận hành", description = "Theo dõi thợ/khách hủy sát giờ, vắng mặt và mức phạt")
    @GetMapping("/violations")
    public ResponseEntity<AdminViolationListResponse> getViolations(
            @RequestParam(required = false) String violationType,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ResponseEntity.ok(adminService.getViolations(violationType, pageable));
    }

    @Operation(summary = "Danh sách cảnh báo gian lận", description = "Theo dõi các booking có cờ bất thường để admin xử lý nhanh")
    @GetMapping("/fraud-alerts")
    public ResponseEntity<AdminFraudAlertListResponse> getFraudAlerts(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(adminService.getFraudAlerts(page, limit));
    }

    @Operation(summary = "Lịch sử chỉnh sửa tin đăng", description = "Theo dõi việc user chỉnh sửa tin để lách kiểm duyệt")
    @GetMapping("/job-post-edit-logs")
    public ResponseEntity<AdminJobPostEditLogListResponse> getJobPostEditLogs(
            @RequestParam(required = false) Long postId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ResponseEntity.ok(adminService.getJobPostEditLogs(postId, pageable));
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

    // ============================================================
    // Quản lý Booking (Admin)
    // ============================================================

    @Operation(summary = "Danh sách booking", description = "Lọc theo trạng thái, cờ bất thường, khoảng thời gian làm việc (scheduled), tìm theo mã đơn hoặc tên khách")
    @GetMapping("/bookings")
    public ResponseEntity<AdminBookingListResponse> getAdminBookings(
            @RequestParam(required = false) BookingStatus status,
            @RequestParam(required = false) Boolean flaggedOnly,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime scheduledFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime scheduledTo,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "scheduledStartTime") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {

        Sort.Direction direction = sortDir.equalsIgnoreCase("asc") ? Sort.Direction.ASC : Sort.Direction.DESC;
        String safeSort = switch (sortBy) {
            case "createdAt", "totalPrice", "status" -> sortBy;
            default -> "scheduledStartTime";
        };
        Pageable pageable = PageRequest.of(page, size, Sort.by(direction, safeSort));
        return ResponseEntity.ok(adminService.getAdminBookings(status, flaggedOnly, scheduledFrom, scheduledTo, q,
                pageable));
    }

    @Operation(summary = "Chi tiết booking", description = "Đầy đủ thông tin vận hành: khách, thợ, địa chỉ, thanh toán, check-in/out, cờ bất thường")
    @GetMapping("/bookings/{bookingId}")
    public ResponseEntity<AdminBookingDetailResponse> getAdminBookingDetail(@PathVariable Long bookingId) {
        return ResponseEntity.ok(adminService.getAdminBookingDetail(bookingId));
    }

    @Operation(summary = "Hủy booking (Admin)", description = "Chỉ cho phép hủy khi booking còn trước giai đoạn thực thi (PENDING/PENDING_ACCEPTANCE/CONFIRMED). Trạng thái đang làm sẽ bị chặn và yêu cầu xử lý vận hành chuyên biệt.")
    @PostMapping("/bookings/{bookingId}/cancel")
    public ResponseEntity<ApiResponse<Void>> adminCancelBooking(
            @PathVariable Long bookingId,
            @Valid @RequestBody AdminCancelBookingRequest request,
            Authentication authentication) {
        String adminEmail = authentication.getName();
        bookingService.cancelBookingByAdmin(bookingId, request.getReason(), adminEmail);
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .message("Đã hủy booking và xử lý ví theo quy định")
                .build());
    }

    @Operation(summary = "Gỡ cờ bất thường", description = "Sau khi xem xét đơn checkout sớm (isFlagged)")
    @PatchMapping("/bookings/{bookingId}/unflag")
    public ResponseEntity<ApiResponse<Void>> adminUnflagBooking(
            @PathVariable Long bookingId,
            Authentication authentication) {
        String adminEmail = authentication.getName();
        bookingService.clearBookingFlagByAdmin(bookingId, adminEmail);
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .message("Đã gỡ cờ cảnh báo")
                .build());
    }

    @Operation(summary = "Xử lý thợ vắng mặt", description = "Tự động hủy, hoàn tiền full cho khách, phạt thợ và tạo vi phạm")
    @PostMapping("/bookings/{bookingId}/helper-no-show")
    public ResponseEntity<ApiResponse<Void>> handleHelperNoShow(
            @PathVariable Long bookingId,
            @RequestParam(required = false) String reason,
            Authentication authentication) {
        bookingService.handleHelperNoShow(bookingId, reason, authentication.getName());
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .message("Đã xử lý thợ vắng mặt")
                .build());
    }

    @Operation(summary = "Xử lý customer không có mặt", description = "Cancel đơn và thanh toán một phần cho helper (30-50%)")
    @PostMapping("/bookings/{bookingId}/customer-no-show")
    public ResponseEntity<ApiResponse<Void>> handleCustomerNoShow(
            @PathVariable Long bookingId,
            @RequestParam(defaultValue = "0.3") double payoutRatio,
            @RequestParam(required = false) String reason,
            Authentication authentication) {
        bookingService.handleCustomerNoShow(bookingId, payoutRatio, reason, authentication.getName());
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .message("Đã xử lý khách vắng mặt")
                .build());
    }

    @Operation(summary = "Danh sách tranh chấp booking", description = "Lấy các đơn đang ở trạng thái DISPUTED để admin xử lý")
    @GetMapping("/disputes")
    public ResponseEntity<AdminDisputeListResponse> getDisputes(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("disputedAt").descending());
        return ResponseEntity.ok(bookingService.getDisputes(pageable));
    }

    @Operation(summary = "Xử lý tranh chấp booking", description = "REFUND_CUSTOMER: hoàn tiền cho khách. REJECT_REPORT: giải ngân tiền cho thợ.")
    @PostMapping("/disputes/{bookingId}/resolve")
    public ResponseEntity<ApiResponse<Void>> resolveDispute(
            @PathVariable Long bookingId,
            @Valid @RequestBody AdminResolveDisputeRequest request,
            Authentication authentication) {
        bookingService.resolveDispute(bookingId, request, authentication.getName());
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .message("Đã xử lý tranh chấp thành công")
                .build());
    }

    // ============================================================
    // Quản lý tin đăng / Chợ việc (Admin)
    // ============================================================

    @Operation(summary = "Danh sách tin đăng", description = "Lọc theo trạng thái, danh mục, khoảng ngày làm, ID khách; tìm theo mã tin, tiêu đề, tên/SĐT/email khách")
    @GetMapping("/job-posts")
    public ResponseEntity<AdminJobPostListResponse> getAdminJobPosts(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Integer categoryId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate workDateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate workDateTo,
            @RequestParam(required = false) Long customerId,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {

        Sort.Direction direction = sortDir.equalsIgnoreCase("asc") ? Sort.Direction.ASC : Sort.Direction.DESC;
        String safeSort = switch (sortBy) {
            case "workDate", "offerPrice", "status" -> sortBy;
            default -> "createdAt";
        };
        Pageable pageable = PageRequest.of(page, size, Sort.by(direction, safeSort));
        return ResponseEntity.ok(adminService.getAdminJobPosts(status, categoryId, workDateFrom, workDateTo, customerId,
                q, pageable));
    }

    @Operation(summary = "Chi tiết tin đăng", description = "Thông tin tin + khách + booking liên quan (nếu có) + thống kê ứng tuyển")
    @GetMapping("/job-posts/{postId}")
    public ResponseEntity<AdminJobPostDetailResponse> getAdminJobPostDetail(@PathVariable Long postId) {
        return ResponseEntity.ok(adminService.getAdminJobPostDetail(postId));
    }

    @Operation(summary = "Hủy tin đăng (Admin)", description = "PUBLISHED: hoàn hold & hủy ứng tuyển như khách. ASSIGNED: chỉ hủy được khi booking liên quan chưa vào giai đoạn thực thi; nếu đang ARRIVED/IN_PROGRESS/PENDING_COMPLETION sẽ bị chặn.")
    @PostMapping("/job-posts/{postId}/cancel")
    public ResponseEntity<ApiResponse<Void>> adminCancelJobPost(
            @PathVariable Long postId,
            @Valid @RequestBody AdminCancelJobPostRequest request,
            Authentication authentication) {
        String adminEmail = authentication.getName();
        jobService.cancelJobPostByAdmin(postId, request.getReason(), adminEmail);
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .message("Đã xử lý hủy tin đăng theo quy định")
                .build());
    }

    // ============================================================
    // Quản lý User (Admin)
    // ============================================================

    @Operation(summary = "Danh sách người dùng", description = "Lọc theo role, trạng thái tài khoản; tìm theo tên, email hoặc SĐT (q)")
    @GetMapping("/users")
    public ResponseEntity<AdminUserListResponse> getUsers(
            @RequestParam(required = false) UserRole role,
            @RequestParam(required = false) UserStatus status,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {

        Sort.Direction direction = sortDir.equalsIgnoreCase("asc") ? Sort.Direction.ASC : Sort.Direction.DESC;
        String safeSort = switch (sortBy) {
            case "updatedAt", "fullName", "email", "phone" -> sortBy;
            default -> "createdAt";
        };
        Pageable pageable = PageRequest.of(page, size, Sort.by(direction, safeSort));
        return ResponseEntity.ok(adminService.getUsers(role, status, q, pageable));
    }

    @Operation(summary = "Chi tiết người dùng", description = "Không trả về mật khẩu. HELPER có thêm tóm tắt KYC nếu có hồ sơ.")
    @GetMapping("/users/{userId}")
    public ResponseEntity<AdminUserDetailResponse> getAdminUserDetail(@PathVariable Long userId) {
        return ResponseEntity.ok(adminService.getAdminUserDetail(userId));
    }

    @Operation(summary = "Khóa / mở khóa tài khoản", description = "Chỉ chấp nhận BANNED (khóa) hoặc ACTIVE (mở khóa). Chặn tuyệt đối thao tác trên tài khoản ADMIN.")
    @PatchMapping("/users/{userId}/status")
    public ResponseEntity<ApiResponse<AdminUserListItemResponse>> updateUserStatus(
            @PathVariable Long userId,
            @Valid @RequestBody AdminUpdateUserStatusRequest request,
            Authentication authentication) {
        String adminEmail = authentication.getName();
        Long adminId = userRepository.findByEmail(adminEmail)
                .map(u -> u.getId())
                .orElseThrow(() -> new BadRequestException("Không xác định được tài khoản admin."));
        AdminUserListItemResponse data = adminService.updateUserStatus(userId, request, adminId, adminEmail);
        return ResponseEntity.ok(ApiResponse.<AdminUserListItemResponse>builder()
                .message("Cập nhật trạng thái tài khoản thành công")
                .data(data)
                .build());
    }

    // ============================================================
    // BE-Admin-01: Quản lý Danh mục Cha (service_categories)
    // ============================================================

    @Operation(summary = "Tạo mới danh mục cha", description = "Admin tạo danh mục cha cho các dịch vụ (VD: Dịch vụ Gia đình)")
    @PostMapping("/categories")
    public ResponseEntity<ApiResponse<CategoryResponse>> createCategory(
            @Valid @RequestBody CreateCategoryRequest request) {

        var category = adminService.createCategory(request);
        return ResponseEntity.status(201).body(ApiResponse.<CategoryResponse>builder()
                .message("Tạo danh mục cha thành công")
                .data(CategoryResponse.builder()
                        .categoryId(category.getCategoryId())
                        .name(category.getName())
                        .description(category.getDescription())
                        .basePrice(category.getBasePrice())
                        .unit(category.getUnit() != null ? category.getUnit().name() : null)
                        .isActive(category.getIsActive())
                        .build())
                .build());
    }

    @Operation(summary = "Lấy danh sách danh mục cha", description = "Admin xem danh sách các danh mục để chọn khi tạo/sửa dịch vụ con")
    @GetMapping("/categories/parents")
    public ResponseEntity<ApiResponse<List<CategoryResponse>>> getParentCategories() {
        return ResponseEntity.ok(ApiResponse.<List<CategoryResponse>>builder()
                .message("Thành công")
                .data(adminService.getRootCategories())
                .build());
    }

    @Operation(summary = "Cập nhật danh mục cha", description = "Thay đổi tên, mô tả hoặc giá cơ bản của danh mục")
    @PatchMapping("/categories/{categoryId}")
    public ResponseEntity<ApiResponse<CategoryResponse>> updateCategory(
            @PathVariable("categoryId") Integer categoryId,
            @Valid @RequestBody UpdateCategoryRequest request) {

        return ResponseEntity.ok(ApiResponse.<CategoryResponse>builder()
                .message("Cập nhật danh mục thành công")
                .data(adminService.updateCategory(categoryId, request))
                .build());
    }

    @Operation(summary = "Xóa danh mục cha", description = "Xóa danh mục (Sẽ xóa tất cả dịch vụ con bên trong)")
    @DeleteMapping("/categories/{categoryId}")
    public ResponseEntity<ApiResponse<Void>> deleteCategory(@PathVariable("categoryId") Integer categoryId) {
        adminService.deleteCategory(categoryId);
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .message("Xóa danh mục thành công")
                .build());
    }

    @Operation(summary = "Lấy dịch vụ con theo danh mục", description = "Admin chọn danh mục cha rồi lấy danh sách dịch vụ để set giá")
    @GetMapping("/categories/{categoryId}/services")
    public ResponseEntity<ApiResponse<List<ServiceResponse>>> getServicesByCategory(
            @PathVariable("categoryId") Integer categoryId) {
        return ResponseEntity.ok(ApiResponse.<List<ServiceResponse>>builder()
                .message("Thành công")
                .data(adminService.getChildrenServicesByCategory(categoryId))
                .build());
    }

    // ============================================================
    // BE-Admin-01: Quản lý Dịch vụ Con (services) & Set giá
    // ============================================================

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

    @Operation(summary = "Duyệt yêu cầu rút tiền (PB-18)", description = "Admin duyệt lệnh rút tiền. Hệ thống sẽ trả về mã nội dung chuyển khoản HOMIRT{id}.")
    @PatchMapping("/withdrawals/{requestId}/approve")
    public ResponseEntity<ApiResponse<Void>> approveWithdrawal(
            @PathVariable("requestId") Integer requestId,
            Authentication authentication) {
        
        String adminEmail = authentication.getName();
        String transferCode = walletService.approveWithdraw(requestId, adminEmail);
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .message("Duyệt thành công! Admin vui lòng chuyển khoản với nội dung: " + transferCode)
                .build());
    }

    @Operation(summary = "Từ chối yêu cầu rút tiền (PB-18)", description = "Admin từ chối lệnh rút. Tiền sẽ được hoàn lại từ Hold Balance về Available Balance của User.")
    @PatchMapping("/withdrawals/{requestId}/reject")
    public ResponseEntity<ApiResponse<Void>> rejectWithdrawal(
            @PathVariable("requestId") Integer requestId,
            @RequestParam String reason,
            Authentication authentication) {
        
        String adminEmail = authentication.getName();
        walletService.rejectWithdraw(requestId, reason, adminEmail);
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .message("Đã từ chối yêu cầu rút tiền và hoàn tiền cho người dùng.")
                .build());
    }

    @Operation(summary = "Lấy danh sách yêu cầu rút tiền", description = "Admin liệt kê các đơn rút tiền theo trạng thái (PENDING, PROCESSING, COMPLETED, REJECTED)")
    @GetMapping("/withdrawals")
    public ResponseEntity<ApiResponse<WithdrawRequestListResponse>> getWithdrawals(
            @RequestParam(required = false) com.homeconnect.core.enums.WithdrawStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        WithdrawRequestListResponse response = walletService.getWithdrawals(status, pageable);
        
        return ResponseEntity.ok(ApiResponse.<WithdrawRequestListResponse>builder()
                .message("Thành công")
                .data(response)
                .build());
    }

    @GetMapping("/withdrawals/{requestId}")
    @Operation(summary = "[Admin] Lấy chi tiết đơn rút tiền ")
    public ResponseEntity<ApiResponse<com.homeconnect.core.dto.response.WithdrawRequestResponse>> getWithdrawDetail(@PathVariable Integer requestId) {
        com.homeconnect.core.dto.response.WithdrawRequestResponse response = walletService.getWithdrawDetail(requestId);
        return ResponseEntity.ok(ApiResponse.<com.homeconnect.core.dto.response.WithdrawRequestResponse>builder()
                .message("Thành công")
                .data(response)
                .build());
    }
}