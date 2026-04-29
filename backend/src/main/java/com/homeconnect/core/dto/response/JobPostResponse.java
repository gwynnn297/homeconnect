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
    private BigDecimal basePrice;
    private List<ServiceFee> serviceFees;
    private String currency;
    private String status;
    private LocalDateTime createdAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ServiceFee {
        private String name;
        private BigDecimal price;
    }

    private Long bookingId;
    private String bookingStatus;
    private Boolean canCheckin;
    private Boolean customerArrivalConfirmed;
    private String arrivalProofImage;

    private String disputeReason;
    private String disputeEvidenceUrl;
    private LocalDateTime disputedAt;
    private String helperDisputeMessage;
    private String helperDisputeEvidenceUrl;
    private LocalDateTime helperDisputeAt;

    private Double workSize;
    private Boolean isPremium;
    private Boolean hasPets;
    private Boolean bringTools;

    private java.util.Map<String, Object> additionalData;

    private Integer categoryId;
    private String categoryName;

    // --- Thông tin chi tiết địa chỉ (Chỉ hiển thị cho Customer hoặc Helper đã được
    // accept) ---
    private String addressDetail;
    private BigDecimal latitude;
    private BigDecimal longitude;
    private String fullAddress;

    private BigDecimal originalPrice;
    private BigDecimal discountAmount;
    private BigDecimal finalPrice;
    private String customerTier;
    private Boolean isVipCustomer;
}
