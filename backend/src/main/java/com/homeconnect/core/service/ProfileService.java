package com.homeconnect.core.service;

import com.homeconnect.core.dto.request.profile.CommonProfileUpdateRequest;
import com.homeconnect.core.dto.request.profile.HelperProfessionalProfileRequest;
import com.homeconnect.core.dto.response.profile.HelperProfileResponse;
import com.homeconnect.core.dto.response.profile.LocationResponse;
import com.homeconnect.core.dto.response.profile.ServiceSimpleResponse;
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
    private final HelperWorkingDistrictRepository helperWorkingDistrictRepository;

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
        
        // Validation phân cấp địa chỉ
        if (request.getProvinceId() != null) {
            Location province = locationRepository.findById(request.getProvinceId())
                    .orElseThrow(() -> new ApiException("Tỉnh/Thành phố không tồn tại", HttpStatus.BAD_REQUEST));
            if (province.getType() != com.homeconnect.core.enums.LocationType.PROVINCE) {
                throw new ApiException("ID Tỉnh/Thành phố không đúng loại", HttpStatus.BAD_REQUEST);
            }
            address.setProvince(province);

            if (request.getDistrictId() != null) {
                Location district = locationRepository.findById(request.getDistrictId())
                        .orElseThrow(() -> new ApiException("Quận/Huyện không tồn tại", HttpStatus.BAD_REQUEST));
                if (district.getParent() == null || !district.getParent().getLocationId().equals(province.getLocationId())) {
                    throw new ApiException("Quận/Huyện không thuộc Tỉnh/Thành phố đã chọn", HttpStatus.BAD_REQUEST);
                }
                if (district.getType() != com.homeconnect.core.enums.LocationType.DISTRICT) {
                    throw new ApiException("ID Quận/Huyện không đúng loại", HttpStatus.BAD_REQUEST);
                }
                address.setDistrict(district);

                if (request.getWardId() != null) {
                    Location ward = locationRepository.findById(request.getWardId())
                            .orElseThrow(() -> new ApiException("Phường/Xã không tồn tại", HttpStatus.BAD_REQUEST));
                    if (ward.getParent() == null || !ward.getParent().getLocationId().equals(district.getLocationId())) {
                        throw new ApiException("Phường/Xã không thuộc Quận/Huyện đã chọn", HttpStatus.BAD_REQUEST);
                    }
                    address.setWard(ward);
                }
            } else if (request.getWardId() != null) {
                throw new ApiException("Cần chọn Quận/Huyện trước khi chọn Phường/Xã", HttpStatus.BAD_REQUEST);
            }
        } else if (request.getDistrictId() != null || request.getWardId() != null) {
            throw new ApiException("Cần chọn Tỉnh/Thành phố trước", HttpStatus.BAD_REQUEST);
        }

        if (request.getAddressLabel() != null) {
            address.setType(request.getAddressLabel());
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
        java.time.LocalDate dob = request.getDateOfBirth() != null ? request.getDateOfBirth() : user.getDateOfBirth();
        Integer exp = request.getExperienceYears() != null ? request.getExperienceYears() : profile.getExperienceYears();

        if (dob != null) {
            int age = java.time.Period.between(dob, java.time.LocalDate.now()).getYears();
            if (age < 18) {
                throw new ApiException("Người giúp việc phải từ 18 tuổi trở lên", HttpStatus.BAD_REQUEST);
            }
            if (exp != null && exp > (age - 15)) {
                throw new ApiException("Số năm kinh nghiệm (" + exp + ") không hợp lệ so với tuổi (" + age + ")", HttpStatus.BAD_REQUEST);
            }
            user.setDateOfBirth(dob);
            userRepository.save(user);
        }

        if (request.getExperienceYears() != null) {
            profile.setExperienceYears(request.getExperienceYears());
        }
        
        // 3. Update Hometown
        if (request.getHometownId() != null) {
            Location hometown = locationRepository.findById(request.getHometownId())
                    .orElseThrow(() -> new ApiException("Mã tỉnh thành quê quán không hợp lệ", HttpStatus.BAD_REQUEST));
            profile.setHometown(hometown);
        }

        // 4. Update Working Districts
        if (request.getWorkingDistrictIds() != null) {
            helperWorkingDistrictRepository.deleteByHelper_Id(user.getId());
            helperWorkingDistrictRepository.flush();
            
            for (Integer districtId : new java.util.HashSet<>(request.getWorkingDistrictIds())) {
                Location district = locationRepository.findById(districtId)
                        .orElseThrow(() -> new ApiException("Quận/Huyện không hợp lệ: " + districtId, HttpStatus.BAD_REQUEST));
                helperWorkingDistrictRepository.save(HelperWorkingDistrict.builder()
                        .helper(user)
                        .location(district)
                        .build());
            }
        }

        // 5. Update Skills
        if (request.getServiceIds() != null) {
            helperServiceRepository.deleteByHelper_Id(user.getId());
            helperServiceRepository.flush(); // Cập nhật ngay để tránh Duplicate Entry khi insert lại
            
            List<HelperService> newSkills = request.getServiceIds().stream()
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
                .status(user.getStatus() != null ? user.getStatus().name() : null)
                .addressDetail(address != null ? address.getAddressDetail() : null)
                .provinceName(address != null && address.getProvince() != null ? address.getProvince().getName() : null)
                .districtName(address != null && address.getDistrict() != null ? address.getDistrict().getName() : null)
                .wardName(address != null && address.getWard() != null ? address.getWard().getName() : null)
                .addressLabel(address != null ? address.getType() : null)
                .build();
    }

    private HelperProfileResponse mapToHelperResponse(HelperProfile profile) {
        return HelperProfileResponse.builder()
                .bio(profile.getBio())
                .dateOfBirth(profile.getUser().getDateOfBirth())
                .experienceYears(profile.getExperienceYears())
                .hometownId(profile.getHometown() != null ? profile.getHometown().getLocationId() : null)
                .hometownName(profile.getHometown() != null ? profile.getHometown().getName() : null)
                .kycStatus(profile.getKycStatus() != null ? profile.getKycStatus().name() : null)
                .isOnline(profile.getIsOnline())
                .ratingAverage(profile.getRatingAverage())
                .totalReviews(profile.getTotalReviews())
                .services(getServicesForHelper(profile.getUser().getId()))
                .workingDistricts(getWorkingDistrictsForHelper(profile.getUser().getId()))
                .build();
    }

    private List<LocationResponse> getWorkingDistrictsForHelper(Long userId) {
        return helperWorkingDistrictRepository.findByHelper_Id(userId).stream()
                .map(wd -> LocationResponse.builder()
                        .id(wd.getLocation().getLocationId())
                        .name(wd.getLocation().getName())
                        .type(wd.getLocation().getType() != null ? wd.getLocation().getType().name() : null)
                        .build())
                .collect(Collectors.toList());
    }

    private List<ServiceSimpleResponse> getServicesForHelper(Long userId) {
        return helperServiceRepository.findByHelper_Id(userId).stream()
                .map(hs -> ServiceSimpleResponse.builder()
                        .id(hs.getService().getServiceId())
                        .name(hs.getService().getName())
                        .build())
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

    public List<String> getAddressLabels() {
        return List.of("HOME", "OFFICE", "OTHER");
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
