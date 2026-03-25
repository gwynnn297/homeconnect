package com.homeconnect.core.controller;

import com.homeconnect.core.dto.request.HelperRegistrationStage1Request;
import com.homeconnect.core.dto.request.HelperRegistrationStage2Request;
import com.homeconnect.core.dto.response.UpdateKycResponse;
import com.homeconnect.core.repository.ServiceCategoryRepository;
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
    private final ServiceCategoryRepository serviceCategoryRepository;
    private final ServiceRepository serviceRepository;

    @GetMapping("/categories")
    @Operation(summary = "Lấy danh mục dịch vụ (Cha)", description = "Dùng để chọn kỹ năng đăng ký (Cha làm được hết con)")
    public ResponseEntity<List<Map<String, Object>>> getCategories() {
        List<Map<String, Object>> categories = serviceCategoryRepository.findAll().stream()
                .filter(cat -> Boolean.TRUE.equals(cat.getIsActive()))
                .map(cat -> {
                    Map<String, Object> map = new java.util.HashMap<>();
                    map.put("id", cat.getCategoryId());
                    map.put("name", cat.getName());
                    map.put("basePrice", cat.getBasePrice());

                    map.put("unit", cat.getUnit() != null ? cat.getUnit().name() : "");
                    return map;
                })
                .collect(java.util.stream.Collectors.toList());
        return ResponseEntity.ok(categories);
    }

    @GetMapping("/categories/{categoryId}/services")
    @Operation(summary = "Lấy danh sách dịch vụ con", description = "Dùng để xem các dịch vụ cụ thể thuộc một danh mục")
    public ResponseEntity<List<Map<String, Object>>> getServicesByCategoryId(@PathVariable Integer categoryId) {
        List<Map<String, Object>> services = serviceRepository.findByCategoryCategoryIdAndIsActiveTrue(categoryId).stream()
                .map(s -> {
                    Map<String, Object> map = new java.util.HashMap<>();
                    map.put("id", s.getServiceId());
                    map.put("name", s.getName());
                    map.put("basePrice", s.getBasePrice());
                    return map;
                })
                .collect(java.util.stream.Collectors.toList());
        return ResponseEntity.ok(services);
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
