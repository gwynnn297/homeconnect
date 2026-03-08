package com.homeconnect.core.controller;

import com.homeconnect.core.dto.request.profile.CommonProfileUpdateRequest;
import com.homeconnect.core.dto.request.profile.HelperProfessionalProfileRequest;
import com.homeconnect.core.dto.response.ApiResponse;
import com.homeconnect.core.dto.response.profile.HelperProfileResponse;
import com.homeconnect.core.dto.response.profile.UserProfileResponse;
import com.homeconnect.core.service.ProfileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@Tag(name = "Profile Management", description = "Quản lý hồ sơ người dùng (Customer & Helper)")
public class ProfileController {

    private final ProfileService profileService;
    
    /**
     * Lấy hồ sơ cá nhân của người dùng đang đăng nhập.
     * Trả về thông tin cơ bản như Họ tên, Email, Số điện thoại, Địa chỉ.
     * 
     * @return ApiResponse chứa UserProfileResponse
     */
    @GetMapping("/profile")
    @Operation(summary = "Lấy hồ sơ cá nhân", description = "Lấy thông tin cơ bản: Tên, Email, SĐT, Địa chỉ của User đang đăng nhập")
    public ResponseEntity<ApiResponse<UserProfileResponse>> getMyProfile() {
        return ResponseEntity.ok(ApiResponse.<UserProfileResponse>builder()
                .message("Lấy thông tin hồ sơ thành công")
                .data(profileService.getProfile())
                .build());
    }

    /**
     * Cập nhật thông tin hồ sơ cơ bản.
     * Cho phép đổi tên, ảnh đại diện và địa chỉ liên lạc.
     * 
     * @param request Thông tin cập nhật (Họ tên, ảnh, địa chỉ...)
     * @return ApiResponse chứa UserProfileResponse đã cập nhật
     */
    @PutMapping("/profile")
    @Operation(summary = "Cập nhật hồ sơ cá name/avatar/địa chỉ", description = "Cho phép sửa đổi các thông tin cơ bản của tài khoản")
    public ResponseEntity<ApiResponse<UserProfileResponse>> updateProfile(@Valid @RequestBody CommonProfileUpdateRequest request) {
        return ResponseEntity.ok(ApiResponse.<UserProfileResponse>builder()
                .message("Cập nhật hồ sơ thành công")
                .data(profileService.updateCommonProfile(request))
                .build());
    }

    /**
     * Lấy hồ sơ nghề nghiệp dành cho Người giúp việc (Helper).
     * Chỉ Helper mới có quyền truy cập API này.
     * 
     * @return ApiResponse chứa HelperProfileResponse
     */
    @GetMapping("/helper/profile")
    @PreAuthorize("hasRole('HELPER')")
    @Operation(summary = "Lấy hồ sơ năng lực (Helper)", description = "Lấy thông tin chuyên môn: Kinh nghiệm, Kỹ năng, Bio của Helper")
    public ResponseEntity<ApiResponse<HelperProfileResponse>> getMyProfessionalProfile() {
        return ResponseEntity.ok(ApiResponse.<HelperProfileResponse>builder()
                .message("Lấy hồ sơ năng lực thành công")
                .data(profileService.getHelperProfessionalProfile())
                .build());
    }

    /**
     * Cập nhật hồ sơ năng lực của Người giúp việc.
     * Bao gồm: Kinh nghiệm, Giới thiệu (Bio), Kỹ năng dịch vụ, Khu vực làm việc.
     * 
     * @param request Thông tin nghề nghiệp cần cập nhật
     * @return ApiResponse chứa HelperProfileResponse đã cập nhật
     */
    @PutMapping("/helper/profile")
    @PreAuthorize("hasRole('HELPER')")
    @Operation(summary = "Cập nhật hồ sơ năng lực (Helper)", description = "Cập nhật các thông tin chuyên môn của Người giúp việc")
    public ResponseEntity<ApiResponse<HelperProfileResponse>> updateProfessionalProfile(
            @Valid @RequestBody HelperProfessionalProfileRequest request) {
        return ResponseEntity.ok(ApiResponse.<HelperProfileResponse>builder()
                .message("Cập nhật hồ sơ năng lực thành công")
                .data(profileService.updateHelperProfessionalProfile(request))
                .build());
    }

    /**
     * Lấy hồ sơ công khai của một Người giúp việc bất kỳ.
     * Dùng cho Khách hàng khi cần xem thông tin Helper trước khi đặt lịch.
     * 
     * @param id User ID của Helper cần xem
     * @return ApiResponse chứa HelperProfileResponse công khai
     */
    @GetMapping("/helpers/{id}")
    @Operation(summary = "Xem hồ sơ công khai của Helper", description = "Dùng để hiển thị thông tin Helper cho Khách hàng xem trước khi đặt việc")
    public ResponseEntity<ApiResponse<HelperProfileResponse>> getPublicHelperProfile(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.<HelperProfileResponse>builder()
                .message("Lấy thông tin người giúp việc thành công")
                .data(profileService.getPublicHelperProfile(id))
                .build());
    }

    @GetMapping("/address-labels")
    @Operation(summary = "Lấy danh sách các nhãn địa chỉ", description = "Dùng để hiển thị trong dropdown cho FE chọn (HOME, OFFICE, vv)")
    public ResponseEntity<ApiResponse<java.util.List<String>>> getAddressLabels() {
        return ResponseEntity.ok(ApiResponse.<java.util.List<String>>builder()
                .message("Lấy danh sách nhãn địa chỉ thành công")
                .data(profileService.getAddressLabels())
                .build());
    }

    // --- External Location APIs (Proxy via Backend) ---

    @GetMapping("/locations/provinces")
    @Operation(summary = "Lấy danh sách Tỉnh/Thành", description = "Gọi từ Provinces API v1")
    public ResponseEntity<ApiResponse<java.util.List<java.util.Map<String, Object>>>> getProvinces() {
        return ResponseEntity.ok(ApiResponse.<java.util.List<java.util.Map<String, Object>>>builder()
                .message("Lấy danh sách tỉnh thành thành công")
                .data(profileService.getProvinces())
                .build());
    }

    @GetMapping("/locations/provinces/{provinceCode}/districts")
    @Operation(summary = "Lấy danh sách Quận/Huyện theo Tỉnh", description = "Gọi từ Provinces API v1")
    public ResponseEntity<ApiResponse<java.util.Map<String, Object>>> getDistricts(@PathVariable String provinceCode) {
        return ResponseEntity.ok(ApiResponse.<java.util.Map<String, Object>>builder()
                .message("Lấy danh sách quận huyện thành công")
                .data(profileService.getDistricts(provinceCode))
                .build());
    }

    @GetMapping("/locations/districts/{districtCode}/wards")
    @Operation(summary = "Lấy danh sách Phường/Xã theo Quận", description = "Gọi từ Provinces API v1")
    public ResponseEntity<ApiResponse<java.util.Map<String, Object>>> getWards(@PathVariable String districtCode) {
        return ResponseEntity.ok(ApiResponse.<java.util.Map<String, Object>>builder()
                .message("Lấy danh sách phường xã thành công")
                .data(profileService.getWards(districtCode))
                .build());
    }
}
