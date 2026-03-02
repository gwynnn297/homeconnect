package com.homeconnect.core.dto.request.profile;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.util.List;

/**
 * Request cập nhật hồ sơ năng lực của Helper (PB-04)
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HelperProfessionalProfileRequest {

    @Schema(description = "Ngày sinh", example = "2000-01-01")
    private java.time.LocalDate dateOfBirth;

    @Schema(description = "ID của Tỉnh/Thành phố quê quán", example = "41")
    private Integer hometownId;

    @Schema(description = "Danh sách ID các Quận/Huyện muốn nhận việc")
    private List<Integer> workingDistrictIds;

    @NotBlank(message = "Bio không được để trống")
    @Size(min = 50, message = "Bio phải có ít nhất 50 ký tự")
    private String bio;

    @Min(value = 0, message = "Kinh nghiệm không được là số âm")
    @Max(value = 50, message = "Kinh nghiệm không hợp lệ")
    private Integer experienceYears;

    @Schema(description = "Danh sách ID các dịch vụ cung cấp")
    private List<Integer> serviceIds;
}
