package com.homeconnect.core.controller;

import com.homeconnect.core.dto.request.schedule.ScheduleRegisterRequest;
import com.homeconnect.core.dto.request.schedule.ScheduleSlotRequest;
import com.homeconnect.core.dto.request.schedule.ScheduleUpdateDayRequest;
import com.homeconnect.core.dto.response.ApiResponse;
import com.homeconnect.core.dto.response.schedule.RegisterScheduleSummaryResponse;
import com.homeconnect.core.dto.response.schedule.ScheduleResponse;
import com.homeconnect.core.entity.User;
import com.homeconnect.core.exception.ApiException;
import com.homeconnect.core.repository.UserRepository;
import com.homeconnect.core.service.ScheduleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/schedules")
@RequiredArgsConstructor
@Tag(name = "Helper Schedule", description = "Quản lý lịch làm việc của Helper")
public class ScheduleController {

    private final ScheduleService scheduleService;
    private final UserRepository userRepository;

    private Long getUserId(UserDetails userDetails) {
        return userRepository.findByEmail(userDetails.getUsername())
                .map(User::getId)
                .orElseThrow(() -> new ApiException("User not found", HttpStatus.NOT_FOUND));
    }

    /**
     * Đăng ký lịch rảnh (Dành cho Helper)
     */
    @Operation(summary = "Đăng ký lịch rảnh hàng loạt", description = "Dành cho Helper đăng ký lịch rảnh định kỳ dựa trên ngày bắt đầu, ngày kết thúc và các thứ trong tuần.")
    @PostMapping("/register")
    @PreAuthorize("hasRole('HELPER')")
    public ResponseEntity<RegisterScheduleSummaryResponse> registerSchedule(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody ScheduleRegisterRequest request) {
        return ResponseEntity.ok(scheduleService.registerSchedule(getUserId(userDetails), request));
    }

    /**
     * Cập nhật lịch cho đúng 1 ngày (Tách nhóm)
     */
    @Operation(summary = "Cập nhật lịch cho 1 ngày", description = "Cập nhật lại toàn bộ khung giờ cho 1 ngày cụ thể. Ngày này sẽ được cấp groupId mới (tách khỏi chuỗi cũ nếu có).")
    @PutMapping("/day")
    @PreAuthorize("hasRole('HELPER')")
    public ResponseEntity<RegisterScheduleSummaryResponse> updateDaySchedule(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody ScheduleUpdateDayRequest request) {
        return ResponseEntity.ok(scheduleService.updateDaySchedule(getUserId(userDetails), request));
    }

    /**
     * Cập nhật lịch đồng bộ theo chuỗi (Group)
     */
    @Operation(summary = "Cập nhật lịch theo chuỗi (Series)", description = "Tìm toàn bộ các ngày có cùng groupId VÀ cùng 'thứ' (dayOfWeek) với id truyền vào để cập nhật đồng bộ sang khung giờ mới.")
    @PutMapping("/{id}/group")
    @PreAuthorize("hasRole('HELPER')")
    public ResponseEntity<RegisterScheduleSummaryResponse> updateGroupSchedule(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id,
            @Valid @RequestBody List<ScheduleSlotRequest> newSlots) {
        return ResponseEntity.ok(scheduleService.updateGroupSchedule(getUserId(userDetails), id, newSlots));
    }

    /**
     * Cập nhật một ca đơn lẻ
     */
    @Operation(summary = "Cập nhật một ca làm việc", description = "Chỉ cập nhật ca được chọn theo id. Không ảnh hưởng các ca khác trong ngày hoặc chuỗi.")
    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('HELPER')")
    public ResponseEntity<RegisterScheduleSummaryResponse> updateSingleSchedule(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id,
            @Valid @RequestBody ScheduleSlotRequest slot) {
        return ResponseEntity.ok(scheduleService.updateSingleSchedule(getUserId(userDetails), id, slot));
    }

    /**
     * Lấy lịch làm việc theo tháng
     */
    @Operation(summary = "Lấy lịch theo tháng", description = "Trả về danh sách khung giờ của Helper. Nếu không truyền helperId, hệ thống tự lấy lịch của chính Helper đang đăng nhập.")
    @GetMapping("/monthly")
    public ResponseEntity<ApiResponse<List<ScheduleResponse>>> getMonthlySchedule(
            @AuthenticationPrincipal UserDetails userDetails,
            @Parameter(description = "ID của helper (không bắt buộc nếu xem lịch bản thân)") @RequestParam(required = false) Long helperId,
            @Parameter(description = "Tháng (1-12)") @RequestParam int month,
            @Parameter(description = "Năm (ví dụ: 2026)") @RequestParam int year) {
        Long targetId = (helperId != null) ? helperId : getUserId(userDetails);
        return ResponseEntity.ok(ApiResponse.<List<ScheduleResponse>>builder()
                .message("Lấy lịch theo tháng thành công")
                .data(scheduleService.getMonthlySchedule(targetId, month, year))
                .build());
    }

    /**
     * Lấy toàn bộ lịch làm việc
     */
    @Operation(summary = "Lấy toàn bộ lịch làm việc", description = "Trả về toàn bộ danh sách khung giờ của Helper. Nếu không truyền helperId, hệ thống tự lấy lịch của chính Helper đang đăng nhập.")
    @GetMapping("/all")
    public ResponseEntity<ApiResponse<List<ScheduleResponse>>> getAllSchedules(
            @AuthenticationPrincipal UserDetails userDetails,
            @Parameter(description = "ID của helper (không bắt buộc nếu xem lịch bản thân)") @RequestParam(required = false) Long helperId) {
        Long targetId = (helperId != null) ? helperId : getUserId(userDetails);
        return ResponseEntity.ok(ApiResponse.<List<ScheduleResponse>>builder()
                .message("Lấy toàn bộ lịch thành công")
                .data(scheduleService.getAllSchedules(targetId))
                .build());
    }

    /**
     * Xem chi tiết một khung giờ
     */
    @Operation(summary = "Xem chi tiết khung giờ", description = "Trả về thông tin chi tiết của một slot lịch theo ID.")
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ScheduleResponse>> getScheduleDetail(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.<ScheduleResponse>builder()
                .message("Lấy chi tiết khung giờ thành công")
                .data(scheduleService.getScheduleDetail(id))
                .build());
    }

    /**
     * Xóa một khung giờ đơn lẻ
     */
    @Operation(summary = "Xóa một khung giờ đơn lẻ", description = "Xóa hoàn toàn một slot lịch khỏi database. Chỉ áp dụng cho ca AVAILABLE hoặc CANCELLED.")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('HELPER')")
    public ResponseEntity<Void> deleteSchedule(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id) {
        scheduleService.deleteSchedule(getUserId(userDetails), id);
        return ResponseEntity.noContent().build();
    }



    /**
     * Hủy ca làm việc (Xin nghỉ)
     */
    @Operation(summary = "Hủy ca làm việc (Xin nghỉ)", description = "Helper xin nghỉ một ca đã đăng ký. Giới hạn tối đa 3 ca nghỉ/tháng.")
    @PatchMapping("/{id}/cancel")
    @PreAuthorize("hasRole('HELPER')")
    public ResponseEntity<Void> cancelSchedule(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id,
            @RequestBody @Schema(example = "{\"reason\": \"Bận việc gia đình\"}") Map<String, String> body) {
        String reason = body.getOrDefault("reason", "No reason provided");
        scheduleService.cancelSchedule(getUserId(userDetails), id, reason);
        return ResponseEntity.noContent().build();
    }

    /**
     * Nghỉ nhiều ca đã đăng ký (Hủy chu kỳ lịch cam kết)
     */
    @Operation(summary = "Nghỉ nhiều ca theo chuỗi (Hủy series)", description = "Dùng để hủy toàn bộ chu kỳ lịch cam kết của cùng 'thứ' trong tuần từ ca làm việc hiện tại trở về sau.")
    @PatchMapping("/{id}/cancel-bulk")
    @PreAuthorize("hasRole('HELPER')")
    public ResponseEntity<Void> bulkCancelSchedule(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id,
            @RequestBody @Schema(example = "{\"reason\": \"Nghỉ phép dài hạn\"}") Map<String, String> body) {
        String reason = body.getOrDefault("reason", "No reason provided");
        scheduleService.bulkCancelSchedule(getUserId(userDetails), id, reason);
        return ResponseEntity.noContent().build();
    }

}
