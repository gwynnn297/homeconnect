package com.homeconnect.core.dto.response.admin;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class AdminJobPostEditLogListResponse {
    private List<AdminJobPostEditLogItemResponse> logs;
    private long totalElements;
    private int totalPages;
    private int currentPage;
    private int pageSize;
    private String message;
}
