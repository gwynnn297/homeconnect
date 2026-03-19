package com.homeconnect.core.dto.response.admin;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.homeconnect.core.enums.ServiceUnit;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Response DTO để trả về thông tin dịch vụ sau khi tạo
 * Tránh trả trực tiếp Entity để bảo mật và tối ưu hiệu năng (Lazy Loading).
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ServiceResponse {
    @JsonProperty("service_id")
    private Integer serviceId;
    
    private String name;
    
    
    private String description;
    
    @JsonProperty("base_price")
    private BigDecimal basePrice;
    
    private ServiceUnit unit;
    
    
    @JsonProperty("is_active")
    private Boolean isActive;

    @JsonProperty("category_id")
    private Integer categoryId;

    @JsonProperty("category_name")
    private String categoryName;

    @JsonProperty("created_at")
    private LocalDateTime createdAt;

    @JsonProperty("updated_at")
    private LocalDateTime updatedAt;
}
