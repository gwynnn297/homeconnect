package com.homeconnect.core.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.*;
import lombok.*;

import java.math.BigDecimal;
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
    @Schema(description = "Tên của Tỉnh/Thành phố quê quán", example = "Thành phố Đà Nẵng")
    private String hometownName;

    @NotNull(message = "Tỉnh/Thành phố hiện tại không được để trống")
    @Schema(description = "Tên của Tỉnh/Thành phố hiện tại", example = "Thành phố Hồ Chí Minh")
    private String provinceName;

    private String provinceCode;
    
    @NotNull(message = "Quận/Huyện hiện tại không được để trống")
    @Schema(description = "Tên của Quận/Huyện hiện tại", example = "Quận 1")
    private String districtName;

    private String districtCode;

    @NotNull(message = "Phường/Xã hiện tại không được để trống")
    @Schema(description = "Tên của Phường/Xã hiện tại", example = "Phường Bến Nghé")
    private String wardName;

    private String wardCode;

    @NotBlank(message = "Địa chỉ hiện tại không được để trống")
    @Schema(description = "Địa chỉ tạm trú hiện tại: Số nhà, tên đường...", example = "Số 123, đường Nguyễn Huệ")
    private String currentAddress;


    @NotEmpty(message = "Phải chọn ít nhất 1 quận muốn nhận việc")
    @Schema(description = "Danh sách các Quận/Huyện muốn nhận việc")
    private List<com.homeconnect.core.dto.request.profile.HelperProfessionalProfileRequest.WorkingDistrictRequest> workingDistricts;

    // --- Giới thiệu & Dịch vụ ---
    @NotBlank(message = "Giới thiệu bản thân không được để trống")
    @Schema(description = "Giới thiệu bản thân: Chia sẻ về kỹ năng, thái độ làm việc...", example = "Tôi là người chăm chỉ, có trách nhiệm...")
    private String bio;

    @NotNull(message = "Số năm kinh nghiệm không được để trống")
    @Min(value = 0, message = "Số năm kinh nghiệm không được âm")
    @Schema(description = "Kinh nghiệm làm việc (số năm)", example = "3")
    private Integer experienceYears;

    @NotEmpty(message = "Phải chọn ít nhất một dịch vụ cha (Danh mục).")
    @Schema(description = "Danh sách ID các danh mục dịch vụ cung cấp")
    private List<Integer> categoryIds;


    @DecimalMin(value = "-90.0", message = "Vĩ độ không hợp lệ (-90 đến 90)")
    @DecimalMax(value = "90.0", message = "Vĩ độ không hợp lệ (-90 đến 90)")
    private BigDecimal latitude;

    @DecimalMin(value = "-180.0", message = "Kinh độ không hợp lệ (-180 đến 180)")
    @DecimalMax(value = "180.0", message = "Kinh độ không hợp lệ (-180 đến 180)")
    private BigDecimal longitude;
}
