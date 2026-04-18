package com.homeconnect.core.dto.response.admin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminJobPostListItemResponse {

    private Long postId;
    private Long customerId;
    private String customerName;
    private String title;
    private Integer categoryId;
    private String categoryName;
    private String status;
    private LocalDate workDate;
    private LocalTime startTime;
    private BigDecimal offerPrice;
    private String districtName;
    private LocalDateTime createdAt;
}
