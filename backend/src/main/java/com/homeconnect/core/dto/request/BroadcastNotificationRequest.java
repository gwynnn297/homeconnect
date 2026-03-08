package com.homeconnect.core.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request DTO cho Broadcast Notification
 * Sử dụng cho POST /api/v1/admin/notifications/broadcast
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BroadcastNotificationRequest {

    @NotBlank(message = "Tiêu đề không được để trống")
    private String title;

    @NotBlank(message = "Nội dung thông báo không được để trống")
    private String message;

    private String targetRole; // Optional: CUSTOMER, HELPER, hoặc null (gửi cho tất cả)
}
