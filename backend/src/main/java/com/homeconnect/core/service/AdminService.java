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
import com.homeconnect.core.dto.response.admin.AdminJobPostDetailResponse;
import com.homeconnect.core.dto.response.admin.AdminJobPostListItemResponse;
import com.homeconnect.core.dto.response.admin.AdminJobPostListResponse;
import com.homeconnect.core.dto.response.admin.AdminUserDetailResponse;
import com.homeconnect.core.dto.response.admin.AdminUserListItemResponse;
import com.homeconnect.core.dto.response.admin.AdminUserListResponse;
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
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
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

        private final UserRepository userRepository;
        private final HelperProfileRepository helperProfileRepository;
        private final HelperServiceRepository helperServiceRepository;
        private final HelperWorkingDistrictRepository helperWorkingDistrictRepository;
        private final ServiceRepository serviceRepository;
        private final ServiceCategoryRepository serviceCategoryRepository;
        private final AddressRepository addressRepository;
        private final EmailService emailService;
        private final WalletRepository walletRepository;
        private final WalletTransactionRepository walletTransactionRepository;
        private final BookingRepository bookingRepository;
        private final JobPostRepository jobPostRepository;
        private final JobApplicationRepository jobApplicationRepository;
        private final JobService jobService;
        private final WithdrawRequestRepository withdrawRequestRepository;

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
                long blockedUsers = userRepository.countByStatus(UserStatus.BLOCKED);
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
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy user với ID: " + userId));

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
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy user với ID: " + userId));

                if (adminUserId.equals(target.getId())) {
                        throw new BadRequestException("Không thể khóa hoặc thao tác trên chính tài khoản của bạn.");
                }

                boolean wantBlocked = "BLOCKED".equalsIgnoreCase(request.getStatus());
                boolean wantActive = "ACTIVE".equalsIgnoreCase(request.getStatus());

                if (wantBlocked) {
                        if (target.getStatus() == UserStatus.BLOCKED) {
                                log.info("Admin {}: idempotent — user {} đã ở trạng thái BLOCKED", adminEmail, userId);
                                return mapToAdminUserListItem(target);
                        }
                        if (target.getRole() == UserRole.ADMIN && target.getStatus() == UserStatus.ACTIVE) {
                                long activeAdmins = userRepository.countByRoleAndStatus(UserRole.ADMIN,
                                                UserStatus.ACTIVE);
                                if (activeAdmins <= 1) {
                                        throw new BadRequestException(
                                                        "Không thể khóa tài khoản admin cuối cùng đang hoạt động.");
                                }
                        }
                        target.setStatus(UserStatus.BLOCKED);
                } else if (wantActive) {
                        if (target.getStatus() == UserStatus.ACTIVE) {
                                return mapToAdminUserListItem(target);
                        }
                        if (target.getStatus() != UserStatus.BLOCKED) {
                                throw new BadRequestException(
                                                "Chỉ có thể mở khóa (ACTIVE) khi tài khoản đang bị khóa (BLOCKED).");
                        }
                        target.setStatus(UserStatus.ACTIVE);
                }

                userRepository.save(target);
                log.info("Admin {} đã cập nhật status={} cho user id={} (email={}). Ghi chú: {}", adminEmail,
                                target.getStatus(), userId, target.getEmail(), request.getReason());

                return mapToAdminUserListItem(target);
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
        public AdminBookingDetailResponse getAdminBookingDetail(Long bookingId) {
                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy booking: " + bookingId));
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