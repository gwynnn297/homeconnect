package com.homeconnect.core.dto.response;

import com.homeconnect.core.enums.BookingStatus;
import com.homeconnect.core.enums.PaymentStatus;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingResponse {
    private Long bookingId;
    private Long customerId;
    private String customerName;
    private Long helperId;
    private String helperName;
    private String serviceName;
    private LocalDateTime scheduledStartTime;
    private LocalDateTime scheduledEndTime;
    private LocalDateTime arrivedAt;
    private String arrivalProofImage;
    private Boolean customerArrivalConfirmed;
    private LocalDateTime customerArrivalConfirmedAt;
    private BookingStatus status;
    private BigDecimal totalPrice;
    private BigDecimal originalPrice;
    private BigDecimal discountRate;
    private BigDecimal discountAmount;
    private BigDecimal finalPrice;
    private String tierAtBooking;
    private String address;
    private PaymentStatus paymentStatus;
    private String disputeReason;
    private String evidenceUrl;
    private LocalDateTime disputedAt;
    private LocalDateTime disputeResolvedAt;
    private String disputeResolutionAction;
}
