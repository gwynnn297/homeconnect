package com.homeconnect.core.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Paginated response cho danh sách Helper
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HelperListResponse {

    private List<HelperListItemResponse> helpers;
    private long totalElements;
    private int totalPages;
    private int currentPage;
    private int pageSize;

    private String message;
}
