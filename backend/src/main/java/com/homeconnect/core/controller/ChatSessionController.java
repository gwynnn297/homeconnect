package com.homeconnect.core.controller;

import com.homeconnect.core.dto.request.ChatSessionCreateRequest;
import com.homeconnect.core.dto.request.ChatSessionMessageRequest;
import com.homeconnect.core.dto.response.ApiResponse;
import com.homeconnect.core.dto.response.chat.ChatMessageResponse;
import com.homeconnect.core.dto.response.chat.ChatSendMessageResponse;
import com.homeconnect.core.dto.response.chat.ChatSessionResponse;
import com.homeconnect.core.service.ChatSessionService;
import com.homeconnect.core.util.SecurityUtil;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/chat/sessions")
@RequiredArgsConstructor
@Tag(name = "Chat Sessions", description = "API hội thoại chatbot đặt lịch")
public class ChatSessionController {

    private final ChatSessionService chatSessionService;
    private final SecurityUtil securityUtil;

    @PostMapping
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "Tạo phiên chat mới")
    public ResponseEntity<ApiResponse<ChatSessionResponse>> createSession(
            @RequestBody(required = false) ChatSessionCreateRequest request,
            Authentication authentication) {
        Long customerId = securityUtil.getCurrentUserId(authentication);
        ChatSessionResponse response = chatSessionService.createSession(customerId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.<ChatSessionResponse>builder()
                .message("Tạo phiên chat thành công")
                .data(response)
                .build());
    }

    @GetMapping("/{sessionId}")
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "Lấy thông tin phiên chat")
    public ResponseEntity<ApiResponse<ChatSessionResponse>> getSession(
            @PathVariable Long sessionId,
            Authentication authentication) {
        Long customerId = securityUtil.getCurrentUserId(authentication);
        ChatSessionResponse response = chatSessionService.getSession(sessionId, customerId);
        return ResponseEntity.ok(ApiResponse.<ChatSessionResponse>builder()
                .message("Lấy phiên chat thành công")
                .data(response)
                .build());
    }

    @DeleteMapping("/{sessionId}")
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "Xóa (ẩn) phiên chat")
    public ResponseEntity<ApiResponse<Void>> deleteSession(
            @PathVariable Long sessionId,
            Authentication authentication) {
        Long customerId = securityUtil.getCurrentUserId(authentication);
        chatSessionService.deleteSession(sessionId, customerId);
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .message("Xóa phiên chat thành công")
                .build());
    }

    @GetMapping
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "Lấy danh sách phiên chat của khách hàng")
    public ResponseEntity<ApiResponse<List<ChatSessionResponse>>> getSessions(Authentication authentication) {
        Long customerId = securityUtil.getCurrentUserId(authentication);
        List<ChatSessionResponse> response = chatSessionService.getSessions(customerId);
        return ResponseEntity.ok(ApiResponse.<List<ChatSessionResponse>>builder()
                .message("Lấy danh sách phiên chat thành công")
                .data(response)
                .build());
    }

    @GetMapping("/{sessionId}/messages")
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "Lấy lịch sử tin nhắn của phiên chat")
    public ResponseEntity<ApiResponse<List<ChatMessageResponse>>> getMessages(
            @PathVariable Long sessionId,
            Authentication authentication) {
        Long customerId = securityUtil.getCurrentUserId(authentication);
        List<ChatMessageResponse> response = chatSessionService.getMessages(sessionId, customerId);
        return ResponseEntity.ok(ApiResponse.<List<ChatMessageResponse>>builder()
                .message("Lấy lịch sử chat thành công")
                .data(response)
                .build());
    }

    @PostMapping("/{sessionId}/messages")
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "Gửi tin nhắn vào phiên chat")
    public ResponseEntity<ApiResponse<ChatSendMessageResponse>> sendMessage(
            @PathVariable Long sessionId,
            @Valid @RequestBody ChatSessionMessageRequest request,
            Authentication authentication) {
        Long customerId = securityUtil.getCurrentUserId(authentication);
        ChatSendMessageResponse response = chatSessionService.sendMessage(sessionId, customerId, request);
        return ResponseEntity.ok(ApiResponse.<ChatSendMessageResponse>builder()
                .message("Xử lý tin nhắn thành công")
                .data(response)
                .build());
    }

    @PostMapping("/{sessionId}/helpers/{helperId}/select")
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "Chọn helper từ danh sách chatbot gợi ý")
    public ResponseEntity<ApiResponse<ChatSendMessageResponse>> selectHelper(
            @PathVariable Long sessionId,
            @PathVariable Long helperId,
            Authentication authentication) {
        Long customerId = securityUtil.getCurrentUserId(authentication);
        ChatSendMessageResponse response = chatSessionService.selectHelper(sessionId, customerId, helperId);
        return ResponseEntity.ok(ApiResponse.<ChatSendMessageResponse>builder()
                .message("Xử lý chọn helper thành công")
                .data(response)
                .build());
    }

    @PostMapping("/{sessionId}/addresses/{addressId}/select")
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "Chọn địa chỉ trong phiên chat")
    public ResponseEntity<ApiResponse<ChatSendMessageResponse>> selectAddress(
            @PathVariable Long sessionId,
            @PathVariable Integer addressId,
            Authentication authentication) {
        Long customerId = securityUtil.getCurrentUserId(authentication);
        ChatSendMessageResponse response = chatSessionService.selectAddress(sessionId, customerId, addressId);
        return ResponseEntity.ok(ApiResponse.<ChatSendMessageResponse>builder()
                .message("Chọn địa chỉ thành công")
                .data(response)
                .build());
    }

    @PostMapping("/{sessionId}/confirm-booking")
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "Xác nhận tạo booking thật từ phiên chat")
    public ResponseEntity<ApiResponse<ChatSendMessageResponse>> confirmBooking(
            @PathVariable Long sessionId,
            Authentication authentication) {
        Long customerId = securityUtil.getCurrentUserId(authentication);
        ChatSendMessageResponse response = chatSessionService.confirmBooking(sessionId, customerId);
        return ResponseEntity.ok(ApiResponse.<ChatSendMessageResponse>builder()
                .message("Xác nhận booking từ chat thành công")
                .data(response)
                .build());
    }

    @PostMapping("/{sessionId}/resume-after-topup")
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "Resume phiên chat sau khi nạp tiền")
    public ResponseEntity<ApiResponse<ChatSendMessageResponse>> resumeAfterTopup(
            @PathVariable Long sessionId,
            Authentication authentication) {
        Long customerId = securityUtil.getCurrentUserId(authentication);
        ChatSendMessageResponse response = chatSessionService.resumeAfterTopup(sessionId, customerId);
        return ResponseEntity.ok(ApiResponse.<ChatSendMessageResponse>builder()
                .message("Resume phiên chat thành công")
                .data(response)
                .build());
    }
}
