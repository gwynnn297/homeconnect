package com.homeconnect.core.service;

import com.homeconnect.core.dto.request.BroadcastNotificationRequest;
import com.homeconnect.core.dto.request.HelperReviewRequest;
import com.homeconnect.core.dto.request.admin.AdminUpdateUserStatusRequest;
import com.homeconnect.core.dto.request.admin.CreateCategoryRequest;
import com.homeconnect.core.dto.request.admin.CreateServiceRequest;
import com.homeconnect.core.dto.request.admin.UpdateCategoryRequest;
import com.homeconnect.core.dto.request.admin.UpdateServiceRequest;
import com.homeconnect.core.dto.response.*;
import com.homeconnect.core.dto.response.admin.AdminBookingDetailResponse;
import com.homeconnect.core.dto.response.admin.AdminBookingListItemResponse;
import com.homeconnect.core.dto.response.admin.AdminBookingListResponse;
import com.homeconnect.core.dto.response.admin.AdminAuditLogItemResponse;
import com.homeconnect.core.dto.response.admin.AdminAuditLogListResponse;
import com.homeconnect.core.dto.response.admin.AdminFraudAlertItemResponse;
import com.homeconnect.core.dto.response.admin.AdminFraudAlertListResponse;
import com.homeconnect.core.dto.response.admin.AdminJobPostEditLogItemResponse;
import com.homeconnect.core.dto.response.admin.AdminJobPostEditLogListResponse;
import com.homeconnect.core.dto.response.admin.AdminJobPostDetailResponse;
import com.homeconnect.core.dto.response.admin.AdminJobPostListItemResponse;
import com.homeconnect.core.dto.response.admin.AdminJobPostListResponse;
import com.homeconnect.core.dto.response.admin.AdminUserDetailResponse;
import com.homeconnect.core.dto.response.admin.AdminUserListItemResponse;
import com.homeconnect.core.dto.response.admin.AdminUserListResponse;
import com.homeconnect.core.dto.response.admin.AdminViolationItemResponse;
import com.homeconnect.core.dto.response.admin.AdminViolationListResponse;
import com.homeconnect.core.dto.response.admin.ServiceResponse;
import com.homeconnect.core.dto.response.service.CategoryResponse;
import com.homeconnect.core.entity.*;
import com.homeconnect.core.enums.BookingStatus;
import com.homeconnect.core.enums.KycStatus;
import com.homeconnect.core.enums.UserRole;
import com.homeconnect.core.enums.UserStatus;
import com.homeconnect.core.exception.ResourceNotFoundException;
import com.homeconnect.core.exception.BadRequestException;
import com.homeconnect.core.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Duration;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.math.BigDecimal;

/**
 * AdminService - Xử lý các chức năng Admin liên quan Helper
 * Bao gồm: Review KYC Helper, quản lý hệ thống
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AdminService {
        // Giá tối thiểu cho phép để tránh lỗi nhập liệu (VD: 20,000 VNĐ)
        private static final BigDecimal MIN_SERVICE_PRICE = new BigDecimal("20000");
        private static final List<BookingStatus> CUSTOMER_LOCK_AUTO_CANCEL_BOOKING_STATUSES = Arrays.asList(
                        BookingStatus.PENDING,
                        BookingStatus.PENDING_ACCEPTANCE,
                        BookingStatus.CONFIRMED);
        private static final List<BookingStatus> CUSTOMER_LOCK_OPERATIONAL_BOOKING_STATUSES = Arrays.asList(
                        BookingStatus.ARRIVED,
                        BookingStatus.IN_PROGRESS,
                        BookingStatus.PENDING_COMPLETION);
        private static final List<String> CUSTOMER_LOCK_AUTO_CANCEL_POST_STATUSES = Arrays.asList(
                        "PUBLISHED",
                        "ASSIGNED");
        private static final List<BookingStatus> HELPER_LOCK_AUTO_CANCEL_BOOKING_STATUSES = Arrays.asList(
                        BookingStatus.PENDING,
                        BookingStatus.PENDING_ACCEPTANCE,
                        BookingStatus.CONFIRMED);
        private static final List<BookingStatus> HELPER_LOCK_OPERATIONAL_BOOKING_STATUSES = Arrays.asList(
                        BookingStatus.ARRIVED,
                        BookingStatus.IN_PROGRESS,
                        BookingStatus.PENDING_COMPLETION);
        private static final long HELPER_LOCK_NEAR_START_MINUTES = 120;

        private final UserRepository userRepository;
        private final HelperProfileRepository helperProfileRepository;
        private final HelperServiceRepository helperServiceRepository;
        private final HelperWorkingDistrictRepository helperWorkingDistrictRepository;
        private final ServiceRepository serviceRepository;
        private final ServiceCategoryRepository serviceCategoryRepository;
        private final AddressRepository addressRepository;
        private final EmailService emailService;
        private final NotificationService notificationService;
        private final WalletRepository walletRepository;
        private final WalletTransactionRepository walletTransactionRepository;
        private final BookingRepository bookingRepository;
        private final JobPostRepository jobPostRepository;
        private final JobApplicationRepository jobApplicationRepository;
        private final JobService jobService;
        private final BookingService bookingService;
        private final WithdrawRequestRepository withdrawRequestRepository;
        private final AdminAuditLogService adminAuditLogService;
        private final AdminAuditLogRepository adminAuditLogRepository;
        private final UserViolationRepository userViolationRepository;
        private final JobPostEditLogRepository jobPostEditLogRepository;

        @Transactional
        public HelperReviewResponse reviewHelperKyc(Long helperId, HelperReviewRequest request, String adminEmail) {

                // 1. Validate request
                if (!request.isValid()) {
                        throw new BadRequestException("Lý do từ chối bắt buộc khi action = REJECTED");
                }

                // 2. Tìm User với role HELPER
                User helper = userRepository.findById(helperId)
                                .orElseThrow(() -> new ResourceNotFoundException(
                                                "Không tìm thấy Helper với ID: " + helperId));

                // Kiểm tra User có phải là Helper không
                if (!"HELPER".equals(helper.getRole().name())) {
                        throw new BadRequestException(
                                        "User ID " + helperId + " không phải là Helper. Role: "
                                                        + helper.getRole().name());
                }

                // 3. Tìm HelperProfile
                HelperProfile helperProfile = helperProfileRepository.findByUser_Id(helperId)
                                .orElseThrow(
                                                () -> new ResourceNotFoundException(
                                                                "Không tìm thấy hồ sơ Helper cho User ID: "
                                                                                + helperId));

                // 4. Kiểm tra trạng thái hiện tại
                if (helperProfile.getKycStatus() != KycStatus.WAITING_APPROVAL
                                && helperProfile.getKycStatus() != KycStatus.IDENTITY_VERIFIED) {
                        throw new BadRequestException("Helper này không ở trạng thái chờ duyệt. Trạng thái hiện tại: " +
                                        helperProfile.getKycStatus().getDisplayName());
                }

                // 5. Cập nhật trạng thái KYC
                KycStatus newStatus = "VERIFIED".equals(request.getAction()) ? KycStatus.VERIFIED : KycStatus.REJECTED;
                helperProfile.setKycStatus(newStatus);
                if (KycStatus.VERIFIED.equals(newStatus)) {
                        helper.setStatus(UserStatus.ACTIVE);
                } else {
                        helper.setStatus(UserStatus.REJECTED);
                }

                if (KycStatus.REJECTED.equals(newStatus)) {
                        helperProfile.setRejectionReason(request.getRejectionReason());
                } else {
                        helperProfile.setRejectionReason(null); // Clear rejection reason khi approve
                }

                helperProfile.setUpdatedAt(LocalDateTime.now());

                // 6. Lưu thay đổi
                helperProfileRepository.save(helperProfile);
                userRepository.save(helper);

                // 7. Gửi email thông báo cho Helper
                sendKycNotificationEmail(helper, newStatus, request.getRejectionReason());

                // 8. Log hoạt động Admin
                log.info("Admin {} đã {} KYC cho Helper {} (ID: {})",
                                adminEmail,
                                newStatus == KycStatus.VERIFIED ? "approve" : "reject",
                                helper.getFullName(),
                                helperId);

                // 9. Tạo response
                return HelperReviewResponse.builder()
                                .helperId(helper.getId().intValue())
                                .helperName(helper.getFullName())
                                .helperEmail(helper.getEmail())
                                .kycStatus(newStatus)
                                .rejectionReason(request.getRejectionReason())
                                .reviewedAt(LocalDateTime.now())
                                .reviewedBy(adminEmail)
                                .message(newStatus == KycStatus.VERIFIED ? "Đã phê duyệt KYC cho Helper thành công"
                                                : "Đã từ chối KYC cho Helper")
                                .build();
        }

        @Transactional
        public HelperReviewResponse approveHelperCv(Long helperId, String adminEmail) {
                User helper = userRepository.findById(helperId)
                                .orElseThrow(() -> new ResourceNotFoundException(
                                                "Không tìm thấy Helper với ID: " + helperId));

                if (!"HELPER".equals(helper.getRole().name())) {
                        throw new BadRequestException(
                                        "User ID " + helperId + " không phải là Helper. Role: "
                                                        + helper.getRole().name());
                }

                HelperProfile helperProfile = helperProfileRepository.findByUser_Id(helperId)
                                .orElseThrow(() -> new ResourceNotFoundException(
                                                "Không tìm thấy hồ sơ Helper cho User ID: " + helperId));

                if (helperProfile.getKycStatus() != KycStatus.IDENTITY_VERIFIED) {
                        throw new BadRequestException("Chỉ có thể duyệt CV khi helper ở trạng thái IDENTITY_VERIFIED.");
                }

                helperProfile.setKycStatus(KycStatus.VERIFIED);
                helperProfile.setRejectionReason(null);
                helperProfile.setUpdatedAt(LocalDateTime.now());
                helper.setStatus(UserStatus.ACTIVE);

                helperProfileRepository.save(helperProfile);
                userRepository.save(helper);
                sendKycNotificationEmail(helper, KycStatus.VERIFIED, null);

                log.info("Admin {} đã approve CV cho Helper {} (ID: {})", adminEmail, helper.getFullName(), helperId);

                return HelperReviewResponse.builder()
                                .helperId(helper.getId().intValue())
                                .helperName(helper.getFullName())
                                .helperEmail(helper.getEmail())
                                .kycStatus(KycStatus.VERIFIED)
                                .rejectionReason(null)
                                .reviewedAt(LocalDateTime.now())
                                .reviewedBy(adminEmail)
                                .message("Đã duyệt CV cho Helper thành công")
                                .build();
        }

        /**
         * Gửi email thông báo kết quả KYC cho Helper
         */
        private void sendKycNotificationEmail(User helper, KycStatus kycStatus, String rejectionReason) {
                try {
                        String subject = kycStatus == KycStatus.VERIFIED ? "Xác thực danh tính thành công - HomeConnect"
                                        : "Xác thực danh tính không thành công - HomeConnect";

                        String content = buildKycNotificationContent(helper.getFullName(), kycStatus, rejectionReason);

                        emailService.sendSimpleMessage(helper.getEmail(), subject, content);

                        log.info("Đã gửi email thông báo KYC {} cho Helper: {}",
                                        kycStatus.getDisplayName(), helper.getEmail());

                } catch (Exception e) {
                        log.error("Lỗi gửi email thông báo KYC cho Helper {}: {}", helper.getEmail(), e.getMessage());
                        // Không throw exception vì email không critical
                }
        }

        /**
         * Tạo nội dung email thông báo KYC
         */
        private String buildKycNotificationContent(String helperName, KycStatus kycStatus, String rejectionReason) {
                if (kycStatus == KycStatus.VERIFIED) {
                        return String.format(
                                        """
                                                        Chào %s,

                                                        Chúc mừng! Hồ sơ xác thực danh tính của bạn đã được phê duyệt thành công.

                                                        Bạn có thể bắt đầu nhận việc và kiếm tiền trên ứng dụng HomeConnect ngay bây giờ.

                                                        Cảm ơn bạn đã tin tưởng và sử dụng HomeConnect!

                                                        Trân trọng,
                                                        Đội ngũ HomeConnect
                                                        """,
                                        helperName);
                } else {
                        return String.format(
                                        """
                                                                                                Chào %s,

                                                                                                Rất tiếc, hồ sơ xác thực danh tính của bạn đã không được phê duyệt.

                                                                                                Lý do: %s

                                                                                                Bạn có thể cập nhật lại hồ sơ và nộp lại để được xem xét.

                                                                                                Nếu có thắc mắc, vui lòng liên hệ bộ phận hỗ trợ của chúng tôi.

                                                                                                Trân trọng,
                                                        Đội ngũ HomeConnect
                                                                                                """,
                                        helperName, rejectionReason != null ? rejectionReason : "Không rõ");
                }
        }

        /**
         * GET /api/v1/admin/helpers?status={status}
         * Lấy danh sách Helper với filter theo KYC status và pagination
         */
        @Transactional(readOnly = true)
        public HelperListResponse getHelpers(KycStatus status, Pageable pageable) {
                Page<HelperProfile> helperPage;

                if (status != null) {
                        helperPage = helperProfileRepository.findByKycStatus(status, pageable);
                } else {
                        helperPage = helperProfileRepository.findAll(pageable);
                }

                // Batch fetch addresses cho tất cả helpers trong page để tránh N+1 query
                List<Long> helperIds = helperPage.getContent().stream()
                                .map(hp -> hp.getUser().getId())
                                .collect(Collectors.toList());

                Map<Long, Address> helperAddresses = helperIds.isEmpty() ? Map.of()
                                : addressRepository.findDefaultAddressesByUserIds(helperIds).stream()
                                                .collect(Collectors.toMap(addr -> addr.getUser().getId(),
                                                                addr -> addr));

                List<HelperListItemResponse> helpers = helperPage.getContent().stream()
                                .map(hp -> mapToHelperListItem(hp, helperAddresses.get(hp.getUser().getId())))
                                .collect(Collectors.toList());

                String message = status != null
                                ? String.format("Danh sách Helper với trạng thái %s", status.getDisplayName())
                                : "Danh sách tất cả Helper";

                return HelperListResponse.builder()
                                .helpers(helpers)
                                .totalElements(helperPage.getTotalElements())
                                .totalPages(helperPage.getTotalPages())
                                .currentPage(helperPage.getNumber())
                                .pageSize(helperPage.getSize())
                                .message(message)
                                .build();
        }

        /**
         * GET /api/v1/admin/helpers/{id}
         * Xem chi tiết hồ sơ Helper
         */
        @Transactional(readOnly = true)
        public HelperDetailResponse getHelperDetail(Long helperId) {
                // 1. Tìm User với role HELPER
                User helper = userRepository.findById(helperId)
                                .orElseThrow(() -> new ResourceNotFoundException(
                                                "Không tìm thấy Helper với ID: " + helperId));

                if (helper.getRole() != UserRole.HELPER) {
                        throw new BadRequestException("User ID " + helperId + " không phải là Helper");
                }

                // 2. Tìm HelperProfile
                HelperProfile helperProfile = helperProfileRepository.findByUser_Id(helperId)
                                .orElseThrow(
                                                () -> new ResourceNotFoundException(
                                                                "Không tìm thấy hồ sơ Helper cho User ID: "
                                                                                + helperId));

                // 3. Lấy địa chỉ mặc định của helper (từ bảng addresses)
                Address helperAddress = addressRepository.findByUser_IdAndIsDefaultTrue(helperId).orElse(null);

                // 4. Lấy danh sách danh mục thợ có (Dùng cho hiển thị Cha)
                List<HelperDetailResponse.ServiceInfo> services = helperServiceRepository.findByHelper_Id(helperId)
                                .stream()
                                .map(hs -> HelperDetailResponse.ServiceInfo.builder()
                                                .serviceId(hs.getCategory().getCategoryId())
                                                .name(hs.getCategory().getName())
                                                .build())
                                .collect(Collectors.toList());

                // 5. Lấy danh sách khu vực làm việc
                List<HelperDetailResponse.DistrictInfo> workingDistricts = helperWorkingDistrictRepository
                                .findByHelper_Id(helperId)
                                .stream()
                                .map(hwd -> HelperDetailResponse.DistrictInfo.builder()
                                                .locationId(0) // No ID needed now
                                                .name(hwd.getDistrictName())
                                                .code(hwd.getDistrictCode())
                                                .build())
                                .collect(Collectors.toList());

                // 6. Build response
                return HelperDetailResponse.builder()
                                // User info
                                .helperId(helper.getId())
                                .fullName(helper.getFullName())
                                .email(helper.getEmail())
                                .phone(helper.getPhone())
                                .avatarUrl(helper.getAvatarUrl())
                                .status(helper.getStatus())
                                .createdAt(helper.getCreatedAt())

                                // Profile info
                                .profileId(helperProfile.getProfileId())
                                .bio(helperProfile.getBio())
                                .experienceYears(helperProfile.getExperienceYears())
                                .dateOfBirth(helper.getDateOfBirth()) // Đã chuyển từ helperProfile sang User
                                .addressDetail(helperAddress != null ? helperAddress.getAddressDetail() : null)

                                // Location
                                .hometown(helperProfile.getHometownName() != null
                                                ? HelperDetailResponse.LocationInfo.builder()
                                                                .name(helperProfile.getHometownName())
                                                                .type("PROVINCE")
                                                                .build()
                                                : null)
                                .currentCity(helperAddress != null && helperAddress.getProvinceName() != null
                                                ? HelperDetailResponse.LocationInfo.builder()
                                                                .name(helperAddress.getProvinceName())
                                                                .type("PROVINCE")
                                                                .build()
                                                : null)

                                // KYC info
                                .kycStatus(helperProfile.getKycStatus())
                                .rejectionReason(helperProfile.getRejectionReason())
                                .identityNumber(helperProfile.getIdentityNumber())
                                .cccdNumber(helperProfile.getCccdNumber())
                                .aiVerified(helperProfile.getKycStatus() == KycStatus.IDENTITY_VERIFIED
                                                || helperProfile.getKycStatus() == KycStatus.VERIFIED)
                                .identityFrontUrl(helperProfile.getIdentityFrontUrl())
                                .identityBackUrl(helperProfile.getIdentityBackUrl())
                                .selfieUrl(helperProfile.getSelfieUrl())

                                // Services & Districts
                                .services(services)
                                .workingDistricts(workingDistricts)

                                // Timestamps
                                .profileUpdatedAt(helperProfile.getUpdatedAt())
                                .build();
        }

        /**
         * GET /api/v1/admin/statistics
         * Thống kê tổng quan cho Admin Dashboard
         */
        @Transactional(readOnly = true)
        public AdminStatisticsResponse getStatistics() {
                long totalUsers = userRepository.count();
                long totalCustomers = userRepository.countByRole(UserRole.CUSTOMER);
                long totalHelpers = userRepository.countByRole(UserRole.HELPER);
                long totalAdmins = userRepository.countByRole(UserRole.ADMIN);
                long activeUsers = userRepository.countByStatus(UserStatus.ACTIVE);
                long blockedUsers = userRepository.countByStatusIn(
                                Arrays.asList(UserStatus.BANNED, UserStatus.BLOCKED, UserStatus.SUSPENDED));
                AdminStatisticsResponse.UserStats userStats = AdminStatisticsResponse.UserStats.builder()
                                .totalUsers(totalUsers)
                                .totalCustomers(totalCustomers)
                                .totalHelpers(totalHelpers)
                                .totalAdmins(totalAdmins)
                                .activeUsers(activeUsers)
                                .blockedUsers(blockedUsers)
                                .build();

                long pendingKyc = helperProfileRepository.countByKycStatus(KycStatus.PENDING);
                long waitingApproval = helperProfileRepository.countByKycStatus(KycStatus.WAITING_APPROVAL)
                                + helperProfileRepository.countByKycStatus(KycStatus.IDENTITY_VERIFIED);
                long verifiedHelpers = helperProfileRepository.countByKycStatus(KycStatus.VERIFIED);
                long rejectedHelpers = helperProfileRepository.countByKycStatus(KycStatus.REJECTED);

                AdminStatisticsResponse.HelperStats helperStats = AdminStatisticsResponse.HelperStats.builder()
                                .totalHelpers(totalHelpers)
                                .pendingKyc(pendingKyc)
                                .waitingApproval(waitingApproval)
                                .verifiedHelpers(verifiedHelpers)
                                .rejectedHelpers(rejectedHelpers)
                                .build();

                long totalServices = serviceRepository.count();
                long totalCategories = serviceCategoryRepository.count();
                long totalAddresses = addressRepository.count();

                AdminStatisticsResponse.SystemStats systemStats = AdminStatisticsResponse.SystemStats.builder()
                                .totalServices(totalServices)
                                .totalCategories(totalCategories)
                                .totalAddresses(totalAddresses)
                                .build();

                long totalBookings = bookingRepository.count();
                long flaggedBookings = bookingRepository.countByIsFlaggedTrue();
                Map<String, Long> bookingByStatus = toCountMap(bookingRepository.countGroupedByStatus());
                Map<String, Long> bookingByPayment = toCountMap(bookingRepository.countGroupedByPaymentStatus());

                AdminStatisticsResponse.BookingSnapshot bookingSnap = AdminStatisticsResponse.BookingSnapshot.builder()
                                .totalBookings(totalBookings)
                                .flaggedBookings(flaggedBookings)
                                .countByStatus(bookingByStatus)
                                .countByPaymentStatus(bookingByPayment)
                                .build();

                long totalPosts = jobPostRepository.count();
                Map<String, Long> postByStatus = toCountMap(jobPostRepository.countGroupedByStatus());
                AdminStatisticsResponse.JobPostSnapshot jobPostSnap = AdminStatisticsResponse.JobPostSnapshot.builder()
                                .totalPosts(totalPosts)
                                .countByStatus(postByStatus)
                                .build();

                long pendingApps = jobApplicationRepository.countByStatus("PENDING");
                AdminStatisticsResponse.MarketplaceSnapshot marketplaceSnap = AdminStatisticsResponse.MarketplaceSnapshot
                                .builder()
                                .pendingJobApplications(pendingApps)
                                .build();

                long totalWallets = walletRepository.count();
                BigDecimal sumAvail = walletRepository.sumAvailableBalance();
                BigDecimal sumHold = walletRepository.sumHoldBalance();
                BigDecimal sumDebt = walletRepository.sumDebtBalance();
                Map<String, Long> withdrawBySt = toCountMap(withdrawRequestRepository.countGroupedByStatus());

                AdminStatisticsResponse.FinanceSnapshot financeSnap = AdminStatisticsResponse.FinanceSnapshot.builder()
                                .totalWallets(totalWallets)
                                .sumAvailableBalance(sumAvail != null ? sumAvail : BigDecimal.ZERO)
                                .sumHoldBalance(sumHold != null ? sumHold : BigDecimal.ZERO)
                                .sumDebtBalance(sumDebt != null ? sumDebt : BigDecimal.ZERO)
                                .withdrawCountByStatus(withdrawBySt)
                                .build();

                return AdminStatisticsResponse.builder()
                                .userStats(userStats)
                                .helperStats(helperStats)
                                .systemStats(systemStats)
                                .booking(bookingSnap)
                                .jobPost(jobPostSnap)
                                .marketplace(marketplaceSnap)
                                .finance(financeSnap)
                                .message("Thống kê hệ thống HomeConnect")
                                .build();
        }

        @Transactional(readOnly = true)
        public AdminAuditLogListResponse getAdminAuditLogs(
                        Long actorId,
                        String eventType,
                        String targetType,
                        LocalDateTime from,
                        LocalDateTime to,
                        Pageable pageable) {
                Specification<AdminAuditLog> spec = AdminAuditLogSpecification.withFilters(actorId, eventType, targetType,
                                from, to);
                Page<AdminAuditLog> page = adminAuditLogRepository.findAll(spec, pageable);
                List<AdminAuditLogItemResponse> items = page.getContent().stream()
                                .map(log -> AdminAuditLogItemResponse.builder()
                                                .auditId(log.getAuditId())
                                                .eventType(log.getEventType())
                                                .eventLabel(toAuditEventLabel(log.getEventType()))
                                                .actorId(log.getActorId())
                                                .actorEmail(log.getActorEmail())
                                                .actorRole(log.getActorRole())
                                                .targetType(log.getTargetType())
                                                .targetId(log.getTargetId())
                                                .result(log.getResult())
                                                .reason(log.getReason())
                                                .metadataJson(log.getMetadataJson())
                                                .createdAt(log.getCreatedAt())
                                                .build())
                                .collect(Collectors.toList());

                return AdminAuditLogListResponse.builder()
                                .logs(items)
                                .totalElements(page.getTotalElements())
                                .totalPages(page.getTotalPages())
                                .currentPage(page.getNumber())
                                .pageSize(page.getSize())
                                .message("Danh sách admin audit logs")
                                .build();
        }

        private String toAuditEventLabel(String eventType) {
                if (eventType == null || eventType.isBlank()) {
                        return "Thao tác quản trị";
                }
                return switch (eventType) {
                        case "ADMIN_USER_STATUS_UPDATE" -> "Cập nhật trạng thái tài khoản người dùng";
                        case "ADMIN_BOOKING_CANCEL" -> "Hủy booking bởi quản trị viên";
                        case "ADMIN_BOOKING_UNFLAG" -> "Gỡ cờ cảnh báo booking";
                        case "ADMIN_BOOKING_HELPER_NO_SHOW" -> "Xử lý thợ vắng mặt";
                        case "ADMIN_BOOKING_CUSTOMER_NO_SHOW" -> "Xử lý khách hàng vắng mặt";
                        case "ADMIN_HELPER_LOCK_BOOKING_REVIEW" -> "Chuyển booking sang xử lý vận hành khi khóa helper";
                        case "ADMIN_HELPER_LOCK_REOPEN_POST" -> "Mở lại tin đăng do helper bị khóa";
                        case "ADMIN_CUSTOMER_LOCK_BOOKING_REVIEW" -> "Chuyển booking sang xử lý vận hành khi khóa khách hàng";
                        case "ADMIN_CUSTOMER_LOCK_JOB_REVIEW" -> "Chuyển tin đăng sang xử lý vận hành khi khóa khách hàng";
                        case "ADMIN_JOB_POST_CANCEL" -> "Hủy tin đăng bởi quản trị viên";
                        default -> "Thao tác quản trị: " + eventType;
                };
        }

        @Transactional(readOnly = true)
        public AdminViolationListResponse getViolations(String violationType, Pageable pageable) {
                Page<UserViolation> page = (violationType == null || violationType.isBlank())
                                ? userViolationRepository.findAll(pageable)
                                : userViolationRepository.findByViolationType(violationType, pageable);
                List<AdminViolationItemResponse> items = page.getContent().stream()
                                .map(v -> AdminViolationItemResponse.builder()
                                                .violationId(v.getId())
                                                .userId(v.getUser() != null ? v.getUser().getId() : null)
                                                .userName(v.getUser() != null ? v.getUser().getFullName() : null)
                                                .userRole(v.getUser() != null && v.getUser().getRole() != null
                                                                ? v.getUser().getRole().name()
                                                                : null)
                                                .bookingId(v.getBookingId())
                                                .violationType(v.getViolationType())
                                                .severity(v.getSeverity())
                                                .penaltyAmount(v.getPenaltyAmount())
                                                .note(v.getNote())
                                                .createdAt(v.getCreatedAt())
                                                .build())
                                .collect(Collectors.toList());
                return AdminViolationListResponse.builder()
                                .violations(items)
                                .totalElements(page.getTotalElements())
                                .totalPages(page.getTotalPages())
                                .currentPage(page.getNumber())
                                .pageSize(page.getSize())
                                .message("Danh sách vi phạm vận hành")
                                .build();
        }

        @Transactional(readOnly = true)
        public AdminJobPostEditLogListResponse getJobPostEditLogs(Long postId, Pageable pageable) {
                Page<JobPostEditLog> page = postId == null
                                ? jobPostEditLogRepository.findAll(pageable)
                                : jobPostEditLogRepository.findByPostId(postId, pageable);
                List<AdminJobPostEditLogItemResponse> items = page.getContent().stream()
                                .map(log -> AdminJobPostEditLogItemResponse.builder()
                                                .editLogId(log.getId())
                                                .postId(log.getPostId())
                                                .editedBy(log.getEditedBy())
                                                .revisionNo(log.getRevisionNo())
                                                .oldTitle(log.getOldTitle())
                                                .newTitle(log.getNewTitle())
                                                .oldDescription(log.getOldDescription())
                                                .newDescription(log.getNewDescription())
                                                .createdAt(log.getCreatedAt())
                                                .build())
                                .collect(Collectors.toList());
                return AdminJobPostEditLogListResponse.builder()
                                .logs(items)
                                .totalElements(page.getTotalElements())
                                .totalPages(page.getTotalPages())
                                .currentPage(page.getNumber())
                                .pageSize(page.getSize())
                                .message("Lịch sử chỉnh sửa tin đăng")
                                .build();
        }

        private static Map<String, Long> toCountMap(List<Object[]> rows) {
                Map<String, Long> m = new HashMap<>();
                if (rows == null) {
                        return m;
                }
                for (Object[] row : rows) {
                        if (row == null || row.length < 2 || row[0] == null) {
                                continue;
                        }
                        String key = row[0].toString();
                        long n = row[1] instanceof Number ? ((Number) row[1]).longValue() : 0L;
                        m.put(key, n);
                }
                return m;
        }

        /**
         * POST /api/v1/admin/notifications/broadcast
         * Gửi thông báo broadcast tới nhiều user
         */
        @Transactional
        public BroadcastNotificationResponse broadcastNotification(BroadcastNotificationRequest request) {
                List<User> recipients;

                // Lọc user theo role nếu có
                if (request.getTargetRole() != null && !request.getTargetRole().isBlank()) {
                        try {
                                UserRole targetRole = UserRole.valueOf(request.getTargetRole().toUpperCase());
                                recipients = userRepository.findByRole(targetRole);
                        } catch (IllegalArgumentException e) {
                                throw new BadRequestException("Role không hợp lệ: " + request.getTargetRole());
                        }
                } else {
                        recipients = userRepository.findAll();
                }

                int totalRecipients = recipients.size();
                int successCount = 0;
                int failureCount = 0;

                // Gửi email cho từng user
                for (User user : recipients) {
                        try {
                                emailService.sendSimpleMessage(user.getEmail(), request.getTitle(),
                                                request.getMessage());
                                successCount++;
                                log.info("Đã gửi broadcast notification tới: {}", user.getEmail());
                        } catch (Exception e) {
                                failureCount++;
                                log.error("Lỗi gửi broadcast notification tới {}: {}", user.getEmail(), e.getMessage());
                        }
                }

                log.info("Broadcast notification hoàn tất: {}/{} thành công", successCount, totalRecipients);

                return BroadcastNotificationResponse.builder()
                                .success(true)
                                .message("Đã gửi thông báo broadcast")
                                .totalRecipients(totalRecipients)
                                .successCount(successCount)
                                .failureCount(failureCount)
                                .build();
        }

        /**
         * Helper method: Map HelperProfile sang HelperListItemResponse
         */
        private HelperListItemResponse mapToHelperListItem(HelperProfile helperProfile, Address address) {
                User helper = helperProfile.getUser();

                // Count services and districts
                long totalServices = helperServiceRepository.countByHelper_Id(helper.getId());
                long totalWorkingDistricts = helperWorkingDistrictRepository.countByHelper_Id(helper.getId());

                return HelperListItemResponse.builder()
                                .helperId(helper.getId())
                                .fullName(helper.getFullName())
                                .email(helper.getEmail())
                                .phone(helper.getPhone())
                                .avatarUrl(helper.getAvatarUrl())

                                .kycStatus(helperProfile.getKycStatus())
                                .identityNumber(helperProfile.getIdentityNumber())
                                .cccdNumber(helperProfile.getCccdNumber())
                                .aiVerified(helperProfile.getKycStatus() == KycStatus.IDENTITY_VERIFIED
                                                || helperProfile.getKycStatus() == KycStatus.VERIFIED)
                                .dateOfBirth(helper.getDateOfBirth()) // Đã chuyển từ helperProfile sang User

                                .currentCityName(
                                                address != null ? address.getProvinceName() : null)

                                .experienceYears(helperProfile.getExperienceYears())
                                .bio(helperProfile.getBio())
                                .totalServices((int) totalServices)
                                .totalWorkingDistricts((int) totalWorkingDistricts)

                                .createdAt(helper.getCreatedAt())
                                .updatedAt(helperProfile.getUpdatedAt())
                                .build();
        }

        private ServiceResponse mapToServiceResponse(com.homeconnect.core.entity.Service service) {
                return ServiceResponse.builder()
                                .serviceId(service.getServiceId())
                                .name(service.getName())
                                .description(service.getDescription())
                                .basePrice(service.getBasePrice())
                                .isActive(service.getIsActive())
                                .categoryId(service.getCategory() != null ? service.getCategory().getCategoryId()
                                                : null)
                                .categoryName(service.getCategory() != null ? service.getCategory().getName() : null)
                                .createdAt(service.getCreatedAt())
                                .updatedAt(service.getUpdatedAt())
                                .build();
        }

        /**
         * BE-Admin-01: Xóa dịch vụ nhỏ
         */
        @Transactional
        public void deleteService(Integer id) {
                if (!serviceRepository.existsById(id)) {
                        throw new BadRequestException("Dịch vụ không tồn tại");
                }
                serviceRepository.deleteById(id);
        }

        private void validateServicePrice(BigDecimal price) {
                if (price != null && price.compareTo(MIN_SERVICE_PRICE) < 0) {
                        throw new BadRequestException("Giá dịch vụ quá thấp (Tối thiểu phải từ " +
                                        String.format("%,d", MIN_SERVICE_PRICE.longValue())
                                        + " VNĐ). Vui lòng kiểm tra lại!");
                }
        }

        /**
         * BE-Admin-01: Lấy thông tin chi tiết của một dịch vụ lẻ
         */
        @Transactional(readOnly = true)
        public ServiceResponse getServiceDetail(Integer serviceId) {
                com.homeconnect.core.entity.Service service = serviceRepository.findById(serviceId)
                                .orElseThrow(() -> new BadRequestException(
                                                "Dịch vụ ID " + serviceId + " không tồn tại"));
                return mapToServiceResponse(service);
        }

        /**
         * BE-Admin-01: Cập nhật thông tin dịch vụ (Patch)
         */
        @Transactional
        public ServiceResponse updateService(Integer serviceId, UpdateServiceRequest request) {
                com.homeconnect.core.entity.Service service = serviceRepository.findById(serviceId)
                                .orElseThrow(() -> new BadRequestException(
                                                "Dịch vụ ID " + serviceId + " không tồn tại"));
                if (request.getName() != null && !request.getName().equals(service.getName())) {
                        if (serviceRepository.existsByName(request.getName())) {
                                throw new BadRequestException("Tên dịch vụ '" + request.getName() + "' đã tồn tại");
                        }
                        service.setName(request.getName());
                }

                if (request.getBasePrice() != null) {
                        validateServicePrice(request.getBasePrice());
                        service.setBasePrice(request.getBasePrice());
                }

                if (request.getDescription() != null) {
                        service.setDescription(request.getDescription());
                }

                if (request.getIsActive() != null) {
                        service.setIsActive(request.getIsActive());
                }

                return mapToServiceResponse(serviceRepository.save(service));
        }

        /**
         * BE-Admin-01: Manage Service & Price
         * Tạo mới dịch vụ và giá sàn
         */
        @Transactional
        public ServiceResponse createService(CreateServiceRequest request) {
                // 1. Kiểm tra tên dịch vụ duy nhất
                if (serviceRepository.existsByName(request.getName())) {
                        throw new BadRequestException("Tên dịch vụ '" + request.getName() + "' đã tồn tại");
                }

                validateServicePrice(request.getBasePrice());

                // 2. Map DTO sang Entity
                ServiceCategory category = null;
                if (request.getCategoryId() != null) {
                        category = serviceCategoryRepository.findById(request.getCategoryId())
                                        .orElseThrow(() -> new BadRequestException(
                                                        "Danh mục ID " + request.getCategoryId() + " không tồn tại"));
                }

                com.homeconnect.core.entity.Service service = com.homeconnect.core.entity.Service.builder()
                                .name(request.getName())
                                .description(request.getDescription())
                                .basePrice(request.getBasePrice())
                                .isActive(request.getIsActive() == null || request.getIsActive())
                                .category(category)
                                .build();

                // 3. Lưu entity
                service = serviceRepository.save(service);

                log.info("Admin đã tạo mới dịch vụ: {} (ID: {})", service.getName(), service.getServiceId());

                // 4. Trả về response
                return mapToServiceResponse(service);
        }

        // --- BE-Admin-01: Danh muc Cha (ServiceCategory) ---

        @Transactional
        public ServiceCategory createCategory(CreateCategoryRequest request) {
                if (serviceCategoryRepository.existsByName(request.getName())) {
                        throw new BadRequestException("Ten danh muc da ton tai");
                }
                return serviceCategoryRepository.save(ServiceCategory.builder()
                                .name(request.getName())
                                .description(request.getDescription())
                                .basePrice(request.getBasePrice())
                                .unit(request.getUnit() != null
                                                ? com.homeconnect.core.enums.ServiceUnit.valueOf(request.getUnit())
                                                : null)
                                .isActive(true)
                                .build());
        }

        @Transactional(readOnly = true)
        public List<CategoryResponse> getRootCategories() {
                return serviceCategoryRepository.findAll().stream()
                                .map(cat -> CategoryResponse.builder()
                                                .categoryId(cat.getCategoryId())
                                                .name(cat.getName())
                                                .description(cat.getDescription())
                                                .basePrice(cat.getBasePrice())
                                                .unit(cat.getUnit() != null ? cat.getUnit().name() : null)
                                                .isActive(cat.getIsActive())
                                                .uiConfig(cat.getUiConfig())
                                                .build())
                                .collect(Collectors.toList());
        }

        @Transactional(readOnly = true)
        public List<ServiceResponse> getChildrenServicesByCategory(Integer categoryId) {
                ServiceCategory category = serviceCategoryRepository.findById(categoryId)
                                .orElseThrow(() -> new BadRequestException("Danh muc khong ton tai"));
                return category.getServices().stream()
                                .map(this::mapToServiceResponse)
                                .collect(Collectors.toList());
        }

        @Transactional
        public CategoryResponse updateCategory(Integer categoryId, UpdateCategoryRequest request) {
                ServiceCategory category = serviceCategoryRepository.findById(categoryId)
                                .orElseThrow(() -> new BadRequestException("Danh mục không tồn tại"));

                if (request.getName() != null && !request.getName().equals(category.getName())) {
                        if (serviceCategoryRepository.existsByName(request.getName())) {
                                throw new BadRequestException("Tên danh mục đã tồn tại");
                        }
                        category.setName(request.getName());
                }

                if (request.getDescription() != null)
                        category.setDescription(request.getDescription());
                if (request.getBasePrice() != null)
                        category.setBasePrice(request.getBasePrice());
                if (request.getUnit() != null)
                        category.setUnit(com.homeconnect.core.enums.ServiceUnit.valueOf(request.getUnit()));
                if (request.getIsActive() != null)
                        category.setIsActive(request.getIsActive());

                category = serviceCategoryRepository.save(category);
                return CategoryResponse.builder()
                                .categoryId(category.getCategoryId())
                                .name(category.getName())
                                .description(category.getDescription())
                                .basePrice(category.getBasePrice())
                                .unit(category.getUnit() != null ? category.getUnit().name() : null)
                                .isActive(category.getIsActive())
                                .uiConfig(category.getUiConfig())
                                .build();
        }

        @Transactional
        public void deleteCategory(Integer categoryId) {
                ServiceCategory category = serviceCategoryRepository.findById(categoryId)
                                .orElseThrow(() -> new BadRequestException("Danh mục không tồn tại"));

                serviceCategoryRepository.delete(category);
        }

        // --- Admin: Quản lý User ---

        @Transactional(readOnly = true)
        public AdminUserListResponse getUsers(UserRole role, UserStatus status, String search,
                        Pageable pageable) {
                Specification<User> spec = UserSpecification.withFilters(role, status, search);
                Page<User> page = userRepository.findAll(spec, pageable);
                List<AdminUserListItemResponse> items = page.getContent().stream()
                                .map(this::mapToAdminUserListItem)
                                .collect(Collectors.toList());
                return AdminUserListResponse.builder()
                                .users(items)
                                .totalElements(page.getTotalElements())
                                .totalPages(page.getTotalPages())
                                .currentPage(page.getNumber())
                                .pageSize(page.getSize())
                                .message("Danh sách người dùng")
                                .build();
        }

        @Transactional(readOnly = true)
        public AdminUserDetailResponse getAdminUserDetail(Long userId) {
                User user = userRepository.findById(userId)
                                .orElseThrow(() -> new ResourceNotFoundException(
                                                "Không tìm thấy user với ID: " + userId));

                AdminUserDetailResponse.HelperSummary helperSummary = null;
                if (user.getRole() == UserRole.HELPER) {
                        helperSummary = helperProfileRepository.findByUser_Id(userId)
                                        .map(hp -> AdminUserDetailResponse.HelperSummary.builder()
                                                        .profileId(hp.getProfileId())
                                                        .kycStatus(hp.getKycStatus())
                                                        .rejectionReason(hp.getRejectionReason())
                                                        .isOnline(hp.getIsOnline())
                                                        .ratingAverage(hp.getRatingAverage())
                                                        .totalReviews(hp.getTotalReviews())
                                                        .build())
                                        .orElse(null);
                }

                AdminUserDetailResponse.AddressSummary addressSummary = addressRepository
                                .findByUser_IdAndIsDefaultTrue(userId)
                                .map(addr -> AdminUserDetailResponse.AddressSummary.builder()
                                                .addressDetail(addr.getAddressDetail())
                                                .provinceName(addr.getProvinceName())
                                                .districtName(addr.getDistrictName())
                                                .wardName(addr.getWardName())
                                                .build())
                                .orElse(null);

                AdminUserDetailResponse.WalletSummary walletSummary = walletRepository.findByUserId(userId)
                                .map(w -> {
                                        BigDecimal earnings = walletTransactionRepository
                                                        .getTotalEarningsByWalletId(w.getWalletId());
                                        if (earnings == null) {
                                                earnings = BigDecimal.ZERO;
                                        }
                                        return AdminUserDetailResponse.WalletSummary.builder()
                                                        .walletId(w.getWalletId())
                                                        .availableBalance(w.getAvailableBalance())
                                                        .holdBalance(w.getHoldBalance())
                                                        .debtBalance(w.getDebtBalance())
                                                        .isFrozen(w.getIsFrozen())
                                                        .totalEarnings(earnings)
                                                        .build();
                                })
                                .orElse(null);

                long bookingsCustomer = bookingRepository.countByCustomer_Id(userId);
                long bookingsHelper = bookingRepository.countByHelper_Id(userId);
                long jobPosts = jobPostRepository.countByCustomerId(userId);

                AdminUserDetailResponse.ActivityStats activity = AdminUserDetailResponse.ActivityStats.builder()
                                .bookingsAsCustomer(bookingsCustomer)
                                .bookingsAsHelper(bookingsHelper)
                                .jobPostsCreated(jobPosts)
                                .build();

                return AdminUserDetailResponse.builder()
                                .userId(user.getId())
                                .fullName(user.getFullName())
                                .email(user.getEmail())
                                .phone(user.getPhone())
                                .role(user.getRole())
                                .status(user.getStatus())
                                .gender(user.getGender())
                                .dateOfBirth(user.getDateOfBirth())
                                .avatarUrl(user.getAvatarUrl())
                                .createdAt(user.getCreatedAt())
                                .updatedAt(user.getUpdatedAt())
                                .defaultAddress(addressSummary)
                                .wallet(walletSummary)
                                .activity(activity)
                                .helperSummary(helperSummary)
                                .build();
        }

        @Transactional
        public AdminUserListItemResponse updateUserStatus(Long userId, AdminUpdateUserStatusRequest request,
                        Long adminUserId, String adminEmail) {
                User target = userRepository.findById(userId)
                                .orElseThrow(() -> new ResourceNotFoundException(
                                                "Không tìm thấy user với ID: " + userId));

                if (adminUserId.equals(target.getId())) {
                        adminAuditLogService.log(adminUserId, adminEmail, "ADMIN_USER_STATUS_UPDATE", "USER", userId,
                                        "BLOCKED", "Admin cố thao tác trạng thái trên chính mình",
                                        "{\"requestedStatus\":\"" + request.getStatus() + "\"}");
                        throw new BadRequestException("Không thể khóa hoặc thao tác trên chính tài khoản của bạn.");
                }

                if (target.getRole() == UserRole.ADMIN) {
                        adminAuditLogService.log(adminUserId, adminEmail, "ADMIN_USER_STATUS_UPDATE", "USER", userId,
                                        "BLOCKED", "Chặn tuyệt đối thao tác khóa/mở khóa trên tài khoản admin",
                                        "{\"requestedStatus\":\"" + request.getStatus() + "\"}");
                        throw new BadRequestException("Không được phép thao tác khóa/mở khóa tài khoản ADMIN.");
                }

                boolean wantBlocked = "BANNED".equalsIgnoreCase(request.getStatus());
                boolean wantActive = "ACTIVE".equalsIgnoreCase(request.getStatus());

                if (wantBlocked) {
                        if (target.getStatus() == UserStatus.BANNED || target.getStatus() == UserStatus.SUSPENDED
                                        || target.getStatus() == UserStatus.BLOCKED
                                        || target.getStatus() == UserStatus.WITHDRAW_ONLY) {
                                log.info("Admin {}: idempotent — user {} đã ở trạng thái bị khóa", adminEmail, userId);
                                return mapToAdminUserListItem(target);
                        }

                        // Nếu user còn tiền khả dụng, chỉ cho phép rút tiền theo yêu cầu nghiệp vụ.
                        boolean hasAvailableBalance = walletRepository.findByUserId(target.getId())
                                        .map(wallet -> wallet.getAvailableBalance() != null
                                                        && wallet.getAvailableBalance().compareTo(BigDecimal.ZERO) > 0)
                                        .orElse(false);

                        if (target.getRole() == UserRole.HELPER) {
                                HelperLockOutcome helperOutcome = enforceHelperLockBusinessRules(target, request.getReason(),
                                                adminEmail);
                                if (helperOutcome.blockingCriticalCases > 0) {
                                        adminAuditLogService.log(
                                                        adminUserId,
                                                        adminEmail,
                                                        "ADMIN_USER_STATUS_UPDATE",
                                                        "USER",
                                                        userId,
                                                        "BLOCKED",
                                                        "Không thể khóa helper vì có booking sát giờ/đang thực thi cần xử lý vận hành",
                                                        "{\"blockingCases\":" + helperOutcome.blockingCriticalCases + "}");
                                        throw new BadRequestException(
                                                        "Không thể khóa helper ngay vì có " + helperOutcome.blockingCriticalCases
                                                                        + " booking sát giờ/đang thực thi. "
                                                                        + "Vui lòng xử lý vận hành các booking đó trước.");
                                }
                        }

                        if (hasAvailableBalance) {
                                target.setStatus(UserStatus.WITHDRAW_ONLY);
                        } else if (target.getRole() == UserRole.HELPER) {
                                target.setStatus(UserStatus.SUSPENDED);
                        } else {
                                target.setStatus(UserStatus.BANNED);
                        }
                        target.setBannedAt(LocalDateTime.now());
                        target.setBannedBy(adminUserId);
                        target.setBanReason(request.getReason());
                        notificationService.createNotification(
                                        target.getId(),
                                        "Tài khoản đã bị khóa",
                                        target.getStatus() == UserStatus.WITHDRAW_ONLY
                                                        ? "Tài khoản của bạn đã bị khóa và chuyển sang chế độ chỉ rút tiền. "
                                                                        + "Các chức năng khác sẽ bị tạm ngưng."
                                                        : "Tài khoản của bạn đã bị khóa theo quyết định của quản trị viên. "
                                                                        + "Vui lòng liên hệ hỗ trợ để được hướng dẫn.",
                                        "ACCOUNT_LOCKED");
                        if (target.getRole() == UserRole.HELPER) {
                                notificationService.createNotification(
                                                target.getId(),
                                                "Trạng thái khóa đã áp dụng",
                                                "Tài khoản helper của bạn đã bị khóa sau khi hệ thống xử lý xong các booking đủ điều kiện.",
                                                "ACCOUNT_LOCKED");
                        } else if (target.getRole() == UserRole.CUSTOMER) {
                                enforceCustomerLockBusinessRules(target, request.getReason(), adminEmail);
                        }
                } else if (wantActive) {
                        if (target.getStatus() == UserStatus.ACTIVE) {
                                return mapToAdminUserListItem(target);
                        }
                        if (target.getStatus() != UserStatus.BANNED
                                        && target.getStatus() != UserStatus.SUSPENDED
                                        && target.getStatus() != UserStatus.BLOCKED
                                        && target.getStatus() != UserStatus.WITHDRAW_ONLY) {
                                throw new BadRequestException(
                                                "Chỉ có thể mở khóa (ACTIVE) khi tài khoản đang bị khóa/tạm đình chỉ.");
                        }
                        target.setStatus(UserStatus.ACTIVE);
                        target.setUnbannedAt(LocalDateTime.now());
                        target.setUnbannedBy(adminUserId);
                        target.setUnbanReason(request.getReason());
                }

                userRepository.save(target);
                log.info("Admin {} đã cập nhật status={} cho user id={} (email={}). Ghi chú: {}", adminEmail,
                                target.getStatus(), userId, target.getEmail(), request.getReason());
                adminAuditLogService.log(
                                adminUserId,
                                adminEmail,
                                "ADMIN_USER_STATUS_UPDATE",
                                "USER",
                                userId,
                                "SUCCESS",
                                request.getReason(),
                                "{\"newStatus\":\"" + target.getStatus().name() + "\"}");

                return mapToAdminUserListItem(target);
        }

        private HelperLockOutcome enforceHelperLockBusinessRules(User helper, String reason, String adminEmail) {
                String lockReason = (reason == null || reason.isBlank())
                                ? "Helper bị khóa tài khoản theo quyết định admin"
                                : reason.trim();
                Long adminUserId = adminAuditLogService.resolveActorIdByEmail(adminEmail);

                // 1) Hủy toàn bộ booking helper đang trong các trạng thái có thể xử lý,
                // hoàn/giải phóng tiền theo luồng cancel admin hiện có.
                List<BookingStatus> activeStatuses = Arrays.asList(
                                BookingStatus.PENDING,
                                BookingStatus.PENDING_ACCEPTANCE,
                                BookingStatus.CONFIRMED,
                                BookingStatus.ARRIVED,
                                BookingStatus.IN_PROGRESS,
                                BookingStatus.PENDING_COMPLETION);
                List<Booking> activeBookings = bookingRepository.findByHelper_IdAndStatusIn(helper.getId(), activeStatuses);
                int cancelledBookings = 0;
                int pendingOperationalBookings = 0;
                int blockingCriticalCases = 0;
                for (Booking booking : activeBookings) {
                        if (booking.getStatus() == BookingStatus.CANCELLED || booking.getStatus() == BookingStatus.COMPLETED
                                        || booking.getStatus() == BookingStatus.EXPIRED) {
                                continue;
                        }
                        if (HELPER_LOCK_AUTO_CANCEL_BOOKING_STATUSES.contains(booking.getStatus())) {
                                if (booking.getStatus() == BookingStatus.CONFIRMED) {
                                        long minutesToStart = Duration.between(LocalDateTime.now(),
                                                        booking.getScheduledStartTime()).toMinutes();
                                        if (minutesToStart <= HELPER_LOCK_NEAR_START_MINUTES) {
                                                blockingCriticalCases++;
                                                booking.setIsFlagged(true);
                                                bookingRepository.save(booking);
                                                adminAuditLogService.log(
                                                                adminUserId,
                                                                adminEmail,
                                                                "ADMIN_HELPER_LOCK_BOOKING_REVIEW",
                                                                "BOOKING",
                                                                booking.getId(),
                                                                "BLOCKED",
                                                                "Booking đã sát giờ nên không được tự hủy khi khóa helper",
                                                                "{\"bookingStatus\":\"" + booking.getStatus().name()
                                                                                + "\",\"minutesToStart\":" + minutesToStart
                                                                                + "}");
                                                notificationService.createNotification(
                                                                booking.getCustomer().getId(),
                                                                "Đơn hàng cần admin xử lý gấp",
                                                                "Đơn #" + booking.getId()
                                                                                + " đã sát giờ nên chưa thể tự động đổi helper. "
                                                                                + "Đội vận hành sẽ liên hệ ngay.",
                                                                "BOOKING_REVIEW");
                                                notificationService.createNotification(
                                                                helper.getId(),
                                                                "Booking sát giờ cần xử lý vận hành",
                                                                "Đơn #" + booking.getId()
                                                                                + " đã sát giờ nên chưa thể tự động hủy khi khóa tài khoản.",
                                                                "BOOKING_REVIEW");
                                                continue;
                                        }
                                }
                                bookingService.cancelBookingByAdmin(
                                                booking.getId(),
                                                "[AUTO] Helper bị khóa tài khoản: " + lockReason,
                                                adminEmail);
                                reopenRelatedJobPostIfEligible(booking, adminUserId, adminEmail, lockReason);
                                cancelledBookings++;
                                continue;
                        }

                        if (HELPER_LOCK_OPERATIONAL_BOOKING_STATUSES.contains(booking.getStatus())) {
                                pendingOperationalBookings++;
                                booking.setIsFlagged(true);
                                bookingRepository.save(booking);
                                adminAuditLogService.log(
                                                adminUserId,
                                                adminEmail,
                                                "ADMIN_HELPER_LOCK_BOOKING_REVIEW",
                                                "BOOKING",
                                                booking.getId(),
                                                "BLOCKED",
                                                "Booking đã vào giai đoạn thực thi, chuyển xử lý vận hành thay vì hủy tự động",
                                                "{\"bookingStatus\":\"" + booking.getStatus().name() + "\"}");
                                notificationService.createNotification(
                                                booking.getCustomer().getId(),
                                                "Đơn hàng cần xử lý vận hành",
                                                "Đơn #" + booking.getId()
                                                                + " tạm thời không tự hủy vì helper đã vào giai đoạn thực thi. "
                                                                + "Đội vận hành sẽ liên hệ để xử lý theo quy trình.",
                                                "BOOKING_REVIEW");
                                notificationService.createNotification(
                                                helper.getId(),
                                                "Đơn hàng chuyển xử lý vận hành",
                                                "Đơn #" + booking.getId()
                                                                + " không thể tự hủy do đã ở giai đoạn thực thi. "
                                                                + "Vui lòng chờ quyết định từ quản trị viên.",
                                                "BOOKING_REVIEW");
                        }
                }

                // 2) Vô hiệu các đơn ứng tuyển/chờ nhận việc để helper không thể tiếp tục thao tác
                // job feed cũ.
                List<JobApplication> activeApplications = jobApplicationRepository.findByHelperId(helper.getId()).stream()
                                .filter(a -> Arrays.asList("PENDING", "ACCEPTED", "ASSIGNED").contains(a.getStatus()))
                                .collect(Collectors.toList());
                int rejectedApplications = jobApplicationRepository.updateStatusByHelperIdAndStatusIn(
                                helper.getId(),
                                "REJECTED",
                                Arrays.asList("PENDING", "ACCEPTED", "ASSIGNED"));
                if (rejectedApplications > 0) {
                        notificationService.createNotification(
                                        helper.getId(),
                                        "Đã đóng các đơn ứng tuyển",
                                        "Tài khoản helper của bạn đã bị khóa, " + rejectedApplications
                                                        + " đơn ứng tuyển/chờ nhận việc đã được đóng.",
                                        "ACCOUNT_LOCKED");
                }
                activeApplications.stream()
                                .map(JobApplication::getPostId)
                                .distinct()
                                .forEach(postId -> jobPostRepository.findById(postId).ifPresent(post -> notificationService
                                                .createNotification(
                                                                post.getCustomerId(),
                                                                "Helper không còn khả dụng",
                                                                "Một helper trong tin #" + postId
                                                                                + " đã bị khóa tài khoản, hệ thống đã đóng trạng thái ứng tuyển liên quan.",
                                                                "HELPER_LOCKED")));

                log.info(
                                "Đã áp dụng lock nghiệp vụ cho helper {}: hủy {} booking, {} booking chuyển xử lý vận hành, {} booking chặn khóa, reject {} job applications",
                                helper.getId(),
                                cancelledBookings,
                                pendingOperationalBookings,
                                blockingCriticalCases,
                                rejectedApplications);
                return new HelperLockOutcome(cancelledBookings, pendingOperationalBookings, blockingCriticalCases,
                                rejectedApplications);
        }

        private void reopenRelatedJobPostIfEligible(Booking booking, Long adminUserId, String adminEmail, String lockReason) {
                if (booking.getJobPostId() == null) {
                        return;
                }
                jobPostRepository.findById(booking.getJobPostId()).ifPresent(post -> {
                        String status = post.getStatus();
                        if (!"ASSIGNED".equalsIgnoreCase(status) && !"CONFIRMED".equalsIgnoreCase(status)) {
                                return;
                        }
                        post.setStatus("PUBLISHED");
                        post.setModerationReason("[AUTO_REOPEN] Helper bị khóa: " + lockReason);
                        post.setModeratedBy(adminUserId);
                        post.setModeratedAt(LocalDateTime.now());
                        jobPostRepository.save(post);

                        jobApplicationRepository.findByPostIdAndHelperId(post.getPostId(), booking.getHelper().getId())
                                        .ifPresent(app -> {
                                                app.setStatus("CANCELLED");
                                                jobApplicationRepository.save(app);
                                        });

                        notificationService.createNotification(
                                        post.getCustomerId(),
                                        "Tin đăng được mở lại",
                                        "Tin #" + post.getPostId()
                                                        + " được mở lại để tìm helper mới vì helper cũ đã bị khóa tài khoản.",
                                        "JOB_REOPENED");
                        adminAuditLogService.log(
                                        adminUserId,
                                        adminEmail,
                                        "ADMIN_HELPER_LOCK_REOPEN_POST",
                                        "JOB_POST",
                                        post.getPostId(),
                                        "SUCCESS",
                                        "Mở lại tin do helper bị khóa và booking chưa sát giờ",
                                        "{\"previousStatus\":\"" + status + "\"}");
                });
        }

        private static class HelperLockOutcome {
                final int cancelledBookings;
                final int pendingOperationalBookings;
                final int blockingCriticalCases;
                final int rejectedApplications;

                HelperLockOutcome(int cancelledBookings, int pendingOperationalBookings, int blockingCriticalCases,
                                int rejectedApplications) {
                        this.cancelledBookings = cancelledBookings;
                        this.pendingOperationalBookings = pendingOperationalBookings;
                        this.blockingCriticalCases = blockingCriticalCases;
                        this.rejectedApplications = rejectedApplications;
                }
        }

        private void enforceCustomerLockBusinessRules(User customer, String reason, String adminEmail) {
                String lockReason = (reason == null || reason.isBlank())
                                ? "Customer bị khóa tài khoản theo quyết định admin"
                                : reason.trim();
                Long adminUserId = adminAuditLogService.resolveActorIdByEmail(adminEmail);

                List<BookingStatus> candidateStatuses = Arrays.asList(
                                BookingStatus.PENDING,
                                BookingStatus.PENDING_ACCEPTANCE,
                                BookingStatus.CONFIRMED,
                                BookingStatus.ARRIVED,
                                BookingStatus.IN_PROGRESS,
                                BookingStatus.PENDING_COMPLETION);
                List<Booking> customerBookings = bookingRepository.findByCustomer_IdAndStatusIn(customer.getId(),
                                candidateStatuses);
                int cancelledBookings = 0;
                int operationalBookings = 0;

                for (Booking booking : customerBookings) {
                        if (CUSTOMER_LOCK_AUTO_CANCEL_BOOKING_STATUSES.contains(booking.getStatus())) {
                                bookingService.cancelBookingByAdmin(
                                                booking.getId(),
                                                "[AUTO] Customer bị khóa tài khoản: " + lockReason,
                                                adminEmail);
                                cancelledBookings++;
                                continue;
                        }

                        if (CUSTOMER_LOCK_OPERATIONAL_BOOKING_STATUSES.contains(booking.getStatus())) {
                                operationalBookings++;
                                adminAuditLogService.log(
                                                adminUserId,
                                                adminEmail,
                                                "ADMIN_CUSTOMER_LOCK_BOOKING_REVIEW",
                                                "BOOKING",
                                                booking.getId(),
                                                "BLOCKED",
                                                "Booking của customer đã vào giai đoạn thực thi, chuyển xử lý vận hành",
                                                "{\"bookingStatus\":\"" + booking.getStatus().name() + "\"}");
                                notificationService.createNotification(
                                                customer.getId(),
                                                "Đơn hàng cần xử lý vận hành",
                                                "Đơn #" + booking.getId()
                                                                + " của bạn đang ở giai đoạn thực thi nên chưa thể tự động hủy. "
                                                                + "Đội vận hành sẽ liên hệ để xử lý.",
                                                "BOOKING_REVIEW");
                                notificationService.createNotification(
                                                booking.getHelper().getId(),
                                                "Đơn hàng cần xử lý vận hành",
                                                "Đơn #" + booking.getId()
                                                                + " thuộc khách hàng vừa bị khóa tài khoản. "
                                                                + "Đơn sẽ được đội vận hành xử lý theo quy trình.",
                                                "BOOKING_REVIEW");
                        }
                }

                List<JobPost> activePosts = jobPostRepository.findByCustomerIdAndStatusInOrderByCreatedAtDesc(
                                customer.getId(),
                                CUSTOMER_LOCK_AUTO_CANCEL_POST_STATUSES);
                int cancelledPosts = 0;
                int reviewPosts = 0;
                for (JobPost post : activePosts) {
                        try {
                                jobService.cancelJobPostByAdmin(
                                                post.getPostId(),
                                                "[AUTO] Customer bị khóa tài khoản: " + lockReason,
                                                adminEmail);
                                cancelledPosts++;
                        } catch (Exception ex) {
                                reviewPosts++;
                                adminAuditLogService.log(
                                                adminUserId,
                                                adminEmail,
                                                "ADMIN_CUSTOMER_LOCK_JOB_REVIEW",
                                                "JOB_POST",
                                                post.getPostId(),
                                                "BLOCKED",
                                                "Không thể tự động hủy tin khi khóa customer, chuyển xử lý vận hành",
                                                "{\"status\":\"" + post.getStatus() + "\",\"reason\":\""
                                                                + ex.getMessage().replace("\"", "'") + "\"}");
                                notificationService.createNotification(
                                                customer.getId(),
                                                "Tin đăng cần xử lý vận hành",
                                                "Tin #" + post.getPostId()
                                                                + " chưa thể tự động đóng khi khóa tài khoản. "
                                                                + "Đội vận hành sẽ xử lý tiếp.",
                                                "BOOKING_REVIEW");
                                bookingRepository.findTopByJobPostIdOrderByCreatedAtDesc(post.getPostId())
                                                .ifPresent(linkedBooking -> notificationService.createNotification(
                                                                linkedBooking.getHelper().getId(),
                                                                "Tin đăng liên quan cần xử lý vận hành",
                                                                "Tin #" + post.getPostId()
                                                                                + " của khách hàng đã bị khóa tài khoản đang chờ xử lý vận hành.",
                                                                "BOOKING_REVIEW"));
                        }
                }

                log.info(
                                "Đã áp dụng lock nghiệp vụ cho customer {}: hủy {} booking, {} booking chuyển vận hành, đóng {} tin, {} tin chuyển vận hành",
                                customer.getId(),
                                cancelledBookings,
                                operationalBookings,
                                cancelledPosts,
                                reviewPosts);
        }

        // --- Admin: Quản lý tin đăng (Job posts / chợ việc) ---

        @Transactional(readOnly = true)
        public AdminJobPostListResponse getAdminJobPosts(
                        String status,
                        Integer categoryId,
                        LocalDate workDateFrom,
                        LocalDate workDateTo,
                        Long customerId,
                        String search,
                        Pageable pageable) {
                Specification<JobPost> spec = JobPostSpecification.forAdmin(
                                status, categoryId, workDateFrom, workDateTo, customerId, search);
                Page<JobPost> page = jobPostRepository.findAll(spec, pageable);
                List<AdminJobPostListItemResponse> items = page.getContent().stream()
                                .map(this::mapToAdminJobPostListItem)
                                .collect(Collectors.toList());
                return AdminJobPostListResponse.builder()
                                .posts(items)
                                .totalElements(page.getTotalElements())
                                .totalPages(page.getTotalPages())
                                .currentPage(page.getNumber())
                                .pageSize(page.getSize())
                                .message("Danh sách tin đăng")
                                .build();
        }

        @Transactional(readOnly = true)
        public AdminJobPostDetailResponse getAdminJobPostDetail(Long postId) {
                JobPost jobPost = jobPostRepository.findById(postId)
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tin đăng: " + postId));
                User customer = userRepository.findById(jobPost.getCustomerId())
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy khách hàng"));

                List<JobApplication> apps = jobApplicationRepository.findByPostId(postId);
                int pending = (int) apps.stream()
                                .filter(a -> "PENDING".equals(a.getStatus()))
                                .count();

                com.homeconnect.core.dto.response.JobPostResponse postDto = jobService.getJobPostDetailForAdmin(postId);
                Booking linked = bookingRepository.findTopByJobPostIdOrderByCreatedAtDesc(postId).orElse(null);

                return AdminJobPostDetailResponse.builder()
                                .post(postDto)
                                .customerId(customer.getId())
                                .customerName(customer.getFullName())
                                .customerEmail(customer.getEmail())
                                .customerPhone(customer.getPhone())
                                .linkedBookingId(linked != null ? linked.getId() : null)
                                .linkedBookingStatus(linked != null && linked.getStatus() != null
                                                ? linked.getStatus().name()
                                                : null)
                                .applicationCount(apps.size())
                                .pendingApplicationCount(pending)
                                .build();
        }

        private AdminJobPostListItemResponse mapToAdminJobPostListItem(JobPost jp) {
                User c = jp.getCustomer();
                String customerName = c != null ? c.getFullName()
                                : userRepository.findById(jp.getCustomerId()).map(User::getFullName).orElse("—");
                String catName = jp.getCategory() != null ? jp.getCategory().getName() : "—";
                Integer catId = jp.getCategory() != null ? jp.getCategory().getCategoryId() : null;
                String district = jp.getAddress() != null ? jp.getAddress().getDistrictName() : null;
                return AdminJobPostListItemResponse.builder()
                                .postId(jp.getPostId())
                                .customerId(jp.getCustomerId())
                                .customerName(customerName)
                                .title(jp.getTitle())
                                .categoryId(catId)
                                .categoryName(catName)
                                .status(jp.getStatus())
                                .workDate(jp.getWorkDate())
                                .startTime(jp.getStartTime())
                                .offerPrice(jp.getOfferPrice())
                                .districtName(district)
                                .createdAt(jp.getCreatedAt())
                                .build();
        }

        // --- Admin: Quản lý Booking ---

        @Transactional(readOnly = true)
        public AdminBookingListResponse getAdminBookings(BookingStatus status, Boolean flaggedOnly,
                        java.time.LocalDateTime scheduledFrom, java.time.LocalDateTime scheduledTo, String search,
                        Pageable pageable) {
                Specification<Booking> spec = BookingSpecification.forAdmin(status, flaggedOnly, scheduledFrom,
                                scheduledTo, search);
                Page<Booking> page = bookingRepository.findAll(spec, pageable);
                List<AdminBookingListItemResponse> items = page.getContent().stream()
                                .map(this::mapToAdminBookingListItem)
                                .collect(Collectors.toList());
                return AdminBookingListResponse.builder()
                                .bookings(items)
                                .totalElements(page.getTotalElements())
                                .totalPages(page.getTotalPages())
                                .currentPage(page.getNumber())
                                .pageSize(page.getSize())
                                .message("Danh sách booking")
                                .build();
        }

        @Transactional(readOnly = true)
        public AdminFraudAlertListResponse getFraudAlerts(int page, int limit) {
                int boundedLimit = Math.min(Math.max(limit, 1), 100);
                int safePage = Math.max(page, 1);
                Pageable pageable = PageRequest.of(safePage - 1, boundedLimit, Sort.by("createdAt").descending());
                Specification<Booking> spec = BookingSpecification.forAdmin(null, true, null, null, null);
                Page<Booking> resultPage = bookingRepository.findAll(spec, pageable);

                List<AdminFraudAlertItemResponse> items = resultPage.getContent().stream()
                                .map(this::mapToFraudAlertItem)
                                .collect(Collectors.toList());

                return AdminFraudAlertListResponse.builder()
                                .data(items)
                                .totalRecords(resultPage.getTotalElements())
                                .totalPages(resultPage.getTotalPages())
                                .currentPage(safePage)
                                .build();
        }

        @Transactional(readOnly = true)
        public AdminBookingDetailResponse getAdminBookingDetail(Long bookingId) {
                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResourceNotFoundException(
                                                "Không tìm thấy booking: " + bookingId));
                return mapToAdminBookingDetail(booking);
        }

        private AdminBookingListItemResponse mapToAdminBookingListItem(Booking b) {
                return AdminBookingListItemResponse.builder()
                                .bookingId(b.getId())
                                .customerId(b.getCustomer().getId())
                                .customerName(b.getCustomer().getFullName())
                                .helperId(b.getHelper().getId())
                                .helperName(b.getHelper().getFullName())
                                .serviceName(b.getCategory() != null ? b.getCategory().getName() : "—")
                                .status(b.getStatus())
                                .paymentStatus(b.getPaymentStatus())
                                .totalPrice(b.getTotalPrice())
                                .scheduledStartTime(b.getScheduledStartTime())
                                .scheduledEndTime(b.getScheduledEndTime())
                                .isFlagged(b.getIsFlagged())
                                .createdAt(b.getCreatedAt())
                                .build();
        }

        private AdminFraudAlertItemResponse mapToFraudAlertItem(Booking b) {
                return AdminFraudAlertItemResponse.builder()
                                .bookingId(b.getId())
                                .customerName(b.getCustomer() != null ? b.getCustomer().getFullName() : "—")
                                .helperName(b.getHelper() != null ? b.getHelper().getFullName() : "—")
                                .serviceName(b.getCategory() != null ? b.getCategory().getName() : "—")
                                .status(b.getStatus())
                                .totalPrice(b.getTotalPrice())
                                .scheduledStartTime(b.getScheduledStartTime())
                                .createdAt(b.getCreatedAt())
                                .build();
        }

        private AdminBookingDetailResponse mapToAdminBookingDetail(Booking b) {
                Address addr = b.getAddress();
                String formatted = formatAdminBookingAddress(addr);
                String arrival = resolveAdminArrivalProof(b);
                Integer catId = b.getCategory() != null ? b.getCategory().getCategoryId() : null;
                return AdminBookingDetailResponse.builder()
                                .bookingId(b.getId())
                                .jobPostId(b.getJobPostId())
                                .customerId(b.getCustomer().getId())
                                .customerName(b.getCustomer().getFullName())
                                .customerEmail(b.getCustomer().getEmail())
                                .customerPhone(b.getCustomer().getPhone())
                                .helperId(b.getHelper().getId())
                                .helperName(b.getHelper().getFullName())
                                .helperEmail(b.getHelper().getEmail())
                                .helperPhone(b.getHelper().getPhone())
                                .serviceName(b.getCategory() != null ? b.getCategory().getName() : "—")
                                .categoryId(catId)
                                .addressDetail(addr != null ? addr.getAddressDetail() : null)
                                .wardName(addr != null ? addr.getWardName() : null)
                                .districtName(addr != null ? addr.getDistrictName() : null)
                                .provinceName(addr != null ? addr.getProvinceName() : null)
                                .addressFormatted(formatted)
                                .status(b.getStatus())
                                .paymentStatus(b.getPaymentStatus())
                                .totalPrice(b.getTotalPrice())
                                .scheduledStartTime(b.getScheduledStartTime())
                                .scheduledEndTime(b.getScheduledEndTime())
                                .expiredAt(b.getExpiredAt())
                                .arrivedAt(b.getArrivedAt())
                                .arrivalProofImage(arrival)
                                .checkinPhotoUrl(b.getCheckinPhotoUrl())
                                .checkedInAt(b.getCheckedInAt())
                                .customerArrivalConfirmed(b.getCustomerArrivalConfirmed())
                                .customerArrivalConfirmedAt(b.getCustomerArrivalConfirmedAt())
                                .confirmedStartAt(b.getConfirmedStartAt())
                                .checkoutPhotoUrl(b.getCheckoutPhotoUrl())
                                .checkoutReason(b.getCheckoutReason())
                                .checkedOutAt(b.getCheckedOutAt())
                                .confirmedDoneAt(b.getConfirmedDoneAt())
                                .disputeReason(b.getDisputeReason())
                                .evidenceUrl(b.getEvidenceUrl())
                                .disputedAt(b.getDisputedAt())
                                .disputeResolvedAt(b.getDisputeResolvedAt())
                                .disputeResolutionAction(b.getDisputeResolutionAction())
                                .disputeResolvedByAdminId(b.getDisputeResolvedByAdminId())
                                .isFlagged(b.getIsFlagged())
                                .createdAt(b.getCreatedAt())
                                .updatedAt(b.getUpdatedAt())
                                .build();
        }

        private static String formatAdminBookingAddress(Address addr) {
                if (addr == null) {
                        return null;
                }
                return String.format("%s, %s, %s, %s",
                                nz(addr.getAddressDetail()),
                                nz(addr.getWardName()),
                                nz(addr.getDistrictName()),
                                nz(addr.getProvinceName()));
        }

        private static String nz(String s) {
                return s == null ? "" : s;
        }

        private static String resolveAdminArrivalProof(Booking b) {
                if (b.getArrivalProofImage() != null && !b.getArrivalProofImage().isBlank()) {
                        return b.getArrivalProofImage();
                }
                if (b.getCheckinPhotoUrl() != null && !b.getCheckinPhotoUrl().isBlank()) {
                        return b.getCheckinPhotoUrl();
                }
                return null;
        }

        private AdminUserListItemResponse mapToAdminUserListItem(User user) {
                return AdminUserListItemResponse.builder()
                                .userId(user.getId())
                                .fullName(user.getFullName())
                                .email(user.getEmail())
                                .phone(user.getPhone())
                                .role(user.getRole())
                                .status(user.getStatus())
                                .gender(user.getGender())
                                .dateOfBirth(user.getDateOfBirth())
                                .avatarUrl(user.getAvatarUrl())
                                .createdAt(user.getCreatedAt())
                                .updatedAt(user.getUpdatedAt())
                                .build();
        }
}