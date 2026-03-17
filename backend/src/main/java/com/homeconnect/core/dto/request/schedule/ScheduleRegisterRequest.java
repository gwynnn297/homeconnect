package com.homeconnect.core.dto.request.schedule;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@io.swagger.v3.oas.annotations.media.Schema(description = "Yêu cầu đăng ký lịch làm việc hàng loạt")
public class ScheduleRegisterRequest {

    @NotNull(message = "Ngày bắt đầu không được để trống")
    @io.swagger.v3.oas.annotations.media.Schema(description = "Ngày bắt đầu chu kỳ", example = "2026-06-01")
    private LocalDate startDate;

    @NotNull(message = "Ngày kết thúc không được để trống")
    @io.swagger.v3.oas.annotations.media.Schema(description = "Ngày kết thúc chu kỳ", example = "2026-06-30")
    private LocalDate endDate;

    @NotEmpty(message = "Danh sách ngày trong tuần không được để trống")
    @io.swagger.v3.oas.annotations.media.Schema(description = "Các thứ trong tuần (2: Thứ 2, 3: Thứ 3, ..., 7: Thứ 7, 8: Chủ nhật)", example = "[2, 4, 6]")
    private List<Integer> daysOfWeek; // 2 (Mon) to 8 (Sun)

    @NotEmpty(message = "Danh sách khung giờ không được để trống")
    @io.swagger.v3.oas.annotations.media.Schema(description = "Danh sách các khung giờ rảnh trong ngày")
    private List<ScheduleSlotRequest> slots;
}
