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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Service layer cho Job Posts - BE-Post-01 & BE-Post-02
 * Xử lý logic business cho job posting, estimate pricing và hold money
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JobService {

        private static final int MIN_LEAD_TIME_HOURS = 2;

    private final ServiceRepository serviceRepository;
    private final JobPostRepository jobPostRepository;
    private final WalletService walletService;
    private final GeocodingService geocodingService;
    private final ApplicationEventPublisher eventPublisher;

    /**
     * BE-Post-01: Tính giá ước tính cho job post
     * Logic: estimated_price = base_price * duration_hours
     */
    public EstimatePriceResponse estimatePrice(EstimatePriceRequest request) {
        log.info("Estimating price for service {} with {} hours", request.getServiceId(), request.getDurationHours());

        // Tìm service theo ID
        Service service = serviceRepository.findById(request.getServiceId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Không tìm thấy dịch vụ với ID: " + request.getServiceId()));

        // Kiểm tra service có active không
        if (!Boolean.TRUE.equals(service.getIsActive())) {
            throw new IllegalArgumentException("Dịch vụ này hiện không khả dụng: " + service.getName());
        }

        // Tính giá ước tính
        BigDecimal basePrice = service.getBasePrice();
        BigDecimal durationHours = BigDecimal.valueOf(request.getDurationHours());
        BigDecimal estimatedPrice = basePrice.multiply(durationHours);

        log.info("Estimated price calculated: {} VND (base: {} x hours: {})",
                estimatedPrice, basePrice, durationHours);

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
        log.info("Creating job post for customer {}, service {}, {} hours",
                customerId, request.getServiceId(), request.getDurationHours());

                LocalDateTime requestedWorkDateTime = request.getWorkDate().atTime(request.getStartTime());
                LocalDateTime minAllowedDateTime = LocalDateTime.now().plusHours(MIN_LEAD_TIME_HOURS);
                if (requestedWorkDateTime.isBefore(minAllowedDateTime)) {
                        throw new IllegalArgumentException("Thời gian làm việc phải đặt trước tối thiểu " + MIN_LEAD_TIME_HOURS + " tiếng");
                }

        GeocodingService.GeoResult geoResult = geocodingService.geocodeByAddressText(request.getAddressDetail());
        String normalizedAddress = geoResult.getNormalizedAddress() != null && !geoResult.getNormalizedAddress().isBlank()
                ? geoResult.getNormalizedAddress()
                : request.getAddressDetail().trim();

        // 1. Tính lại giá thật (KHÔNG TIN FRONTEND)
        Service service = serviceRepository.findById(request.getServiceId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Không tìm thấy dịch vụ với ID: " + request.getServiceId()));

        if (!Boolean.TRUE.equals(service.getIsActive())) {
            throw new IllegalArgumentException("Dịch vụ này hiện không khả dụng: " + service.getName());
        }

        BigDecimal finalPrice = service.getBasePrice().multiply(BigDecimal.valueOf(request.getDurationHours()));
        log.info("💰 Final price calculated: {} VND", finalPrice);

        // 2. Tạo JobPost (nhưng chưa commit)
        JobPost jobPost = JobPost.builder()
                .customerId(customerId)
                .serviceId(request.getServiceId())
                .title(request.getTitle() != null ? request.getTitle()
                        : "Cần " + service.getName() + " - " + request.getDurationHours() + " giờ")
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
            log.info("💎 Money held successfully: {} VND for user {}", finalPrice, customerId);
        } catch (Exception e) {
            log.error("❌ Failed to hold money for job post {}: {}", jobPost.getPostId(), e.getMessage());
            throw new RuntimeException("Ví không đủ số dư để đăng tin - " + e.getMessage());
        }

        // 4. Publish event để kích hoạt matching sau khi transaction commit thành công
        eventPublisher.publishEvent(new JobPostCreatedEvent(jobPost.getPostId()));

        // 5. Trả về response
        return JobPostResponse.builder()
                .postId(jobPost.getPostId())
                .serviceId(service.getServiceId())
                .serviceName(service.getName())
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
}