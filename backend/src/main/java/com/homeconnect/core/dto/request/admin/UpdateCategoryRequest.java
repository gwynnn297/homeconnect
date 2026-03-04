package com.homeconnect.core.dto.request.admin;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

/**
 * Request DTO để cập nhật thông tin Danh mục lớn
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateCategoryRequest {
    private String name;

    @JsonProperty("icon_url")
    private String iconUrl;

    @JsonProperty("is_active")
    private Boolean isActive;
}
