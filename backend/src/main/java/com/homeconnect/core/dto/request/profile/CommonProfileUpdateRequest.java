package com.homeconnect.core.dto.request.profile;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.*;

/**
 * Request cập nhật hồ sơ chung (PB-08, PB-20)
 * Bao gồm thông tin cơ bản và địa chỉ mặc định
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CommonProfileUpdateRequest {

    @NotBlank(message = "Họ tên không được để trống")
    private String fullName;

    private String avatarUrl;

    @Pattern(regexp = "^(MALE|FEMALE|OTHER)$", message = "Giới tính không hợp lệ")
    private String gender;

    // Thông tin địa chỉ (PB-20)
    private String addressDetail;
    private Integer wardId;
    private Integer districtId;
    private Integer provinceId;
}
