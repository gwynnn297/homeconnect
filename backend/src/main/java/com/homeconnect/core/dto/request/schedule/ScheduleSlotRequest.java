package com.homeconnect.core.dto.request.schedule;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@io.swagger.v3.oas.annotations.media.Schema(description = "Yêu cầu đăng ký khung giờ rảnh")
public class ScheduleSlotRequest {

    @NotNull(message = "Giờ bắt đầu không được để trống")
    @io.swagger.v3.oas.annotations.media.Schema(description = "Giờ bắt đầu (HH:mm)", example = "08:00")
    private LocalTime startTime;

    @NotNull(message = "Giờ kết thúc không được để trống")
    @io.swagger.v3.oas.annotations.media.Schema(description = "Giờ kết thúc (HH:mm)", example = "12:00")
    private LocalTime endTime;
}
