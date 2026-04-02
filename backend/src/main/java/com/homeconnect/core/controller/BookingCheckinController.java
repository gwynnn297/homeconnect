package com.homeconnect.core.controller;

import com.homeconnect.core.dto.request.booking.CheckinVerifyRequest;
import com.homeconnect.core.dto.response.ApiResponse;
import com.homeconnect.core.dto.response.booking.CheckinChallengeResponse;
import com.homeconnect.core.dto.response.booking.CheckinVerifyResponse;
import com.homeconnect.core.service.BookingCheckinService;
import com.homeconnect.core.util.SecurityUtil;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/bookings")
@RequiredArgsConstructor
@Tag(name = "Booking Check-in", description = "Liveness check-in cho helper")
public class BookingCheckinController {

    private final BookingCheckinService bookingCheckinService;
    private final SecurityUtil securityUtil;

    @Operation(summary = "Tạo challenge check-in", description = "Trả về challenge động cho client thực hiện liveness")
    @PostMapping("/{bookingId}/checkin/challenge")
    @PreAuthorize("hasRole('HELPER')")
    public ResponseEntity<ApiResponse<CheckinChallengeResponse>> createChallenge(
            @PathVariable Long bookingId,
            Authentication authentication) {
        Long helperId = securityUtil.getCurrentUserId(authentication);
        CheckinChallengeResponse response = bookingCheckinService.createChallenge(bookingId, helperId);

        return ResponseEntity.ok(ApiResponse.<CheckinChallengeResponse>builder()
                .message("Tạo challenge check-in thành công")
                .data(response)
                .build());
    }

    @Operation(summary = "Verify liveness + face match", description = "Xác thực ảnh live và cập nhật booking=ARRIVED nếu đạt")
    @PostMapping("/{bookingId}/checkin/verify")
    @PreAuthorize("hasRole('HELPER')")
    public ResponseEntity<ApiResponse<CheckinVerifyResponse>> verifyAndCheckin(
            @PathVariable Long bookingId,
            @Valid @RequestBody CheckinVerifyRequest request,
            Authentication authentication) {
        Long helperId = securityUtil.getCurrentUserId(authentication);
        CheckinVerifyResponse response = bookingCheckinService.verifyAndCheckin(bookingId, helperId, request);

        return ResponseEntity.ok(ApiResponse.<CheckinVerifyResponse>builder()
                .message(response.getMessage())
                .data(response)
                .build());
    }
}
