package com.homeconnect.core.dto.response.service;

import com.homeconnect.core.dto.response.admin.ServiceResponse;
import lombok.*;

import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CategoryResponse {
    private Integer categoryId;
    private String name;
    private String description;
    private java.math.BigDecimal basePrice;
    private String unit;
    private Boolean isActive;
    private List<ServiceResponse> services;
}
