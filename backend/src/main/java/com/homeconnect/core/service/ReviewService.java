package com.homeconnect.core.service;

import com.homeconnect.core.dto.request.CreateReviewRequest;
import com.homeconnect.core.dto.response.ReviewResponse;
import com.homeconnect.core.entity.Booking;
import com.homeconnect.core.entity.HelperProfile;
import com.homeconnect.core.entity.Review;
import com.homeconnect.core.enums.BookingStatus;
import com.homeconnect.core.exception.ApiException;
import com.homeconnect.core.repository.BookingRepository;
import com.homeconnect.core.repository.HelperProfileRepository;
import com.homeconnect.core.repository.ReviewRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final BookingRepository bookingRepository;
    private final HelperProfileRepository helperProfileRepository;

    /**
     * Gửi đánh giá cho một đơn hàng đã hoàn thành
     * Ràng buộc PB-24: Trong vòng 7 ngày sau khi Job hoàn thành
     */
    @Transactional
    public void submitReview(CreateReviewRequest request, Long customerId) {
        // 1. Validate Booking
        Booking booking = bookingRepository.findById(request.getBookingId())
                .orElseThrow(() -> new ApiException("Không tìm thấy đơn hàng", HttpStatus.NOT_FOUND));

        if (!booking.getCustomer().getId().equals(customerId)) {
            throw new ApiException("Bạn không có quyền đánh giá đơn hàng này", HttpStatus.FORBIDDEN);
        }

        if (booking.getStatus() != BookingStatus.COMPLETED) {
            throw new ApiException("Chỉ có thể đánh giá đơn hàng đã hoàn thành", HttpStatus.BAD_REQUEST);
        }

        // Kiểm tra thời hạn 7 ngày (PB-24)
        LocalDateTime doneAt = booking.getConfirmedDoneAt() != null ? booking.getConfirmedDoneAt() : booking.getUpdatedAt();
        if (doneAt.plusDays(7).isBefore(LocalDateTime.now())) {
            throw new ApiException("Đã quá hạn 7 ngày để gửi đánh giá cho đơn hàng này", HttpStatus.BAD_REQUEST);
        }

        if (reviewRepository.existsByBookingId(request.getBookingId())) {
            throw new ApiException("Đơn hàng này đã được đánh giá rồi", HttpStatus.BAD_REQUEST);
        }

        // 2. Lọc từ ngữ thô tục (Profanity Filter)
        String filteredComment = filterProfanity(request.getComment());

        // 3. Lưu Review
        Review review = Review.builder()
                .booking(booking)
                .customer(booking.getCustomer())
                .helper(booking.getHelper())
                .rating(request.getRating())
                .comment(filteredComment)
                .tags(request.getTags())
                .evidencePhotoUrl(request.getEvidencePhotoUrl())
                .build();

        reviewRepository.save(review);

        // 4. Tính toán lại Rating cho Helper
        updateHelperRating(booking.getHelper().getId());
        
        log.info("[PB-24] Review submitted for booking {}. Rating: {}", booking.getId(), request.getRating());
    }

    /**
     * Chỉnh sửa đánh giá (PB-24)
     * Ràng buộc: Chỉ được phép sửa trong vòng 24h sau khi tạo, không được xóa hẳn.
     */
    @Transactional
    public void updateReview(Integer reviewId, com.homeconnect.core.dto.request.UpdateReviewRequest request, Long customerId) {
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ApiException("Không tìm thấy đánh giá", HttpStatus.NOT_FOUND));

        if (!review.getCustomer().getId().equals(customerId)) {
            throw new ApiException("Bạn không có quyền chỉnh sửa đánh giá này", HttpStatus.FORBIDDEN);
        }

        // Kiểm tra thời hạn 24h (PB-24)
        if (review.getCreatedAt().plusHours(24).isBefore(LocalDateTime.now())) {
            throw new ApiException("Đã quá 24h, bạn không thể chỉnh sửa đánh giá này nữa", HttpStatus.BAD_REQUEST);
        }

        if (request.getRating() != null) review.setRating(request.getRating());
        if (request.getComment() != null) review.setComment(filterProfanity(request.getComment()));
        if (request.getTags() != null) review.setTags(request.getTags());
        if (request.getEvidencePhotoUrl() != null) review.setEvidencePhotoUrl(request.getEvidencePhotoUrl());
        
        review.setUpdatedAt(LocalDateTime.now());
        reviewRepository.save(review);

        // Cập nhật lại Rating trung bình
        updateHelperRating(review.getHelper().getId());
        
        log.info("[PB-24] Review {} updated by customer {}.", reviewId, customerId);
    }

    private String filterProfanity(String text) {
        if (text == null || text.isBlank()) return text;
        // Placeholder cho bộ lọc từ ngữ thô tục
        List<String> badWords = List.of("chó", "đm", "vcl", "cl", "ngu");
        String result = text;
        for (String word : badWords) {
            String pattern = "(?i)" + word;
            result = result.replaceAll(pattern, "***");
        }
        return result;
    }

    /**
     * Tính toán lại trung bình cộng Rating và tổng số review cho Helper
     */
    @Transactional
    public void updateHelperRating(Long helperId) {
        HelperProfile profile = helperProfileRepository.findByUser_Id(helperId)
                .orElseThrow(() -> new ApiException("Không tìm thấy hồ sơ thợ", HttpStatus.NOT_FOUND));

        Double avgRating = reviewRepository.getAverageRatingByHelperId(helperId);
        Long totalReviews = reviewRepository.countReviewsByHelperId(helperId);

        if (avgRating != null) {
            profile.setRatingAverage(BigDecimal.valueOf(avgRating).setScale(2, RoundingMode.HALF_UP));
        } else {
            profile.setRatingAverage(BigDecimal.ZERO);
        }
        
        profile.setTotalReviews(totalReviews.intValue());
        helperProfileRepository.save(profile);
        
        log.debug("Updated rating for helper {}: avg={}, total={}", helperId, avgRating, totalReviews);
    }

    @Transactional(readOnly = true)
    public List<ReviewResponse> getReviewsByHelperId(Long helperId, Pageable pageable) {
        return reviewRepository.findByHelperIdAndIsVisibleTrueOrderByCreatedAtDesc(helperId, pageable)
                .stream()
                .map(r -> mapToReviewResponse(r, true)) // Ẩn danh khi thợ/khách khác xem
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ReviewResponse> getReviewsByCustomerId(Long customerId, Pageable pageable) {
        return reviewRepository.findByCustomerIdOrderByCreatedAtDesc(customerId, pageable)
                .stream()
                .map(r -> mapToReviewResponse(r, false)) // Không ẩn danh khi chính khách xem
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ReviewResponse getReviewByBookingId(Long bookingId) {
        return reviewRepository.findByBookingId(bookingId)
                .map(r -> mapToReviewResponse(r, false))
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public com.homeconnect.core.dto.response.ReviewStatsResponse getReviewStats(Long helperId) {
        Double avgRating = reviewRepository.getAverageRatingByHelperId(helperId);
        Long totalReviews = reviewRepository.countReviewsByHelperId(helperId);
        List<Object[]> distributionRaw = reviewRepository.getRatingDistributionByHelperId(helperId);

        java.util.Map<Integer, Long> distribution = new java.util.HashMap<>();
        // Initialize with 0 for stars 1 to 5
        for (int i = 1; i <= 5; i++) distribution.put(i, 0L);
        
        for (Object[] row : distributionRaw) {
            Integer rating = (Integer) row[0];
            Long count = (Long) row[1];
            distribution.put(rating, count);
        }

        return com.homeconnect.core.dto.response.ReviewStatsResponse.builder()
                .averageRating(avgRating != null ? BigDecimal.valueOf(avgRating).setScale(2, RoundingMode.HALF_UP).doubleValue() : 0.0)
                .totalReviews(totalReviews)
                .ratingDistribution(distribution)
                .build();
    }

    private ReviewResponse mapToReviewResponse(Review review, boolean anonymize) {
        String name = anonymize ? anonymizeName(review.getCustomer().getFullName()) : review.getCustomer().getFullName();
        return ReviewResponse.builder()
                .id(review.getId())
                .customerId(review.getCustomer().getId())
                .customerName(name)
                .rating(review.getRating())
                .comment(review.getComment())
                .tags(review.getTags())
                .evidencePhotoUrl(review.getEvidencePhotoUrl())
                .createdAt(review.getCreatedAt())
                .updatedAt(review.getUpdatedAt())
                .build();
    }

    private String anonymizeName(String fullName) {
        if (fullName == null || fullName.isBlank()) return "Khách hàng";
        String[] parts = fullName.split("\\s+");
        if (parts.length == 1) return parts[0].charAt(0) + "***";
        
        // "Nguyễn Văn A" -> "Nguyễn V."
        String firstName = parts[0];
        String lastName = parts[parts.length - 1];
        return firstName + " " + lastName.charAt(0) + ".";
    }
}
