package com.homeconnect.core.dto.response;

import com.homeconnect.core.enums.KycStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KycVerifyResponse {
    private boolean success;
    private String message;
    private String cccdNumber;
    private double faceConfidence;
    private KycStatus kycStatus;
}
