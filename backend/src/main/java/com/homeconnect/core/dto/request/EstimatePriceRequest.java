package com.homeconnect.core.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request DTO cho API estimate price - BE-Post-01
 * Tính toán giá tạm thời cho job post trước khi khách hàng đăng
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EstimatePriceRequest {

    @NotNull(message = "Service ID không được để trống")
    @Positive(message = "Service ID phải là số dương")
    private Integer serviceId;

    @NotNull(message = "Số giờ không được để trống")
    @Positive(message = "Số giờ phải lớn hơn 0")
    private Integer durationHours;
}