package com.homeconnect.core.dto.response;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Builder
public class VerifyForgotOtpResponse {
    private boolean success;
    private String resetToken;
}


