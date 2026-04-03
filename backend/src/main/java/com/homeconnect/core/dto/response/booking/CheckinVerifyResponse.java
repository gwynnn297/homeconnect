package com.homeconnect.core.dto.response.booking;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class CheckinVerifyResponse {
    private Boolean matched;
    private Double confidence;
    private Double threshold;
    private String bookingStatus;
    private String message;
}
