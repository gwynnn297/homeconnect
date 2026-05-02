package com.homeconnect.core.dto.response;

import com.homeconnect.core.enums.BookingStatus;
import com.homeconnect.core.enums.PaymentStatus;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

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
    private Integer categoryId;
    private String serviceName;
    private LocalDateTime scheduledStartTime;
    private LocalDateTime scheduledEndTime;
    private LocalDate workDate;
    private LocalTime startTime;
    private Integer durationHours;
    private LocalDateTime arrivedAt;
    private String arrivalProofImage;
    private Boolean customerArrivalConfirmed;
    private LocalDateTime customerArrivalConfirmedAt;
    private String checkoutPhotoUrl;
    private String checkoutReason;
    private LocalDateTime checkedOutAt;
    private LocalDateTime confirmedStartAt;
    private LocalDateTime confirmedDoneAt;
    private Boolean isFlagged;
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
    private LocalDateTime createdAt;
    private Double workSize;
    private String description;
    private String serviceIds;
    private Boolean isPremium;
    private Boolean hasPets;
    private Boolean bringTools;
    private java.util.Map<String, Object> additionalData;
    private Boolean isVipCustomer;
    private Boolean canCheckin;
    
    private String cancelReason;
    private String cancelSource;
    private String subServiceNames;
    
    // Address Details
    private String wardName;
    private String districtName;
    private String provinceName;
}
