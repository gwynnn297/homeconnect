package com.homeconnect.core.service;

import com.homeconnect.core.socket.SocketIOService;
import com.homeconnect.core.dto.request.CreateJobPostRequest;
import com.homeconnect.core.dto.request.EstimatePriceRequest;
import com.homeconnect.core.dto.response.EstimatePriceResponse;
import com.homeconnect.core.dto.request.UpdateJobPostRequest;
import com.homeconnect.core.dto.response.JobApplicationStatusResponse;
import com.homeconnect.core.dto.response.JobPostResponse;
import com.homeconnect.core.entity.Address;
import com.homeconnect.core.entity.Booking;
import com.homeconnect.core.entity.JobPost;
import com.homeconnect.core.entity.JobPostEditLog;
import com.homeconnect.core.event.JobPostCreatedEvent;
import com.homeconnect.core.repository.JobPostRepository;
import com.homeconnect.core.repository.BookingRepository;
import com.homeconnect.core.repository.ServiceRepository;
import com.homeconnect.core.repository.JobApplicationRepository;
import com.homeconnect.core.repository.HelperScheduleRepository;
import com.homeconnect.core.repository.HelperServiceRepository;
import com.homeconnect.core.repository.HelperWorkingDistrictRepository;
import com.homeconnect.core.repository.JobPostEditLogRepository;
import com.homeconnect.core.repository.ServiceCategoryRepository;
import com.homeconnect.core.repository.UserRepository;
import com.homeconnect.core.entity.ServiceCategory;
import com.homeconnect.core.repository.AddressRepository;
import com.homeconnect.core.entity.JobApplication;
import java.util.stream.Collectors;
import java.util.Optional;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;

import com.homeconnect.core.exception.ApiException;
import com.homeconnect.core.enums.BookingStatus;
import com.homeconnect.core.enums.CustomerTier;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Collections;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.HashMap;
import java.util.Objects;
import java.util.regex.Pattern;

/**
 * Service layer cho Job Posts - BE-Post-01 & BE-Post-02
 * Xử lý logic business cho job posting, estimate pricing và hold money
 */
@Slf4j
@org.springframework.stereotype.Service
@RequiredArgsConstructor
public class JobService {

    private static final int MIN_LEAD_TIME_HOURS = 2;
    /** Danh mục 1 — Dọn dẹp nhà: thời lượng job (tính phí) tối đa */
    private static final int MAX_CLEANING_DURATION_HOURS = 4;
    /**
     * Mỗi dịch vụ con cộng thêm 1 giờ vào thời lượng làm việc (thợ cần thêm thời
     * gian)
     */
    private static final int HOURS_PER_SUB_SERVICE = 1;
    private static final int MAX_POSTS_PER_DAY = 10;
    private static final Pattern PHONE_PATTERN = Pattern.compile("(\\+?84|0)\\d{9,10}");
    private static final Pattern CONTACT_BYPASS_PATTERN = Pattern.compile("\\b(zalo|facebook|fb|telegram)\\b",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern GIBBERISH_PATTERN = Pattern.compile("^(.)\\1{5,}$");
    private static final List<BookingStatus> ADMIN_JOB_POST_CANCEL_ALLOWED_BOOKING_STATUSES = List.of(
            BookingStatus.PENDING,
            BookingStatus.PENDING_ACCEPTANCE,
            BookingStatus.CONFIRMED);

    private final ServiceRepository serviceRepository;
    private final JobPostRepository jobPostRepository;
    private final HelperServiceRepository helperServiceRepository;
    private final HelperWorkingDistrictRepository helperWorkingDistrictRepository;
    private final JobApplicationRepository jobApplicationRepository;
    private final ServiceCategoryRepository serviceCategoryRepository;
    private final UserRepository userRepository;
    private final WalletService walletService;
    private final LoyaltyService loyaltyService;
    private final AddressRepository addressRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final NotificationService notificationService;
    private final HelperScheduleRepository helperScheduleRepository;
    private final BookingRepository bookingRepository;
    private final BookingService bookingService;
    private final ObjectMapper objectMapper;
    private final JobPostEditLogRepository jobPostEditLogRepository;
    private final AdminAuditLogService adminAuditLogService;
    private final SocketIOService socketIOService;

    public EstimatePriceResponse estimatePrice(EstimatePriceRequest request) {
        log.info("Estimating price for category {}, duration {} hours",
                request.getCategoryId(), request.getDurationHours());

        validateWorkSizeAndDuration(request.getCategoryId(), request.getDurationHours(), request.getWorkSize());
        validateCleaningMaxDuration(request.getCategoryId(), request.getDurationHours());

        ServiceCategory category = serviceCategoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Không tìm thấy danh mục dịch vụ với ID: " + request.getCategoryId()));

        if (!Boolean.TRUE.equals(category.getIsActive())) {
            throw new IllegalArgumentException("Danh mục này hiện không khả dụng: " + category.getName());
        }

        if (request.getServiceIds() != null && !request.getServiceIds().isEmpty()) {
            for (Integer sId : request.getServiceIds()) {
                serviceRepository.findById(sId)
                        .orElseThrow(() -> new ApiException("Dịch vụ con " + sId + " không tồn tại",
                                HttpStatus.BAD_REQUEST));
            }
        }

        // --- 1. Tính toán Breakdown ---
        BigDecimal baseLaborPrice_Unit = category.getBasePrice();
        int subServiceCount = (request.getServiceIds() != null) ? request.getServiceIds().size() : 0;

        // baseDurationHours là số giờ gốc của gói (không bao gồm giờ cộng thêm của dịch
        // vụ con)
        int totalDuration = request.getDurationHours() + (subServiceCount * HOURS_PER_SUB_SERVICE);
        BigDecimal finalBasePrice = baseLaborPrice_Unit.multiply(BigDecimal.valueOf(request.getDurationHours()));

        List<EstimatePriceResponse.ServiceFee> serviceFees = new ArrayList<>();
        if (request.getServiceIds() != null) {
            for (Integer sId : request.getServiceIds()) {
                com.homeconnect.core.entity.Service service = serviceRepository.findById(sId).orElse(null);
                if (service != null && service.getBasePrice() != null) {
                    serviceFees.add(EstimatePriceResponse.ServiceFee.builder()
                            .name(service.getName())
                            .price(service.getBasePrice())
                            .build());
                }
            }
        }

        BigDecimal finalEstimatedPrice = calculatePriceInternal(
                category,
                request.getDurationHours(),
                request.getServiceIds(),
                request.getWorkSize(),
                request.getAdditionalData());

        log.info("Estimated price: {} VND (Base: {}, Fees: {})", finalEstimatedPrice, finalBasePrice,
                serviceFees.size());

        return EstimatePriceResponse.builder()
                .estimatedPrice(finalEstimatedPrice)
                .basePrice(finalBasePrice)
                .totalDuration(totalDuration)
                .serviceFees(serviceFees)
                .currency("VND")
                .build();
    }

    @Transactional
    public JobPostResponse createJobPost(CreateJobPostRequest request, Long customerId) {
        log.info("Creating job post for customer {}, services {}, {} hours",
                customerId, request.getServiceIds(), request.getDurationHours());
        enforceJobPostingRateLimit(customerId);
        validatePostContentForModeration(request.getTitle(), request.getDescription());

        LocalDateTime requestedWorkDateTime = request.getWorkDate().atTime(request.getStartTime());
        LocalDateTime minAllowedDateTime = LocalDateTime.now().plusHours(MIN_LEAD_TIME_HOURS);
        if (requestedWorkDateTime.isBefore(minAllowedDateTime)) {
            throw new IllegalArgumentException(
                    "Thời gian làm việc phải đặt trước tối thiểu " + MIN_LEAD_TIME_HOURS + " tiếng");
        }

        // --- 1. Xử lý Địa chỉ (Bắt buộc chọn từ danh sách đã lưu) ---
        com.homeconnect.core.entity.Address savedAddress = addressRepository.findById(request.getAddressId())
                .orElseThrow(() -> new ApiException("Địa chỉ không tồn tại", HttpStatus.BAD_REQUEST));

        if (!savedAddress.getUser().getId().equals(customerId)) {
            throw new ApiException("Địa chỉ không thuộc về bạn", HttpStatus.FORBIDDEN);
        }

        // --- 2. Tính giá (Pricing Logic) ---
        ServiceCategory category = serviceCategoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Không tìm thấy danh mục dịch vụ với ID: " + request.getCategoryId()));

        if (!Boolean.TRUE.equals(category.getIsActive())) {
            throw new IllegalArgumentException("Danh mục này hiện không khả dụng: " + category.getName());
        }

        validateWorkSizeAndDuration(request.getCategoryId(), request.getDurationHours(), request.getWorkSize());
        validateCleaningMaxDuration(request.getCategoryId(), request.getDurationHours());

        java.util.List<Integer> sIds = request.getServiceIds();
        int subServiceCount = (sIds != null) ? sIds.size() : 0;
        int totalDuration = request.getDurationHours() + (subServiceCount * HOURS_PER_SUB_SERVICE);

        // --- NEW: Sử dụng logic tính tiền chung (Dựa trên số giờ GỐC khách chọn) ---
        BigDecimal originalPrice = calculatePriceInternal(
                category,
                request.getDurationHours(),
                request.getServiceIds(),
                request.getWorkSize(),
                request.getAdditionalData());
        userRepository.findById(customerId)
                .orElseThrow(() -> new ApiException("Khách hàng không tồn tại", HttpStatus.NOT_FOUND));
        int monthlyCompletedCount = (int) loyaltyService.getMonthlyCompletedCount(customerId);
        CustomerTier customerTier = loyaltyService.resolveTierByCompletedCount(monthlyCompletedCount);
        BigDecimal discountRate = loyaltyService.resolveDiscountRate(customerTier);
        BigDecimal discountAmount = originalPrice.multiply(discountRate).setScale(2, java.math.RoundingMode.HALF_UP);
        BigDecimal finalPrice = originalPrice.subtract(discountAmount).setScale(2, java.math.RoundingMode.HALF_UP);

        StringBuilder serviceNames = new StringBuilder();
        String serviceIdStr = null;

        if (sIds != null && !sIds.isEmpty()) {
            serviceIdStr = sIds.stream().map(String::valueOf).collect(java.util.stream.Collectors.joining(","));
            for (Integer sId : sIds) {
                com.homeconnect.core.entity.Service service = serviceRepository.findById(sId)
                        .orElseThrow(() -> new ApiException("Dịch vụ con " + sId + " không tồn tại",
                                HttpStatus.BAD_REQUEST));

                if (serviceNames.length() > 0)
                    serviceNames.append(", ");
                serviceNames.append(service.getName());
            }
        }

        // --- 3. Tạo JobPost ---
        JobPost jobPost = JobPost.builder()
                .customerId(customerId)
                .serviceId(serviceIdStr)
                .category(category)
                .title(request.getTitle() != null ? request.getTitle()
                        : "Cần " + (serviceNames.length() > 0 ? serviceNames.toString() : category.getName()) +
                                (com.homeconnect.core.enums.ServiceUnit.PER_SERVICE.equals(category.getUnit()) ? ""
                                        : " - " + totalDuration + " giờ"))
                .description(request.getDescription())
                .address(savedAddress)
                .workDate(request.getWorkDate())
                .startTime(request.getStartTime())
                .durationHours(totalDuration)
                .offerPrice(finalPrice)
                .status("PUBLISHED")
                .moderationStatus("APPROVED")
                .expiresAt(LocalDateTime.now().plusDays(3))
                .lastValidatedAt(LocalDateTime.now())
                .workSize(request.getWorkSize())
                .build();

        // Xử lý additionalData: Lưu kèm snapshot loyalty để booking có thể kế thừa
        Map<String, Object> additionalData = request.getAdditionalData() != null
                ? new HashMap<>(request.getAdditionalData())
                : new HashMap<>();
        additionalData.put("loyaltyOriginalPrice", originalPrice);
        additionalData.put("loyaltyDiscountRate", discountRate);
        additionalData.put("loyaltyDiscountAmount", discountAmount);
        additionalData.put("loyaltyFinalPrice", finalPrice);
        additionalData.put("loyaltyTierAtBooking", customerTier.name());
        additionalData.put("isVipCustomer", customerTier == CustomerTier.GOLD);
        jobPost.setAdditionalData(serializeAdditionalData(additionalData));
        jobPost.setModerationStatus("APPROVED");
        jobPost.setModerationFlags("");
        jobPost.setLastValidatedAt(LocalDateTime.now());

        jobPost = jobPostRepository.save(jobPost);

        // --- 4. Giữ tiền (nằm trong @Transactional, nếu lỗi sẽ tự rollback cả bước lưu
        // JobPost) ---
        walletService.holdMoney(customerId, finalPrice, jobPost.getPostId(), null);

        // --- 5. Publish event thông báo ---
        eventPublisher.publishEvent(new JobPostCreatedEvent(jobPost.getPostId()));

        // --- 6. Real-time update: Thông báo cho các helper tiềm năng
        socketIOService.broadcast("new_job_available", toSocketJobAvailablePayload(jobPost));

        return mapToJobPostResponse(jobPost, true);
    }

    // REMOVED autoSaveAddress (unused)

    @Transactional(readOnly = true)
    public List<JobPostResponse> getHelperJobFeed(Long helperId) {
        List<Integer> categoryIds = helperServiceRepository.findByHelper_Id(helperId).stream()
                .map(hs -> hs.getCategory().getCategoryId())
                .collect(Collectors.toList());

        List<String> helperDistricts = helperWorkingDistrictRepository.findByHelper_Id(helperId).stream()
                .map(com.homeconnect.core.entity.HelperWorkingDistrict::getDistrictName)
                .map(this::normalizeLocationText)
                .collect(Collectors.toList());

        if (categoryIds.isEmpty() || helperDistricts.isEmpty()) {
            return Collections.emptyList();
        }

        List<JobPost> activeJobs = jobPostRepository
                .findActiveJobPosts(java.time.LocalDate.now(), java.time.LocalTime.now(), java.time.LocalDateTime.now()).stream()
                .filter(jp -> jp.getCategory() != null && categoryIds.contains(jp.getCategory().getCategoryId()))
                .filter(jp -> !jobApplicationRepository.existsByPostIdAndHelperIdAndTypeAndStatusIn(jp.getPostId(),
                        helperId, "APPLIED", List.of("PENDING", "ACCEPTED", "ASSIGNED")))
                .collect(Collectors.toList());

        return activeJobs.stream()
                .filter(jp -> {
                    // 1. Lọc theo Quận (Sử dụng equals để tránh nhầm Quận 1/12)
                    String jobDistrict = jp.getAddress() != null
                            ? normalizeLocationText(jp.getAddress().getDistrictName())
                            : "";
                    boolean districtMatch = helperDistricts.stream().anyMatch(hd -> jobDistrict.equals(hd));
                    if (!districtMatch)
                        return false;

                    // 2. Lọc theo Lịch rảnh (Phải có slot AVAILABLE bao trùm Job)
                    int duration = (jp.getDurationHours() != null && jp.getDurationHours() > 0) ? jp.getDurationHours()
                            : 1;
                    long durationSecs = (long) duration * 3600;
                    long availableCount = helperScheduleRepository.countAvailableSchedules(
                            helperId,
                            jp.getWorkDate(),
                            jp.getStartTime(),
                            durationSecs);
                    return availableCount > 0;
                })
                .sorted(java.util.Comparator.comparing((JobPost jp) -> isVipCustomer(jp)).reversed()
                        .thenComparing(JobPost::getCreatedAt,
                                java.util.Comparator.nullsLast(java.util.Comparator.reverseOrder())))
                .map(jp -> mapToJobPostResponse(jp, false))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<JobPostResponse> getAllPublishedJobs(Long helperId) {
        List<String> helperDistricts = getNormalizedHelperDistricts(helperId);
        if (helperDistricts.isEmpty()) {
            return Collections.emptyList();
        }

        // Lấy tất cả các việc đang OPEN (PUBLISHED) trong khu vực helper đã đăng ký.
        return jobPostRepository.findActiveJobPosts(java.time.LocalDate.now(), java.time.LocalTime.now(), java.time.LocalDateTime.now()).stream()
                .filter(jp -> !jobApplicationRepository.existsByPostIdAndHelperIdAndTypeAndStatusIn(jp.getPostId(),
                        helperId, "APPLIED", List.of("PENDING", "ACCEPTED", "ASSIGNED")))
                .filter(jp -> isJobInRegisteredDistrict(jp, helperDistricts))
                .sorted(java.util.Comparator.comparing((JobPost jp) -> isVipCustomer(jp)).reversed()
                        .thenComparing(JobPost::getCreatedAt,
                                java.util.Comparator.nullsLast(java.util.Comparator.reverseOrder())))
                .map(jp -> mapToJobPostResponse(jp, false))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<JobPostResponse> getHelperJobsByTab(Long helperId, String tab) {
        String normalizedTab = tab == null ? "NEW" : tab.trim().toUpperCase();

        // Tab NEW phải khớp điều kiện ứng tuyển: quận + danh mục + lịch AVAILABLE (giống applyForJob).
        // Không dùng getAllPublishedJobs — tránh hiện việc mà thợ không có slot vẫn bị API từ chối.
        if ("NEW".equals(normalizedTab)) {
            return getHelperJobFeed(helperId);
        }

        List<String> applicationStatuses = switch (normalizedTab) {
            case "PENDING" -> List.of("PENDING");
            case "CONFIRMED" -> List.of("ACCEPTED", "ASSIGNED");
            default -> throw new ApiException("Tab không hợp lệ: " + normalizedTab, HttpStatus.BAD_REQUEST);
        };

        List<JobApplication> applications = jobApplicationRepository
                .findByHelperIdAndStatusInOrderByCreatedAtDesc(helperId, applicationStatuses);

        if (applications.isEmpty()) {
            return Collections.emptyList();
        }

        LinkedHashSet<Long> orderedPostIds = applications.stream()
                .map(JobApplication::getPostId)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        if (orderedPostIds.isEmpty()) {
            return Collections.emptyList();
        }

        List<JobPost> posts = jobPostRepository.findByPostIdInOrderByCreatedAtDesc(orderedPostIds);
        Map<Long, JobPost> postById = new HashMap<>();
        for (JobPost post : posts) {
            postById.put(post.getPostId(), post);
        }

        Map<Long, Booking> bookingByPostIdMutable = Collections.emptyMap();
        if ("CONFIRMED".equals(normalizedTab)) {
            List<Booking> bookings = bookingRepository.findByHelper_IdAndJobPostIdInAndStatusInOrderByCreatedAtDesc(
                    helperId,
                    new ArrayList<>(orderedPostIds),
                    List.of(BookingStatus.CONFIRMED, BookingStatus.ARRIVED, BookingStatus.IN_PROGRESS,
                            BookingStatus.PENDING_COMPLETION, BookingStatus.COMPLETED, BookingStatus.DISPUTED,
                            BookingStatus.RESOLVED, BookingStatus.CANCELLED, BookingStatus.EXPIRED));

            Map<Long, Booking> map = new HashMap<>();
            for (Booking booking : bookings) {
                if (booking.getJobPostId() != null && !map.containsKey(booking.getJobPostId())) {
                    map.put(booking.getJobPostId(), booking);
                }
            }
            bookingByPostIdMutable = map;
        }

        final Map<Long, Booking> bookingByPostId = bookingByPostIdMutable;

        final boolean revealAddress = "CONFIRMED".equals(normalizedTab);
        return orderedPostIds.stream()
                .map(postById::get)
                .filter(Objects::nonNull)
                .map(jp -> mapToJobPostResponse(jp, revealAddress, bookingByPostId.get(jp.getPostId())))
                .collect(Collectors.toList());
    }

    @Transactional
    public void applyForJob(Long jobId, Long helperId) {
        JobPost jobPost = jobPostRepository.findById(jobId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy tin đăng việc với ID: " + jobId));

        if (!"PUBLISHED".equals(jobPost.getStatus())) {
            throw new IllegalStateException("Tin này hiện không cho phép ứng tuyển");
        }

        Optional<com.homeconnect.core.entity.JobApplication> existingApp = jobApplicationRepository
                .findByPostIdAndHelperId(jobId, helperId);
        if (existingApp.isPresent()) {
            com.homeconnect.core.entity.JobApplication app = existingApp.get();

            // Nếu đã ứng tuyển rồi (loại APPLIED)
            if ("APPLIED".equals(app.getType())) {
                throw new IllegalStateException("Bạn đã ứng tuyển công việc này rồi");
            }

            // Nếu là lời mời (loại INVITED)
            if ("INVITED".equals(app.getType())) {
                // Kiểm tra lịch rảnh TRỰC TIẾP trước khi chấp nhận lời mời (Chắc ăn hơn)
                validateHelperAvailability(jobPost, helperId);

                // Chuyển thành APPLIED (Chấp nhận lời mời)
                app.setType("APPLIED");
                app.setStatus("PENDING");
                jobApplicationRepository.save(app);

                notifyCustomerHelperApplied(jobPost, helperId);
                return;
            }
        }

        // --- Ràng buộc mới: Phải có lịch rảnh (AVAILABLE) mới được ứng tuyển ---
        validateHelperAvailability(jobPost, helperId);

        // --- Ràng buộc: Phải làm việc tại Quận/Huyện của công việc ---
        validateJobDistrict(jobPost, helperId);

        // --- Ràng buộc: Phải có kỹ năng phù hợp với danh mục công việc ---
        validateHelperService(jobPost, helperId);

        // Tạo application mới nếu chưa tồn tại bất kỳ loại nào

        com.homeconnect.core.entity.JobApplication application = com.homeconnect.core.entity.JobApplication.builder()
                .postId(jobId)
                .helperId(helperId)
                .type("APPLIED")
                .status("PENDING")
                .build();
        jobApplicationRepository.save(application);

        notifyCustomerHelperApplied(jobPost, helperId);
    }

    /**
     * Khách hàng nhận thông báo trong DB + chuông (new_notification) và tin nhắn riêng new_job_application.
     * Socket gửi sau {@code afterCommit} để tránh khách refetch sớm trước khi application đã commit.
     */
    private void notifyCustomerHelperApplied(JobPost jobPost, Long helperId) {
        Long customerId = jobPost.getCustomerId();
        if (customerId == null) {
            return;
        }

        String helperDisplay = userRepository.findById(helperId)
                .map(u -> {
                    if (u.getFullName() != null && !u.getFullName().isBlank()) {
                        return u.getFullName();
                    }
                    return "Thợ #" + helperId;
                })
                .orElse("Thợ #" + helperId);

        String title = jobPost.getTitle() != null ? jobPost.getTitle() : "Việc nhà";

        notificationService.createNotification(
                customerId,
                "Thợ ứng tuyển",
                String.format("\"%s\" — %s vừa gửi ứng tuyển. Vào Quản lý bài đăng để xem và chọn thợ.", title,
                        helperDisplay),
                "JOB_APPLICATION");

        scheduleCustomerJobApplicationSocket(customerId, jobPost.getPostId(), jobPost.getTitle(), helperId);
    }

    private void scheduleCustomerJobApplicationSocket(Long customerUserId, Long postId, String jobTitle,
            Long helperId) {
        Runnable push = () -> {
            try {
                Map<String, Object> payload = new HashMap<>();
                payload.put("postId", postId);
                payload.put("jobTitle", jobTitle);
                payload.put("helperId", helperId);
                socketIOService.sendMessage(customerUserId.toString(), "new_job_application", payload);
            } catch (Exception e) {
                log.warn("Socket new_job_application skipped for customer {}: {}", customerUserId, e.getMessage());
            }
        };

        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    push.run();
                }
            });
        } else {
            push.run();
        }
    }

    private JobPostResponse mapToJobPostResponse(JobPost jobPost, boolean showAddressDetail) {
        return mapToJobPostResponse(jobPost, showAddressDetail, null);
    }

    private Map<String, Object> toSocketJobAvailablePayload(JobPost jobPost) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("postId", jobPost.getPostId());
        payload.put("title", jobPost.getTitle());
        payload.put("workDate", jobPost.getWorkDate() != null ? jobPost.getWorkDate().toString() : null);
        payload.put("startTime", jobPost.getStartTime() != null ? jobPost.getStartTime().toString() : null);
        payload.put("durationHours", jobPost.getDurationHours());
        payload.put("districtName", jobPost.getAddress() != null ? jobPost.getAddress().getDistrictName() : null);
        payload.put("provinceName", jobPost.getAddress() != null ? jobPost.getAddress().getProvinceName() : null);
        return payload;
    }

    private JobPostResponse mapToJobPostResponse(JobPost jobPost, boolean showAddressDetail, Booking booking) {
        try {
            List<Integer> sIds = parseServiceIds(jobPost.getServiceId());
            StringBuilder sNames = new StringBuilder();
            List<JobPostResponse.ServiceFee> serviceFees = new ArrayList<>();

            for (Integer id : sIds) {
                serviceRepository.findById(id).ifPresent(s -> {
                    if (sNames.length() > 0)
                        sNames.append(", ");
                    sNames.append(s.getName());

                    serviceFees.add(JobPostResponse.ServiceFee.builder()
                            .name(s.getName())
                            .price(s.getBasePrice() != null ? s.getBasePrice() : BigDecimal.ZERO)
                            .build());
                });
            }

            // Safe category access
            BigDecimal baseLaborPrice_Unit = BigDecimal.ZERO;
            Integer categoryId = null;
            String categoryName = null;
            try {
                ServiceCategory cat = jobPost.getCategory();
                if (cat != null) {
                    baseLaborPrice_Unit = cat.getBasePrice() != null ? cat.getBasePrice() : BigDecimal.ZERO;
                    categoryId = cat.getCategoryId();
                    categoryName = cat.getName();
                }
            } catch (Exception e) {
                log.warn("Failed to load category for job post {}: {}", jobPost.getPostId(), e.getMessage());
            }

            int baseDurationHours = Math.max(0, (jobPost.getDurationHours() != null ? jobPost.getDurationHours() : 0)
                    - (sIds.size() * HOURS_PER_SUB_SERVICE));
            BigDecimal finalBasePrice = baseLaborPrice_Unit.multiply(BigDecimal.valueOf(baseDurationHours));

            Map<String, Object> additionalDataMap = deserializeAdditionalData(jobPost.getAdditionalData());

            Double workSize = jobPost.getWorkSize();
            if (workSize == null && additionalDataMap != null && additionalDataMap.containsKey("workSize")) {
                Object wsObj = additionalDataMap.get("workSize");
                if (wsObj != null) {
                    try {
                        workSize = Double.valueOf(wsObj.toString());
                    } catch (NumberFormatException ignored) {}
                }
            }

            JobPostResponse.JobPostResponseBuilder builder = JobPostResponse.builder()
                    .postId(jobPost.getPostId())
                    .serviceIds(sIds)
                    .serviceNames(sNames.toString())
                    .categoryId(categoryId)
                    .categoryName(categoryName)
                    .title(jobPost.getTitle())
                    .description(jobPost.getDescription());

            // Safe address mapping
            try {
                Address addr = null;
                try {
                    addr = jobPost.getAddress();
                } catch (jakarta.persistence.EntityNotFoundException e) {
                    log.warn("Address reference lost for JobPost #{}: {}", jobPost.getPostId(), e.getMessage());
                }

                if (addr != null) {
                    builder.addressId(addr.getAddressId())
                           .wardName(addr.getWardName())
                           .districtName(addr.getDistrictName())
                           .provinceName(addr.getProvinceName());

                    if (showAddressDetail) {
                        String fullAddrStr = String.join(", ",
                                addr.getAddressDetail() != null ? addr.getAddressDetail() : "",
                                addr.getWardName() != null ? addr.getWardName() : "",
                                addr.getDistrictName() != null ? addr.getDistrictName() : "",
                                addr.getProvinceName() != null ? addr.getProvinceName() : "").replaceAll(", , ", ", ").trim();
                        builder.fullAddress(fullAddrStr.isEmpty() ? "Địa chỉ không xác định" : fullAddrStr);
                        builder.addressDetail(addr.getAddressDetail());
                    }
                } else {
                    builder.fullAddress("Địa chỉ không xác định (Dữ liệu gốc đã bị xóa)");
                }
            } catch (Exception e) {
                log.warn("General Address error for JobPost #{}: {}", jobPost.getPostId(), e.getMessage());
                if (showAddressDetail) builder.fullAddress("Địa chỉ không xác định (Lỗi dữ liệu)");
            }


            builder.workDate(jobPost.getWorkDate())
                    .startTime(jobPost.getStartTime())
                    .durationHours(jobPost.getDurationHours())
                    .offerPrice(jobPost.getOfferPrice())
                    .basePrice(finalBasePrice)
                    .serviceFees(serviceFees)
                    .currency("VND")
                    .status(jobPost.getStatus())
                    .bookingId(booking != null ? booking.getId() : null)
                    .bookingStatus(booking != null && booking.getStatus() != null ? booking.getStatus().name() : null)
                    .canCheckin(booking != null && booking.getStatus() == BookingStatus.CONFIRMED && (booking.getScheduledStartTime() == null || Math.abs(java.time.Duration.between(booking.getScheduledStartTime(), java.time.LocalDateTime.now()).toMinutes()) <= 180))
                    .customerArrivalConfirmed(booking != null && Boolean.TRUE.equals(booking.getCustomerArrivalConfirmed()))
                    .arrivalProofImage(booking != null
                            ? (booking.getArrivalProofImage() != null && !booking.getArrivalProofImage().isBlank()
                                    ? booking.getArrivalProofImage()
                                    : booking.getCheckinPhotoUrl())
                            : null)
                    .disputeReason(booking != null ? booking.getDisputeReason() : null)
                    .disputeEvidenceUrl(booking != null ? booking.getEvidenceUrl() : null)
                    .disputedAt(booking != null ? booking.getDisputedAt() : null)
                    .helperDisputeMessage(booking != null ? booking.getHelperDisputeMessage() : null)
                    .helperDisputeEvidenceUrl(booking != null ? booking.getHelperDisputeEvidenceUrl() : null)
                    .helperDisputeAt(booking != null ? booking.getHelperDisputeAt() : null)
                    .cancelReason(booking != null ? booking.getCancelReason() : null)
                    .cancelSource(booking != null ? booking.getCancelSource() : null)
                    .createdAt(jobPost.getCreatedAt())
                    .workSize(workSize)
                    .additionalData(additionalDataMap);


            BigDecimal originalPrice = extractBigDecimal(additionalDataMap, "loyaltyOriginalPrice", jobPost.getOfferPrice());
            BigDecimal discountAmount = extractBigDecimal(additionalDataMap, "loyaltyDiscountAmount", BigDecimal.ZERO);
            BigDecimal finalPrice = extractBigDecimal(additionalDataMap, "loyaltyFinalPrice", jobPost.getOfferPrice());
            String customerTier = extractString(additionalDataMap, "loyaltyTierAtBooking", CustomerTier.BRONZE.name());
            
            builder.originalPrice(originalPrice)
                    .discountAmount(discountAmount)
                    .finalPrice(finalPrice)
                    .customerTier(customerTier)
                    .isVipCustomer("GOLD".equalsIgnoreCase(customerTier) || Boolean.TRUE.equals(extractBoolean(additionalDataMap, "isVipCustomer")));

            return builder.build();
        } catch (Exception e) {
            log.error("Failed to map JobPost {}: {}", jobPost.getPostId(), e.getMessage(), e);
            return null;
        }
    }

    private BigDecimal extractBigDecimal(Map<String, Object> data, String key, BigDecimal defaultValue) {
        if (data == null)
            return defaultValue;
        Object value = data.get(key);
        if (value == null)
            return defaultValue;
        try {
            return new BigDecimal(value.toString()).setScale(2, java.math.RoundingMode.HALF_UP);
        } catch (Exception e) {
            return defaultValue;
        }
    }

    private String extractString(Map<String, Object> data, String key, String defaultValue) {
        if (data == null)
            return defaultValue;
        Object value = data.get(key);
        return value == null ? defaultValue : value.toString();
    }

    private Boolean extractBoolean(Map<String, Object> data, String key) {
        if (data == null)
            return null;
        Object value = data.get(key);
        if (value == null)
            return null;
        if (value instanceof Boolean b)
            return b;
        return "true".equalsIgnoreCase(value.toString());
    }

    private boolean isVipCustomer(JobPost jobPost) {
        Map<String, Object> data = deserializeAdditionalData(jobPost.getAdditionalData());
        if (data == null)
            return false;
        if (Boolean.TRUE.equals(extractBoolean(data, "isVipCustomer")))
            return true;
        String tier = extractString(data, "loyaltyTierAtBooking", CustomerTier.BRONZE.name());
        return CustomerTier.GOLD.name().equalsIgnoreCase(tier);
    }

    private String serializeAdditionalData(Map<String, Object> data) {
        if (data == null || data.isEmpty())
            return null;
        try {
            return objectMapper.writeValueAsString(data);
        } catch (JsonProcessingException e) {
            log.error("Error serializing additionalData", e);
            return null;
        }
    }

    private Map<String, Object> deserializeAdditionalData(String data) {
        if (data == null || data.isEmpty())
            return null;
        try {
            return objectMapper.readValue(data, new TypeReference<Map<String, Object>>() {
            });
        } catch (JsonProcessingException e) {
            log.error("Error deserializing additionalData", e);
            return null;
        }
    }

    private String normalizeLocationText(String text) {
        if (text == null)
            return "";
        return java.text.Normalizer.normalize(text, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase()
                .replaceAll("\\b(quan|huyen|thi xa|thanh pho|tp\\.?)\\b", "")
                .replaceAll("[^a-z0-9\\s]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    /**
     * [BE-Post-08] Helper hủy đơn sau khi đã nhận (Áp dụng mức phạt linh hoạt
     * PB-24)
     */
    @Transactional
    public void cancelJobByHelper(Long postId, Long helperId) {
        log.info("Helper {} yêu cầu hủy Job Post #{}", helperId, postId);

        JobPost jobPost = jobPostRepository.findById(postId)
                .orElseThrow(() -> new ApiException("Không tìm thấy job post", HttpStatus.NOT_FOUND));

        // 1. Kiểm tra trạng thái đơn (Chỉ cho phép hủy khi đã được giao/xác nhận)
        if (!"ASSIGNED".equals(jobPost.getStatus()) && !"CONFIRMED".equals(jobPost.getStatus())) {
            throw new ApiException("Chưa thể xử lý hủy đơn ở trạng thái này", HttpStatus.BAD_REQUEST);
        }

        // 2. Tính toán tiền phạt dựa trên thời gian (PB-24)
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime workStart = jobPost.getWorkDate().atTime(jobPost.getStartTime());
        long hoursBeforeStart = java.time.Duration.between(now, workStart).toHours();

        BigDecimal penaltyAmount = BigDecimal.ZERO;
        String penaltyReason = "Hủy sớm (>4h)";

        if (hoursBeforeStart < 1) {
            penaltyAmount = new BigDecimal("50000");
            penaltyReason = "Hủy cực sát giờ (<1h)";
        } else if (hoursBeforeStart < 4) {
            penaltyAmount = new BigDecimal("30000");
            penaltyReason = "Hủy sát giờ (1-4h)";
        }

        // 3. Thực hiện phạt và bồi thường
        if (penaltyAmount.compareTo(BigDecimal.ZERO) > 0) {
            walletService.deductPenalty(helperId, penaltyAmount, postId, penaltyReason);

            // Trích 50% bồi thường cho khách hàng
            BigDecimal compensation = penaltyAmount.multiply(new BigDecimal("0.5"));
            walletService.compensateCustomer(jobPost.getCustomerId(), compensation, postId, "Bồi thường do thợ hủy đơn #" + postId);

            log.info("⚠ Đã phạt thợ {} số tiền {} VNĐ và bồi thường Khách {} số tiền {} VNĐ",
                    helperId, penaltyAmount, jobPost.getCustomerId(), compensation);
        }

        // 4. Reset trạng thái Job để gom Helper khác
        jobPost.setStatus("PUBLISHED");
        jobPostRepository.save(jobPost);

        // 5. Cập nhật Application của Helper này thành CANCELLED
        jobApplicationRepository.findByPostIdAndHelperId(postId, helperId).ifPresent(app -> {
            app.setStatus("CANCELLED");
            jobApplicationRepository.save(app);
        });

        log.info(" Đã xử lý hủy đơn thành công cho Job #{}", postId);
    }

    /**
     * [BE-Post-03] Lấy danh sách bài đăng của khách hàng
     */
    @Transactional(readOnly = true)
    public List<JobPostResponse> getCustomerJobs(Long customerId) {
        log.info("Lấy danh sách job post của customer {}", customerId);
        List<JobPost> jobPosts = jobPostRepository.findByCustomerIdOrderByCreatedAtDesc(customerId);
        if (jobPosts.isEmpty()) {
            return Collections.emptyList();
        }

        List<Long> postIds = jobPosts.stream()
                .map(JobPost::getPostId)
                .filter(Objects::nonNull)
                .toList();

        Map<Long, Booking> bookingByPostId = new HashMap<>();
        if (!postIds.isEmpty()) {
            List<Booking> bookings = bookingRepository.findByCustomer_IdAndJobPostIdInOrderByCreatedAtDesc(customerId,
                    postIds);
            for (Booking booking : bookings) {
                if (booking.getJobPostId() != null && !bookingByPostId.containsKey(booking.getJobPostId())) {
                    bookingByPostId.put(booking.getJobPostId(), booking);
                }
            }
        }

        return jobPosts.stream()
                .map(jp -> mapToJobPostResponse(jp, true, bookingByPostId.get(jp.getPostId())))
                .filter(Objects::nonNull) // Filter out any posts that failed to map
                .collect(Collectors.toList());
    }

    /**
     * [BE-Post-04] Lấy chi tiết bài đăng
     */
    @Transactional(readOnly = true)
    public JobPostResponse getJobDetail(Long jobId, Long customerId) {
        JobPost jobPost = jobPostRepository.findById(jobId)
                .orElseThrow(() -> new ApiException("Không tìm thấy bài đăng", HttpStatus.NOT_FOUND));

        if (!jobPost.getCustomerId().equals(customerId)) {
            throw new ApiException("Bạn không có quyền xem bài đăng này", HttpStatus.FORBIDDEN);
        }

        Booking booking = bookingRepository.findTopByJobPostIdAndCustomer_IdOrderByCreatedAtDesc(jobId, customerId)
                .orElse(null);
        return mapToJobPostResponse(jobPost, true, booking);
    }

    /**
     * Chi tiết bài đăng cho Admin — đầy đủ địa chỉ, không kiểm tra chủ sở hữu.
     */
    @Transactional(readOnly = true)
    public JobPostResponse getJobPostDetailForAdmin(Long postId) {
        JobPost jobPost = jobPostRepository.findById(postId)
                .orElseThrow(() -> new ApiException("Không tìm thấy bài đăng", HttpStatus.NOT_FOUND));
        Booking booking = bookingRepository.findTopByJobPostIdOrderByCreatedAtDesc(postId).orElse(null);
        return mapToJobPostResponse(jobPost, true, booking);
    }

    /**
     * [BE-Post-05] Cập nhật bài đăng (Chỉ cho phép khi status = PUBLISHED)
     */
    @Transactional
    public JobPostResponse updateJobPost(Long jobId, UpdateJobPostRequest request, Long customerId) {
        JobPost jobPost = jobPostRepository.findById(jobId)
                .orElseThrow(() -> new ApiException("Không tìm thấy bài đăng", HttpStatus.NOT_FOUND));

        if (!jobPost.getCustomerId().equals(customerId)) {
            throw new ApiException("Bạn không có quyền chỉnh sửa bài đăng này", HttpStatus.FORBIDDEN);
        }

        if (!"PUBLISHED".equals(jobPost.getStatus())) {
            throw new ApiException("Chỉ có thể chỉnh sửa bài đăng khi đang ở trạng thái Đang tìm thợ",
                    HttpStatus.BAD_REQUEST);
        }

        // Lưu giá cũ để so sánh
        BigDecimal oldPrice = jobPost.getOfferPrice();
        String oldTitle = jobPost.getTitle();
        String oldDescription = jobPost.getDescription();
        String oldAdditionalData = jobPost.getAdditionalData();

        // Cập nhật các trường
        if (request.getTitle() != null)
            jobPost.setTitle(request.getTitle());
        if (request.getDescription() != null)
            jobPost.setDescription(request.getDescription());
        jobPost.setLastValidatedAt(LocalDateTime.now());
        jobPost.setEditRevision((jobPost.getEditRevision() == null ? 0 : jobPost.getEditRevision()) + 1);
        if (request.getWorkDate() != null)
            jobPost.setWorkDate(request.getWorkDate());
        if (request.getStartTime() != null)
            jobPost.setStartTime(request.getStartTime());
        // durationHours ở đây là Base Duration từ request
        if (request.getDurationHours() != null)
            jobPost.setDurationHours(request.getDurationHours());
        // if (request.getWorkSize() != null)
        // jobPost.setWorkSize(request.getWorkSize());

        // Update additionalData and workSize
        Map<String, Object> currentData = deserializeAdditionalData(jobPost.getAdditionalData());
        if (currentData == null)
            currentData = new java.util.HashMap<>();

        if (request.getAdditionalData() != null) {
            currentData.putAll(request.getAdditionalData());
        }
        if (request.getWorkSize() != null) {
            currentData.put("workSize", request.getWorkSize());
        }
        jobPost.setAdditionalData(serializeAdditionalData(currentData));
        validatePostContentForModeration(jobPost.getTitle(), jobPost.getDescription());

        validateWorkSizeAndDuration(jobPost.getCategory().getCategoryId(), jobPost.getDurationHours(),
                request.getWorkSize() != null ? request.getWorkSize() : (Double) currentData.get("workSize"));
        validateCleaningMaxDuration(jobPost.getCategory().getCategoryId(), jobPost.getDurationHours());

        if (request.getAddressId() != null) {
            Address address = addressRepository.findById(request.getAddressId())
                    .orElseThrow(() -> new ApiException("Địa chỉ không tồn tại", HttpStatus.NOT_FOUND));
            if (!address.getUser().getId().equals(customerId)) {
                throw new ApiException("Địa chỉ không thuộc về bạn", HttpStatus.FORBIDDEN);
            }
            jobPost.setAddress(address);
        }

        // --- Ràng buộc thời gian mới: Không quá khứ và phải trước ít nhất 2 tiếng ---
        LocalDateTime requestedWorkDateTime = jobPost.getWorkDate().atTime(jobPost.getStartTime());
        LocalDateTime minAllowedDateTime = LocalDateTime.now().plusHours(MIN_LEAD_TIME_HOURS);
        if (requestedWorkDateTime.isBefore(minAllowedDateTime)) {
            throw new ApiException(
                    "Thời gian làm việc mới phải đặt trước tối thiểu " + MIN_LEAD_TIME_HOURS + " tiếng kể từ bây giờ",
                    HttpStatus.BAD_REQUEST);
        }

        // Kiểm tra xem các trường ảnh hưởng đến Matching có thay đổi không
        boolean isMatchingCriticalChanged = request.getWorkDate() != null ||
                request.getStartTime() != null ||
                request.getDurationHours() != null ||
                request.getAddressId() != null ||
                request.getServiceIds() != null;

        if (request.getServiceIds() != null) {
            // Kiểm tra tính hợp lệ của các dịch vụ con mới
            for (Integer sId : request.getServiceIds()) {
                com.homeconnect.core.entity.Service service = serviceRepository.findById(sId)
                        .orElseThrow(() -> new ApiException("Dịch vụ con " + sId + " không tồn tại",
                                HttpStatus.BAD_REQUEST));

                if (service.getCategory() == null
                        || !service.getCategory().getCategoryId().equals(jobPost.getCategory().getCategoryId())) {
                    throw new ApiException("Dịch vụ con " + service.getName() + " không thuộc về danh mục "
                            + jobPost.getCategory().getName(), HttpStatus.BAD_REQUEST);
                }
            }

            String serviceIdStr = request.getServiceIds().stream()
                    .map(String::valueOf)
                    .collect(Collectors.joining(","));
            jobPost.setServiceId(serviceIdStr);
        }

        // --- Recalculate Total Duration (Additive Model) ---
        // Nếu là danh mục PER_SERVICE, mặc định base là 1 giờ (trừ khi request chỉ định
        // khác)
        int baseDuration = jobPost.getDurationHours();
        if (jobPost.getCategory().getUnit() != null && "PER_SERVICE".equals(jobPost.getCategory().getUnit().name()) && request.getDurationHours() == null) {
            baseDuration = 1;
        }

        String[] sIds = jobPost.getServiceId() != null ? jobPost.getServiceId().split(",") : new String[0];
        int subServiceCount = 0;
        for (String sId : sIds) {
            if (!sId.trim().isEmpty())
                subServiceCount++;
        }

        int totalHours = baseDuration + subServiceCount;
        jobPost.setDurationHours(totalHours);

        BigDecimal newOriginalPrice = calculatePrice(jobPost);
        userRepository.findById(customerId)
                  .orElseThrow(() -> new ApiException("Khách hàng không tồn tại", HttpStatus.NOT_FOUND));
        int monthlyCompletedCount = (int) loyaltyService.getMonthlyCompletedCount(customerId);
        CustomerTier customerTier = loyaltyService.resolveTierByCompletedCount(monthlyCompletedCount);
        BigDecimal discountRate = loyaltyService.resolveDiscountRate(customerTier);
        BigDecimal discountAmount = newOriginalPrice.multiply(discountRate).setScale(2, java.math.RoundingMode.HALF_UP);
        BigDecimal newPrice = newOriginalPrice.subtract(discountAmount).setScale(2, java.math.RoundingMode.HALF_UP);
        jobPost.setOfferPrice(newPrice);
        currentData.put("loyaltyOriginalPrice", newOriginalPrice);
        currentData.put("loyaltyDiscountRate", discountRate);
        currentData.put("loyaltyDiscountAmount", discountAmount);
        currentData.put("loyaltyFinalPrice", newPrice);
        currentData.put("loyaltyTierAtBooking", customerTier.name());
        currentData.put("isVipCustomer", customerTier == CustomerTier.GOLD);
        jobPost.setAdditionalData(serializeAdditionalData(currentData));

        // Xử lý chênh lệch tiền trong ví
        if (newPrice.compareTo(oldPrice) != 0) {
            log.info("Giá thay đổi từ {} sang {}. Đang điều chỉnh tiền giữ trong ví.", oldPrice, newPrice);
            walletService.refundHold(customerId, oldPrice, jobId, "Cập nhật bài đăng (Hoàn tiền cũ)");
            walletService.holdMoney(customerId, newPrice, jobId, null);
        }

        JobPost saved = jobPostRepository.save(jobPost);
        saved.setEditRevision((saved.getEditRevision() == null ? 0 : saved.getEditRevision()) + 1);
        saved.setLastValidatedAt(LocalDateTime.now());
        saved = jobPostRepository.save(saved);

        jobPostEditLogRepository.save(JobPostEditLog.builder()
                .postId(saved.getPostId())
                .editedBy(customerId)
                .revisionNo(saved.getEditRevision())
                .oldTitle(oldTitle)
                .newTitle(saved.getTitle())
                .oldDescription(oldDescription)
                .newDescription(saved.getDescription())
                .oldAdditionalData(oldAdditionalData)
                .newAdditionalData(saved.getAdditionalData())
                .build());

        // --- QUAN TRỌNG: Chỉ kích hoạt lại Matching nếu các tiêu chí tìm thợ thay đổi
        // ---
        if (isMatchingCriticalChanged) {
            log.info("Phát sự kiện cập nhật để tìm thợ mới cho Job #{} (Do thay đổi tiêu chí Matching)", jobId);
            eventPublisher.publishEvent(new JobPostCreatedEvent(jobId));
        } else {
            log.info("Cập nhật bài đăng Job #{} thành công (Không thay đổi tiêu chí Matching, giữ nguyên thợ cũ)",
                    jobId);
        }

        return mapToJobPostResponse(saved, true);
    }

    /**
     * [BE-Post-06] Hủy bài đăng (Chỉ cho phép khi status = PUBLISHED)
     */
    @Transactional
    public void cancelJobPost(Long jobId, Long customerId) {
        JobPost jobPost = jobPostRepository.findById(jobId)
                .orElseThrow(() -> new ApiException("Không tìm thấy bài đăng", HttpStatus.NOT_FOUND));

        if (!jobPost.getCustomerId().equals(customerId)) {
            throw new ApiException("Bạn không có quyền hủy bài đăng này", HttpStatus.FORBIDDEN);
        }

        if (!"PUBLISHED".equals(jobPost.getStatus())) {
            throw new ApiException("Chỉ có thể hủy bài đăng khi đang ở trạng thái Đang tìm thợ",
                    HttpStatus.BAD_REQUEST);
        }

        // 1. Gửi thông báo đến các thợ đã ứng tuyển/mời (PENDING)
        List<JobApplication> apps = jobApplicationRepository.findByPostId(jobId);
        for (JobApplication app : apps) {
            if ("PENDING".equals(app.getStatus())) {
                notificationService.createNotification(
                        app.getHelperId(),
                        "Công việc bị hủy",
                        String.format("Công việc #%d (%s) đã bị khách hàng hủy.", jobId, jobPost.getTitle()),
                        "JOB_CANCELLED");
            }
        }

        // 2. Hoàn tiền cho khách hàng
        walletService.refundHold(customerId, jobPost.getOfferPrice(), jobId, "Khách hàng hủy bài đăng");

        // 2. Hủy các lời mời/ứng tuyển đang chờ (PENDING)
        jobApplicationRepository.updateStatusByPostIdAndStatusIn(jobId, "CANCELLED",
                java.util.Arrays.asList("PENDING"));

        // Cập nhật trạng thái bài đăng
        jobPost.setStatus("CANCELLED");
        jobPostRepository.save(jobPost);

        // Real-time update: thông báo để helper refresh feed và loại bỏ job đã hủy
        socketIOService.broadcast("job_post_cancelled", java.util.Map.of(
                "postId", jobId,
                "status", "CANCELLED"));

        log.info(
                "Khách hàng {} đã hủy Job Post #{} thành công. Tiền đã hoàn, các lời mời đã hủy và gửi thông báo cho thợ.",
                customerId, jobId);
    }

    /**
     * Admin hủy tin đăng: PUBLISHED → cùng luồng hủy như khách (hoàn hold, hủy ứng
     * tuyển PENDING).
     * ASSIGNED → hủy booking đang hoạt động theo luật admin, sau đó đóng tin.
     */
    @Transactional
    public void cancelJobPostByAdmin(Long postId, String reason, String adminEmail) {
        JobPost jobPost = jobPostRepository.findById(postId)
                .orElseThrow(() -> new ApiException("Không tìm thấy bài đăng", HttpStatus.NOT_FOUND));
        Long adminUserId = adminAuditLogService.resolveActorIdByEmail(adminEmail);

        String st = jobPost.getStatus();
        if ("CANCELLED".equals(st)) {
            throw new ApiException("Bài đăng đã bị hủy trước đó", HttpStatus.BAD_REQUEST);
        }
        if ("EXPIRED".equals(st)) {
            throw new ApiException("Bài đăng đã hết hạn, không cần hủy thủ công", HttpStatus.BAD_REQUEST);
        }
        if ("COMPLETED".equals(st)) {
            throw new ApiException("Bài đăng ở trạng thái hoàn thành, không thể hủy", HttpStatus.BAD_REQUEST);
        }

        if ("PUBLISHED".equals(st)) {
            cancelJobPost(postId, jobPost.getCustomerId());
            notificationService.createNotification(
                    jobPost.getCustomerId(),
                    "Tin đăng bị hủy (Admin)",
                    String.format("Tin #%d đã bị hủy bởi quản trị viên. Lý do: %s", postId, reason),
                    "JOB_ADMIN_CANCEL");
            log.info("Admin {} đã hủy tin PUBLISHED #{}", adminEmail, postId);
            adminAuditLogService.log(
                    adminUserId,
                    adminEmail,
                    "ADMIN_JOB_POST_CANCEL",
                    "JOB_POST",
                    postId,
                    "SUCCESS",
                    reason,
                    "{\"previousStatus\":\"PUBLISHED\"}");
            return;
        }

        if ("ASSIGNED".equals(st)) {
            var bookingOpt = bookingRepository.findTopByJobPostIdOrderByCreatedAtDesc(postId);
            if (bookingOpt.isPresent()) {
                Booking booking = bookingOpt.get();
                if (booking.getStatus() == BookingStatus.COMPLETED) {
                    throw new ApiException("Đơn hàng gắn với tin này đã hoàn thành, không thể hủy bài đăng",
                            HttpStatus.BAD_REQUEST);
                }
                if (!ADMIN_JOB_POST_CANCEL_ALLOWED_BOOKING_STATUSES.contains(booking.getStatus())
                        && booking.getStatus() != BookingStatus.CANCELLED) {
                    adminAuditLogService.log(
                            adminUserId,
                            adminEmail,
                            "ADMIN_JOB_POST_CANCEL",
                            "JOB_POST",
                            postId,
                            "BLOCKED",
                            "Từ chối hủy tin ASSIGNED do booking đang ở trạng thái không cho phép",
                            "{\"bookingId\":" + booking.getId() + ",\"bookingStatus\":\"" + booking.getStatus().name()
                                    + "\"}");
                    throw new ApiException(
                            "Không thể hủy tin vì booking #" + booking.getId() + " đang ở trạng thái "
                                    + booking.getStatus()
                                    + ". Vui lòng xử lý vận hành booking trước (no-show/hoàn thành).",
                            HttpStatus.BAD_REQUEST);
                }
                if (booking.getStatus() != BookingStatus.CANCELLED) {
                    bookingService.cancelBookingByAdmin(booking.getId(),
                            "(Hủy từ quản lý bài đăng) " + reason, adminEmail);
                }
            }
            jobPost.setStatus("CANCELLED");
            jobPost.setModerationReason(reason);
            jobPost.setModeratedBy(adminUserId);
            jobPost.setModeratedAt(LocalDateTime.now());
            jobPostRepository.save(jobPost);

            // Real-time update: thông báo để helper refresh feed và loại bỏ job đã hủy
            socketIOService.broadcast("job_post_cancelled", java.util.Map.of(
                    "postId", postId,
                    "status", "CANCELLED"));

            log.info("Admin {} đã đóng tin ASSIGNED #{} sau khi xử lý booking liên quan", adminEmail, postId);
            adminAuditLogService.log(
                    adminUserId,
                    adminEmail,
                    "ADMIN_JOB_POST_CANCEL",
                    "JOB_POST",
                    postId,
                    "SUCCESS",
                    reason,
                    "{\"previousStatus\":\"ASSIGNED\"}");
            return;
        }

        throw new ApiException("Không thể hủy bài đăng ở trạng thái: " + st, HttpStatus.BAD_REQUEST);
    }

    private void enforceJobPostingRateLimit(Long customerId) {
        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        LocalDateTime endOfDay = startOfDay.plusDays(1);
        long todayCount = jobPostRepository.countByCustomerIdAndCreatedAtBetween(customerId, startOfDay, endOfDay);
        if (todayCount >= MAX_POSTS_PER_DAY) {
            throw new ApiException("Bạn đã vượt quá giới hạn đăng tin trong ngày", HttpStatus.TOO_MANY_REQUESTS);
        }
    }

    private void validatePostContentForModeration(String title, String description) {
        String text = ((title != null ? title : "") + " " + (description != null ? description : "")).trim();
        if (text.isBlank()) {
            throw new ApiException("Nội dung tin đăng không hợp lệ", HttpStatus.BAD_REQUEST);
        }
        String normalized = text.replaceAll("\\s+", " ").trim();

        if (PHONE_PATTERN.matcher(normalized).find() || CONTACT_BYPASS_PATTERN.matcher(normalized).find()) {
            throw new ApiException("Tin đăng không được chứa thông tin liên hệ ngoài hệ thống", HttpStatus.BAD_REQUEST);
        }
        String lower = normalized.toLowerCase();
        if (GIBBERISH_PATTERN.matcher(lower.replace(" ", "")).matches() || lower.contains("test test")) {
            throw new ApiException("Nội dung tin đăng có dấu hiệu spam/rác", HttpStatus.BAD_REQUEST);
        }
    }

    private BigDecimal calculatePrice(JobPost jobPost) {
        Map<String, Object> additionalData = deserializeAdditionalData(jobPost.getAdditionalData());
        Double workSize = null;
        if (additionalData != null && additionalData.containsKey("workSize")) {
            Object wsObj = additionalData.get("workSize");
            if (wsObj != null) {
                try {
                    workSize = Double.valueOf(wsObj.toString());
                } catch (NumberFormatException ignored) {
                }
            }
        }

        List<Integer> sIds = parseServiceIds(jobPost.getServiceId());
        int baseLaborHours = Math.max(0, (jobPost.getDurationHours() != null ? jobPost.getDurationHours() : 0) 
                - (sIds.size() * HOURS_PER_SUB_SERVICE));

        return calculatePriceInternal(
                jobPost.getCategory(),
                baseLaborHours,
                sIds,
                workSize,
                additionalData);
    }

    /**
     * Phương thức lõi tính tiền cho cả 7 danh mục
     * Logic: (Base * Hours) + Premium + Extras + Category-Specific-Fees
     */
    private BigDecimal calculatePriceInternal(
            ServiceCategory category,
            Integer hours,
            List<Integer> serviceIds,
            Double workSize,
            Map<String, Object> additionalData) {

        if (category == null)
            return BigDecimal.ZERO;

        // 1. Giá lao động cơ bản
        int baseLaborHours = (hours != null) ? hours : 0;

        // 2. Tính giá lao động (Dựa trên số giờ khách chọn)
        BigDecimal price;
        int laborBaseHours = baseLaborHours;
        
        if (com.homeconnect.core.enums.ServiceUnit.PER_SERVICE.equals(category.getUnit())) {
            price = category.getBasePrice();
        } else {
            price = category.getBasePrice().multiply(BigDecimal.valueOf(laborBaseHours));
        }


        // 4. Phí các dịch vụ con (extra services) - Cộng theo giá niêm yết của từng dịch vụ
        if (serviceIds != null && !serviceIds.isEmpty()) {
            for (Integer id : serviceIds) {
                com.homeconnect.core.entity.Service service = serviceRepository.findById(id).orElse(null);
                if (service != null && service.getBasePrice() != null) {
                    price = price.add(service.getBasePrice());
                }
            }
        }

        // 4. Logic đặc thù từng danh mục (Dựa trên additionalData và workSize)
        int catId = category.getCategoryId();

        // Category 2: Nấu ăn
        if (catId == 2 && additionalData != null) {
            // Nếu có nhờ đi chợ
            if (Boolean.TRUE.equals(additionalData.get("isTaskerShopping"))) {
                price = price.add(BigDecimal.valueOf(50000));
            }
        }

        // Category 3: Đi chợ
        if (catId == 3 && additionalData != null) {
            // Nếu thợ ứng tiền trước
            if (Boolean.TRUE.equals(additionalData.get("isTaskerAdvance"))) {
                price = price.add(BigDecimal.valueOf(30000)); // Phí dịch vụ ứng tiền

                // Cộng thêm số tiền đi chợ vào tổng tiền cần hold trong ví
                Object shoppingAmt = additionalData.get("shoppingAmount");
                if (shoppingAmt != null) {
                    try {
                        BigDecimal amount = new BigDecimal(shoppingAmt.toString());
                        price = price.add(amount);
                        log.info("Added shoppingAmount {} to total price for category 3", amount);
                    } catch (NumberFormatException e) {
                        log.warn("Invalid shoppingAmount format: {}", shoppingAmt);
                    }
                }
            }
        }

        // Category 5: Trông trẻ
        if (catId == 5 && workSize != null && workSize > 1) {
            // Phụ phí từ bé thứ 2 (30k/giờ cho mỗi bé thêm)
            BigDecimal extraChildFee = BigDecimal.valueOf(workSize - 1)
                    .multiply(BigDecimal.valueOf(hours != null ? hours : 0))
                    .multiply(BigDecimal.valueOf(30000));
            price = price.add(extraChildFee);
        }

        // Category 7: Sơn sửa (Task-based)
        if (catId == 7 && workSize != null && workSize > 1) {
            // Phụ phí từ hạng mục thứ 2 (50k/hạng mục thêm)
            BigDecimal extraItemFee = BigDecimal.valueOf(workSize - 1)
                    .multiply(BigDecimal.valueOf(50000));
            price = price.add(extraItemFee);
        }

        return price;
    }

    private void validateHelperService(JobPost jobPost, Long helperId) {
        if (jobPost.getCategory() == null)
            return;

        Integer requiredCategoryId = jobPost.getCategory().getCategoryId();
        boolean hasSkill = helperServiceRepository.findByHelper_Id(helperId).stream()
                .anyMatch(
                        hs -> hs.getCategory() != null && hs.getCategory().getCategoryId().equals(requiredCategoryId));

        if (!hasSkill) {
            throw new ApiException("Bạn chưa đăng ký kỹ năng cho dịch vụ '" + jobPost.getCategory().getName() + "'.",
                    HttpStatus.BAD_REQUEST);
        }
    }

    private void validateJobDistrict(JobPost jobPost, Long helperId) {
        List<String> helperDistricts = getNormalizedHelperDistricts(helperId);
        if (!isJobInRegisteredDistrict(jobPost, helperDistricts)) {
            throw new ApiException("Công việc này ở "
                    + (jobPost.getAddress() != null ? jobPost.getAddress().getDistrictName() : "Quận khác")
                    + ", không thuộc các khu vực bạn đăng ký làm việc.", HttpStatus.BAD_REQUEST);
        }
    }

    private List<String> getNormalizedHelperDistricts(Long helperId) {
        return helperWorkingDistrictRepository.findByHelper_Id(helperId).stream()
                .map(com.homeconnect.core.entity.HelperWorkingDistrict::getDistrictName)
                .map(this::normalizeLocationText)
                .collect(Collectors.toList());
    }

    private boolean isJobInRegisteredDistrict(JobPost jobPost, List<String> helperDistricts) {
        String jobDistrict = jobPost.getAddress() != null
                ? normalizeLocationText(jobPost.getAddress().getDistrictName())
                : "";
        return helperDistricts.contains(jobDistrict);
    }

    private void validateHelperAvailability(JobPost jobPost, Long helperId) {
        int duration = (jobPost.getDurationHours() != null && jobPost.getDurationHours() > 0)
                ? jobPost.getDurationHours()
                : 1;
        long durationSecs = (long) duration * 3600;
        long availableCount = helperScheduleRepository.countAvailableSchedules(
                helperId,
                jobPost.getWorkDate(),
                jobPost.getStartTime(),
                durationSecs);

        if (availableCount == 0) {
            throw new ApiException(
                    "Bạn chưa cài đặt lịch trống (AVAILABLE) vào khung giờ này hoặc đã bận việc khác. Vui lòng kiểm tra lại lịch làm việc của mình.",
                    HttpStatus.BAD_REQUEST);
        }
    }

    private List<Integer> parseServiceIds(String serviceIdStr) {
        List<Integer> sIds = new ArrayList<>();
        if (serviceIdStr != null && !serviceIdStr.isEmpty()) {
            String[] split = serviceIdStr.split(",");
            for (String idStr : split) {
                try {
                    sIds.add(Integer.parseInt(idStr.trim()));
                } catch (NumberFormatException ignored) {
                }
            }
        }
        return sIds;
    }

    @Transactional(readOnly = true)
    public JobApplicationStatusResponse getApplicationStatus(Long jobId, Long helperId) {
        // Kiểm tra bài đăng tồn tại
        JobPost jobPost = jobPostRepository.findById(jobId).orElse(null);
        if (jobPost == null) {
            return JobApplicationStatusResponse.builder()
                    .exists(false)
                    .build();
        }

        // Tìm application của thợ này với bài đăng
        Optional<JobApplication> appOpt = jobApplicationRepository.findByPostIdAndHelperId(jobId, helperId);
        if (appOpt.isEmpty()) {
            return JobApplicationStatusResponse.builder()
                    .exists(false)
                    .postId(jobPost.getPostId())
                    .jobTitle(jobPost.getTitle())
                    .workDate(jobPost.getWorkDate())
                    .startTime(jobPost.getStartTime())
                    .durationHours(jobPost.getDurationHours())
                    .offerPrice(jobPost.getOfferPrice())
                    .categoryName(jobPost.getCategory() != null ? jobPost.getCategory().getName() : null)
                    .jobStatus(jobPost.getStatus())
                    .build();
        }

        JobApplication app = appOpt.get();
        boolean isAccepted = "ACCEPTED".equals(app.getStatus());

        // Xây dựng builder với thông tin cơ bản & bài đăng
        JobApplicationStatusResponse.JobApplicationStatusResponseBuilder builder = JobApplicationStatusResponse
                .builder()
                .applicationId(app.getApplicationId())
                .type(app.getType())
                .status(app.getStatus())
                .createdAt(app.getCreatedAt())
                .exists(true)
                // Thông tin bài đăng
                .postId(jobPost.getPostId())
                .jobTitle(jobPost.getTitle())
                .jobDescription(jobPost.getDescription())
                .workDate(jobPost.getWorkDate())
                .startTime(jobPost.getStartTime())
                .durationHours(jobPost.getDurationHours())
                .offerPrice(jobPost.getOfferPrice())
                .categoryName(jobPost.getCategory() != null ? jobPost.getCategory().getName() : null)
                .jobStatus(jobPost.getStatus());

        // Nếu đã được ACCEPTED → tiết lộ địa chỉ chi tiết của khách hàng
        if (isAccepted && jobPost.getAddress() != null) {
            com.homeconnect.core.entity.Address addr = jobPost.getAddress();

            String fullAddress = String.join(", ",
                    addr.getAddressDetail() != null ? addr.getAddressDetail() : "",
                    addr.getWardName() != null ? addr.getWardName() : "",
                    addr.getDistrictName() != null ? addr.getDistrictName() : "",
                    addr.getProvinceName() != null ? addr.getProvinceName() : "").replaceAll(", $", "")
                    .replaceAll("^, ", "");

            builder.addressDetail(addr.getAddressDetail())
                    .wardName(addr.getWardName())
                    .districtName(addr.getDistrictName())
                    .provinceName(addr.getProvinceName())
                    .latitude(addr.getLatitude())
                    .longitude(addr.getLongitude())
                    .fullAddress(fullAddress);

            log.info("Thợ #{} đã ACCEPTED bài #{} → Trả về địa chỉ khách hàng: {}", helperId, jobId, fullAddress);
        } else if (isAccepted) {
            log.warn("Thợ #{} đã ACCEPTED bài #{} nhưng bài đăng không có địa chỉ.", helperId, jobId);
        }

        return builder.build();
    }

    /**
     * [BE-Auto-01] Tự động hết hạn bài đăng khi qua giờ bắt đầu công việc.
     * Chạy bởi JobAutomationTask định kỳ.
     * Logic:
     * 1. Tìm các bài đăng PUBLISHED đã qua giờ bắt đầu.
     * 2. Chuyển trạng thái sang EXPIRED.
     * 3. Hoàn tiền ký quỹ về ví khách hàng.
     * 4. Hủy các đơn ứng tuyển/lời mời PENDING.
     * 5. Gửi thông báo cho khách hàng và thợ.
     */
    @Transactional
    public void cleanupExpiredJobs() {
        LocalDate today = LocalDate.now();
        LocalTime now = LocalTime.now();
        LocalDateTime nowDateTime = LocalDateTime.now();

        List<JobPost> expiredPosts = jobPostRepository.findExpiredJobPosts(today, now, nowDateTime);
        if (expiredPosts.isEmpty()) {
            log.debug("[Auto-Expiry] Không có bài đăng nào hết hạn.");
            return;
        }

        log.info("[Auto-Expiry] Tìm thấy {} bài đăng cần hết hạn lúc {}.", expiredPosts.size(), LocalDateTime.now());

        for (JobPost jobPost : expiredPosts) {
            try {
                expireSingleJobPost(jobPost);
            } catch (Exception e) {
                // Log lỗi nhưng tiếp tục xử lý các bài đăng còn lại
                log.error("[Auto-Expiry] Lỗi khi xử lý bài đăng #{}: {}", jobPost.getPostId(), e.getMessage(), e);
            }
        }

        log.info("[Auto-Expiry] Hoàn tất xử lý {} bài đăng hết hạn.", expiredPosts.size());
    }

    /**
     * Xử lý hết hạn cho một bài đăng cụ thể.
     */
    private void expireSingleJobPost(JobPost jobPost) {
        Long postId = jobPost.getPostId();
        Long customerId = jobPost.getCustomerId();

        log.info("[Auto-Expiry] Xử lý bài đăng #{} - '{}'  (ngày: {}, giờ: {})",
                postId, jobPost.getTitle(), jobPost.getWorkDate(), jobPost.getStartTime());

        // 1. Chuyển trạng thái bài đăng sang EXPIRED
        jobPost.setStatus("EXPIRED");
        jobPostRepository.save(jobPost);

        // 2. Hoàn tiền ký quỹ về ví khách hàng
        try {
            walletService.refundHold(
                    customerId,
                    jobPost.getOfferPrice(),
                    postId,
                    "Bài đăng tự động hết hạn do quá giờ làm việc");
            log.info("[Auto-Expiry] Đã hoàn {} VNĐ về ví khách hàng #{} cho bài đăng #{}.",
                    jobPost.getOfferPrice(), customerId, postId);
        } catch (Exception e) {
            log.warn("[Auto-Expiry] Không thể hoàn tiền cho khách #{} (bài #{}): {}",
                    customerId, postId, e.getMessage());
        }

        // 3. Lấy danh sách ứng tuyển đang PENDING và hủy tất cả
        List<JobApplication> pendingApps = jobApplicationRepository.findByPostId(postId).stream()
                .filter(app -> "PENDING".equals(app.getStatus()))
                .collect(Collectors.toList());

        for (JobApplication app : pendingApps) {
            app.setStatus("CANCELLED");
            jobApplicationRepository.save(app);

            // 4. Thông báo cho từng thợ đã ứng tuyển/được mời
            notificationService.createNotification(
                    app.getHelperId(),
                    "Công việc đã hết hạn",
                    String.format(
                            "Công việc '%s' (vào lúc %s ngày %s) đã hết hạn vì khách hàng chưa xác nhận. Bạn có thể tìm thêm việc mới!",
                            jobPost.getTitle(), jobPost.getStartTime(), jobPost.getWorkDate()),
                    "JOB_EXPIRED");
            log.debug("[Auto-Expiry] Đã báo hủy cho thợ #{} (bài #{}).", app.getHelperId(), postId);
        }

        // 5. Thông báo cho khách hàng
        notificationService.createNotification(
                customerId,
                "Bài đăng đã tự động hết hạn",
                String.format(
                        "Bài đăng '%s' (lúc %s ngày %s) đã hết hạn vì chưa có thợ được chốt. Tiền giữ chỗ đã được hoàn lại vào ví của bạn.",
                        jobPost.getTitle(), jobPost.getStartTime(), jobPost.getWorkDate()),
                "JOB_POST_EXPIRED");

        log.info("[Auto-Expiry] Bài đăng #{} đã hết hạn. Đã hủy {} đơn ứng tuyển PENDING và gửi thông báo.",
                postId, pendingApps.size());
    }

    private void validateCleaningMaxDuration(Integer categoryId, Integer durationHours) {
        if (categoryId == null || durationHours == null) {
            return;
        }
        if (categoryId == 1 && durationHours > MAX_CLEANING_DURATION_HOURS) {
            throw new ApiException(
                    "Dịch vụ dọn dẹp nhà chỉ được đặt tối đa " + MAX_CLEANING_DURATION_HOURS + " giờ.",
                    HttpStatus.BAD_REQUEST);
        }
    }

    private com.homeconnect.core.enums.ServiceUnit getCategoryUnit(Integer categoryId) {
        return serviceCategoryRepository.findById(categoryId)
                .map(com.homeconnect.core.entity.ServiceCategory::getUnit)
                .orElse(com.homeconnect.core.enums.ServiceUnit.PER_HOUR);
    }

    private void validateWorkSizeAndDuration(Integer categoryId, Integer hours, Double workSize) {
        if (workSize == null || workSize <= 0)
            return;

        // Skip hours check for task-based categories
        if (com.homeconnect.core.enums.ServiceUnit.PER_SERVICE.equals(getCategoryUnit(categoryId))) {
            // Only validate workSize limits if any
            if (categoryId == 2 && workSize > 8) {
                throw new ApiException("Số người ăn tối đa là 8 người", HttpStatus.BAD_REQUEST);
            }
            return;
        }

        if (hours == null)
            return;

        switch (categoryId) {
            case 1: // Dọn dẹp nhà (m2)
                if (workSize > 100 && hours < 4)
                    throw new ApiException("Diện tích trên 100m2 cần tối thiểu 4 giờ", HttpStatus.BAD_REQUEST);
                if (workSize > 80 && hours < 3)
                    throw new ApiException("Diện tích trên 80m2 cần tối thiểu 3 giờ", HttpStatus.BAD_REQUEST);
                if (workSize > 60 && hours < 2)
                    throw new ApiException("Diện tích trên 60m2 cần tối thiểu 2 giờ", HttpStatus.BAD_REQUEST);
                break;
            case 2: // Nấu ăn
                // Validate number of people (workSize)
                if (workSize > 8) {
                    throw new ApiException("Số người ăn tối đa là 8 người", HttpStatus.BAD_REQUEST);
                }
                break;
            case 4: // Vệ sinh văn phòng (m2 sàn)
                if (workSize > 150 && hours < 4)
                    throw new ApiException("Diện tích trên 150m2 cần tối thiểu 4 giờ", HttpStatus.BAD_REQUEST);
                if (workSize > 100 && hours < 3)
                    throw new ApiException("Diện tích trên 100m2 cần tối thiểu 3 giờ", HttpStatus.BAD_REQUEST);
                if (workSize > 60 && hours < 2)
                    throw new ApiException("Diện tích trên 60m2 cần tối thiểu 2 giờ", HttpStatus.BAD_REQUEST);
                break;
            case 6: // Làm vườn (m2)
                if (workSize > 80 && hours < 4)
                    throw new ApiException("Diện tích trên 80m2 cần tối thiểu 4 giờ", HttpStatus.BAD_REQUEST);
                if (workSize > 50 && hours < 3)
                    throw new ApiException("Diện tích trên 50m2 cần tối thiểu 3 giờ", HttpStatus.BAD_REQUEST);
                break;
            case 7: // Sơn sửa (hạng mục)
                if (workSize > 4 && hours < 4)
                    throw new ApiException("Trên 4 hạng mục cần tối thiểu 4 giờ", HttpStatus.BAD_REQUEST);
                if (workSize > 2 && hours < 3)
                    throw new ApiException("Trên 2 hạng mục cần tối thiểu 3 giờ", HttpStatus.BAD_REQUEST);
                break;
        }

        if (hours > 12) {
            throw new ApiException("Thời lượng làm việc tối đa là 12 giờ", HttpStatus.BAD_REQUEST);
        }
    }
}
