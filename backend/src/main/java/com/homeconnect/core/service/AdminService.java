package com.homeconnect.core.service;

import com.homeconnect.core.dto.request.BroadcastNotificationRequest;
import com.homeconnect.core.dto.request.HelperReviewRequest;
import com.homeconnect.core.dto.request.admin.CreateServiceRequest;
import com.homeconnect.core.dto.request.admin.UpdateServiceRequest;
import com.homeconnect.core.dto.response.*;
import com.homeconnect.core.dto.response.admin.ServiceResponse;
import com.homeconnect.core.entity.*;
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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
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
    private final AddressRepository addressRepository;
    private final EmailService emailService;


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

                // 4. Kiểm tra trạng thái hiện tại - chỉ cho phép review khi status =
                // WAITING_APPROVAL
                if (helperProfile.getKycStatus() != KycStatus.WAITING_APPROVAL) {
                        throw new BadRequestException("Helper này không ở trạng thái chờ duyệt. Trạng thái hiện tại: " +
                                        helperProfile.getKycStatus().getDisplayName());
                }

                // 5. Cập nhật trạng thái KYC
                KycStatus newStatus = "VERIFIED".equals(request.getAction()) ? KycStatus.VERIFIED : KycStatus.REJECTED;
                helperProfile.setKycStatus(newStatus);

                if (KycStatus.REJECTED.equals(newStatus)) {
                        helperProfile.setRejectionReason(request.getRejectionReason());
                } else {
                        helperProfile.setRejectionReason(null); // Clear rejection reason khi approve
                }

                helperProfile.setUpdatedAt(LocalDateTime.now());

                // 6. Lưu thay đổi
                helperProfileRepository.save(helperProfile);

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
                        return String.format("""
                                        Chào %s,

                                        Rất tiếc, hồ sơ xác thực danh tính của bạn đã không được phê duyệt.

                                        Lý do: %s

                                        Bạn có thể cập nhật lại hồ sơ và nộp lại để được xem xét.

                                        Nếu có thắc mắc, vui lòng liên hệ bộ phận hỗ trợ của chúng tôi.

                                        Trân trọng,
                                        Đội ngũ HomeConnect
                                        """, helperName, rejectionReason != null ? rejectionReason : "Không rõ");
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

                // 4. Lấy danh sách dịch vụ
                List<HelperDetailResponse.ServiceInfo> services = helperServiceRepository.findByHelper_Id(helperId)
                                .stream()
                                .map(hs -> HelperDetailResponse.ServiceInfo.builder()
                                                .serviceId(hs.getService().getServiceId())
                                                .name(hs.getService().getName())
                                                .iconUrl(hs.getService().getIconUrl())
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
                // thống kê user
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

                // Thống kế Helper theo KYC status
                long pendingKyc = helperProfileRepository.countByKycStatus(KycStatus.PENDING);
                long waitingApproval = helperProfileRepository.countByKycStatus(KycStatus.WAITING_APPROVAL);
                long verifiedHelpers = helperProfileRepository.countByKycStatus(KycStatus.VERIFIED);
                long rejectedHelpers = helperProfileRepository.countByKycStatus(KycStatus.REJECTED);

                AdminStatisticsResponse.HelperStats helperStats = AdminStatisticsResponse.HelperStats.builder()
                                .totalHelpers(totalHelpers)
                                .pendingKyc(pendingKyc)
                                .waitingApproval(waitingApproval)
                                .verifiedHelpers(verifiedHelpers)
                                .rejectedHelpers(rejectedHelpers)
                                .build();

                // Thống kê hệ thống: tổng số dịch vụ
                long totalServices = serviceRepository.count();

                AdminStatisticsResponse.SystemStats systemStats = AdminStatisticsResponse.SystemStats.builder()
                                .totalServices(totalServices)
                                .build();

                return AdminStatisticsResponse.builder()
                                .userStats(userStats)
                                .helperStats(helperStats)
                                .systemStats(systemStats)
                                .message("Thống kê hệ thống HomeConnect")
                                .build();
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
                .iconUrl(service.getIconUrl())
                .basePrice(service.getBasePrice())
                .unit(service.getUnit())
                .isActive(service.getIsActive())
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
                String.format("%,d", MIN_SERVICE_PRICE.longValue()) + " VNĐ). Vui lòng kiểm tra lại!");
        }
    }
    /**
     * BE-Admin-01: Lấy thông tin chi tiết của một dịch vụ lẻ
     */
    @Transactional(readOnly = true)
    public ServiceResponse getServiceDetail(Integer serviceId) {
        com.homeconnect.core.entity.Service service = serviceRepository.findById(serviceId)
                .orElseThrow(() -> new BadRequestException("Dịch vụ ID " + serviceId + " không tồn tại"));
        return mapToServiceResponse(service);
    }

    /**
     * BE-Admin-01: Cập nhật thông tin dịch vụ (Patch)
     */
    @Transactional
    public ServiceResponse updateService(Integer serviceId, UpdateServiceRequest request) {
        com.homeconnect.core.entity.Service service = serviceRepository.findById(serviceId)
                .orElseThrow(() -> new BadRequestException("Dịch vụ ID " + serviceId + " không tồn tại"));

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

        if (request.getUnit() != null) {
            service.setUnit(request.getUnit());
        }

        if (request.getIconUrl() != null) {
            service.setIconUrl(request.getIconUrl());
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
        com.homeconnect.core.entity.Service service = com.homeconnect.core.entity.Service.builder()
                .name(request.getName())
                .description(request.getDescription())
                .iconUrl(request.getIconUrl())
                .basePrice(request.getBasePrice())
                .unit(request.getUnit())
                .isActive(request.getIsActive() == null || request.getIsActive())
                .build();

        // 3. Lưu entity
        service = serviceRepository.save(service);

        log.info("Admin đã tạo mới dịch vụ: {} (ID: {})", service.getName(), service.getServiceId());

        // 4. Trả về response
        return mapToServiceResponse(service);
    }

}