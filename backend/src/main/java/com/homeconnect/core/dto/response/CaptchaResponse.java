package com.homeconnect.core.dto.response;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class CaptchaResponse {
    private String captchaId;
    private String captchaText; // In a real app, this would be an image (Base64)
}
