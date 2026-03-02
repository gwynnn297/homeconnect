package com.homeconnect.core.service;

import com.homeconnect.core.dto.request.profile.CommonProfileUpdateRequest;
import com.homeconnect.core.dto.request.profile.HelperProfessionalProfileRequest;
import com.homeconnect.core.dto.response.profile.HelperProfileResponse;
import com.homeconnect.core.dto.response.profile.LocationResponse;
import com.homeconnect.core.dto.response.profile.UserProfileResponse;
import com.homeconnect.core.entity.*;
import com.homeconnect.core.enums.LocationType;
import com.homeconnect.core.exception.ApiException;
import com.homeconnect.core.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ProfileService {

    private final UserRepository userRepository;
    private final HelperProfileRepository helperProfileRepository;
    private final LocationRepository locationRepository;
    private final ServiceRepository serviceRepository;
    private final HelperServiceRepository helperServiceRepository;
    private final AddressRepository addressRepository;

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
        
        // 1. Update Basic User Info
        user.setFullName(request.getFullName());
        if (request.getAvatarUrl() != null) {
            user.setAvatarUrl(request.getAvatarUrl());
        }
        user.setGender(request.getGender());
        User savedUser = userRepository.save(user);

        // 2. Update Default Address (PB-20)
        Address address = addressRepository.findByUser_IdAndIsDefaultTrue(user.getId())
                .orElse(Address.builder()
                        .user(user)
                        .isDefault(true)
                        .type("HOME")
                        .build());
        
        address.setAddressDetail(request.getAddressDetail());
        address.setContactName(user.getFullName());
        address.setContactPhone(user.getPhone());
        
        if (request.getProvinceId() != null) {
            address.setProvince(locationRepository.findById(request.getProvinceId()).orElse(null));
        }
        if (request.getDistrictId() != null) {
            address.setDistrict(locationRepository.findById(request.getDistrictId()).orElse(null));
        }
        if (request.getWardId() != null) {
            address.setWard(locationRepository.findById(request.getWardId()).orElse(null));
        }
        
        addressRepository.save(address);
        
        log.info("Updated common profile and address for user: {}", user.getEmail());
        return mapToUserResponse(savedUser, address);
    }

    public HelperProfileResponse getHelperProfessionalProfile() {
        User user = getCurrentUser();
        HelperProfile profile = helperProfileRepository.findByUser_Id(user.getId())
                .orElseThrow(() -> new ApiException("Đây không phải tài khoản Helper hoặc hồ sơ chưa được tạo", HttpStatus.BAD_REQUEST));
        
        return mapToHelperResponse(profile);
    }

    @Transactional
    public HelperProfileResponse updateHelperProfessionalProfile(HelperProfessionalProfileRequest request) {
        User user = getCurrentUser();
        HelperProfile profile = helperProfileRepository.findByUser_Id(user.getId())
                .orElseThrow(() -> new ApiException("Hồ sơ Helper không tồn tại", HttpStatus.NOT_FOUND));

        // 1. Validate Bio
        if (request.getBio() != null) {
            if (request.getBio().length() < 50) {
                throw new ApiException("Bio phải có ít nhất 50 ký tự", HttpStatus.BAD_REQUEST);
            }
            if (PHONE_PATTERN.matcher(request.getBio()).matches()) {
                throw new ApiException("Bio không được chứa số điện thoại để đảm bảo an toàn hệ thống", HttpStatus.BAD_REQUEST);
            }
            profile.setBio(request.getBio());
        }

        // 2. Update Basic Info
        java.time.LocalDate dob = request.getDateOfBirth() != null ? request.getDateOfBirth() : profile.getDateOfBirth();
        Integer exp = request.getExperienceYears() != null ? request.getExperienceYears() : profile.getExperienceYears();

        if (dob != null) {
            int age = java.time.Period.between(dob, java.time.LocalDate.now()).getYears();
            if (age < 18) {
                throw new ApiException("Người giúp việc phải từ 18 tuổi trở lên", HttpStatus.BAD_REQUEST);
            }
            if (exp != null && exp > (age - 15)) {
                throw new ApiException("Số năm kinh nghiệm (" + exp + ") không hợp lệ so với tuổi (" + age + ")", HttpStatus.BAD_REQUEST);
            }
            profile.setDateOfBirth(dob);
        }

        if (request.getExperienceYears() != null) {
            profile.setExperienceYears(request.getExperienceYears());
        }
        
        if (request.getAvatarUrl() != null) {
            user.setAvatarUrl(request.getAvatarUrl());
            userRepository.save(user);
        }

        // 3. Update Hometown
        if (request.getHometownCode() != null) {
            Location hometown = locationRepository.findById(request.getHometownCode())
                    .orElseThrow(() -> new ApiException("Mã tỉnh thành quê quán không hợp lệ", HttpStatus.BAD_REQUEST));
            profile.setHometown(hometown);
        }

        // 4. Update Skills
        if (request.getSkills() != null) {
            helperServiceRepository.deleteByHelper_Id(user.getId());
            helperServiceRepository.flush(); // Cập nhật ngay để tránh Duplicate Entry khi insert lại
            
            List<HelperService> newSkills = request.getSkills().stream()
                    .distinct()
                    .map(serviceId -> {
                        com.homeconnect.core.entity.Service service = serviceRepository.findById(serviceId)
                                .orElseThrow(() -> new ApiException("Dịch vụ ID " + serviceId + " không tồn tại", HttpStatus.BAD_REQUEST));
                        return HelperService.builder()
                                .helper(user)
                                .service(service)
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
                .isVerified(user.getIsVerified())
                .status(user.getStatus() != null ? user.getStatus().name() : null)
                .addressDetail(address != null ? address.getAddressDetail() : null)
                .provinceName(address != null && address.getProvince() != null ? address.getProvince().getName() : null)
                .districtName(address != null && address.getDistrict() != null ? address.getDistrict().getName() : null)
                .wardName(address != null && address.getWard() != null ? address.getWard().getName() : null)
                .build();
    }

    private HelperProfileResponse mapToHelperResponse(HelperProfile profile) {
        return HelperProfileResponse.builder()
                .bio(profile.getBio())
                .dateOfBirth(profile.getDateOfBirth())
                .experienceYears(profile.getExperienceYears())
                .hometownName(profile.getHometown() != null ? profile.getHometown().getName() : null)
                .kycStatus(profile.getKycStatus() != null ? profile.getKycStatus().name() : null)
                .isOnline(profile.getIsOnline())
                .ratingAverage(profile.getRatingAverage())
                .totalReviews(profile.getTotalReviews())
                .skillNames(getSkillNamesForHelper(profile.getUser().getId()))
                .build();
    }

    private List<String> getSkillNamesForHelper(Long userId) {
        return helperServiceRepository.findByHelper_Id(userId).stream()
                .map(hs -> hs.getService().getName())
                .collect(Collectors.toList());
    }

    // ========== LOCATION APIs (PB-20) ==========

    public List<LocationResponse> getProvinces() {
        return locationRepository.findByType(LocationType.PROVINCE).stream()
                .map(this::mapToLocationResponse)
                .collect(Collectors.toList());
    }

    public List<LocationResponse> getDistricts(Integer provinceId) {
        return locationRepository.findByParent_LocationId(provinceId).stream()
                .filter(l -> l.getType() == LocationType.DISTRICT)
                .map(this::mapToLocationResponse)
                .collect(Collectors.toList());
    }

    public List<LocationResponse> getWards(Integer districtId) {
        return locationRepository.findByParent_LocationId(districtId).stream()
                .filter(l -> l.getType() == LocationType.WARD)
                .map(this::mapToLocationResponse)
                .collect(Collectors.toList());
    }

    private LocationResponse mapToLocationResponse(Location location) {
        return LocationResponse.builder()
                .id(location.getLocationId())
                .name(location.getName())
                .type(location.getType().name())
                .build();
    }

    public List<com.homeconnect.core.dto.response.profile.ServiceResponse> getActiveServices() {
        return serviceRepository.findByIsActiveTrue().stream()
                .map(this::mapToServiceResponse)
                .collect(Collectors.toList());
    }

    private com.homeconnect.core.dto.response.profile.ServiceResponse mapToServiceResponse(com.homeconnect.core.entity.Service service) {
        return com.homeconnect.core.dto.response.profile.ServiceResponse.builder()
                .id(service.getServiceId())
                .name(service.getName())
                .iconUrl(service.getIconUrl())
                .basePrice(service.getBasePrice())
                .unit(service.getUnit() != null ? service.getUnit().name() : null)
                .build();
    }
}
