package com.homeconnect.core.service;

import com.homeconnect.core.dto.request.SaveAddressRequest;
import com.homeconnect.core.dto.request.UpdateAddressRequest;
import com.homeconnect.core.dto.response.AddressResponse;
import com.homeconnect.core.entity.Address;
import com.homeconnect.core.repository.AddressRepository;
import com.homeconnect.core.repository.BookingRepository;
import com.homeconnect.core.repository.JobPostRepository;
import com.homeconnect.core.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AddressService {
    private final AddressRepository addressRepository;
    private final UserRepository userRepository;
    private final JobPostRepository jobPostRepository;
    private final BookingRepository bookingRepository;
    private final GeocodingService geocodingService;

    // ─── GET ──────────────────────────────────────────────────────────────────

    public List<AddressResponse> getMyAddresses(Long userId) {
        return addressRepository.findByUser_Id(userId)
                .stream()
                .map(AddressResponse::from)
                .collect(Collectors.toList());
    }

    // ─── CREATE ───────────────────────────────────────────────────────────────

    @Transactional
    public AddressResponse createAddress(Long userId, SaveAddressRequest request) {
        // 1. Giới hạn tối đa 10 địa chỉ
        long currentCount = addressRepository.countByUser_Id(userId);
        if (currentCount >= 10) {
            throw new com.homeconnect.core.exception.ApiException(
                "Bạn chỉ được lưu tối đa 10 địa chỉ. Vui lòng xóa bớt địa chỉ cũ.",
                org.springframework.http.HttpStatus.BAD_REQUEST);
        }

        // 2. Validate và lấy tọa độ + địa chỉ chuẩn qua Geocoding
        BigDecimal lat, lng;
        String addressDetail = request.getAddressDetail();
        String wardName      = request.getWardName();
        String districtName  = request.getDistrictName();
        String provinceName  = request.getProvinceName();

        if (request.getPlaceId() != null && !request.getPlaceId().isBlank()) {
            // Trường hợp có placeId (ưu tiên)
            Map<String, Object> components = geocodingService.getAddressComponents(request.getPlaceId());
            lat = java.math.BigDecimal.valueOf((Double) components.get("latitude"));
            lng = java.math.BigDecimal.valueOf((Double) components.get("longitude"));
            
            // Standardize address từ Goong (tùy chọn, ở đây ta lấy luôn để tránh "nhập bậy")
            addressDetail = resolve(components, "addressDetail", addressDetail);
            wardName      = resolve(components, "wardName",      wardName);
            districtName  = resolve(components, "districtName",  districtName);
            provinceName  = resolve(components, "provinceName",  provinceName);
        } else {
            // Trường hợp nhập tay hoàn toàn -> Geocode từ text để validate
            GeocodingService.GeoResult geo = geocodingService.geocode(addressDetail, wardName, districtName, provinceName);
            if (geo == null) {
                throw new com.homeconnect.core.exception.ApiException(
                    "Không tìm thấy địa chỉ này trên bản đồ. Vui lòng kiểm tra lại Số nhà, Tên đường và Phường/Quận.",
                    org.springframework.http.HttpStatus.BAD_REQUEST);
            }
            lat = geo.getLatitude();
            lng = geo.getLongitude();

            // QUAN TRỌNG: Lấy địa chỉ CHUẨN từ Goong để ghi đè cái người dùng nhập bậy
            if (geo.getPlaceId() != null) {
                Map<String, Object> components = geocodingService.getAddressComponents(geo.getPlaceId());
                addressDetail = resolve(components, "addressDetail", addressDetail);
                wardName      = resolve(components, "wardName",      wardName);
                districtName  = resolve(components, "districtName",  districtName);
                provinceName  = resolve(components, "provinceName",  provinceName);
            }
        }

        // 3. Kiểm tra trùng lặp
        if (addressRepository.existsByUser_IdAndAddressDetailIgnoreCaseAndWardNameAndDistrictNameAndProvinceName(
                userId, addressDetail, wardName, districtName, provinceName)) {
            throw new com.homeconnect.core.exception.ApiException(
                "Địa chỉ này đã tồn tại trong danh sách của bạn.",
                org.springframework.http.HttpStatus.CONFLICT);
        }

        if (Boolean.TRUE.equals(request.getIsDefault())) {
            resetDefaultAddress(userId);
        }

        Address address = Address.builder()
                .user(userRepository.getReferenceById(userId))
                .addressDetail(addressDetail)
                .wardName(wardName)
                .districtName(districtName)
                .provinceName(provinceName)
                .latitude(lat)
                .longitude(lng)
                .type(request.getType() != null ? request.getType() : "HOME")
                .isDefault(Boolean.TRUE.equals(request.getIsDefault()))
                .build();

        return AddressResponse.from(addressRepository.save(address));
    }

    // ─── UPDATE ───────────────────────────────────────────────────────────────

    @Transactional
    public AddressResponse updateAddress(Long userId, Integer addressId, UpdateAddressRequest request) {
        Address existing = addressRepository.findById(addressId)
                .orElseThrow(() -> new com.homeconnect.core.exception.ApiException(
                        "Không tìm thấy địa chỉ.", org.springframework.http.HttpStatus.NOT_FOUND));

        if (!existing.getUser().getId().equals(userId)) {
            throw new com.homeconnect.core.exception.ApiException(
                    "Bạn không có quyền chỉnh sửa địa chỉ này.", org.springframework.http.HttpStatus.FORBIDDEN);
        }

        if (Boolean.TRUE.equals(request.getIsDefault()) && !Boolean.TRUE.equals(existing.getIsDefault())) {
            resetDefaultAddress(userId);
        }

        BigDecimal lat, lng;
        String addressDetail = request.getAddressDetail();
        String wardName      = request.getWardName();
        String districtName  = request.getDistrictName();
        String provinceName  = request.getProvinceName();

        if (request.getPlaceId() != null && !request.getPlaceId().isBlank()) {
            Map<String, Object> components = geocodingService.getAddressComponents(request.getPlaceId());
            lat = java.math.BigDecimal.valueOf((Double) components.get("latitude"));
            lng = java.math.BigDecimal.valueOf((Double) components.get("longitude"));
            addressDetail = resolve(components, "addressDetail", addressDetail);
            wardName      = resolve(components, "wardName",      wardName);
            districtName  = resolve(components, "districtName",  districtName);
            provinceName  = resolve(components, "provinceName",  provinceName);
        } else {
            GeocodingService.GeoResult geo = geocodingService.geocode(addressDetail, wardName, districtName, provinceName);
            if (geo == null) {
                throw new com.homeconnect.core.exception.ApiException(
                    "Địa chỉ không hợp lệ hoặc không tìm thấy trên bản đồ.",
                    org.springframework.http.HttpStatus.BAD_REQUEST);
            }
            lat = geo.getLatitude();
            lng = geo.getLongitude();

            // Chuẩn hóa lại text nhập tay
            if (geo.getPlaceId() != null) {
                Map<String, Object> components = geocodingService.getAddressComponents(geo.getPlaceId());
                addressDetail = resolve(components, "addressDetail", addressDetail);
                wardName      = resolve(components, "wardName",      wardName);
                districtName  = resolve(components, "districtName",  districtName);
                provinceName  = resolve(components, "provinceName",  provinceName);
            }
        }

        // Kiểm tra trùng lặp trước khi lưu (Ngoại trừ chính nó)
        if (addressRepository.existsByUser_IdAndAddressDetailIgnoreCaseAndWardNameAndDistrictNameAndProvinceNameAndAddressIdNot(
                userId, addressDetail, wardName, districtName, provinceName, addressId)) {
            throw new com.homeconnect.core.exception.ApiException(
                "Địa chỉ này đã tồn tại trong danh sách của bạn.",
                org.springframework.http.HttpStatus.CONFLICT);
        }

        existing.setAddressDetail(addressDetail);
        existing.setWardName(wardName);
        existing.setDistrictName(districtName);
        existing.setProvinceName(provinceName);
        existing.setLatitude(lat);
        existing.setLongitude(lng);
        existing.setIsDefault(request.getIsDefault());
        existing.setType(request.getType() != null ? request.getType() : existing.getType());

        return AddressResponse.from(addressRepository.save(existing));
    }

    // ─── DELETE ───────────────────────────────────────────────────────────────

    @Transactional
    public void deleteAddress(Long userId, Integer addressId) {
        Address existing = addressRepository.findById(addressId)
                .orElseThrow(() -> new com.homeconnect.core.exception.ApiException(
                        "Không tìm thấy địa chỉ.", org.springframework.http.HttpStatus.NOT_FOUND));

        if (!existing.getUser().getId().equals(userId)) {
            throw new com.homeconnect.core.exception.ApiException(
                    "Bạn không có quyền xóa địa chỉ này.", org.springframework.http.HttpStatus.FORBIDDEN);
        }

        // RÀNG BUỘC: Không xóa địa chỉ nếu đang có bài đăng tin hoặc đơn hàng liên kết
        if (jobPostRepository.existsByAddress_AddressId(addressId)) {
            throw new com.homeconnect.core.exception.ApiException(
                    "Không thể xóa địa chỉ này vì đang có bài đăng tin liên kết.", 
                    org.springframework.http.HttpStatus.BAD_REQUEST);
        }
        if (bookingRepository.existsByAddress_AddressId(addressId)) {
            throw new com.homeconnect.core.exception.ApiException(
                    "Không thể xóa địa chỉ này vì đang có đơn hàng (booking) liên kết.", 
                    org.springframework.http.HttpStatus.BAD_REQUEST);
        }

        addressRepository.delete(existing);
    }

    // ─── HELPER ───────────────────────────────────────────────────────────────

    private void resetDefaultAddress(Long userId) {
        addressRepository.findByUser_IdAndIsDefaultTrue(userId)
                .ifPresent(a -> {
                    a.setIsDefault(false);
                    addressRepository.save(a);
                });
    }

    /** Ưu tiên giá trị nhập từ user (fallback) nếu có, nếu trống mới dùng từ Goong (val). */
    private String resolve(Map<String, Object> components, String key, String fallback) {
        // Nếu user đã nhập/chọn từ gợi ý có data rồi thì giữ nguyên để tránh mất số nhà 
        if (fallback != null && !fallback.isBlank()) {
            return fallback;
        }
        Object val = components.get(key);
        return (val != null && !val.toString().isBlank()) ? val.toString() : fallback;
    }
}
