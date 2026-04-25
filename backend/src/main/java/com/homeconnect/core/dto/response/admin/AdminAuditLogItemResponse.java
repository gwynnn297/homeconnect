package com.homeconnect.core.dto.response.admin;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class AdminAuditLogItemResponse {
    private Long auditId;
    private String eventType;
    private String eventLabel;
    private Long actorId;
    private String actorEmail;
    private String actorRole;
    private String targetType;
    private Long targetId;
    private String result;
    private String reason;
    private String metadataJson;
    private LocalDateTime createdAt;
}
