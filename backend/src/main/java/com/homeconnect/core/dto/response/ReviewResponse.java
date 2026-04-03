package com.homeconnect.core.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReviewResponse {
    private Integer id;
    private Long customerId;
    private String customerName;
    private Integer rating;
    private String comment;
    private String tags;
    private String evidencePhotoUrl;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
