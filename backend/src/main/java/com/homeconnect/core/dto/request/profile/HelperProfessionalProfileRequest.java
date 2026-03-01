package com.homeconnect.core.dto.request.profile;

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

    private String avatarUrl;

    @NotBlank(message = "Bio không được để trống")
    @Size(min = 50, message = "Bio phải có ít nhất 50 ký tự")
    private String bio;

    private Integer hometownCode; // ID của Location (Province)

    private java.time.LocalDate dateOfBirth; // Ngày sinh (Lưu ở helper_profiles)

    @Min(value = 0, message = "Kinh nghiệm không được là số âm")
    @Max(value = 50, message = "Kinh nghiệm không hợp lệ")
    private Integer experienceYears;

    private List<Integer> skills; // Danh sách ID của Services (v1 helper_services)
}
