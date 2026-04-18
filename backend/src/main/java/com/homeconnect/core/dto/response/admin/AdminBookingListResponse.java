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
public class AdminBookingListResponse {

    private List<AdminBookingListItemResponse> bookings;
    private long totalElements;
    private int totalPages;
    private int currentPage;
    private int pageSize;
    private String message;
}
