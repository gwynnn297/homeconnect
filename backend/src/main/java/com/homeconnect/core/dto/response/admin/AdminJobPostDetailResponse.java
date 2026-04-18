package com.homeconnect.core.dto.response.admin;

import com.homeconnect.core.dto.response.JobPostResponse;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminJobPostDetailResponse {

    private JobPostResponse post;

    private Long customerId;
    private String customerName;
    private String customerEmail;
    private String customerPhone;

    /** Booking gắn với tin (marketplace / chốt thợ), có thể null */
    private Long linkedBookingId;
    private String linkedBookingStatus;

    private int applicationCount;
    private int pendingApplicationCount;
}
