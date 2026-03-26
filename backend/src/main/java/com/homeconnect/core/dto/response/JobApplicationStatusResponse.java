package com.homeconnect.core.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class JobApplicationStatusResponse {
    private Long applicationId;
    private String type;   // APPLIED, INVITED
    private String status; // PENDING, ACCEPTED, REJECTED, CANCELLED, EXPIRED
    private LocalDateTime createdAt;
    private boolean exists; // true nếu thợ đã có tương tác với bài này
}
