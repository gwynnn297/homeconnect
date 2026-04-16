package com.homeconnect.core.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Yeu cau xac minh eKYC bang AI")
public class KycVerifyRequest {

    @Schema(description = "URL anh CCCD mat truoc", example = "https://storage.com/cccd-front.jpg")
    private String cccdFrontUrl;

    @Schema(description = "URL anh selfie", example = "https://storage.com/selfie.jpg")
    private String selfieUrl;

    @Schema(description = "So CCCD fallback neu OCR khong trich duoc", example = "012345678901")
    private String identityNumberFallback;
}
