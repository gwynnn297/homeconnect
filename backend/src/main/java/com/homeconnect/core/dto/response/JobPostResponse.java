package com.homeconnect.core.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * Response DTO cho job post - BE-Post-02
 * Thông tin job post sau khi tạo thành công
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class JobPostResponse {

    private Long postId;
    private Integer serviceId;
    private String serviceName;
    private String title;
    private String description;
    private String addressDetail;
    private BigDecimal latitude;
    private BigDecimal longitude;
    private LocalDate workDate;
    private LocalTime startTime;
    private Integer durationHours;
    private BigDecimal offerPrice;
    private String currency;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime expiresAt;
}