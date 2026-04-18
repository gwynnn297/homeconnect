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
public class AdminBookingDetailResponse {

    private Long bookingId;
    private Long jobPostId;

    private Long customerId;
    private String customerName;
    private String customerEmail;
    private String customerPhone;

    private Long helperId;
    private String helperName;
    private String helperEmail;
    private String helperPhone;

    private String serviceName;
    private Integer categoryId;

    private String addressDetail;
    private String wardName;
    private String districtName;
    private String provinceName;
    private String addressFormatted;

    private BookingStatus status;
    private PaymentStatus paymentStatus;
    private BigDecimal totalPrice;

    private LocalDateTime scheduledStartTime;
    private LocalDateTime scheduledEndTime;
    private LocalDateTime expiredAt;

    private LocalDateTime arrivedAt;
    private String arrivalProofImage;
    private String checkinPhotoUrl;
    private LocalDateTime checkedInAt;

    private Boolean customerArrivalConfirmed;
    private LocalDateTime customerArrivalConfirmedAt;
    private LocalDateTime confirmedStartAt;

    private String checkoutPhotoUrl;
    private String checkoutReason;
    private LocalDateTime checkedOutAt;

    private LocalDateTime confirmedDoneAt;

    private Boolean isFlagged;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
