package com.homeconnect.core.dto.response.admin;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class AdminViolationItemResponse {
    private Long violationId;
    private Long userId;
    private String userName;
    private String userRole;
    private Long bookingId;
    private String violationType;
    private String severity;
    private BigDecimal penaltyAmount;
    private String note;
    private LocalDateTime createdAt;
}
