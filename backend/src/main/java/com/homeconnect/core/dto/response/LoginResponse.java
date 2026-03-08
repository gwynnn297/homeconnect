package com.homeconnect.core.dto.response;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Builder
public class LoginResponse {
    private String accessToken;
    private String tokenType;
    private Long expiresIn;
    private UserInfo user;

    @Getter
    @Setter
    @Builder
    public static class UserInfo {
        private Integer userId;
        private String fullName;
        private String email;
        private String phone;
        private String role;
        private String kycStatus;
    }
}
