
package com.homeconnect.core.service;

import com.homeconnect.core.dto.request.CreateJobPostRequest;
import com.homeconnect.core.dto.request.EstimatePriceRequest;
import com.homeconnect.core.dto.response.EstimatePriceResponse;
import com.homeconnect.core.dto.request.UpdateJobPostRequest;
import com.homeconnect.core.dto.response.JobApplicationStatusResponse;
import com.homeconnect.core.dto.response.JobPostResponse;
import com.homeconnect.core.entity.Address;
import com.homeconnect.core.entity.JobPost;
import com.homeconnect.core.event.JobPostCreatedEvent;
import com.homeconnect.core.repository.JobPostRepository;
import com.homeconnect.core.repository.ServiceRepository;
import com.homeconnect.core.repository.JobApplicationRepository;
import com.homeconnect.core.repository.HelperScheduleRepository;
import com.homeconnect.core.repository.HelperServiceRepository;
import com.homeconnect.core.repository.HelperWorkingDistrictRepository;
import com.homeconnect.core.repository.ServiceCategoryRepository;
import com.homeconnect.core.entity.ServiceCategory;
import com.homeconnect.core.repository.AddressRepository;
import com.homeconnect.core.entity.JobApplication;
import java.util.stream.Collectors;
import java.util.Optional;

import com.homeconnect.core.exception.ApiException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;

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

/**
 * Service layer cho Job Posts - BE-Post-01 & BE-Post-02
 * Xử lý logic business cho job posting, estimate pricing và hold money
 */
@Slf4j
@org.springframework.stereotype.Service
@RequiredArgsConstructor
public class JobService {

    private static final int MIN_LEAD_TIME_HOURS = 2;

    private final ServiceRepository serviceRepository;
    private final JobPostRepository jobPostRepository;
    private final HelperServiceRepository helperServiceRepository;
    private final HelperWorkingDistrictRepository helperWorkingDistrictRepository;
    private final JobApplicationRepository jobApplicationRepository;
    private final ServiceCategoryRepository serviceCategoryRepository;
    private final WalletService walletService;
    private final AddressRepository addressRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final NotificationService notificationService;
    private final HelperScheduleRepository helperScheduleRepository;

    public EstimatePriceResponse estimatePrice(EstimatePriceRequest request) {
        log.info("Estimating price for category {}, duration {} hours",
                request.getCategoryId(), request.getDurationHours());

        ServiceCategory category = serviceCategoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Không tìm thấy danh mục dịch vụ với ID: " + request.getCategoryId()));

        if (!Boolean.TRUE.equals(category.getIsActive())) {
            throw new IllegalArgumentException("Danh mục này hiện không khả dụng: " + category.getName());
        }

        BigDecimal categoryPrice = category.getBasePrice();
        BigDecimal durationHours = BigDecimal.valueOf(request.getDurationHours());
        BigDecimal estimatedPrice = categoryPrice.multiply(durationHours);
    
    // Cộng phí Premium nếu khách yêu cầu trong bản tính thử
    if (Boolean.TRUE.equals(request.getIsPremium())) {
        estimatedPrice = estimatedPrice.add(BigDecimal.valueOf(50000));
        log.info("Included 50,000 VND Premium surcharge in estimate");
    }

    if (request.getServiceIds() != null && !request.getServiceIds().isEmpty()) {
            for (Integer sId : request.getServiceIds()) {
                com.homeconnect.core.entity.Service service = serviceRepository.findById(sId)
                        .orElseThrow(() -> new ApiException("Dịch vụ con " + sId + " không tồn tại", HttpStatus.BAD_REQUEST));
                if (service.getBasePrice() != null) {
                    estimatedPrice = estimatedPrice.add(service.getBasePrice());
                }
            }
        }

        log.info("Estimated price: {} VND", estimatedPrice);

        return EstimatePriceResponse.builder()
                .estimatedPrice(estimatedPrice)
                .currency("VND")
                .build();
    }

    @Transactional
    public JobPostResponse createJobPost(CreateJobPostRequest request, Long customerId) {
        log.info("Creating job post for customer {}, services {}, {} hours",
                customerId, request.getServiceIds(), request.getDurationHours());

        LocalDateTime requestedWorkDateTime = request.getWorkDate().atTime(request.getStartTime());
        LocalDateTime minAllowedDateTime = LocalDateTime.now().plusHours(MIN_LEAD_TIME_HOURS);
        if (requestedWorkDateTime.isBefore(minAllowedDateTime)) {
            throw new IllegalArgumentException("Thời gian làm việc phải đặt trước tối thiểu " + MIN_LEAD_TIME_HOURS + " tiếng");
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

        // Giá = (Giá Cha * Số giờ) + Phí Premium + Tổng Giá Con
        BigDecimal finalPrice = category.getBasePrice().multiply(BigDecimal.valueOf(request.getDurationHours()));

        if (Boolean.TRUE.equals(request.getIsPremium())) {
            finalPrice = finalPrice.add(BigDecimal.valueOf(50000));
            log.info("Added 50,000 VND for Premium service");
        }

        java.util.List<Integer> sIds = request.getServiceIds();
        StringBuilder serviceNames = new StringBuilder();
        String serviceIdStr = null;

        if (sIds != null && !sIds.isEmpty()) {
            serviceIdStr = sIds.stream().map(String::valueOf).collect(java.util.stream.Collectors.joining(","));
            for (Integer sId : sIds) {
                com.homeconnect.core.entity.Service service = serviceRepository.findById(sId)
                        .orElseThrow(() -> new ApiException("Dịch vụ con " + sId + " không tồn tại", HttpStatus.BAD_REQUEST));

                if (service.getCategory() == null || !service.getCategory().getCategoryId().equals(category.getCategoryId())) {
                    throw new ApiException("Dịch vụ con " + service.getName() + " không thuộc về danh mục " + category.getName(), HttpStatus.BAD_REQUEST);
                }

                if (service.getBasePrice() != null) {
                    finalPrice = finalPrice.add(service.getBasePrice());
                }
                if (serviceNames.length() > 0) serviceNames.append(", ");
                serviceNames.append(service.getName());
            }
        }

        // --- 3. Tạo JobPost ---
        JobPost jobPost = JobPost.builder()
                .customerId(customerId)
                .serviceId(serviceIdStr)
                .category(category)
                .title(request.getTitle() != null ? request.getTitle()
                        : "Cần " + (serviceNames.length() > 0 ? serviceNames.toString() : category.getName()) + " - " + request.getDurationHours() + " giờ")
                .description(request.getDescription())
                .address(savedAddress)
                .workDate(request.getWorkDate())
                .startTime(request.getStartTime())
                .durationHours(request.getDurationHours())
                .offerPrice(finalPrice)
                .status("PUBLISHED")
                .expiresAt(LocalDateTime.now().plusDays(3))
                .workSize(request.getWorkSize())
                .isPremium(Boolean.TRUE.equals(request.getIsPremium()))
                .hasPets(Boolean.TRUE.equals(request.getHasPets()))
                .bringTools(Boolean.TRUE.equals(request.getIsPremium()))
                .build();

        jobPost = jobPostRepository.save(jobPost);

        // --- 4. Giữ tiền (nằm trong @Transactional, nếu lỗi sẽ tự rollback cả bước lưu JobPost) ---
        walletService.holdMoney(customerId, finalPrice, jobPost.getPostId());

        // --- 5. Publish event thông báo ---
        eventPublisher.publishEvent(new JobPostCreatedEvent(jobPost.getPostId()));

        return mapToJobPostResponse(jobPost, true);
    }

    // REMOVED autoSaveAddress (unused)

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

        List<JobPost> activeJobs = jobPostRepository.findActiveJobPosts(java.time.LocalDate.now(), java.time.LocalDateTime.now()).stream()
                .filter(jp -> jp.getCategory() != null && categoryIds.contains(jp.getCategory().getCategoryId()))
                .filter(jp -> !jobApplicationRepository.existsByPostIdAndHelperIdAndTypeAndStatusIn(jp.getPostId(), helperId, "APPLIED", List.of("PENDING", "ACCEPTED", "ASSIGNED")))
                .collect(Collectors.toList());

        return activeJobs.stream()
                .filter(jp -> {
                    // 1. Lọc theo Quận (Sử dụng equals để tránh nhầm Quận 1/12)
                    String jobDistrict = jp.getAddress() != null ? normalizeLocationText(jp.getAddress().getDistrictName()) : "";
                    boolean districtMatch = helperDistricts.stream().anyMatch(hd -> jobDistrict.equals(hd));
                    if (!districtMatch) return false;

                    // 2. Lọc theo Lịch rảnh (Phải có slot AVAILABLE bao trùm Job)
                    java.time.LocalTime endTime = jp.getStartTime().plusHours(jp.getDurationHours());
                    long availableCount = helperScheduleRepository.countAvailableSchedules(
                            helperId,
                            jp.getWorkDate(),
                            jp.getStartTime(),
                            endTime
                    );
                    return availableCount > 0;
                })
                .map(jp -> mapToJobPostResponse(jp, false))
                .collect(Collectors.toList());
    }

    public List<JobPostResponse> getAllPublishedJobs(Long helperId) {
        // Lấy tất cả các việc đang mở (PUBLISHED)
        // Chỉ lọc bỏ các việc thợ đã ứng tuyển rồi
        return jobPostRepository.findActiveJobPosts(java.time.LocalDate.now(), java.time.LocalDateTime.now()).stream()
                .filter(jp -> !jobApplicationRepository.existsByPostIdAndHelperIdAndTypeAndStatusIn(jp.getPostId(), helperId, "APPLIED", List.of("PENDING", "ACCEPTED", "ASSIGNED")))
                .map(jp -> mapToJobPostResponse(jp, false))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<JobPostResponse> getHelperJobsByTab(Long helperId, String tab) {
        String normalizedTab = tab == null ? "NEW" : tab.trim().toUpperCase();

        if ("NEW".equals(normalizedTab)) {
            return getAllPublishedJobs(helperId);
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

        return orderedPostIds.stream()
                .map(postById::get)
                .filter(Objects::nonNull)
                .map(jp -> mapToJobPostResponse(jp, false))
                .collect(Collectors.toList());
    }

    @Transactional
    public void applyForJob(Long jobId, Long helperId) {
        JobPost jobPost = jobPostRepository.findById(jobId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy tin đăng việc với ID: " + jobId));

        if (!"PUBLISHED".equals(jobPost.getStatus())) {
            throw new IllegalStateException("Tin này hiện không cho phép ứng tuyển");
        }

        Optional<com.homeconnect.core.entity.JobApplication> existingApp = jobApplicationRepository.findByPostIdAndHelperId(jobId, helperId);
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
                return;
            }
        }

        // --- Ràng buộc mới: Phải có lịch rảnh (AVAILABLE) mới được ứng tuyển ---
        validateHelperAvailability(jobPost, helperId);

        // Tạo application mới nếu chưa tồn tại bất kỳ loại nào

        com.homeconnect.core.entity.JobApplication application = com.homeconnect.core.entity.JobApplication.builder()
                .postId(jobId)
                .helperId(helperId)
                .type("APPLIED")
                .status("PENDING")
                .build();
        jobApplicationRepository.save(application);
    }

    private JobPostResponse mapToJobPostResponse(JobPost jobPost, boolean showAddressDetail) {
        List<Integer> sIds = parseServiceIds(jobPost.getServiceId());
        StringBuilder sNames = new StringBuilder();
        for (Integer id : sIds) {
            serviceRepository.findById(id).ifPresent(s -> {
                if (sNames.length() > 0) sNames.append(", ");
                sNames.append(s.getName());
            });
        }

        JobPostResponse.JobPostResponseBuilder builder = JobPostResponse.builder()
                .postId(jobPost.getPostId())
                .serviceIds(sIds)
                .serviceNames(sNames.toString())
                .categoryId(jobPost.getCategory() != null ? jobPost.getCategory().getCategoryId() : null)
                .categoryName(jobPost.getCategory() != null ? jobPost.getCategory().getName() : null)
                .title(jobPost.getTitle())
                .description(jobPost.getDescription())
                .addressId(jobPost.getAddress() != null ? jobPost.getAddress().getAddressId() : null)
                .wardName(jobPost.getAddress() != null ? jobPost.getAddress().getWardName() : null)
                .districtName(jobPost.getAddress() != null ? jobPost.getAddress().getDistrictName() : null)
                .provinceName(jobPost.getAddress() != null ? jobPost.getAddress().getProvinceName() : null)
                .workDate(jobPost.getWorkDate())
                .startTime(jobPost.getStartTime())
                .durationHours(jobPost.getDurationHours())
                .offerPrice(jobPost.getOfferPrice())
                .currency("VND")
                .status(jobPost.getStatus())
                .createdAt(jobPost.getCreatedAt())
                .workSize(jobPost.getWorkSize())
                .isPremium(jobPost.getIsPremium())
                .hasPets(jobPost.getHasPets())
                .bringTools(jobPost.getBringTools());

        // Nếu được yêu cầu hiển thị địa chỉ chi tiết (Dành cho Customer hoặc View riêng biệt)
        if (showAddressDetail && jobPost.getAddress() != null) {
            com.homeconnect.core.entity.Address addr = jobPost.getAddress();
            String fullAddress = String.join(", ",
                    addr.getAddressDetail() != null ? addr.getAddressDetail() : "",
                    addr.getWardName() != null ? addr.getWardName() : "",
                    addr.getDistrictName() != null ? addr.getDistrictName() : "",
                    addr.getProvinceName() != null ? addr.getProvinceName() : ""
            ).replaceAll(", $", "").replaceAll("^, ", "");

            builder.addressDetail(addr.getAddressDetail())
                   .latitude(addr.getLatitude())
                   .longitude(addr.getLongitude())
                   .fullAddress(fullAddress);
        }

        return builder.build();
    }

    private String normalizeLocationText(String text) {
        if (text == null) return "";
        return java.text.Normalizer.normalize(text, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase()
                .replaceAll("\\b(quan|huyen|thi xa|thanh pho|tp\\.?)\\b", "")
                .replaceAll("[^a-z0-9\\s]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    /**
     * [BE-Post-08] Helper hủy đơn sau khi đã nhận (Áp dụng mức phạt linh hoạt PB-24)
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
            walletService.compensateCustomer(jobPost.getCustomerId(), compensation, postId);
            
            log.info("⚠ Đã phạt Helper {} số tiền {} VNĐ và bồi thường Khách {} số tiền {} VNĐ", 
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

        log.info("✅ Đã xử lý hủy đơn thành công cho Job #{}", postId);
    }

    /**
     * [BE-Post-03] Lấy danh sách bài đăng của khách hàng
     */
    public List<JobPostResponse> getCustomerJobs(Long customerId) {
        log.info("Lấy danh sách job post của customer {}", customerId);
        return jobPostRepository.findByCustomerIdOrderByCreatedAtDesc(customerId).stream()
                .map(jp -> mapToJobPostResponse(jp, true))
                .collect(Collectors.toList());
    }

    /**
     * [BE-Post-04] Lấy chi tiết bài đăng
     */
    public JobPostResponse getJobDetail(Long jobId, Long customerId) {
        JobPost jobPost = jobPostRepository.findById(jobId)
                .orElseThrow(() -> new ApiException("Không tìm thấy bài đăng", HttpStatus.NOT_FOUND));

        if (!jobPost.getCustomerId().equals(customerId)) {
            throw new ApiException("Bạn không có quyền xem bài đăng này", HttpStatus.FORBIDDEN);
        }

        return mapToJobPostResponse(jobPost, true);
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
            throw new ApiException("Chỉ có thể chỉnh sửa bài đăng khi đang ở trạng thái Đang tìm thợ", HttpStatus.BAD_REQUEST);
        }

        // Lưu giá cũ để so sánh
        BigDecimal oldPrice = jobPost.getOfferPrice();

        // Cập nhật các trường
        if (request.getTitle() != null) jobPost.setTitle(request.getTitle());
        if (request.getDescription() != null) jobPost.setDescription(request.getDescription());
        if (request.getWorkDate() != null) jobPost.setWorkDate(request.getWorkDate());
        if (request.getStartTime() != null) jobPost.setStartTime(request.getStartTime());
        if (request.getDurationHours() != null) jobPost.setDurationHours(request.getDurationHours());
        if (request.getWorkSize() != null) jobPost.setWorkSize(request.getWorkSize());
        if (request.getIsPremium() != null) jobPost.setIsPremium(request.getIsPremium());
        if (request.getHasPets() != null) jobPost.setHasPets(request.getHasPets());
        if (request.getBringTools() != null) jobPost.setBringTools(request.getBringTools());

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
            throw new ApiException("Thời gian làm việc mới phải đặt trước tối thiểu " + MIN_LEAD_TIME_HOURS + " tiếng kể từ bây giờ", HttpStatus.BAD_REQUEST);
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
                        .orElseThrow(() -> new ApiException("Dịch vụ con " + sId + " không tồn tại", HttpStatus.BAD_REQUEST));
                
                if (service.getCategory() == null || !service.getCategory().getCategoryId().equals(jobPost.getCategory().getCategoryId())) {
                    throw new ApiException("Dịch vụ con " + service.getName() + " không thuộc về danh mục " + jobPost.getCategory().getName(), HttpStatus.BAD_REQUEST);
                }
            }

            String serviceIdStr = request.getServiceIds().stream()
                    .map(String::valueOf)
                    .collect(Collectors.joining(","));
            jobPost.setServiceId(serviceIdStr);
        }

        BigDecimal newPrice = calculatePrice(jobPost);
        jobPost.setOfferPrice(newPrice);

        // Xử lý chênh lệch tiền trong ví
        if (newPrice.compareTo(oldPrice) != 0) {
            log.info("Giá thay đổi từ {} sang {}. Đang điều chỉnh tiền giữ trong ví.", oldPrice, newPrice);
            walletService.refundHold(customerId, oldPrice, jobId, "Cập nhật bài đăng (Hoàn tiền cũ)");
            walletService.holdMoney(customerId, newPrice, jobId);
        }

        JobPost saved = jobPostRepository.save(jobPost);
        
        // --- QUAN TRỌNG: Chỉ kích hoạt lại Matching nếu các tiêu chí tìm thợ thay đổi ---
        if (isMatchingCriticalChanged) {
            log.info("Phát sự kiện cập nhật để tìm thợ mới cho Job #{} (Do thay đổi tiêu chí Matching)", jobId);
            eventPublisher.publishEvent(new JobPostCreatedEvent(jobId));
        } else {
            log.info("Cập nhật bài đăng Job #{} thành công (Không thay đổi tiêu chí Matching, giữ nguyên thợ cũ)", jobId);
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
            throw new ApiException("Chỉ có thể hủy bài đăng khi đang ở trạng thái Đang tìm thợ", HttpStatus.BAD_REQUEST);
        }

        // 1. Gửi thông báo đến các thợ đã ứng tuyển/mời (PENDING)
        List<JobApplication> apps = jobApplicationRepository.findByPostId(jobId);
        for (JobApplication app : apps) {
            if ("PENDING".equals(app.getStatus())) {
                notificationService.createNotification(
                    app.getHelperId(),
                    "Công việc bị hủy",
                    String.format("Công việc #%d (%s) đã bị khách hàng hủy.", jobId, jobPost.getTitle()),
                    "JOB_CANCELLED"
                );
            }
        }

        // 2. Hoàn tiền cho khách hàng
        walletService.refundHold(customerId, jobPost.getOfferPrice(), jobId, "Khách hàng hủy bài đăng");

        // 2. Hủy các lời mời/ứng tuyển đang chờ (PENDING)
        jobApplicationRepository.updateStatusByPostIdAndStatusIn(jobId, "CANCELLED", java.util.Arrays.asList("PENDING"));

        // Cập nhật trạng thái bài đăng
        jobPost.setStatus("CANCELLED");
        jobPostRepository.save(jobPost);
        
        log.info("Khách hàng {} đã hủy Job Post #{} thành công. Tiền đã hoàn, các lời mời đã hủy và gửi thông báo cho thợ.", customerId, jobId);
    }

    private BigDecimal calculatePrice(JobPost jobPost) {
        ServiceCategory category = jobPost.getCategory();
        BigDecimal price = category.getBasePrice().multiply(BigDecimal.valueOf(jobPost.getDurationHours()));

        if (Boolean.TRUE.equals(jobPost.getIsPremium())) {
            price = price.add(BigDecimal.valueOf(50000));
        }

        List<Integer> sIds = parseServiceIds(jobPost.getServiceId());
        BigDecimal totalPrice = price;
        for (Integer sId : sIds) {
            com.homeconnect.core.entity.Service service = serviceRepository.findById(sId).orElse(null);
            if (service != null && service.getBasePrice() != null) {
                totalPrice = totalPrice.add(service.getBasePrice());
            }
        }
        return totalPrice;
    }

    private void validateHelperAvailability(JobPost jobPost, Long helperId) {
        java.time.LocalTime endTime = jobPost.getStartTime().plusHours(jobPost.getDurationHours());
        long availableCount = helperScheduleRepository.countAvailableSchedules(
                helperId,
                jobPost.getWorkDate(),
                jobPost.getStartTime(),
                endTime
        );

        if (availableCount == 0) {
            throw new ApiException("Bạn chưa cài đặt lịch trống (AVAILABLE) vào khung giờ này hoặc đã bận việc khác. Vui lòng kiểm tra lại lịch làm việc của mình.", HttpStatus.BAD_REQUEST);
        }
    }

    private List<Integer> parseServiceIds(String serviceIdStr) {
        List<Integer> sIds = new ArrayList<>();
        if (serviceIdStr != null && !serviceIdStr.isEmpty()) {
            String[] split = serviceIdStr.split(",");
            for (String idStr : split) {
                try {
                    sIds.add(Integer.parseInt(idStr.trim()));
                } catch (NumberFormatException ignored) {}
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
        JobApplicationStatusResponse.JobApplicationStatusResponseBuilder builder = JobApplicationStatusResponse.builder()
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
                    addr.getProvinceName() != null ? addr.getProvinceName() : ""
            ).replaceAll(", $", "").replaceAll("^, ", "");

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
     *   1. Tìm các bài đăng PUBLISHED đã qua giờ bắt đầu.
     *   2. Chuyển trạng thái sang EXPIRED.
     *   3. Hoàn tiền ký quỹ về ví khách hàng.
     *   4. Hủy các đơn ứng tuyển/lời mời PENDING.
     *   5. Gửi thông báo cho khách hàng và thợ.
     */
    @Transactional
    public void cleanupExpiredJobs() {
        LocalDate today = LocalDate.now();
        LocalTime now = LocalTime.now();

        List<JobPost> expiredPosts = jobPostRepository.findExpiredJobPosts(today, now);
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
                "Bài đăng tự động hết hạn do quá giờ làm việc"
            );
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
                String.format("Công việc '%s' (vào lúc %s ngày %s) đã hết hạn vì khách hàng chưa xác nhận. Bạn có thể tìm thêm việc mới!",
                    jobPost.getTitle(), jobPost.getStartTime(), jobPost.getWorkDate()),
                "JOB_EXPIRED"
            );
            log.debug("[Auto-Expiry] Đã báo hủy cho thợ #{} (bài #{}).", app.getHelperId(), postId);
        }

        // 5. Thông báo cho khách hàng
        notificationService.createNotification(
            customerId,
            "Bài đăng đã tự động hết hạn",
            String.format("Bài đăng '%s' (lúc %s ngày %s) đã hết hạn vì chưa có thợ được chốt. Tiền giữ chỗ đã được hoàn lại vào ví của bạn.",
                jobPost.getTitle(), jobPost.getStartTime(), jobPost.getWorkDate()),
            "JOB_POST_EXPIRED"
        );

        log.info("[Auto-Expiry] Bài đăng #{} đã hết hạn. Đã hủy {} đơn ứng tuyển PENDING và gửi thông báo.",
                postId, pendingApps.size());
    }
}


