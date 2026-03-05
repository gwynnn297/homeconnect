package com.homeconnect.core.dto.request.profile;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.*;

import java.math.BigDecimal;

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
    private String wardName;
    private String districtName;
    private String provinceName;
    
    @Schema(description = "Loại địa chỉ hoặc nhãn hiển thị", example = "HOME")
    private String addressLabel; // HOME, OFFICE, hoặc tên tự đặt

    @DecimalMin(value = "-90.0", message = "Vĩ độ không hợp lệ (-90 đến 90)")
    @DecimalMax(value = "90.0", message = "Vĩ độ không hợp lệ (-90 đến 90)")
    private BigDecimal latitude;

    @DecimalMin(value = "-180.0", message = "Kinh độ không hợp lệ (-180 đến 180)")
    @DecimalMax(value = "180.0", message = "Kinh độ không hợp lệ (-180 đến 180)")
    private BigDecimal longitude;
}
