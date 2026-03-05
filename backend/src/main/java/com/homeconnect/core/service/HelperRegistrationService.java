package com.homeconnect.core.service;

import com.homeconnect.core.dto.request.HelperRegistrationStage1Request;
import com.homeconnect.core.dto.request.HelperRegistrationStage2Request;
import com.homeconnect.core.dto.request.RegistrationDraft;
import com.homeconnect.core.exception.ApiException;
import com.homeconnect.core.exception.RegistrationIncompleteException;
import com.homeconnect.core.entity.*;
import com.homeconnect.core.enums.KycStatus;
import com.homeconnect.core.enums.UserRole;
import com.homeconnect.core.enums.UserStatus;
import com.homeconnect.core.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Period;

@Service
@Slf4j
@RequiredArgsConstructor
public class HelperRegistrationService {

    private final RegistrationCacheService registrationCacheService;
    private final HelperServiceRepository helperServiceRepository;
    private final HelperWorkingDistrictRepository helperWorkingDistrictRepository;
    private final UserRepository userRepository;
    private final HelperProfileRepository helperProfileRepository;
    private final ServiceRepository serviceRepository;
    private final AddressRepository addressRepository;

    private final ExternalLocationService externalLocationService;
    private final GeocodingService geocodingService;

    @Transactional
    public void registerStage1(String email, HelperRegistrationStage1Request request) {
        log.info("Saving Stage 1 Draft for helper: {}", email);

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Người dùng không tồn tại"));

        if (user.getRole() != UserRole.HELPER) {
            throw new RuntimeException("Chỉ Helper mới có thể thực hiện đăng ký này");
        }

        // Kiểm tra tuổi (>= 18)
        int age = Period.between(request.getDateOfBirth(), LocalDate.now()).getYears();
        if (age < 18) {
            throw new RuntimeException("Helper phải từ 18 tuổi trở lên");
        }

        if (request.getExperienceYears() > (age - 15)) {
            throw new RuntimeException("Số năm kinh nghiệm không hợp lệ so với tuổi của bạn");
        }

        // Lấy hoặc tạo mới draft
        RegistrationDraft draft = registrationCacheService.getDraft(email);
        if (draft == null) {
            draft = new RegistrationDraft();
        }


        // Kiểm tra danh sách Quận làm việc
        for (com.homeconnect.core.dto.request.profile.HelperProfessionalProfileRequest.WorkingDistrictRequest wdReq : request.getWorkingDistricts()) {
            if (!externalLocationService.validateDistrict(wdReq.getCode(), wdReq.getName())) {
                throw new RuntimeException("Quận/Huyện làm việc không hợp lệ: " + wdReq.getName());
            }
        }

        // Kiểm tra danh sách Dịch vụ
        for (Integer sId : request.getServiceIds()) {
            if (!serviceRepository.existsById(sId)) {
                throw new RuntimeException("Dịch vụ không hợp lệ: " + sId);
            }
        }

        // Update draft với Stage 1 data
        draft.setDateOfBirth(request.getDateOfBirth());
        draft.setHometownName(request.getHometownName());
        draft.setProvinceName(request.getProvinceName());
        draft.setDistrictName(request.getDistrictName());
        draft.setWardName(request.getWardName());
        draft.setCurrentAddress(request.getCurrentAddress());
        draft.setWorkingDistricts(request.getWorkingDistricts());
        draft.setBio(request.getBio());
        draft.setExperienceYears(request.getExperienceYears());
        draft.setServiceIds(request.getServiceIds());
        draft.setLatitude(request.getLatitude());
        draft.setLongitude(request.getLongitude());

        registrationCacheService.saveDraft(email, draft);
        log.info("Stage 1 draft saved in cache for: {}", email);
    }

    /**
     * Giai đoạn 2: Xác thực danh tính (CCCD)
     */
    @Transactional
    public void registerStage2(String email, HelperRegistrationStage2Request request) {
        log.info("Saving Stage 2 Draft for helper: {}", email);

        RegistrationDraft draft = registrationCacheService.getDraft(email);
        if (draft == null || !draft.isStage1Complete()) {
            throw new RegistrationIncompleteException("Vui lòng hoàn thành Giai đoạn 1 trước khi thực hiện Giai đoạn 2");
        }

        // Kiểm tra format CCCD (12 chữ số)
        if (request.getIdentityNumber() != null && !request.getIdentityNumber().matches("^\\d{12}$")) {
            throw new RuntimeException("Số CCCD phải bao gồm chính xác 12 chữ số");
        }

        // Kiểm tra trung lặp CCCD
        if (helperProfileRepository.existsByIdentityNumber(request.getIdentityNumber())) {
            throw new RuntimeException("Số CCCD này đã được đăng ký trong hệ thống");
        }

        // Update draft với Stage 2 data
        draft.setIdentityNumber(request.getIdentityNumber());
        draft.setCccdFrontUrl(request.getCccdFrontUrl());
        draft.setCccdBackUrl(request.getCccdBackUrl());
        draft.setSelfieUrl(request.getSelfieUrl());

        registrationCacheService.saveDraft(email, draft);
        log.info("Stage 2 draft updated in cache for: {}", email);
    }


    /**
     * Bước cuối: Gửi hồ sơ để duyệt
     */
    @Transactional
    public void submitRegistration(String email) {
        log.info("Starting final submission for helper: {}", email);

        RegistrationDraft draft = registrationCacheService.getDraft(email);
        if (draft == null || !draft.isStage1Complete() || !draft.isStage2Complete()) {
            throw new RegistrationIncompleteException("Hồ sơ chưa hoàn thiện. Vui lòng hoàn thành cả 2 giai đoạn trước khi gửi.");
        }

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Người dùng không tồn tại"));

        HelperProfile profile = helperProfileRepository.findByUser_Id(user.getId())
                .orElseGet(() -> HelperProfile.builder().user(user).build());

        profile.setBio(draft.getBio());
        profile.setExperienceYears(draft.getExperienceYears());
        profile.setIdentityNumber(draft.getIdentityNumber());
        profile.setIdentityFrontUrl(draft.getCccdFrontUrl());
        profile.setIdentityBackUrl(draft.getCccdBackUrl());
        profile.setSelfieUrl(draft.getSelfieUrl());
        profile.setKycStatus(KycStatus.WAITING_APPROVAL);
        profile.setHometownName(draft.getHometownName());

        // 2. Lưu Working Districts
        helperWorkingDistrictRepository.deleteByHelper_Id(user.getId());
        helperWorkingDistrictRepository.flush();
        for (com.homeconnect.core.dto.request.profile.HelperProfessionalProfileRequest.WorkingDistrictRequest wdReq : draft.getWorkingDistricts()) {
            helperWorkingDistrictRepository.save(HelperWorkingDistrict.builder()
                    .helper(user)
                    .districtName(wdReq.getName())
                    .districtCode(wdReq.getCode())
                    .build());
        }

        // 3. Lưu Registered Services
        helperServiceRepository.deleteByHelper_Id(user.getId());
        helperServiceRepository.flush();
        for (Integer serviceId : new java.util.HashSet<>(draft.getServiceIds())) {
            com.homeconnect.core.entity.Service service = serviceRepository.findById(serviceId)
                    .orElseThrow(() -> new RuntimeException("Dịch vụ không hợp lệ: " + serviceId));
            helperServiceRepository.save(HelperService.builder()
                    .helper(user)
                    .service(service)
                    .isActive(true)
                    .build());
        }

        // 4. Update User status, Avatar & Date of Birth
        user.setStatus(UserStatus.PENDING_REVIEW);
        user.setAvatarUrl(draft.getSelfieUrl());
        user.setDateOfBirth(draft.getDateOfBirth());

        // 5. Save Default Address & Geocode
        Address address = addressRepository.findByUser_IdAndIsDefaultTrue(user.getId())
                .orElse(Address.builder()
                        .user(user)
                        .isDefault(true)
                        .type("HOME")
                        .build());
        
        address.setAddressDetail(draft.getCurrentAddress());
        address.setProvinceName(draft.getProvinceName());
        address.setDistrictName(draft.getDistrictName());
        address.setWardName(draft.getWardName());

        // Logic ưu tiên tọa độ (Chuẩn Production-Ready)
        BigDecimal lat = draft.getLatitude();
        BigDecimal lng = draft.getLongitude();

        if (lat != null && lng != null && (lat.compareTo(BigDecimal.ZERO) != 0 || lng.compareTo(BigDecimal.ZERO) != 0)) {
            address.setLatitude(lat);
            address.setLongitude(lng);
        } else {
            // Fallback sang Geocoding cấu trúc (10 cấp độ dự phòng tích hợp sẵn)
            try {
                GeocodingService.GeoResult geo = geocodingService.geocode(
                        draft.getCurrentAddress(),
                        draft.getWardName(),
                        draft.getDistrictName(),
                        draft.getProvinceName()
                );
                address.setLatitude(geo.getLatitude());
                address.setLongitude(geo.getLongitude());
            } catch (Exception e) {
                log.error("Geocoding failed during submission for helper {}: {}", email, e.getMessage());
                throw new ApiException("Không thể định vị địa chỉ của bạn. Vui lòng kiểm tra lại thông tin địa chỉ.", HttpStatus.BAD_REQUEST);
            }
        }
        
        addressRepository.save(address);
        helperProfileRepository.save(profile);
        userRepository.save(user);

        // 6. Xóa Cache
        registrationCacheService.removeDraft(email);

        log.info("Registration successfully persisted for helper: {}", email);
    }

    private String buildFullAddress(String detail, String ward, String district, String province) {
        if (detail == null || province == null) {
            return null;
        }
        return String.join(", ", detail, ward, district, province, "Vietnam")
                .replaceAll(", null", "")
                .replaceAll(", ,", ",");
    }

}
