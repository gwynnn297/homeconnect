package com.homeconnect.core.controller;

import com.homeconnect.core.dto.request.CreateReviewRequest;
import com.homeconnect.core.dto.response.ApiResponse;
import com.homeconnect.core.service.ReviewService;
import com.homeconnect.core.util.SecurityUtil;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/v1/reviews")
@RequiredArgsConstructor
@Tag(name = "Reviews", description = "API quản lý đánh giá và nhận xét của khách hàng")
public class ReviewController {

    private final ReviewService reviewService;
    private final SecurityUtil securityUtil;

    @Operation(summary = "Gửi đánh giá dịch vụ", description = "Khách hàng gửi điểm số và nhận xét sau khi đơn hàng hoàn thành")
    @PostMapping("")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ApiResponse<Void>> submitReview(
            @Valid @RequestBody CreateReviewRequest request,
            Authentication authentication) {
        
        Long customerId = securityUtil.getCurrentUserId(authentication);
        reviewService.submitReview(request, customerId);
        
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .message("Cảm ơn bạn đã gửi đánh giá!")
                .build());
    }
}
