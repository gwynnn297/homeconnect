package com.homeconnect.core.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response DTO cho Broadcast Notification
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BroadcastNotificationResponse {

    private boolean success;
    private String message;
    private int totalRecipients; // Tổng số người nhận
    private int successCount; // Số email gửi thành công
    private int failureCount; // Số email gửi thất bại
}
