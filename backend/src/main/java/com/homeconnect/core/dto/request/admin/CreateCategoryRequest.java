package com.homeconnect.core.dto.request.admin;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.util.List;

/**
 * Request DTO để Admin tạo Danh mục lớn kèm danh sách các dịch vụ nhỏ (nếu có)
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateCategoryRequest {
    @NotBlank(message = "Tên danh mục không được để trống")
    private String name;

    @JsonProperty("icon_url")
    private String iconUrl;

    @JsonProperty("services")
    private List<CreateCategoryServiceItemRequest> services;
}
