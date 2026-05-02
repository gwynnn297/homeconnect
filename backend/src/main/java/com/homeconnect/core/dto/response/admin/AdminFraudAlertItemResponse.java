package com.homeconnect.core.dto.response.admin;

import com.homeconnect.core.enums.BookingStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminFraudAlertItemResponse {
    private Long bookingId;
    private String customerName;
    private String helperName;
    private String serviceName;
    private BookingStatus status;
    private BigDecimal totalPrice;
    private LocalDateTime scheduledStartTime;
    private LocalDateTime createdAt;
}
