package com.homeconnect.core.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReviewStatsResponse {
    private Double averageRating;
    private Long totalReviews;
    private Map<Integer, Long> ratingDistribution; // Star -> Count (e.g., 5 -> 100, 4 -> 20)
}
