package com.homeconnect.core.dto.response.admin;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class AdminAuditLogListResponse {
    private List<AdminAuditLogItemResponse> logs;
    private long totalElements;
    private int totalPages;
    private int currentPage;
    private int pageSize;
    private String message;
}
