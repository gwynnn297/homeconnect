package com.homeconnect.core.controller;

import com.homeconnect.core.dto.request.DirectBookingRequest;
import com.homeconnect.core.dto.request.SelectApplicantRequest;
import com.homeconnect.core.dto.response.ApiResponse;
import com.homeconnect.core.dto.response.BookingResponse;
import com.homeconnect.core.dto.response.JobApplicantResponse;
import com.homeconnect.core.service.BookingService;
import com.homeconnect.core.util.SecurityUtil;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/v1/bookings")
@RequiredArgsConstructor
@Tag(name = "Bookings", description = "API quản lý đơn hàng, chốt thợ và đặt lịch trực tiếp")
public class BookingController {

    private final BookingService bookingService;
    private final SecurityUtil securityUtil;

    @Operation(summary = "Lấy danh sách thợ ứng tuyển", description = "Khách hàng xem danh sách thợ đã nộp đơn cho tin đăng của mình")
    @GetMapping("/job/{jobId}/applicants")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ApiResponse<List<JobApplicantResponse>>> getApplicants(@PathVariable Long jobId) {
        List<JobApplicantResponse> responses = bookingService.getApplicants(jobId);
        return ResponseEntity.ok(ApiResponse.<List<JobApplicantResponse>>builder()
                .message("Lấy danh sách ứng viên thành công")
                .data(responses)
                .build());
    }

    @Operation(summary = "Chốt chọn thợ", description = "Khách hàng chọn thợ từ danh sách ứng tuyển. Hệ thống sẽ tạo đơn hàng và khóa lịch thợ.")
    @PostMapping("/job/{jobId}/select")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ApiResponse<BookingResponse>> selectApplicant(
            @PathVariable Long jobId,
            @Valid @RequestBody SelectApplicantRequest request,
            Authentication authentication) {
        
        Long customerId = securityUtil.getCurrentUserId(authentication);
        BookingResponse response = bookingService.selectApplicant(jobId, request.getApplicationId(), customerId);
        
        return ResponseEntity.ok(ApiResponse.<BookingResponse>builder()
                .message("Chốt thợ thành công! Đơn hàng đã được tạo.")
                .data(response)
                .build());
    }

    @Operation(summary = "Đặt thợ trực tiếp (PB-13)", description = "Khách hàng đặt thợ cụ thể. Thợ sẽ có 10 phút để phản hồi.")
    @PostMapping("/direct")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ApiResponse<BookingResponse>> createDirectBooking(
            @Valid @RequestBody DirectBookingRequest request,
            Authentication authentication) {
        
        Long customerId = securityUtil.getCurrentUserId(authentication);
        BookingResponse response = bookingService.createDirectBooking(request, customerId);
        
        return ResponseEntity.ok(ApiResponse.<BookingResponse>builder()
                .message("Yêu cầu đặt thợ đã được gửi. Đang chờ thợ xác nhận trong 10 phút.")
                .data(response)
                .build());
    }

    @Operation(summary = "Thợ phản hồi đơn đặt trực tiếp", description = "Thợ bấm Đồng ý hoặc Từ chối yêu cầu đặt việc từ khách hàng")
    @PutMapping("/{bookingId}/respond")
    @PreAuthorize("hasRole('HELPER')")
    public ResponseEntity<ApiResponse<Void>> respondToBooking(
            @PathVariable Long bookingId,
            @RequestParam boolean accept,
            Authentication authentication) {
        
        Long helperId = securityUtil.getCurrentUserId(authentication);
        bookingService.respondToBooking(bookingId, helperId, accept);
        
        String message = accept ? "Bạn đã chấp nhận công việc!" : "Bạn đã từ chối công việc.";
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .message(message)
                .build());
    }

    @Operation(summary = "Xem chi tiết đơn hàng", description = "Lấy thông tin chi tiết một đơn hàng (chỉ chủ đơn hoặc thợ được giao mới có quyền xem)")
    @GetMapping("/{bookingId}")
    @PreAuthorize("hasAnyRole('CUSTOMER', 'HELPER')")
    public ResponseEntity<ApiResponse<BookingResponse>> getBookingDetail(
            @PathVariable Long bookingId,
            Authentication authentication) {
        
        Long userId = securityUtil.getCurrentUserId(authentication);
        BookingResponse response = bookingService.getBookingDetail(bookingId, userId);
        
        return ResponseEntity.ok(ApiResponse.<BookingResponse>builder()
                .message("Lấy thông tin đơn hàng thành công")
                .data(response)
                .build());
    }
}
