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
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
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
}
