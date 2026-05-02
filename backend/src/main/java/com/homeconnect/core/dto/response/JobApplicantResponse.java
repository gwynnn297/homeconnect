package com.homeconnect.core.dto.response;

import lombok.*;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JobApplicantResponse {
    private Long applicationId;
    private Long helperId;
    private String fullName;
    private String avatarUrl;
    private Double rating;
    private Integer reviewCount;
    private String bio;
    private String status;
    private Boolean hasOverlap;
    private List<String> topReviews;
}
