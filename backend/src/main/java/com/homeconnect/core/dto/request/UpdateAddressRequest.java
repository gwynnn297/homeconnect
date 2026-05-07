package com.homeconnect.core.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * DTO cập nhật địa chỉ.
 * Bắt buộc chọn từ gợi ý Goong (placeId). Backend tự geocode tọa độ và text chuẩn.
 */
@Data
public class UpdateAddressRequest {

    @NotBlank(message = "Số nhà, tên đường không được để trống")
    @Schema(description = "Số nhà, tên đường", example = "123 Nguyễn Huệ")
    private String addressDetail;

    @NotBlank(message = "Phường/Xã không được để trống")
    @Schema(description = "Phường/Xã", example = "Phường Bến Nghé")
    private String wardName;

    @NotBlank(message = "Quận/Huyện không được để trống")
    @Schema(description = "Quận/Huyện", example = "Quận 1")
    private String districtName;

    @NotBlank(message = "Tỉnh/Thành phố không được để trống")
    @Schema(description = "Tỉnh/Thành phố", example = "TP.HCM")
    private String provinceName;

    @Schema(description = "ID địa điểm từ Goong (Tùy chọn)", example = "ojE-Sc0mNigpxk3c0i1Fo9oyUSUGNR6Zscq8oa5Q")
    private String placeId;

    @Schema(description = "Loại địa chỉ: HOME, OFFICE, OTHER", example = "HOME")
    private String type;

    @Schema(description = "Đặt làm địa chỉ mặc định", example = "false")
    private Boolean isDefault;

    @Schema(description = "Mã phường/xã chuẩn (GSO code)", example = "20182")
    private String wardCode;

    @Schema(description = "Mã quận/huyện chuẩn (GSO code)", example = "494")
    private String districtCode;

    @Schema(description = "Mã tỉnh/thành chuẩn (GSO code)", example = "48")
    private String provinceCode;
}
