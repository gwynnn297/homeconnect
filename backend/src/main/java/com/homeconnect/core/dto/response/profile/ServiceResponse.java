package com.homeconnect.core.dto.response.profile;

import lombok.*;
import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ServiceResponse {
    private Integer id;
    private String name;
    private String iconUrl;
    private BigDecimal basePrice;
    private String unit;
}
