package com.homeconnect.core.dto.request.admin;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.homeconnect.core.enums.ServiceUnit;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.math.BigDecimal;

/**
 * Payload yêu cầu tạo mới dịch vụ (BE-Admin-01)
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateServiceRequest {

    @NotBlank(message = "Tên dịch vụ không được để trống")
    @Schema(description = "Tên dịch vụ", example = "Dọn nhà theo giờ")
    private String name;

    @NotNull(message = "Giá cơ bản không được để trống")
    @DecimalMin(value = "0.0", inclusive = false, message = "Giá cơ bản phải lớn hơn 0")
    @JsonProperty("base_price")
    @Schema(description = "Giá cơ bản (Giá sàn)", example = "80000")
    private BigDecimal basePrice;

    @NotNull(message = "Đơn vị tính không được để trống")
    @Schema(description = "Đơn vị tính (PER_HOUR, PER_SERVICE, PER_METERS, PER_ROOM)", example = "PER_HOUR")
    private ServiceUnit unit;


    @Schema(description = "Mô tả dịch vụ", example = "Dịch vụ dọn dẹp nhà cửa cơ bản theo giờ")
    private String description;

    @JsonProperty("is_active")
    @Schema(description = "Trạng thái hoạt động", example = "true")
    private Boolean isActive;
}
