package com.homeconnect.core.dto.request.admin;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.homeconnect.core.enums.ServiceUnit;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.*;

import java.math.BigDecimal;

/**
 * Request DTO cho từng dịch vụ nhỏ bên trong một danh mục lớn
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateCategoryServiceItemRequest {
    @NotBlank(message = "Tên dịch vụ không được để trống")
    private String name;

    @NotNull(message = "Giá cơ bản không được để trống")
    @Positive(message = "Giá cơ bản phải lớn hơn 0")
    @JsonProperty("base_price")
    private BigDecimal basePrice;

    @NotNull(message = "Đơn vị tính không được để trống")
    private ServiceUnit unit;

    @JsonProperty("icon_url")
    private String iconUrl;

    private String description;
    
    @JsonProperty("is_active")
    private Boolean isActive;
}
