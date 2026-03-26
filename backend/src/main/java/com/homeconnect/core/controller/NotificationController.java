package com.homeconnect.core.controller;

import com.homeconnect.core.dto.response.ApiResponse;
import com.homeconnect.core.dto.response.NotificationResponse;
import com.homeconnect.core.service.NotificationService;
import com.homeconnect.core.util.SecurityUtil;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
@Tag(name = "Notifications", description = "API lấy thông báo và realtime thông báo")
public class NotificationController {

    private final NotificationService notificationService;
    private final SecurityUtil securityUtil;

    @Operation(summary = "Lấy danh sách thông báo", description = "Lấy danh sách thông báo mới nhất của user hiện tại")
    @GetMapping
    @PreAuthorize("hasAnyRole('HELPER','CUSTOMER','ADMIN')")
    public ResponseEntity<ApiResponse<List<NotificationResponse>>> getNotifications(
            @RequestParam(name = "limit", defaultValue = "20") Integer limit,
            Authentication authentication) {

        Long userId = securityUtil.getCurrentUserId(authentication);
        List<NotificationResponse> notifications = notificationService.getLatestNotifications(userId, limit);

        return ResponseEntity.ok(ApiResponse.<List<NotificationResponse>>builder()
                .message("Lấy danh sách thông báo thành công")
                .data(notifications)
                .build());
    }

    @Operation(summary = "Realtime thông báo", description = "Kết nối SSE để nhận thông báo realtime")
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @PreAuthorize("hasAnyRole('HELPER','CUSTOMER','ADMIN')")
    public SseEmitter streamNotifications(Authentication authentication) {
        Long userId = securityUtil.getCurrentUserId(authentication);
        return notificationService.subscribe(userId);
    }

    @Operation(summary = "Đánh dấu 1 thông báo đã đọc", description = "Chỉ user sở hữu notification mới được đánh dấu đã đọc")
    @PatchMapping("/{notificationId}/read")
    @PreAuthorize("hasAnyRole('HELPER','CUSTOMER','ADMIN')")
    public ResponseEntity<ApiResponse<NotificationResponse>> markAsRead(
            @PathVariable Long notificationId,
            Authentication authentication) {
        Long userId = securityUtil.getCurrentUserId(authentication);
NotificationResponse response = notificationService.markAsRead(userId, notificationId);
        return ResponseEntity.ok(ApiResponse.<NotificationResponse>builder()
                .message("Đã đánh dấu thông báo là đã đọc")
                .data(response)
                .build());
    }

    @Operation(summary = "Đánh dấu tất cả thông báo đã đọc", description = "Đánh dấu tất cả thông báo chưa đọc của user hiện tại là đã đọc")
    @PatchMapping("/read-all")
    @PreAuthorize("hasAnyRole('HELPER','CUSTOMER','ADMIN')")
    public ResponseEntity<ApiResponse<Integer>> markAllAsRead(Authentication authentication) {
        Long userId = securityUtil.getCurrentUserId(authentication);
        int updated = notificationService.markAllAsRead(userId);
        return ResponseEntity.ok(ApiResponse.<Integer>builder()
                .message("Đã đánh dấu tất cả thông báo là đã đọc")
                .data(updated)
                .build());
    }
}
