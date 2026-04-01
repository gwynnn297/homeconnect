package com.homeconnect.core.controller;

import com.homeconnect.core.dto.request.CreateReviewRequest;
import com.homeconnect.core.dto.request.UpdateReviewRequest;
import com.homeconnect.core.dto.response.ApiResponse;
import com.homeconnect.core.dto.response.ReviewResponse;
import com.homeconnect.core.dto.response.ReviewStatsResponse;
import com.homeconnect.core.service.ReviewService;
import com.homeconnect.core.util.SecurityUtil;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/v1/reviews")
@RequiredArgsConstructor
@Tag(name = "Reviews", description = "API quản lý đánh giá và nhận xét của khách hàng")
public class ReviewController {

    private final ReviewService reviewService;
    private final SecurityUtil securityUtil;

    @Operation(summary = "Gửi đánh giá dịch vụ", description = "Khách hàng gửi điểm số và nhận xét sau khi đơn hàng hoàn thành (Hạn 7 ngày)")
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

    @Operation(summary = "Chỉnh sửa đánh giá", description = "Cho phép khách hàng sửa đánh giá trong vòng 24h kể từ khi gửi")
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ApiResponse<Void>> updateReview(
            @PathVariable Integer id,
            @Valid @RequestBody UpdateReviewRequest request,
            Authentication authentication) {
        
        Long customerId = securityUtil.getCurrentUserId(authentication);
        reviewService.updateReview(id, request, customerId);
        
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .message("Cập nhật đánh giá thành công")
                .build());
    }

    @Operation(summary = "Lấy danh sách đánh giá của thợ", description = "Lấy danh sách nhận xét công khai của một thợ cụ thể (phân trang)")
    @GetMapping("/helper/{helperId}")
    public ResponseEntity<ApiResponse<List<ReviewResponse>>> getHelperReviews(
            @PathVariable Long helperId,
            @ParameterObject @PageableDefault(size = 10, sort = "createdAt,desc") Pageable pageable) {
        
        List<ReviewResponse> reviews = reviewService.getReviewsByHelperId(helperId, pageable);
        
        return ResponseEntity.ok(ApiResponse.<List<ReviewResponse>>builder()
                .data(reviews)
                .build());
    }

    @Operation(summary = "Lấy thống kê đánh giá của thợ", description = "Lấy điểm trung bình và phân bổ 1-5 sao của thợ")
    @GetMapping("/helper/{helperId}/stats")
    public ResponseEntity<ApiResponse<ReviewStatsResponse>> getHelperReviewStats(@PathVariable Long helperId) {
        return ResponseEntity.ok(ApiResponse.<ReviewStatsResponse>builder()
                .data(reviewService.getReviewStats(helperId))
                .build());
    }

    @Operation(summary = "Lấy lịch sử đánh giá của tôi", description = "Khách hàng xem lại các đánh giá mình đã gửi")
    @GetMapping("/my-reviews")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ApiResponse<List<ReviewResponse>>> getMyReviews(
            Authentication authentication,
            @ParameterObject @PageableDefault(size = 10, sort = "createdAt,desc") Pageable pageable) {
        
        Long customerId = securityUtil.getCurrentUserId(authentication);
        List<ReviewResponse> reviews = reviewService.getReviewsByCustomerId(customerId, pageable);
        
        return ResponseEntity.ok(ApiResponse.<List<ReviewResponse>>builder()
                .data(reviews)
                .build());
    }

    @Operation(summary = "Lấy đánh giá theo đơn hàng", description = "Kiểm tra xem đơn hàng đã được đánh giá chưa và lấy chi tiết")
    @GetMapping("/booking/{bookingId}")
    public ResponseEntity<ApiResponse<ReviewResponse>> getReviewByBooking(@PathVariable Long bookingId) {
        ReviewResponse review = reviewService.getReviewByBookingId(bookingId);
        return ResponseEntity.ok(ApiResponse.<ReviewResponse>builder()
                .data(review)
                .build());
    }
}
