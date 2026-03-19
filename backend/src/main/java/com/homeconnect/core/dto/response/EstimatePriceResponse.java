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

    @Builder.Default
    private String currency = "VND";
}