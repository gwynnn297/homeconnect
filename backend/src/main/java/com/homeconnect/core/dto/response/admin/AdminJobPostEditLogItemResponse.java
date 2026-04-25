package com.homeconnect.core.dto.response.admin;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class AdminJobPostEditLogItemResponse {
    private Long editLogId;
    private Long postId;
    private Long editedBy;
    private Integer revisionNo;
    private String oldTitle;
    private String newTitle;
    private String oldDescription;
    private String newDescription;
    private LocalDateTime createdAt;
}
