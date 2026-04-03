package com.homeconnect.core.dto.request.booking;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class CheckinVerifyRequest {

    @NotBlank(message = "challengeId không được để trống")
    private String challengeId;

    @NotBlank(message = "liveImageBase64 không được để trống")
    private String liveImageBase64;

    private String proofImageBase64;

    private String proofImageUrl;

    @NotEmpty(message = "performedActions không được rỗng")
    private List<String> performedActions;

    private BigDecimal latitude;

    private BigDecimal longitude;
}
