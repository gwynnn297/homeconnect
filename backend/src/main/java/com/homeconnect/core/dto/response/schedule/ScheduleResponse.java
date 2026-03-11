package com.homeconnect.core.dto.response.schedule;

import com.homeconnect.core.enums.ScheduleStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@io.swagger.v3.oas.annotations.media.Schema(description = "Thông tin chi tiết khung giờ làm việc")
public class ScheduleResponse {
    @io.swagger.v3.oas.annotations.media.Schema(description = "ID của slot lịch")
    private Long id;

    @io.swagger.v3.oas.annotations.media.Schema(description = "Ngày làm việc")
    private LocalDate workDate;

    @io.swagger.v3.oas.annotations.media.Schema(description = "Giờ bắt đầu")
    private LocalTime startTime;

    @io.swagger.v3.oas.annotations.media.Schema(description = "Giờ kết thúc")
    private LocalTime endTime;

    @io.swagger.v3.oas.annotations.media.Schema(description = "Trạng thái (AVAILABLE, BUSY, CANCELLED)")
    private ScheduleStatus status;

    @io.swagger.v3.oas.annotations.media.Schema(description = "Lý do hủy (nếu có)")
    private String cancelReason;

    @io.swagger.v3.oas.annotations.media.Schema(description = "ID đơn hàng (nếu status=BUSY)")
    private Long bookingId;
}
