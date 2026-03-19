package com.homeconnect.core.dto.request;

import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
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

    @NotNull(message = "Service ID không được để trống")
    @Positive(message = "Service ID phải là số dương")
    private Integer serviceId;

    @NotNull(message = "Ngày làm việc không được để trống")
    @FutureOrPresent(message = "Ngày làm việc không được ở quá khứ")
    private LocalDate workDate;

    @NotNull(message = "Giờ bắt đầu không được để trống")
    private LocalTime startTime;

    @NotNull(message = "Số giờ không được để trống")
    @Min(value = 1, message = "Số giờ tối thiểu là 1")
    @Max(value = 12, message = "Số giờ tối đa là 12")
    private Integer durationHours;

    @NotBlank(message = "Địa chỉ chi tiết không được để trống")
    @Size(max = 500, message = "Địa chỉ chi tiết không được vượt quá 500 ký tự")
    private String addressDetail;

    // Optional: FE có thể gửi, nhưng backend sẽ tự geocode lại từ địa chỉ để đảm bảo nhất quán
    @DecimalMin(value = "-90.0", message = "Latitude phải từ -90 đến 90")
    @DecimalMax(value = "90.0", message = "Latitude phải từ -90 đến 90")
    private BigDecimal latitude;

    @DecimalMin(value = "-180.0", message = "Longitude phải từ -180 đến 180")
    @DecimalMax(value = "180.0", message = "Longitude phải từ -180 đến 180")
    private BigDecimal longitude;

    // Optional fields
    @Size(max = 255, message = "Tiêu đề không được vượt quá 255 ký tự")
    private String title;

    @Size(max = 1000, message = "Mô tả không được vượt quá 1000 ký tự")
    private String description;
}