package com.homeconnect.core.dto.response.admin;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

/**
 * Response DTO cho danh mục dịch vụ (Dùng cho Admin chọn khi tạo Service)
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ServiceCategoryResponse {
    @JsonProperty("category_id")
    private Integer categoryId;
    
    private String name;
    
    @JsonProperty("icon_url")
    private String iconUrl;
}
