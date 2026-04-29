package com.homeconnect.core.dto.response.admin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminDisputeListResponse {

    private List<AdminDisputeItemResponse> disputes;
    private long totalElements;
    private int totalPages;
    private int currentPage;
    private int pageSize;
    private String message;
}
