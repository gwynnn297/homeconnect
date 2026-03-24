package com.homeconnect.core.dto.request.admin;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Positive;
import lombok.*;

import java.math.BigDecimal;

/**
 * Request DTO để cập nhật thông tin dịch vụ (Dùng cho Patch)
 * Các trường đều là optional, cái nào truyền lên mới cập nhật cái đó.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateServiceRequest {
    private String name;

    @Positive(message = "Giá cơ bản phải lớn hơn 0")
    @JsonProperty("base_price")
    private BigDecimal basePrice;


    private String description;


    
    @JsonProperty("is_active")
    private Boolean isActive;
}
