package com.homeconnect.core.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import io.swagger.v3.oas.annotations.media.Schema;
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

    private java.util.List<Integer> serviceIds;


    @NotNull(message = "Category ID không được để trống")
    @Positive(message = "Category ID phải là số dương")
    private Integer categoryId;


    @NotNull(message = "Số giờ không được để trống")
    @Min(value = 1, message = "Số giờ tối thiểu là 1")
    @Max(value = 12, message = "Số giờ tối đa là 12")
    private Integer durationHours;


    @Schema(description = "Số lượng/Diện tích (m2, số bé, số máy...)", example = "60.5")
    private Double workSize;



    @Schema(description = "Dữ liệu bổ sung — phải giống body khi POST /api/v1/jobs để giá khớp (đi chợ, nấu ăn, …)")
    private java.util.Map<String, Object> additionalData;
}