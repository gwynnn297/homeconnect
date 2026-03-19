package com.homeconnect.core.dto.request.admin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.*;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateCategoryRequest {
    @NotBlank(message = "Tên danh mục không được để trống")
    private String name;

    private String description;

    @NotNull(message = "Giá cơ bản không được để trống")
    @PositiveOrZero(message = "Giá cơ bản không được âm")
    private java.math.BigDecimal basePrice;

    @NotBlank(message = "Đơn vị tính không được để trống")
    private String unit;
}
