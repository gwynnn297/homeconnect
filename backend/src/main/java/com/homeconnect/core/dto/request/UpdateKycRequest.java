package com.homeconnect.core.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request DTO for updating KYC information
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Thông tin nộp hồ sơ KYC")
public class UpdateKycRequest {

    @NotBlank(message = "Ảnh mặt trước CCCD không được để trống")
    @Schema(description = "URL ảnh mặt trước CCCD", example = "https://storage.com/cccd_front.jpg")
    private String cccdFront;

    @NotBlank(message = "Ảnh mặt sau CCCD không được để trống")
    @Schema(description = "URL ảnh mặt sau CCCD", example = "https://storage.com/cccd_back.jpg")
    private String cccdBack;

    @NotBlank(message = "Ảnh đại diện/selfie không được để trống")
    @Schema(description = "URL ảnh đại diện/selfie", example = "https://storage.com/avatar.jpg")
    private String avatar;

    @NotBlank(message = "Địa chỉ chi tiết không được để trống")
    @Schema(description = "Địa chỉ liên hệ cụ thể", example = "Số 123, Đường ABC, Phường XYZ")
    private String address;

    @NotNull(message = "ID quê quán không được để trống")
    @Schema(description = "ID của tỉnh/thành quê quán", example = "1")
    private Integer hometown;
}
