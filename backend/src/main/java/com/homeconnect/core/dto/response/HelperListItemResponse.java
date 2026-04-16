package com.homeconnect.core.dto.response;

import com.homeconnect.core.enums.KycStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Response DTO cho danh sách Helper (Admin)
 * Sử dụng cho GET /api/v1/admin/helpers
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HelperListItemResponse {

    private Long helperId;
    private String fullName;
    private String email;
    private String phone;
    private String avatarUrl;

    // KYC thông tin
    private KycStatus kycStatus;
    private String identityNumber;
    private String cccdNumber;
    private Boolean aiVerified;
    private LocalDate dateOfBirth;

    // đia chỉ
    private String currentCityName; // Tên thành phố hiện tại

    // Profile
    private Integer experienceYears;
    private String bio;

    // Stats
    private Integer totalServices; // Số dịch vụ đã đăng ký
    private Integer totalWorkingDistricts; // Số khu vực làm việc

    // Timestamps
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
