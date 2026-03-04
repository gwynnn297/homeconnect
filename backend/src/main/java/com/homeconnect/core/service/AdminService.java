package com.homeconnect.core.service;

import com.homeconnect.core.dto.request.BroadcastNotificationRequest;
import com.homeconnect.core.dto.request.HelperReviewRequest;
import com.homeconnect.core.dto.request.admin.CreateCategoryRequest;
import com.homeconnect.core.dto.request.admin.CreateServiceRequest;
import com.homeconnect.core.dto.request.admin.UpdateCategoryRequest;
import com.homeconnect.core.dto.request.admin.UpdateServiceRequest;
import com.homeconnect.core.dto.response.*;
import com.homeconnect.core.dto.response.admin.ServiceCategoryResponse;
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
    private final LocationRepository locationRepository;
    private final AddressRepository addressRepository;
    private final EmailService emailService;

    /**
     * BE-Admin-02: Helper Approval Workflow
     * Review KYC của Helper - Approve hoặc Reject
     */
    @Transactional
    public HelperReviewResponse reviewHelperKyc(Long helperId, HelperReviewRequest request, String adminEmail) {

        // 1. Validate request
        if (!request.isValid()) {
            throw new BadRequestException("Lý do từ chối bắt buộc khi action = REJECTED");
        }

        // 2. Tìm User với role HELPER
        User helper = userRepository.findById(helperId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy Helper với ID: " + helperId));

        // Kiểm tra User có phải là Helper không
        if (!"HELPER".equals(helper.getRole().name())) {
            throw new BadRequestException(
                    "User ID " + helperId + " không phải là Helper. Role: " + helper.getRole().name());
        }

        // 3. Tìm HelperProfile
        HelperProfile helperProfile = helperProfileRepository.findByUser_Id(helperId)
                .orElseThrow(
                        () -> new ResourceNotFoundException("Không tìm thấy hồ sơ Helper cho User ID: " + helperId));

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
            return String.format("""
                    Chào %s,

                    Chúc mừng! Hồ sơ xác thực danh tính của bạn đã được phê duyệt thành công.

                    Bạn có thể bắt đầu nhận việc và kiếm tiền trên ứng dụng HomeConnect ngay bây giờ.

                    Cảm ơn bạn đã tin tưởng và sử dụng HomeConnect!

                    Trân trọng,
                    Đội ngũ HomeConnect
                    """, helperName);
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

        List<HelperListItemResponse> helpers = helperPage.getContent().stream()
                .map(this::mapToHelperListItem)
                .collect(Collectors.toList());

        String message = status != null ? String.format("Danh sách Helper với trạng thái %s", status.getDisplayName())
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
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy Helper với ID: " + helperId));

        if (helper.getRole() != UserRole.HELPER) {
            throw new BadRequestException("User ID " + helperId + " không phải là Helper");
        }

        // 2. Tìm HelperProfile
        HelperProfile helperProfile = helperProfileRepository.findByUser_Id(helperId)
                .orElseThrow(
                        () -> new ResourceNotFoundException("Không tìm thấy hồ sơ Helper cho User ID: " + helperId));

        // 3. Lấy danh sách dịch vụ
        List<HelperDetailResponse.ServiceInfo> services = helperServiceRepository.findByHelper_Id(helperId)
                .stream()
                .map(hs -> HelperDetailResponse.ServiceInfo.builder()
                        .serviceId(hs.getService().getServiceId())
                        .name(hs.getService().getName())
                        .iconUrl(hs.getService().getIconUrl())
                        .build())
                .collect(Collectors.toList());

        // 4. Lấy danh sách khu vực làm việc
        List<HelperDetailResponse.DistrictInfo> workingDistricts = helperWorkingDistrictRepository
                .findByHelper_Id(helperId)
                .stream()
                .map(hwd -> HelperDetailResponse.DistrictInfo.builder()
                        .locationId(hwd.getLocation().getLocationId())
                        .name(hwd.getLocation().getName())
                        .build())
                .collect(Collectors.toList());

        // 5. Build response
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
                .dateOfBirth(helper.getDateOfBirth())
                .addressDetail(addressRepository.findByUser_IdAndIsDefaultTrue(helperId)
                        .map(Address::getAddressDetail).orElse(null))

                // Location
                .hometown(helperProfile.getHometown() != null ? HelperDetailResponse.LocationInfo.builder()
                        .locationId(helperProfile.getHometown().getLocationId())
                        .name(helperProfile.getHometown().getName())
                        .type(helperProfile.getHometown().getType().name())
                        .build() : null)
                .currentCity(addressRepository.findByUser_IdAndIsDefaultTrue(helperId)
                        .map(Address::getProvince)
                        .map(p -> HelperDetailResponse.LocationInfo.builder()
                                .locationId(p.getLocationId())
                                .name(p.getName())
                                .type(p.getType().name())
                                .build()).orElse(null))

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

        // Thống kê hệ thống: tổng số dịch vụ, tổng số khu vực
        long totalServices = serviceRepository.count();
        long totalLocations = locationRepository.count();

        AdminStatisticsResponse.SystemStats systemStats = AdminStatisticsResponse.SystemStats.builder()
                .totalServices(totalServices)
                .totalLocations(totalLocations)
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
                emailService.sendSimpleMessage(user.getEmail(), request.getTitle(), request.getMessage());
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
     * BE-Admin-01: Lấy danh sách danh mục dịch vụ
     * Dùng cho Admin chọn khi tạo mới Service
     */
    @Transactional(readOnly = true)
    public List<ServiceCategoryResponse> getServiceCategories() {
        return serviceCategoryRepository.findAll().stream()
                .filter(ServiceCategory::getIsActive)
                .map(cat -> ServiceCategoryResponse.builder()
                        .categoryId(cat.getCategoryId())
                        .name(cat.getName())
                        .iconUrl(cat.getIconUrl())
                        .build())
                .collect(Collectors.toList());
    }

    /**
     * BE-Admin-01: Tạo Danh mục lớn cùng với các dịch vụ nhỏ (nếu có)
     */
    @Transactional
    public ServiceCategoryResponse createCategoryWithServices(CreateCategoryRequest request) {
        // 1. Kiểm tra tên danh mục duy nhất
        if (serviceCategoryRepository.existsByName(request.getName())) {
            throw new BadRequestException("Tên danh mục '" + request.getName() + "' đã tồn tại");
        }

        // 2. Tạo Category
        ServiceCategory category = serviceCategoryRepository.save(ServiceCategory.builder()
                .name(request.getName())
                .iconUrl(request.getIconUrl())
                .isActive(true)
                .build());

        // 3. Kiểm tra trùng lặp dịch vụ (trong Request và trong DB)
        if (request.getServices() != null && !request.getServices().isEmpty()) {
            // Kiểm tra trùng lặp ngay trong chính danh sách gửi lên
            java.util.Set<String> serviceNamesInRequest = new java.util.HashSet<>();
            for (var item : request.getServices()) {
                if (!serviceNamesInRequest.add(item.getName().toLowerCase())) {
                    throw new BadRequestException("Tên dịch vụ '" + item.getName() + "' bị trùng lặp trong danh sách gửi lên");
                }
                
                if (serviceRepository.existsByName(item.getName())) {
                    throw new BadRequestException("Dịch vụ '" + item.getName() + "' đã tồn tại trong hệ thống");
                }

                validateServicePrice(item.getBasePrice());
            }

            // 4. Lưu các dịch vụ nhỏ
            for (var item : request.getServices()) {
                serviceRepository.save(com.homeconnect.core.entity.Service.builder()
                        .category(category)
                        .name(item.getName())
                        .basePrice(item.getBasePrice())
                        .unit(item.getUnit())
                        .iconUrl(item.getIconUrl())
                        .description(item.getDescription())
                        .isActive(item.getIsActive() == null || item.getIsActive())
                        .build());
            }
        }

        return ServiceCategoryResponse.builder()
                .categoryId(category.getCategoryId())
                .name(category.getName())
                .iconUrl(category.getIconUrl())
                .build();
    }

    /**
     * BE-Admin-01: Cập nhật thông tin danh mục lớn
     */
    @Transactional
    public ServiceCategoryResponse updateCategory(Integer id, UpdateCategoryRequest request) {
        ServiceCategory category = serviceCategoryRepository.findById(id)
                .orElseThrow(() -> new BadRequestException("Danh mục không tồn tại"));

        if (request.getName() != null && !request.getName().isBlank()) {
            if (!category.getName().equals(request.getName()) && serviceCategoryRepository.existsByName(request.getName())) {
                throw new BadRequestException("Tên danh mục đã tồn tại");
            }
            category.setName(request.getName());
        }

        if (request.getIconUrl() != null) {
            category.setIconUrl(request.getIconUrl());
        }

        if (request.getIsActive() != null) {
            category.setIsActive(request.getIsActive());
        }

        serviceCategoryRepository.save(category);

        return ServiceCategoryResponse.builder()
                .categoryId(category.getCategoryId())
                .name(category.getName())
                .iconUrl(category.getIconUrl())
                .build();
    }

    /**
     * BE-Admin-01: Xóa danh mục lớn
     * Lưu ý: Trong thực tế thường dùng Soft Delete (is_active = false)
     * Nhưng ở đây triển khai Hard Delete theo yêu cầu quản trị.
     */
    @Transactional
    public void deleteCategory(Integer id) {
        ServiceCategory category = serviceCategoryRepository.findById(id)
                .orElseThrow(() -> new BadRequestException("Danh mục không tồn tại"));
        
        // Nhờ CascadeType.ALL và orphanRemoval=true, các service con sẽ tự động bị xóa
        serviceCategoryRepository.delete(category);
    }

    /**
     * BE-Admin-01: Lấy danh sách dịch vụ nhỏ trong một danh mục lớn
     */
    @Transactional(readOnly = true)
    public List<ServiceResponse> getServicesByCategory(Integer categoryId) {
        if (!serviceCategoryRepository.existsById(categoryId)) {
            throw new BadRequestException("Danh mục ID " + categoryId + " không tồn tại");
        }
        return serviceRepository.findByCategoryCategoryId(categoryId).stream()
                .map(this::mapToServiceResponse)
                .collect(Collectors.toList());
    }

    private ServiceResponse mapToServiceResponse(com.homeconnect.core.entity.Service service) {
        return ServiceResponse.builder()
                .serviceId(service.getServiceId())
                .name(service.getName())
                .categoryId(service.getCategory().getCategoryId())
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

        // 2. Tìm danh mục dịch vụ
        ServiceCategory category = serviceCategoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy danh mục dịch vụ với ID: " + request.getCategoryId()));

        // 3. Map DTO sang Entity
        com.homeconnect.core.entity.Service service = com.homeconnect.core.entity.Service.builder()
                .name(request.getName())
                .category(category)
                .description(request.getDescription())
                .iconUrl(request.getIconUrl())
                .basePrice(request.getBasePrice())
                .unit(request.getUnit())
                .isActive(request.getIsActive() == null || request.getIsActive())
                .build();

        // 4. Lưu entity
        service = serviceRepository.save(service);

        log.info("Admin đã tạo mới dịch vụ: {} (ID: {})", service.getName(), service.getServiceId());

        // 5. Trả về response
        return ServiceResponse.builder()
                .serviceId(service.getServiceId())
                .name(service.getName())
                .description(service.getDescription())
                .iconUrl(service.getIconUrl())
                .basePrice(service.getBasePrice())
                .unit(service.getUnit())
                .categoryName(category.getName())
                .isActive(service.getIsActive())
                .createdAt(service.getCreatedAt())
                .build();
    }

    /**
     * Helper method: Map HelperProfile sang HelperListItemResponse
     */
    private HelperListItemResponse mapToHelperListItem(HelperProfile helperProfile) {
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
                .dateOfBirth(helper.getDateOfBirth())

                .currentCityName(addressRepository.findByUser_IdAndIsDefaultTrue(helper.getId())
                        .map(Address::getProvince)
                        .map(Location::getName).orElse(null))

                .experienceYears(helperProfile.getExperienceYears())
                .bio(helperProfile.getBio())

                .totalServices((int) totalServices)
                .totalWorkingDistricts((int) totalWorkingDistricts)

                .createdAt(helper.getCreatedAt())
                .updatedAt(helperProfile.getUpdatedAt())
                .build();
    }
}