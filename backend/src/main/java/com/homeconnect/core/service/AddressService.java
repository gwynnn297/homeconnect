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
    private final ExternalLocationService externalLocationService;

    // ─── GET ──────────────────────────────────────────────────────────────────

    public List<AddressResponse> getMyAddresses(Long userId) {
        return addressRepository.findByUser_IdAndIsDeletedFalse(userId)
                .stream()
                .map(AddressResponse::from)
                .collect(Collectors.toList());
    }

    // ─── CREATE ───────────────────────────────────────────────────────────────

    @Transactional
    public AddressResponse createAddress(Long userId, SaveAddressRequest request) {
        // 1. Giới hạn tối đa 10 địa chỉ (Chỉ tính địa chỉ đang hoạt động)
        long currentCount = addressRepository.countByUser_IdAndIsDeletedFalse(userId);
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
            Map<String, Object> components = geocodingService.getAddressComponents(request.getPlaceId());
            lat = java.math.BigDecimal.valueOf(Double.parseDouble(components.get("latitude").toString()));
            lng = java.math.BigDecimal.valueOf(Double.parseDouble(components.get("longitude").toString()));
            
            addressDetail = resolve(components, "addressDetail", addressDetail);
            wardName      = resolve(components, "wardName",      wardName);
            districtName  = resolve(components, "districtName",  districtName);
            provinceName  = resolve(components, "provinceName",  provinceName);
        } else {
            GeocodingService.GeoResult geo = geocodingService.geocode(addressDetail, wardName, districtName, provinceName);
            if (geo == null) {
                throw new com.homeconnect.core.exception.ApiException(
                    "Không tìm thấy địa chỉ này trên bản đồ.",
                    org.springframework.http.HttpStatus.BAD_REQUEST);
            }
            lat = geo.getLatitude();
            lng = geo.getLongitude();
        }

        // 3. Liên kết mã số chuẩn từ ExternalLocationService
        String wCode = request.getWardCode();
        String dCode = request.getDistrictCode();
        String pCode = request.getProvinceCode();
        

        if (pCode == null || pCode.isBlank()) pCode = externalLocationService.findProvinceCodeByName(provinceName);
        if (dCode == null || dCode.isBlank()) dCode = externalLocationService.findDistrictCodeByName(pCode, districtName);
        if (wCode == null || wCode.isBlank()) wCode = externalLocationService.findWardCodeByName(dCode, wardName);

        // 4. Kiểm tra trùng lặp (Chỉ tính địa chỉ chưa xóa)
        if (addressRepository.existsByUser_IdAndAddressDetailIgnoreCaseAndWardNameAndDistrictNameAndProvinceNameAndIsDeletedFalse(
                userId, addressDetail, wardName, districtName, provinceName)) {
            throw new com.homeconnect.core.exception.ApiException(
                "Địa chỉ này đã tồn tại.",
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
                .wardCode(wCode)
                .districtCode(dCode)
                .provinceCode(pCode)
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
                .orElseThrow(() -> new com.homeconnect.core.exception.ApiException("Không tìm thấy địa chỉ", org.springframework.http.HttpStatus.NOT_FOUND));

        if (!existing.getUser().getId().equals(userId)) {
            throw new com.homeconnect.core.exception.ApiException("Bạn không có quyền sửa địa chỉ này", org.springframework.http.HttpStatus.FORBIDDEN);
        }

        BigDecimal lat = existing.getLatitude();
        BigDecimal lng = existing.getLongitude();
        String addressDetail = request.getAddressDetail();
        String wardName = request.getWardName();
        String districtName = request.getDistrictName();
        String provinceName = request.getProvinceName();

        if (request.getPlaceId() != null && !request.getPlaceId().isBlank()) {
            Map<String, Object> components = geocodingService.getAddressComponents(request.getPlaceId());
            lat = java.math.BigDecimal.valueOf(Double.parseDouble(components.get("latitude").toString()));
            lng = java.math.BigDecimal.valueOf(Double.parseDouble(components.get("longitude").toString()));
            addressDetail = resolve(components, "addressDetail", addressDetail);
            wardName = resolve(components, "wardName", wardName);
            districtName = resolve(components, "districtName", districtName);
            provinceName = resolve(components, "provinceName", provinceName);
        }

        // Sync mã chuẩn
        String wCode = request.getWardCode();
        String dCode = request.getDistrictCode();
        String pCode = request.getProvinceCode();

        if (pCode == null || pCode.isBlank()) pCode = externalLocationService.findProvinceCodeByName(provinceName);
        if (dCode == null || dCode.isBlank()) dCode = externalLocationService.findDistrictCodeByName(pCode, districtName);
        if (wCode == null || wCode.isBlank()) wCode = externalLocationService.findWardCodeByName(dCode, wardName);

        if (Boolean.TRUE.equals(request.getIsDefault())) {
            resetDefaultAddress(userId);
        }

        // --- MỚI: Chiến lược Immutable Address (Bảo vệ lịch sử) ---
        // Nếu địa chỉ đã từng được sử dụng trong Booking/JobPost, ta không sửa trực tiếp
        // mà sẽ ẩn bản cũ và tạo bản mới.
        boolean isUsed = jobPostRepository.existsByAddress_AddressId(addressId) 
                      || bookingRepository.existsByAddress_AddressId(addressId);

        if (isUsed) {
            // Kiểm tra xem có đơn hàng nào ĐANG HOẠT ĐỘNG không (Chặn sửa nếu đang làm)
            validateNoActiveOrders(addressId);

            // Ẩn bản ghi cũ
            existing.setIsDeleted(true);
            existing.setIsDefault(false);
            addressRepository.save(existing);

            // Tạo bản ghi mới với thông tin đã sửa
            Address newAddress = Address.builder()
                    .user(existing.getUser())
                    .addressDetail(addressDetail)
                    .wardName(wardName)
                    .districtName(districtName)
                    .provinceName(provinceName)
                    .wardCode(wCode)
                    .districtCode(dCode)
                    .provinceCode(pCode)
                    .latitude(lat)
                    .longitude(lng)
                    .type(request.getType() != null ? request.getType() : existing.getType())
                    .isDefault(Boolean.TRUE.equals(request.getIsDefault()))
                    .build();
            return AddressResponse.from(addressRepository.save(newAddress));
        } else {
            // Nếu chưa từng dùng, sửa trực tiếp như bình thường
            existing.setAddressDetail(addressDetail);
            existing.setWardName(wardName);
            existing.setDistrictName(districtName);
            existing.setProvinceName(provinceName);
            existing.setWardCode(wCode);
            existing.setDistrictCode(dCode);
            existing.setProvinceCode(pCode);
            existing.setLatitude(lat);
            existing.setLongitude(lng);
            existing.setIsDefault(Boolean.TRUE.equals(request.getIsDefault()));
            if (request.getType() != null) existing.setType(request.getType());

            return AddressResponse.from(addressRepository.save(existing));
        }
    }

    // ─── DELETE ───────────────────────────────────────────────────────────────

    @Transactional
    public void deleteAddress(Long userId, Integer addressId) {
        Address address = addressRepository.findById(addressId)
                .orElseThrow(() -> new com.homeconnect.core.exception.ApiException("Không tìm thấy địa chỉ", org.springframework.http.HttpStatus.NOT_FOUND));

        if (!address.getUser().getId().equals(userId)) {
            throw new com.homeconnect.core.exception.ApiException("Bạn không có quyền xóa địa chỉ này", org.springframework.http.HttpStatus.FORBIDDEN);
        }

        // Chặn xóa nếu có đơn hàng đang hoạt động
        validateNoActiveOrders(addressId);

        // Thực hiện Soft Delete
        address.setIsDeleted(true);
        address.setIsDefault(false);
        addressRepository.save(address);
    }

    private void validateNoActiveOrders(Integer addressId) {
        boolean hasActiveBooking = bookingRepository.existsByAddress_AddressIdAndStatusIn(addressId, 
            List.of(com.homeconnect.core.enums.BookingStatus.PENDING, 
                    com.homeconnect.core.enums.BookingStatus.PENDING_ACCEPTANCE, 
                    com.homeconnect.core.enums.BookingStatus.CONFIRMED, 
                    com.homeconnect.core.enums.BookingStatus.ARRIVED, 
                    com.homeconnect.core.enums.BookingStatus.IN_PROGRESS, 
                    com.homeconnect.core.enums.BookingStatus.DISPUTED));
        
        boolean hasActiveJob = jobPostRepository.existsByAddress_AddressIdAndStatusIn(addressId, 
            List.of("PUBLISHED"));

        if (hasActiveBooking || hasActiveJob) {
            throw new com.homeconnect.core.exception.ApiException(
                "Không thể sửa/xóa địa chỉ này vì đang có đơn hàng hoặc bài đăng đang hoạt động. Vui lòng hoàn thành hoặc hủy chúng trước.", 
                org.springframework.http.HttpStatus.BAD_REQUEST);
        }
    }

    private void resetDefaultAddress(Long userId) {
        addressRepository.findByUser_IdAndIsDeletedFalse(userId).forEach(a -> {
            if (Boolean.TRUE.equals(a.getIsDefault())) {
                a.setIsDefault(false);
                addressRepository.save(a);
            }
        });
    }

    private String resolve(Map<String, Object> components, String key, String fallback) {
        Object val = components.get(key);
        return (val != null && !String.valueOf(val).isBlank()) ? String.valueOf(val) : fallback;
    }
}
