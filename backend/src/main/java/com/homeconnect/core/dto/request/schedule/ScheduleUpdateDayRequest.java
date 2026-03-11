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
@io.swagger.v3.oas.annotations.media.Schema(description = "Yêu cầu cập nhật lịch làm việc cho một ngày cụ thể")
public class ScheduleUpdateDayRequest {

    @NotNull(message = "Ngày cập nhật không được để trống")
    @io.swagger.v3.oas.annotations.media.Schema(description = "Ngày cần cập nhật (YYYY-MM-DD)", example = "2026-06-01")
    private LocalDate date;

    @NotEmpty(message = "Danh sách khung giờ không được để trống")
    @io.swagger.v3.oas.annotations.media.Schema(description = "Danh sách các khung giờ rảnh mới")
    private List<ScheduleSlotRequest> slots;
}
