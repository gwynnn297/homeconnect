package com.homeconnect.core.dto.response.chat;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatHelperCandidateResponse {
    private Long helperId;
    private String fullName;
    private String avatarUrl;
    private BigDecimal ratingAverage;
    private Integer totalReviews;
    private BigDecimal estimatedPrice;
    private BigDecimal originalPrice;
    private BigDecimal discountRate;
    private BigDecimal discountAmount;
    private BigDecimal finalPrice;
    private String customerTier;
    private String customerTierLabel;
    private String districtName;
    private BigDecimal distanceKm;
    private LocalTime availableStartTime;
    private LocalTime availableEndTime;
    private BigDecimal basePrice;
    private BigDecimal otherFee;
    private List<ServiceFeeItem> subServices;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ServiceFeeItem {
        private String name;
        private BigDecimal price;
    }
}
