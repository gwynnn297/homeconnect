package com.homeconnect.core.controller;

import com.homeconnect.core.dto.response.ApiResponse;
import com.homeconnect.core.dto.request.CreateJobPostRequest;
import com.homeconnect.core.dto.request.EstimatePriceRequest;
import com.homeconnect.core.dto.response.EstimatePriceResponse;
import com.homeconnect.core.dto.response.JobPostResponse;
import com.homeconnect.core.service.JobService;
import com.homeconnect.core.util.SecurityUtil;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * Job Posts Controller - BE-Post-01 & BE-Post-02
 * Quản lý các API liên quan đến job posting, matching và estimate pricing
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/jobs")
@RequiredArgsConstructor
@Tag(name = "Job Posts", description = "API quản lý job posts và báo giá")
public class JobController {

    private final JobService jobService;
    private final SecurityUtil securityUtil;

    /**
     * POST /api/v1/jobs/estimate
     * BE-Post-01: API Báo giá tạm tính (Estimate Price)
     */
    @Operation(summary = "Báo giá tạm tính", description = "Tính toán giá ước tính cho job post dựa trên dịch vụ và số giờ")
    @PostMapping("/estimate")
    public ResponseEntity<ApiResponse<EstimatePriceResponse>> estimatePrice(
            @Valid @RequestBody EstimatePriceRequest request) {

        log.info("Received estimate price request: categoryId={}, serviceIds={}, durationHours={}",
                request.getCategoryId(), request.getServiceIds(), request.getDurationHours());



        EstimatePriceResponse response = jobService.estimatePrice(request);

        return ResponseEntity.ok(ApiResponse.<EstimatePriceResponse>builder()
                .message("Tính giá ước tính thành công")
                .data(response)
                .build());
    }

    /**
     * POST /api/v1/jobs
     * BE-Post-02: API Đăng tin & Giữ tiền (Core Transaction)
     */
    @Operation(summary = "Đăng tin tìm helper", description = "Tạo job post mới và tự động giữ tiền trong ví. Hệ thống sẽ tự động tìm helper phù hợp.")
    @PostMapping("")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ApiResponse<JobPostResponse>> createJobPost(
            @Valid @RequestBody CreateJobPostRequest request,
            Authentication authentication) {

        Long customerId = securityUtil.getCurrentUserId(authentication);

        log.info("Customer {} creating job post for category {} (services {})",
                customerId, request.getCategoryId(), request.getServiceIds());



        JobPostResponse response = jobService.createJobPost(request, customerId);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.<JobPostResponse>builder()
                        .message("Đăng tin thành công! Hệ thống đang tìm helper phù hợp cho bạn.")
                        .data(response)
                        .build());
    }
}