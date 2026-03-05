package com.homeconnect.core.dto.response.profile;

import lombok.*;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HelperProfileResponse {
    private String bio;
    private java.time.LocalDate dateOfBirth;
    private Integer experienceYears;
    private String hometownName;
    private List<ServiceSimpleResponse> services;
    private List<LocationResponse> workingDistricts;
    private String kycStatus;
    private Boolean isOnline;
    private java.math.BigDecimal ratingAverage;
    private Integer totalReviews;
}
