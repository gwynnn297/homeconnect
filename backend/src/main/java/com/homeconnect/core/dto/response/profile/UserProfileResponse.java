package com.homeconnect.core.dto.response.profile;

import lombok.*;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserProfileResponse {
    private Long id;
    private String fullName;
    private String email;
    private String phone;
    private String avatarUrl;
    private String role;
    private String gender;
    private String status;
    
    // Thông tin địa chỉ mặc định (PB-20)
    private String addressDetail;
    private String wardName;
    private String districtName;
    private String provinceName;
    private String provinceCode;
    private String districtCode;
    private String wardCode;
    private String addressLabel;

    private BigDecimal latitude;
    private BigDecimal longitude;
}
