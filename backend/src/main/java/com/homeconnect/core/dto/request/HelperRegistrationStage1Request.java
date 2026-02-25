package com.homeconnect.core.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;
import lombok.*;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Yêu cầu Giai đoạn 1: Thông tin cá nhân & Dịch vụ")
public class HelperRegistrationStage1Request {

    // --- Thông tin cá nhân ---
    @NotNull(message = "Ngày sinh không được để trống")
    @Schema(description = "Ngày sinh (Phải đủ 18 tuổi)", example = "2000-01-01")
    private java.time.LocalDate dateOfBirth;

    // --- Khu vực làm việc & Quê quán ---
    @NotNull(message = "Quê quán không được để trống")
    @Schema(description = "ID của Tỉnh/Thành phố quê quán", example = "41")
    private Integer hometownProvinceId;

    @NotNull(message = "Thành phố hiện tại không được để trống")
    @Schema(description = "ID của Tỉnh/Thành phố hiện tại đang sinh sống", example = "41")
    private Integer currentCityId;

    @NotBlank(message = "Địa chỉ hiện tại không được để trống")
    @Schema(description = "Địa chỉ tạm trú hiện tại: Số nhà, tên đường...", example = "Số 123, đường Nguyễn Huệ")
    private String currentAddress;


    @NotEmpty(message = "Phải chọn ít nhất 1 quận muốn nhận việc")
    @Schema(description = "Danh sách ID các Quận/Huyện muốn nhận việc")
    private List<Integer> workingDistrictIds;

    // --- Giới thiệu & Dịch vụ ---
    @NotBlank(message = "Giới thiệu bản thân không được để trống")
    @Schema(description = "Giới thiệu bản thân: Chia sẻ về kỹ năng, thái độ làm việc...", example = "Tôi là người chăm chỉ, có trách nhiệm...")
    private String bio;

    @NotNull(message = "Số năm kinh nghiệm không được để trống")
    @Min(value = 0, message = "Số năm kinh nghiệm không được âm")
    @Schema(description = "Kinh nghiệm làm việc (số năm)", example = "3")
    private Integer experienceYears;

    @NotEmpty(message = "Phải chọn ít nhất một dịch vụ.")
    @Schema(description = "Danh sách ID các dịch vụ cung cấp")
    private List<Integer> serviceIds;
}
