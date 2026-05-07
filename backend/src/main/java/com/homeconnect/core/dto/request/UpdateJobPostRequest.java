package com.homeconnect.core.dto.request;

import jakarta.validation.constraints.*;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/**
 * Request DTO cho việc cập nhật job post
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateJobPostRequest {

    @Schema(description = "Danh sách ID dịch vụ con (extra services)", example = "[6, 7]")
    private List<Integer> serviceIds;

    @Schema(description = "Ngày làm việc", example = "2024-04-01")
    @FutureOrPresent(message = "Ngày làm việc không được ở quá khứ")
    private LocalDate workDate;

    @Schema(description = "Giờ bắt đầu tại địa điểm", example = "08:30:00")
    private LocalTime startTime;

    @Schema(description = "Số giờ làm việc", example = "4")
    @Min(value = 1, message = "Số giờ tối thiểu là 1")
    @Max(value = 12, message = "Số giờ tối đa là 12")
    private Integer durationHours;

    @Schema(description = "Tiêu đề bài đăng", example = "Cần dọn dẹp nhà")
    @Size(max = 255, message = "Tiêu đề không được vượt quá 255 ký tự")
    private String title;

    @Schema(description = "Mô tả chi tiết công việc", example = "Dọn sạch phòng khách, lau kính...")
    @Size(max = 1000, message = "Mô tả không được vượt quá 1000 ký tự")
    private String description;

    @Schema(description = "ID địa chỉ đã lưu")
    private Integer addressId;

    @Schema(description = "Số lượng/Diện tích", example = "60.5")
    private Double workSize;


    @Schema(description = "Dữ liệu bổ sung (JSON)", example = "{\"dishCount\": 3}")
    private java.util.Map<String, Object> additionalData;
}
