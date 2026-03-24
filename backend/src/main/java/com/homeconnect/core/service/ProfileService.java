package com.homeconnect.core.service;

import com.homeconnect.core.dto.request.profile.CommonProfileUpdateRequest;
import com.homeconnect.core.dto.request.profile.HelperProfessionalProfileRequest;
import com.homeconnect.core.dto.response.profile.HelperProfileResponse;
import com.homeconnect.core.dto.response.profile.LocationResponse;
import com.homeconnect.core.dto.response.profile.CategorySimpleResponse;
import com.homeconnect.core.dto.response.profile.UserProfileResponse;

import com.homeconnect.core.entity.*;
import com.homeconnect.core.exception.ApiException;
import com.homeconnect.core.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ProfileService {

    private final UserRepository userRepository;
    private final HelperProfileRepository helperProfileRepository;
    private final ServiceRepository serviceRepository;
    private final HelperServiceRepository helperServiceRepository;
    private final AddressRepository addressRepository;
    private final HelperWorkingDistrictRepository helperWorkingDistrictRepository;
    private final ServiceCategoryRepository serviceCategoryRepository;
    private final ExternalLocationService externalLocationService;
    private final GeocodingService geocodingService;

    private static final Pattern PHONE_PATTERN = Pattern.compile(".*\\d{8,}.*");

    public User getCurrentUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ApiException("Không tìm thấy người dùng", HttpStatus.NOT_FOUND));
    }

    public UserProfileResponse getProfile() {
        User user = getCurrentUser();
        Address defaultAddress = addressRepository.findByUser_IdAndIsDefaultTrue(user.getId()).orElse(null);
        return mapToUserResponse(user, defaultAddress);
    }

    @Transactional
    public UserProfileResponse updateCommonProfile(CommonProfileUpdateRequest request) {
        User user = getCurrentUser();
        user.setFullName(request.getFullName());
        if (request.getAvatarUrl() != null) {
            user.setAvatarUrl(request.getAvatarUrl());
        }
        user.setGender(request.getGender());
        User savedUser = userRepository.save(user);

        Address address = addressRepository.findByUser_IdAndIsDefaultTrue(user.getId())
                .orElse(Address.builder()
                        .user(user)
                        .isDefault(true)
                        .type("HOME")
                        .build());

        address.setAddressDetail(request.getAddressDetail());
        address.setWardName(request.getWardName());
        address.setDistrictName(request.getDistrictName());
        address.setProvinceName(request.getProvinceName());

        BigDecimal lat = request.getLatitude();
        BigDecimal lng = request.getLongitude();

        if (lat != null && lng != null && (lat.compareTo(BigDecimal.ZERO) != 0 || lng.compareTo(BigDecimal.ZERO) != 0)) {
            address.setLatitude(lat);
            address.setLongitude(lng);
        } else {
            try {
                GeocodingService.GeoResult geo = geocodingService.geocode(
                        request.getAddressDetail(),
                        request.getWardName(),
                        request.getDistrictName(),
                        request.getProvinceName());
                address.setLatitude(geo.getLatitude());
                address.setLongitude(geo.getLongitude());
            } catch (Exception e) {
                log.error("Geocoding failed for profile update of user {}: {}", user.getEmail(), e.getMessage());
                throw new ApiException("Không thể định vị địa chỉ này. Vui lòng kiểm tra lại.", HttpStatus.BAD_REQUEST);
            }
        }

        if (request.getAddressLabel() != null) {
            address.setType(request.getAddressLabel());
        }

        addressRepository.save(address);
        log.info("Updated common profile and geocoded address for user: {}", user.getEmail());
        return mapToUserResponse(savedUser, address);
    }

    public HelperProfileResponse getHelperProfessionalProfile() {
        User user = getCurrentUser();
        HelperProfile profile = helperProfileRepository.findByUser_Id(user.getId())
                .orElseThrow(() -> new ApiException("Đây không phải tài khoản Helper hoặc hồ sơ chưa được tạo",
                        HttpStatus.BAD_REQUEST));
        return mapToHelperResponse(profile);
    }

    @Transactional
    public HelperProfileResponse updateHelperProfessionalProfile(HelperProfessionalProfileRequest request) {
        User user = getCurrentUser();
        HelperProfile profile = helperProfileRepository.findByUser_Id(user.getId())
                .orElseThrow(() -> new ApiException("Hồ sơ Helper không tồn tại", HttpStatus.NOT_FOUND));

        if (request.getBio() != null) {
            if (request.getBio().length() < 50) {
                throw new ApiException("Bio phải có ít nhất 50 ký tự", HttpStatus.BAD_REQUEST);
            }
            if (PHONE_PATTERN.matcher(request.getBio()).matches()) {
                throw new ApiException("Bio không được chứa số điện thoại để đảm bảo an toàn hệ thống",
                        HttpStatus.BAD_REQUEST);
            }
            profile.setBio(request.getBio());
        }

        java.time.LocalDate dob = request.getDateOfBirth() != null ? request.getDateOfBirth() : user.getDateOfBirth();
        Integer exp = request.getExperienceYears() != null ? request.getExperienceYears()
                : profile.getExperienceYears();

        if (dob != null) {
            int age = java.time.Period.between(dob, java.time.LocalDate.now()).getYears();
            if (age < 18) {
                throw new ApiException("Người giúp việc phải từ 18 tuổi trở lên", HttpStatus.BAD_REQUEST);
            }
            if (exp != null && exp > (age - 15)) {
                throw new ApiException("Số năm kinh nghiệm (" + exp + ") không hợp lệ so với tuổi (" + age + ")",
                        HttpStatus.BAD_REQUEST);
            }
            user.setDateOfBirth(dob);
            userRepository.save(user);
        }

        if (request.getExperienceYears() != null) {
            profile.setExperienceYears(request.getExperienceYears());
        }

        if (request.getHometownName() != null) {
            profile.setHometownName(request.getHometownName());
        }

        if (request.getWorkingDistricts() != null) {
            helperWorkingDistrictRepository.deleteByHelper_Id(user.getId());
            helperWorkingDistrictRepository.flush();

            for (HelperProfessionalProfileRequest.WorkingDistrictRequest wdReq : request.getWorkingDistricts()) {
                if (!externalLocationService.validateDistrict(wdReq.getCode(), wdReq.getName())) {
                    throw new ApiException(" Quận/Huyện không hợp lệ: " + wdReq.getName(), HttpStatus.BAD_REQUEST);
                }
                helperWorkingDistrictRepository.save(HelperWorkingDistrict.builder()
                        .helper(user)
                        .districtName(wdReq.getName())
                        .districtCode(wdReq.getCode())
                        .build());
            }
        }

        if (request.getCategoryIds() != null) {
            helperServiceRepository.deleteByHelper_Id(user.getId());
            helperServiceRepository.flush(); // Cập nhật ngay để tránh Duplicate Entry khi insert lại
            
            List<HelperService> newSkills = request.getCategoryIds().stream()
                    .distinct()
                    .map(catId -> {
                        ServiceCategory category = serviceCategoryRepository.findById(catId)
                                .orElseThrow(() -> new ApiException("Danh mục ID " + catId + " không tồn tại", HttpStatus.BAD_REQUEST));
                        return HelperService.builder()
                                .helper(user)
                                .category(category)
                                .isActive(true)
                                .build();
                    })
                    .collect(Collectors.toList());
            helperServiceRepository.saveAll(newSkills);
        }

        HelperProfile savedProfile = helperProfileRepository.save(profile);
        log.info("Updated professional profile for helper: {}", user.getEmail());
        return mapToHelperResponse(savedProfile);
    }

    public HelperProfileResponse getPublicHelperProfile(Long id) {
        HelperProfile profile = helperProfileRepository.findByUser_Id(id)
                .orElseThrow(() -> new ApiException("Không tìm thấy thông tin người giúp việc", HttpStatus.NOT_FOUND));
        return mapToHelperResponse(profile);
    }

    private UserProfileResponse mapToUserResponse(User user, Address address) {
        return UserProfileResponse.builder()
                .id(user.getId())
                .fullName(user.getFullName())
                .email(user.getEmail())
                .phone(user.getPhone())
                .avatarUrl(user.getAvatarUrl())
                .role(user.getRole() != null ? user.getRole().name() : null)
                .gender(user.getGender())
                .status(user.getStatus() != null ? user.getStatus().name() : null)
                .addressDetail(address != null ? address.getAddressDetail() : null)
                .provinceName(address != null ? address.getProvinceName() : null)
                .districtName(address != null ? address.getDistrictName() : null)
                .wardName(address != null ? address.getWardName() : null)
                .addressLabel(address != null ? address.getType() : null)
                .latitude(address != null ? address.getLatitude() : null)
                .longitude(address != null ? address.getLongitude() : null)
                .build();
    }

    private HelperProfileResponse mapToHelperResponse(HelperProfile profile) {
        return HelperProfileResponse.builder()
                .bio(profile.getBio())
                .dateOfBirth(profile.getUser().getDateOfBirth())
                .experienceYears(profile.getExperienceYears())
                .hometownName(profile.getHometownName())
                .kycStatus(profile.getKycStatus() != null ? profile.getKycStatus().name() : null)
                .isOnline(profile.getIsOnline())
                .ratingAverage(profile.getRatingAverage())
                .totalReviews(profile.getTotalReviews())
                .categories(getCategoriesForHelper(profile.getUser().getId()))
                .workingDistricts(getWorkingDistrictsForHelper(profile.getUser().getId()))
                .build();
    }

    private List<LocationResponse> getWorkingDistrictsForHelper(Long userId) {
        return helperWorkingDistrictRepository.findByHelper_Id(userId).stream()
                .map(wd -> LocationResponse.builder()
                        .name(wd.getDistrictName())
                        .code(wd.getDistrictCode())
                        .type("DISTRICT")
                        .build())
                .collect(Collectors.toList());
    }

    private List<CategorySimpleResponse> getCategoriesForHelper(Long userId) {
        return helperServiceRepository.findByHelper_Id(userId).stream()
                .map(hs -> CategorySimpleResponse.builder()
                        .id(hs.getCategory().getCategoryId())
                        .name(hs.getCategory().getName())
                        .build())
                .collect(Collectors.toList());
    }

    public List<com.homeconnect.core.dto.response.profile.ServiceResponse> getActiveServices() {
        return serviceRepository.findByIsActiveTrue().stream()
                .map(this::mapToServiceResponse)
                .collect(Collectors.toList());
    }

    public List<CategorySimpleResponse> getActiveCategories() {
        return serviceCategoryRepository.findAll().stream()
                .filter(cat -> Boolean.TRUE.equals(cat.getIsActive()))
                .map(cat -> CategorySimpleResponse.builder()
                        .id(cat.getCategoryId())
                        .name(cat.getName())
                        .build())
                .collect(Collectors.toList());
    }

    private com.homeconnect.core.dto.response.profile.ServiceResponse mapToServiceResponse(com.homeconnect.core.entity.Service service) {
        return com.homeconnect.core.dto.response.profile.ServiceResponse.builder()
                .id(service.getServiceId())
                .name(service.getName())
                .basePrice(service.getBasePrice())
                .build();
    }

    public List<String> getAddressLabels() {
        return List.of("HOME", "OFFICE", "OTHER");
    }

    public java.util.List<java.util.Map<String, Object>> getProvinces() {
        return externalLocationService.getProvinces();
    }

    public java.util.Map<String, Object> getDistricts(String provinceCode) {
        return externalLocationService.getDistrictsByProvince(provinceCode);
    }

    public java.util.Map<String, Object> getWards(String districtCode) {
        return externalLocationService.getWardsByDistrict(districtCode);
    }
}
