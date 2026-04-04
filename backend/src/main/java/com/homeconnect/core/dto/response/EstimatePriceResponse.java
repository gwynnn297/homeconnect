package com.homeconnect.core.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * Response DTO cho API estimate price - BE-Post-01
 * Trả về giá ước tính cho job post
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EstimatePriceResponse {

    private BigDecimal estimatedPrice;
    private BigDecimal basePrice;
    private java.util.List<ServiceFee> serviceFees;

    @Builder.Default
    private String currency = "VND";

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ServiceFee {
        private String name;
        private BigDecimal price;
    }
}