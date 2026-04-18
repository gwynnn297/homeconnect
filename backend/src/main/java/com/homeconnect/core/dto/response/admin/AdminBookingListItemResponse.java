package com.homeconnect.core.dto.response.admin;

import com.homeconnect.core.enums.BookingStatus;
import com.homeconnect.core.enums.PaymentStatus;
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
public class AdminBookingListItemResponse {

    private Long bookingId;
    private Long customerId;
    private String customerName;
    private Long helperId;
    private String helperName;
    private String serviceName;
    private BookingStatus status;
    private PaymentStatus paymentStatus;
    private BigDecimal totalPrice;
    private LocalDateTime scheduledStartTime;
    private LocalDateTime scheduledEndTime;
    private Boolean isFlagged;
    private LocalDateTime createdAt;
}
