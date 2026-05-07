package com.homeconnect.core.dto.response;

import com.homeconnect.core.entity.Address;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
@Schema(description = "Thông tin địa chỉ đã lưu")
public class AddressResponse {

    @Schema(description = "ID địa chỉ", example = "1")
    private Integer addressId;

    @Schema(description = "Số nhà, tên đường", example = "123 Nguyễn Huệ")
    private String addressDetail;

    @Schema(description = "Phường/Xã", example = "Phường Bến Nghé")
    private String wardName;

    @Schema(description = "Quận/Huyện", example = "Quận 1")
    private String districtName;

    @Schema(description = "Tỉnh/Thành phố", example = "TP.HCM")
    private String provinceName;

    @Schema(description = "Vĩ độ", example = "10.7769")
    private BigDecimal latitude;

    @Schema(description = "Kinh độ", example = "106.7009")
    private BigDecimal longitude;

    @Schema(description = "Loại địa chỉ: HOME, OFFICE, OTHER", example = "HOME")
    private String type;

    @Schema(description = "Địa chỉ mặc định", example = "false")
    private Boolean isDefault;

    @Schema(description = "Mã phường/xã", example = "20182")
    private String wardCode;

    @Schema(description = "Mã quận/huyện", example = "494")
    private String districtCode;

    @Schema(description = "Mã tỉnh/thành", example = "48")
    private String provinceCode;

    public static AddressResponse from(Address a) {
        return AddressResponse.builder()
                .addressId(a.getAddressId())
                .addressDetail(a.getAddressDetail())
                .wardName(a.getWardName())
                .districtName(a.getDistrictName())
                .provinceName(a.getProvinceName())
                .wardCode(a.getWardCode())
                .districtCode(a.getDistrictCode())
                .provinceCode(a.getProvinceCode())
                .latitude(a.getLatitude())
                .longitude(a.getLongitude())
                .type(a.getType())
                .isDefault(a.getIsDefault())
                .build();
    }
}
