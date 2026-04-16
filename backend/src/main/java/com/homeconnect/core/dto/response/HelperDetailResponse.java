package com.homeconnect.core.dto.response;

import com.homeconnect.core.enums.KycStatus;
import com.homeconnect.core.enums.UserStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Response DTO cho chi tiết Helper (Admin)
 * Sử dụng cho GET /api/v1/admin/helpers/{id}
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HelperDetailResponse {

    // ========== USER INFO ==========
    private Long helperId;
    private String fullName;
    private String email;
    private String phone;
    private String avatarUrl;
    private UserStatus status;
    private LocalDateTime createdAt;

    // ========== PROFILE INFO ==========
    private Integer profileId;
    private String bio;
    private Integer experienceYears;
    private LocalDate dateOfBirth;
    private String addressDetail;

    // Location
    private LocationInfo hometown;
    private LocationInfo currentCity;

    // ========== KYC INFO ==========
    private KycStatus kycStatus;
    private String rejectionReason;
    private String identityNumber;
    private String cccdNumber;
    private Boolean aiVerified;
    private String identityFrontUrl;
    private String identityBackUrl;
    private String selfieUrl;

    // ========== SERVICES & DISTRICTS ==========
    private List<ServiceInfo> services; // Danh sách dịch vụ đã đăng ký
    private List<DistrictInfo> workingDistricts; // Các khu vực làm việc

    // ========== TIMESTAMPS ==========
    private LocalDateTime profileUpdatedAt;

    // ========== NESTED CLASSES ==========

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LocationInfo {
        private Integer locationId;
        private String name;
        private String type; // PROVINCE, DISTRICT
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ServiceInfo {
        private Integer serviceId;
        private String name;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DistrictInfo {
        private Integer locationId;
        private String name;
        private String code;
    }
}
