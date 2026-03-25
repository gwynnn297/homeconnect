package com.homeconnect.core.service;

import com.homeconnect.core.dto.request.CreateJobPostRequest;
import com.homeconnect.core.dto.request.EstimatePriceRequest;
import com.homeconnect.core.dto.response.EstimatePriceResponse;
import com.homeconnect.core.dto.response.JobPostResponse;
import com.homeconnect.core.entity.JobPost;
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
import com.homeconnect.core.repository.AddressRepository;
import com.homeconnect.core.repository.UserRepository;
import com.homeconnect.core.entity.User;
import com.homeconnect.core.entity.JobApplication;
import java.util.stream.Collectors;
import java.util.Optional;

import com.homeconnect.core.exception.ApiException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Collections;
import java.util.ArrayList;

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
    private final UserRepository userRepository;
    private final ApplicationEventPublisher eventPublisher;

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

        return mapToJobPostResponse(jobPost);
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
                    String jobDistrict = jp.getAddress() != null ? normalizeLocationText(jp.getAddress().getDistrictName()) : "";
                    return helperDistricts.stream().anyMatch(hd -> jobDistrict.contains(hd) || hd.contains(jobDistrict));
                })
                .map(this::mapToJobPostResponse)
                .collect(Collectors.toList());
    }

    public List<JobPostResponse> getAllPublishedJobs(Long helperId) {
        return jobPostRepository.findActiveJobPosts(java.time.LocalDate.now(), java.time.LocalDateTime.now()).stream()
                .map(this::mapToJobPostResponse)
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
                // Chuyển thành APPLIED (Chấp nhận lời mời)
                app.setType("APPLIED");
                app.setStatus("PENDING"); 
                jobApplicationRepository.save(app);
                return;
            }
        }

        // Tạo application mới nếu chưa tồn tại bất kỳ loại nào

        com.homeconnect.core.entity.JobApplication application = com.homeconnect.core.entity.JobApplication.builder()
                .postId(jobId)
                .helperId(helperId)
                .type("APPLIED")
                .status("PENDING")
                .build();
        jobApplicationRepository.save(application);
    }

    private JobPostResponse mapToJobPostResponse(JobPost jobPost) {
        List<Integer> sIds = parseServiceIds(jobPost.getServiceId());
        StringBuilder sNames = new StringBuilder();
        for (Integer id : sIds) {
            serviceRepository.findById(id).ifPresent(s -> {
                if (sNames.length() > 0) sNames.append(", ");
                sNames.append(s.getName());
            });
        }

        return JobPostResponse.builder()
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
                .bringTools(jobPost.getBringTools())
                .build();
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
}

