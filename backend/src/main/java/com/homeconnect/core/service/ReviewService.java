package com.homeconnect.core.service;

import com.homeconnect.core.dto.request.CreateReviewRequest;
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
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final BookingRepository bookingRepository;
    private final HelperProfileRepository helperProfileRepository;

    /**
     * Gửi đánh giá cho một đơn hàng đã hoàn thành
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

        if (reviewRepository.existsByBookingId(request.getBookingId())) {
            throw new ApiException("Đơn hàng này đã được đánh giá rồi", HttpStatus.BAD_REQUEST);
        }

        // 2. Lưu Review
        Review review = Review.builder()
                .booking(booking)
                .customer(booking.getCustomer())
                .helper(booking.getHelper())
                .rating(request.getRating())
                .comment(request.getComment())
                .build();

        reviewRepository.save(review);

        // 3. Tính toán lại Rating cho Helper
        updateHelperRating(booking.getHelper().getId());
        
        log.info("Review submitted for booking {}. Rating: {}", booking.getId(), request.getRating());
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
}
