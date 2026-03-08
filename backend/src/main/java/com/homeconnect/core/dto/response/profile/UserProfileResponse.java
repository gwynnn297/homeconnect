package com.homeconnect.core.dto.response.profile;

import lombok.*;

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
    private String addressLabel;
}
