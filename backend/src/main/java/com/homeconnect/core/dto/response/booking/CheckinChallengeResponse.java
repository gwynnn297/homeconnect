package com.homeconnect.core.dto.response.booking;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class CheckinChallengeResponse {
    private String challengeId;
    private List<String> requiredActions;
    private Integer ttlSeconds;
    private LocalDateTime expiresAt;
}
