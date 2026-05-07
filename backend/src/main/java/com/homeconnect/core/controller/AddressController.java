package com.homeconnect.core.controller;

import com.homeconnect.core.dto.request.SaveAddressRequest;
import com.homeconnect.core.dto.request.UpdateAddressRequest;
import com.homeconnect.core.dto.response.AddressResponse;
import com.homeconnect.core.dto.response.ApiResponse;
import com.homeconnect.core.service.AddressService;
import com.homeconnect.core.service.GeocodingService;
import com.homeconnect.core.util.SecurityUtil;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/addresses")
@RequiredArgsConstructor
@Tag(name = "Addresses", description = "Quản lý địa chỉ cá nhân và gợi ý Goong")
public class AddressController {
    private final AddressService addressService;
    private final GeocodingService geocodingService;
    private final SecurityUtil securityUtil;

    // ─── GET danh sách địa chỉ ────────────────────────────────────────────────

    @GetMapping
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "Lấy danh sách địa chỉ đã lưu")
    public ResponseEntity<ApiResponse<List<AddressResponse>>> getMyAddresses(Authentication auth) {
        Long userId = securityUtil.getCurrentUserId(auth);
        return ResponseEntity.ok(ApiResponse.<List<AddressResponse>>builder()
                .message("Lấy danh sách địa chỉ thành công")
                .data(addressService.getMyAddresses(userId))
                .build());
    }

    // ─── CREATE ───────────────────────────────────────────────────────────────

    @PostMapping
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "Thêm địa chỉ mới (yêu cầu placeId từ gợi ý Goong)")
    public ResponseEntity<ApiResponse<AddressResponse>> createAddress(
            @Valid @RequestBody SaveAddressRequest request,
            Authentication auth) {
        Long userId = securityUtil.getCurrentUserId(auth);
        return ResponseEntity.ok(ApiResponse.<AddressResponse>builder()
                .message("Thêm địa chỉ thành công")
                .data(addressService.createAddress(userId, request))
                .build());
    }

    // ─── UPDATE ───────────────────────────────────────────────────────────────

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "Cập nhật địa chỉ (placeId tùy chọn; nếu có sẽ geocode chính xác hơn)")
    public ResponseEntity<ApiResponse<AddressResponse>> updateAddress(
            @PathVariable Integer id,
            @Valid @RequestBody UpdateAddressRequest request,
            Authentication auth) {
        Long userId = securityUtil.getCurrentUserId(auth);
        return ResponseEntity.ok(ApiResponse.<AddressResponse>builder()
                .message("Cập nhật địa chỉ thành công")
                .data(addressService.updateAddress(userId, id, request))
                .build());
    }

    // ─── DELETE ───────────────────────────────────────────────────────────────

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('CUSTOMER')")
    @Operation(summary = "Xóa địa chỉ")
    public ResponseEntity<ApiResponse<Void>> deleteAddress(
            @PathVariable Integer id,
            Authentication auth) {
        Long userId = securityUtil.getCurrentUserId(auth);
        addressService.deleteAddress(userId, id);
        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .message("Xóa địa chỉ thành công")
                .build());
    }

    // ─── GỢI Ý ĐỊA CHỈ (Autocomplete) ────────────────────────────────────────

    @GetMapping("/autocomplete")
    @Operation(summary = "Gợi ý địa chỉ từ Goong API (không cần đăng nhập)")
    public ResponseEntity<ApiResponse<List<Map<String, String>>>> autocomplete(
            @RequestParam @jakarta.validation.constraints.Size(min = 3, message = "Từ khóa tìm kiếm phải có ít nhất 3 ký tự") String input) {
        return ResponseEntity.ok(ApiResponse.<List<Map<String, String>>>builder()
                .message("Lấy gợi ý thành công")
                .data(geocodingService.getSuggestions(input))
                .build());
    }

    // ─── CHI TIẾT ĐỊA ĐIỂM (lấy tọa độ từ placeId) ──────────────────────────

    @GetMapping("/detail")
    @Operation(summary = "Lấy tọa độ chi tiết từ place_id của Goong")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getPlaceDetail(
            @RequestParam @jakarta.validation.constraints.NotBlank(message = "placeId không được để trống") String placeId) {
        return ResponseEntity.ok(ApiResponse.<Map<String, Object>>builder()
                .message("Lấy chi tiết địa điểm thành công")
                .data(geocodingService.getPlaceDetail(placeId))
                .build());
    }

    @GetMapping("/detail-v2")
    @Operation(summary = "Lấy chi tiết địa chỉ có cấu trúc (cho Direct Booking)")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getAddressComponents(
            @RequestParam @jakarta.validation.constraints.NotBlank(message = "placeId không được để trống") String placeId) {
        return ResponseEntity.ok(ApiResponse.<Map<String, Object>>builder()
                .message("Lấy chi tiết địa chỉ có cấu trúc thành công")
                .data(geocodingService.getAddressComponents(placeId))
                .build());
    }

    @GetMapping("/geocode")
    @Operation(summary = "Giải mã địa chỉ từ văn bản (cho nhập tay)")
    public ResponseEntity<ApiResponse<GeocodingService.GeoResult>> geocode(
            @RequestParam @jakarta.validation.constraints.NotBlank(message = "Địa chỉ không được để trống") String address) {
        return ResponseEntity.ok(ApiResponse.<GeocodingService.GeoResult>builder()
                .message("Giải mã địa chỉ thành công")
                .data(geocodingService.geocodeByAddressText(address))
                .build());
    }
}
