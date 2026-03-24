package com.homeconnect.core.service;

import com.homeconnect.core.dto.request.CreateJobPostRequest;
import com.homeconnect.core.dto.request.EstimatePriceRequest;
import com.homeconnect.core.dto.response.EstimatePriceResponse;
import com.homeconnect.core.dto.response.JobPostResponse;
import com.homeconnect.core.entity.JobPost;
import com.homeconnect.core.entity.Service;
import com.homeconnect.core.event.JobPostCreatedEvent;
import com.homeconnect.core.repository.JobPostRepository;
import com.homeconnect.core.repository.ServiceRepository;
import com.homeconnect.core.repository.JobApplicationRepository;
import com.homeconnect.core.repository.BookingRepository;
import com.homeconnect.core.repository.HelperScheduleRepository;
import com.homeconnect.core.repository.HelperServiceRepository;
import com.homeconnect.core.repository.HelperWorkingDistrictRepository;
import com.homeconnect.core.repository.ServiceCategoryRepository;
import com.homeconnect.core.enums.BookingStatus;
import com.homeconnect.core.entity.ServiceCategory;

import com.homeconnect.core.exception.ApiException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;


import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.ArrayList;
import java.util.Collections;
import java.util.stream.Collectors;

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
    private final BookingRepository bookingRepository;
    private final HelperScheduleRepository helperScheduleRepository;
    private final ServiceCategoryRepository serviceCategoryRepository;
    private final WalletService walletService;
    private final GeocodingService geocodingService;
    private final ApplicationEventPublisher eventPublisher;


    /**
     * BE-Post-01: Tính giá ước tính cho job post
     * Logic: estimated_price = base_price * duration_hours
     */
    public EstimatePriceResponse estimatePrice(EstimatePriceRequest request) {
        log.info("Estimating price for category {}, duration {} hours",
                request.getCategoryId(), request.getDurationHours());

        // Tìm danh mục dịch vụ theo ID
        ServiceCategory category = serviceCategoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Không tìm thấy danh mục dịch vụ với ID: " + request.getCategoryId()));

        // Kiểm tra danh mục có active không
        if (!Boolean.TRUE.equals(category.getIsActive())) {
            throw new IllegalArgumentException("Danh mục này hiện không khả dụng: " + category.getName());
        }

        // Tính giá ước tính: (Giá Cha * Số giờ) + Giá Con (nếu có)
        BigDecimal categoryPrice = category.getBasePrice();
        BigDecimal durationHours = BigDecimal.valueOf(request.getDurationHours());
        BigDecimal estimatedPrice = categoryPrice.multiply(durationHours);

        if (request.getServiceIds() != null && !request.getServiceIds().isEmpty()) {
            for (Integer sId : request.getServiceIds()) {
                com.homeconnect.core.entity.Service service = serviceRepository.findById(sId)
                        .orElseThrow(() -> new ApiException("Dịch vụ con " + sId + " không tồn tại", HttpStatus.BAD_REQUEST));
                if (service.getBasePrice() != null) {
                    estimatedPrice = estimatedPrice.add(service.getBasePrice());
                }
            }
        }



        log.info("Estimated price: {} VND (Category: {} * {}h + Service surcharge)", 
                estimatedPrice, categoryPrice, durationHours);


        return EstimatePriceResponse.builder()
                .estimatedPrice(estimatedPrice)
                .currency("VND")
                .build();
    }

    /**
     * BE-Post-02: Tạo job post và giữ tiền
     * TRANSACTION CRITICAL: Sử dụng @Transactional để rollback nếu có lỗi
     */
    @Transactional
    public JobPostResponse createJobPost(CreateJobPostRequest request, Long customerId) {
        log.info("Creating job post for customer {}, services {}, {} hours",
                customerId, request.getServiceIds(), request.getDurationHours());


                LocalDateTime requestedWorkDateTime = request.getWorkDate().atTime(request.getStartTime());
                LocalDateTime minAllowedDateTime = LocalDateTime.now().plusHours(MIN_LEAD_TIME_HOURS);
                if (requestedWorkDateTime.isBefore(minAllowedDateTime)) {
                        throw new IllegalArgumentException("Thời gian làm việc phải đặt trước tối thiểu " + MIN_LEAD_TIME_HOURS + " tiếng");
                }

        GeocodingService.GeoResult geoResult = geocodingService.geocodeByAddressText(request.getAddressDetail());
        String normalizedAddress = geoResult.getNormalizedAddress() != null && !geoResult.getNormalizedAddress().isBlank()
                ? geoResult.getNormalizedAddress()
                : request.getAddressDetail().trim();

        // 1. Tính giá dựa trên Danh mục (Cha)
        ServiceCategory category = serviceCategoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Không tìm thấy danh mục dịch vụ với ID: " + request.getCategoryId()));

        if (!Boolean.TRUE.equals(category.getIsActive())) {
            throw new IllegalArgumentException("Danh mục này hiện không khả dụng: " + category.getName());
        }

        // 1. Tính giá: (Giá Cha * Số giờ) + Tổng Giá Con (nếu có)
        BigDecimal finalPrice = category.getBasePrice().multiply(BigDecimal.valueOf(request.getDurationHours()));
        
        java.util.List<Integer> sIds = request.getServiceIds();
        StringBuilder serviceNames = new StringBuilder();
        String serviceIdStr = null;

        if (sIds != null && !sIds.isEmpty()) {
            serviceIdStr = sIds.stream().map(String::valueOf).collect(java.util.stream.Collectors.joining(","));
            for (Integer sId : sIds) {
                com.homeconnect.core.entity.Service service = serviceRepository.findById(sId)
                        .orElseThrow(() -> new ApiException("Dịch vụ con " + sId + " không tồn tại", HttpStatus.BAD_REQUEST));
                
                // Kiểm tra xem dịch vụ con có thuộc về danh mục cha đã chọn không
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
        
        log.info("💰 Final price: {} VND (Category: {} + Services: {})", 
                finalPrice, category.getName(), serviceNames.length() > 0 ? serviceNames.toString() : "None");


        // 2. Tạo JobPost
        JobPost jobPost = JobPost.builder()
                .customerId(customerId)
                .serviceId(serviceIdStr)
                .category(category)
                .title(request.getTitle() != null ? request.getTitle()
                        : "Cần " + (serviceNames.length() > 0 ? serviceNames.toString() : category.getName()) + " - " + request.getDurationHours() + " giờ")




                .description(request.getDescription())
                .addressDetail(normalizedAddress)
                .latitude(geoResult.getLatitude())
                .longitude(geoResult.getLongitude())
                .workDate(request.getWorkDate())
                .startTime(request.getStartTime())
                .durationHours(request.getDurationHours())
                .offerPrice(finalPrice)
                .status("PUBLISHED")
                .expiresAt(LocalDateTime.now().plusDays(3)) // Hết hạn sau 3 ngày
                .build();

        // Save để lấy ID
        jobPost = jobPostRepository.save(jobPost);
        log.info("Job post created with ID: {}", jobPost.getPostId());

        // 3. Gọi hàm giữ tiền (CRITICAL POINT)
        // Nếu hàm này ném lỗi (ví không đủ tiền), @Transactional sẽ rollback jobPost
        try {
            walletService.holdMoney(customerId, finalPrice, jobPost.getPostId());
            log.info(" Money held successfully: {} VND for user {}", finalPrice, customerId);
        } catch (Exception e) {
            log.error(" Failed to hold money for job post {}: {}", jobPost.getPostId(), e.getMessage());
            throw new RuntimeException("Ví không đủ số dư để đăng tin - " + e.getMessage());
        }


        // 4. Publish event để kích hoạt matching sau khi transaction commit thành công
        eventPublisher.publishEvent(new JobPostCreatedEvent(jobPost.getPostId()));

        // 5. Trả về response
        return JobPostResponse.builder()
                .postId(jobPost.getPostId())
                .serviceIds(request.getServiceIds())
                .serviceNames(serviceNames.toString())

                .title(jobPost.getTitle())
                .description(jobPost.getDescription())
                .addressDetail(jobPost.getAddressDetail())
                .latitude(jobPost.getLatitude())
                .longitude(jobPost.getLongitude())
                .workDate(jobPost.getWorkDate())
                .startTime(jobPost.getStartTime())
                .durationHours(jobPost.getDurationHours())
                .offerPrice(jobPost.getOfferPrice())
                .currency("VND")
                .status(jobPost.getStatus())
                .createdAt(jobPost.getCreatedAt())
                .expiresAt(jobPost.getExpiresAt())
                .categoryId(category.getCategoryId())
                .categoryName(category.getName())
                .build();

    }


    /**
     * BE-Job-01: Lấy danh sách việc làm phù hợp cho Helper (Text-based matching)
     */
    public java.util.List<JobPostResponse> getHelperJobFeed(Long helperId) {
        log.info("Fetching job feed for helper {}", helperId);

        // 1. Lấy danh sách ID danh mục thợ có thể làm (Cha)
        java.util.List<Integer> categoryIds = helperServiceRepository.findByHelper_Id(helperId).stream()
                .map(hs -> hs.getCategory().getCategoryId())
                .collect(java.util.stream.Collectors.toList());


        // 2. Lấy danh sách tên quận của helper
        java.util.List<String> helperDistricts = helperWorkingDistrictRepository.findByHelper_Id(helperId).stream()
                .map(com.homeconnect.core.entity.HelperWorkingDistrict::getDistrictName)
                .map(this::normalizeLocationText)
                .collect(java.util.stream.Collectors.toList());

        if (categoryIds.isEmpty() || helperDistricts.isEmpty()) {
            return java.util.Collections.emptyList();
        }


        // 3. Lấy các job công khai khớp với danh mục của thợ
        java.util.List<JobPost> activeJobs = jobPostRepository.findActiveJobPosts(java.time.LocalDate.now(), java.time.LocalDateTime.now()).stream()
                .filter(jp -> jp.getCategory() != null && categoryIds.contains(jp.getCategory().getCategoryId()))
                .filter(jp -> !jobApplicationRepository.existsByPostIdAndHelperId(jp.getPostId(), helperId))
                .collect(java.util.stream.Collectors.toList());


        // 4. Lọc theo địa chỉ (Word-boundary matching để tránh "Quận 1" khớp nhầm "Quận 12")
        return activeJobs.stream()
                .filter(jp -> {
                    String jobAddr = normalizeLocationText(jp.getAddressDetail());
                    return helperDistricts.stream().anyMatch(hd -> {
                        if (hd == null || hd.isBlank()) return false;
                        // Dùng word boundary để "quan 1" không khớp với "quan 12"
                        String pattern = "(?<![\\w\\d])" + java.util.regex.Pattern.quote(hd) + "(?![\\w\\d])";
                        return java.util.regex.Pattern.compile(pattern).matcher(jobAddr).find();
                    });
                })
                .map(this::mapToJobPostResponse)
                .collect(java.util.stream.Collectors.toList());
    }


    /**
     * BE-Job-01: Lấy tất cả các bài đăng việc làm đang được đăng tải (không lọc kỹ năng/khu vực)
     * Đã bao gồm lọc: status=PUBLISHED, workDate>=today, expiresAt>now, và chưa ứng tuyển.
     */
    public java.util.List<JobPostResponse> getAllPublishedJobs(Long helperId) {
        log.info("Fetching all published job posts for helper {}", helperId);
        
        return jobPostRepository.findActiveJobPosts(java.time.LocalDate.now(), java.time.LocalDateTime.now()).stream()
                .filter(jp -> !jobApplicationRepository.existsByPostIdAndHelperId(jp.getPostId(), helperId))
                .map(this::mapToJobPostResponse)
                .collect(java.util.stream.Collectors.toList());
    }


    /**
     * BE-Job-01: Thợ ứng tuyển vào việc làm (Apply)
     */
    @Transactional
    public void applyForJob(Long jobId, Long helperId) {
        log.info("Helper {} applying for job {}", helperId, jobId);

        JobPost jobPost = jobPostRepository.findById(jobId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy tin đăng việc với ID: " + jobId));

        if (!"PUBLISHED".equals(jobPost.getStatus())) {
            throw new IllegalStateException("Tin này hiện không cho phép ứng tuyển");
        }

        if (jobApplicationRepository.existsByPostIdAndHelperId(jobId, helperId)) {
            throw new IllegalStateException("Bạn đã ứng tuyển công việc này rồi");
        }

        // Category Match Check: Chỉ helper đăng ký đúng Danh mục Cha mới được ứng tuyển
        Integer jobCategoryId = jobPost.getCategory() != null ? jobPost.getCategory().getCategoryId() : null;
        if (jobCategoryId == null || !helperServiceRepository.existsByHelper_IdAndCategory_CategoryId(helperId, jobCategoryId)) {
            throw new IllegalStateException("Bạn chưa đăng ký kỹ năng cho danh mục '"
                    + (jobPost.getCategory() != null ? jobPost.getCategory().getName() : "N/A")
                    + "'. Vui lòng cập nhật hồ sơ trước.");
        }

        // District Match Check: Kiểm tra Quận/Huyện của công việc có nằm trong danh sách thợ đăng ký không
        java.util.List<String> helperDistricts = helperWorkingDistrictRepository.findByHelper_Id(helperId).stream()
                .map(com.homeconnect.core.entity.HelperWorkingDistrict::getDistrictName)
                .map(this::normalizeLocationText)
                .collect(java.util.stream.Collectors.toList());

        String jobAddrNormalized = normalizeLocationText(jobPost.getAddressDetail());
        boolean districtMatch = helperDistricts.stream().anyMatch(hd -> {
            if (hd == null || hd.isBlank()) return false;
            String pattern = "(?<![\\w\\d])" + java.util.regex.Pattern.quote(hd) + "(?![\\w\\d])";
            return java.util.regex.Pattern.compile(pattern).matcher(jobAddrNormalized).find();
        });

        if (!districtMatch) {
            throw new IllegalStateException("Công việc này nằm ngoài khu vực hoạt động bạn đã đăng ký (" 
                    + jobPost.getAddressDetail() + ")");
        }


        // Conflict Check (Availability)
        long availableSlots = helperScheduleRepository.countAvailableSchedules(
                helperId, jobPost.getWorkDate(), jobPost.getStartTime(), 
                jobPost.getStartTime().plusHours(jobPost.getDurationHours()));
        
        if (availableSlots == 0) {
            throw new IllegalStateException("Bạn không có lịch rảnh phù hợp cho công việc này");
        }

        // Conflict Check (Overlap Booking)
        LocalDateTime start = jobPost.getWorkDate().atTime(jobPost.getStartTime());
        LocalDateTime end = start.plusHours(jobPost.getDurationHours());
        long overlaps = bookingRepository.countOverlappingBookings(helperId, 
                java.util.Arrays.asList(BookingStatus.CONFIRMED, 
                                     BookingStatus.ARRIVED,
                                     BookingStatus.IN_PROGRESS), 
                start, end);


        
        if (overlaps > 0) {
            throw new IllegalStateException("Bạn đã có đơn hàng khác bị trùng lịch");
        }

        // Save
        com.homeconnect.core.entity.JobApplication application = com.homeconnect.core.entity.JobApplication.builder()
                .postId(jobId)
                .helperId(helperId)
                .type("APPLIED")
                .status("PENDING")
                .build();
        jobApplicationRepository.save(application);
    }

    private JobPostResponse mapToJobPostResponse(JobPost jobPost) {
        java.util.List<Integer> sIds = new java.util.ArrayList<>();
        StringBuilder sNames = new StringBuilder();

        if (jobPost.getServiceId() != null && !jobPost.getServiceId().isEmpty()) {
            String[] split = jobPost.getServiceId().split(",");
            for (String idStr : split) {
                try {
                    Integer sId = Integer.parseInt(idStr.trim());
                    sIds.add(sId);
                    serviceRepository.findById(sId).ifPresent(s -> {
                        if (sNames.length() > 0) sNames.append(", ");
                        sNames.append(s.getName());
                    });
                } catch (NumberFormatException ignored) {}
            }
        }

        return JobPostResponse.builder()
                .postId(jobPost.getPostId())
                .serviceIds(sIds)
                .serviceNames(sNames.toString())

                .categoryId(jobPost.getCategory() != null ? jobPost.getCategory().getCategoryId() : null)
                .categoryName(jobPost.getCategory() != null ? jobPost.getCategory().getName() : null)
                .title(jobPost.getTitle())



                .description(jobPost.getDescription())
                .addressDetail(jobPost.getAddressDetail())
                .latitude(jobPost.getLatitude())
                .longitude(jobPost.getLongitude())
                .workDate(jobPost.getWorkDate())
                .startTime(jobPost.getStartTime())
                .durationHours(jobPost.getDurationHours())
                .offerPrice(jobPost.getOfferPrice())
                .currency("VND")
                .status(jobPost.getStatus())
                .createdAt(jobPost.getCreatedAt())
                .expiresAt(jobPost.getExpiresAt())
                .build();
    }

    private String normalizeLocationText(String text) {
        if (text == null) return "";
        String normalized = java.text.Normalizer.normalize(text, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return normalized.toLowerCase()
                .replaceAll("\\b(quan|huyen|thi xa|thanh pho|tp\\.?)\\b", "")
                .replaceAll("[^a-z0-9\\s]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }
}
