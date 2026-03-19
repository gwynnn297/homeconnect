package com.homeconnect.core.dto.request.admin;

import lombok.*;
import java.math.BigDecimal;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateCategoryRequest {
    private String name;
    private String description;
    private BigDecimal basePrice;
    private String unit;
    private Boolean isActive;
}
