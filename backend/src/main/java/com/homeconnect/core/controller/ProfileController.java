package com.homeconnect.core.controller;

import com.homeconnect.core.dto.request.profile.CommonProfileUpdateRequest;
import com.homeconnect.core.dto.request.profile.HelperProfessionalProfileRequest;
import com.homeconnect.core.dto.response.ApiResponse;
import com.homeconnect.core.dto.response.profile.HelperProfileResponse;
import com.homeconnect.core.dto.response.profile.UserProfileResponse;
import com.homeconnect.core.service.ProfileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class ProfileController {

    private final ProfileService profileService;

    @GetMapping("/profile")
    public ResponseEntity<ApiResponse<UserProfileResponse>> getMyProfile() {
        return ResponseEntity.ok(ApiResponse.<UserProfileResponse>builder()
                .message("Lấy thông tin hồ sơ thành công")
                .data(profileService.getProfile())
                .build());
    }

    @PutMapping("/profile")
    public ResponseEntity<ApiResponse<UserProfileResponse>> updateProfile(@Valid @RequestBody CommonProfileUpdateRequest request) {
        return ResponseEntity.ok(ApiResponse.<UserProfileResponse>builder()
                .message("Cập nhật hồ sơ thành công")
                .data(profileService.updateCommonProfile(request))
                .build());
    }

    @GetMapping("/helper/profile")
    @PreAuthorize("hasRole('HELPER')")
    public ResponseEntity<ApiResponse<HelperProfileResponse>> getMyProfessionalProfile() {
        return ResponseEntity.ok(ApiResponse.<HelperProfileResponse>builder()
                .message("Lấy hồ sơ năng lực thành công")
                .data(profileService.getHelperProfessionalProfile())
                .build());
    }

    @PutMapping("/helper/profile")
    @PreAuthorize("hasRole('HELPER')")
    public ResponseEntity<ApiResponse<HelperProfileResponse>> updateProfessionalProfile(
            @Valid @RequestBody HelperProfessionalProfileRequest request) {
        return ResponseEntity.ok(ApiResponse.<HelperProfileResponse>builder()
                .message("Cập nhật hồ sơ năng lực thành công")
                .data(profileService.updateHelperProfessionalProfile(request))
                .build());
    }

    @GetMapping("/helpers/{id}")
    public ResponseEntity<ApiResponse<HelperProfileResponse>> getPublicHelperProfile(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.<HelperProfileResponse>builder()
                .message("Lấy thông tin người giúp việc thành công")
                .data(profileService.getPublicHelperProfile(id))
                .build());
    }
}
