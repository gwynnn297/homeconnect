package com.homeconnect.core.controller;

import com.homeconnect.core.dto.request.HelperRegistrationStage1Request;
import com.homeconnect.core.dto.request.HelperRegistrationStage2Request;
import com.homeconnect.core.dto.response.UpdateKycResponse;
import com.homeconnect.core.entity.Location;
import com.homeconnect.core.enums.LocationType;
import com.homeconnect.core.repository.LocationRepository;
import com.homeconnect.core.repository.ServiceRepository;
import com.homeconnect.core.service.HelperRegistrationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;


@RestController
@RequestMapping("/api/helpers")
@RequiredArgsConstructor
@Tag(name = "Helper Registration", description = "Quy trình đăng ký 2 giai đoạn và tra cứu dữ liệu cho Helper")
public class HelperRegistrationController {

    private final HelperRegistrationService helperRegistrationService;
    private final LocationRepository locationRepository;
    private final ServiceRepository serviceRepository;

    @GetMapping("/provinces")
    @Operation(summary = "Lấy danh sách tỉnh/thành phố", description = "Dùng để fill vào chọn quê quán ở Stage 1")
    public ResponseEntity<List<Map<String, Object>>> getProvinces() {
        return ResponseEntity.ok(formatLocationList(locationRepository.findByType(LocationType.PROVINCE)));
    }

    @GetMapping("/districts/{provinceId}")
    @Operation(summary = "Lấy danh sách quận/huyện theo tỉnh", description = "Dùng để fill vào chọn quận làm việc ở Stage 1")
    public ResponseEntity<List<Map<String, Object>>> getDistricts(@PathVariable Integer provinceId) {
        return ResponseEntity.ok(formatLocationList(locationRepository.findByParent_LocationId(provinceId)));
    }

    @GetMapping("/services")
    @Operation(summary = "Lấy danh sách dịch vụ", description = "Dùng để chọn dịch vụ đăng ký ở Stage 1")
    public ResponseEntity<List<Map<String, Object>>> getServices() {
        return ResponseEntity.ok(serviceRepository.findByIsActiveTrue().stream()
                .map(s -> Map.<String, Object>of(
                        "id", s.getServiceId(),
                        "name", s.getName(),
                        "icon", s.getIconUrl() != null ? s.getIconUrl() : ""
                ))
                .toList());
    }

    private List<Map<String, Object>> formatLocationList(List<Location> locations) {
        return locations.stream()
                .map(loc -> Map.<String, Object>of(
                        "id", loc.getLocationId(),
                        "name", loc.getName()
                ))
                .toList();
    }



    @PostMapping("/register-stage1")
    @Operation(summary = "Giai đoạn 1: Thông tin cá nhân & Dịch vụ", 
               description = "Lưu thông tin cơ bản, bio, năm kinh nghiệm, khu vực làm việc và loại dịch vụ.",
               security = @SecurityRequirement(name = "bearerAuth"))
    public ResponseEntity<UpdateKycResponse> registerStage1(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody HelperRegistrationStage1Request request) {
        
        helperRegistrationService.registerStage1(userDetails.getUsername(), request);
        return ResponseEntity.ok(UpdateKycResponse.builder()
                .success(true)
                .message("Đã hoàn tất Giai đoạn 1: Hồ sơ & Dịch vụ")
                .build());
    }

    @PostMapping("/register-stage2")
    @Operation(summary = "Giai đoạn 2: Xác thực danh tính (CCCD)", 
               description = "Tải lên ảnh CCCD (mặt trước, mặt sau) và ảnh chân dung.",
               security = @SecurityRequirement(name = "bearerAuth"))
    public ResponseEntity<UpdateKycResponse> registerStage2(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody HelperRegistrationStage2Request request) {
        
        helperRegistrationService.registerStage2(userDetails.getUsername(), request);
        return ResponseEntity.ok(UpdateKycResponse.builder()
                .success(true)
                .message("Đã hoàn tất Giai đoạn 2: Xác thực danh tính")
                .build());
    }

    @PutMapping("/submit")
    @Operation(summary = "Gửi hồ sơ đăng ký", 
               description = "Chuyển trạng thái sang PENDING_REVIEW để chờ quản trị viên phê duyệt.",
               security = @SecurityRequirement(name = "bearerAuth"))
    public ResponseEntity<UpdateKycResponse> submitRegistration(
            @AuthenticationPrincipal UserDetails userDetails) {
        
        helperRegistrationService.submitRegistration(userDetails.getUsername());
        return ResponseEntity.ok(UpdateKycResponse.builder()
                .success(true)
                .message("Hồ sơ đã được gửi đi thành công. Vui lòng chờ phê duyệt.")
                .build());
    }
}
