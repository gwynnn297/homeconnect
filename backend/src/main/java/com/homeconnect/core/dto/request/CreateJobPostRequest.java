package com.homeconnect.core.dto.request;

import jakarta.validation.constraints.*;
import io.swagger.v3.oas.annotations.media.Schema;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalTime;

/**
 * Request DTO cho API tạo job post - BE-Post-02
 * Khách hàng đăng tin tìm helper
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateJobPostRequest {

    @Schema(description = "Danh sách ID dịch vụ con (extra services)", example = "[6, 7]")
    private java.util.List<Integer> serviceIds;


    @NotNull(message = "Category ID (Cha) không được để trống")
    @Schema(description = "Category ID (Cha) - Bắt buộc", example = "1")
    private Integer categoryId;


    @NotNull(message = "Ngày làm việc không được để trống")
    @FutureOrPresent(message = "Ngày làm việc không được ở quá khứ")
    private LocalDate workDate;

    @NotNull(message = "Giờ bắt đầu không được để trống")
    private LocalTime startTime;

    @NotNull(message = "Số giờ không được để trống")
    @Min(value = 1, message = "Số giờ tối thiểu là 1")
    @Max(value = 12, message = "Số giờ tối đa là 12")
    private Integer durationHours;

    @Size(max = 255, message = "Tiêu đề không được vượt quá 255 ký tự")
    private String title;

    @Size(max = 1000, message = "Mô tả không được vượt quá 1000 ký tự")
    private String description;

    @NotNull(message = "Địa chỉ (ID) không được để trống")
    @Schema(description = "ID địa chỉ đã lưu (Nếu chọn từ danh sách)")
    private Integer addressId;

    @Schema(description = "Số lượng/Diện tích (m2, số bé, số máy...)", example = "60.5")
    private Double workSize;

    @Schema(description = "Dịch vụ Premium (+50k)", example = "false")
    private Boolean isPremium;

    @Schema(description = "Nhà có thú cưng", example = "false")
    private Boolean hasPets;

    @Schema(description = "Thợ mang theo dụng cụ", example = "false")
    private Boolean bringTools;
}
