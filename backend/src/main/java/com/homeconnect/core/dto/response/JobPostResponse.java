package com.homeconnect.core.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class JobPostResponse {
    private Long postId;
    private List<Integer> serviceIds;
    private String serviceNames;
    private String title;
    private String description;
    private Integer addressId;
    private String wardName;
    private String districtName;
    private String provinceName;
    private LocalDate workDate;
    private LocalTime startTime;
    private Integer durationHours;
    private BigDecimal offerPrice;
    private String currency;
    private String status;
    private LocalDateTime createdAt;

    private Double workSize;
    private Boolean isPremium;
    private Boolean hasPets;
    private Boolean bringTools;

    private Integer categoryId;
    private String categoryName;
}
