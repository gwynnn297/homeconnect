package com.homeconnect.core.service;

import com.homeconnect.core.dto.request.HelperRegistrationStage1Request;
import com.homeconnect.core.dto.request.HelperRegistrationStage2Request;
import com.homeconnect.core.dto.request.RegistrationDraft;
import com.homeconnect.core.exception.RegistrationIncompleteException;
import com.homeconnect.core.entity.*;
import com.homeconnect.core.enums.KycStatus;
import com.homeconnect.core.enums.UserRole;
import com.homeconnect.core.enums.UserStatus;
import com.homeconnect.core.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
    private final LocationRepository locationRepository;
    private final ServiceRepository serviceRepository;

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

        // Kiểm tra tính hợp lệ của kinh nghiệm (Ví dụ: 20 tuổi không thể có 10 năm kinh nghiệm chuyên nghiệp)
        // Giả sử bắt đầu làm việc sớm nhất từ năm 15 tuổi.
        if (request.getExperienceYears() > (age - 15)) {
            throw new RuntimeException("Số năm kinh nghiệm không hợp lệ so với tuổi của bạn");
        }

        // Lấy hoặc tạo mới draft
        RegistrationDraft draft = registrationCacheService.getDraft(email);
        if (draft == null) {
            draft = new RegistrationDraft();
        }

        // Update draft với Stage 1 data
        draft.setDateOfBirth(request.getDateOfBirth());
        draft.setHometownProvinceId(request.getHometownProvinceId());
        draft.setCurrentCityId(request.getCurrentCityId());
        draft.setCurrentAddress(request.getCurrentAddress());
        draft.setWorkingDistrictIds(request.getWorkingDistrictIds());
        draft.setBio(request.getBio());
        draft.setExperienceYears(request.getExperienceYears());
        draft.setServiceIds(request.getServiceIds());

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

        // 1. Điền thông tin Profile từ draft
        profile.setDateOfBirth(draft.getDateOfBirth());
        profile.setBio(draft.getBio());
        profile.setExperienceYears(draft.getExperienceYears());
        profile.setAddressDetail(draft.getCurrentAddress());
        profile.setIdentityNumber(draft.getIdentityNumber());
        profile.setIdentityFrontUrl(draft.getCccdFrontUrl());
        profile.setIdentityBackUrl(draft.getCccdBackUrl());
        profile.setSelfieUrl(draft.getSelfieUrl());
        profile.setKycStatus(KycStatus.WAITING_APPROVAL);

        Location hometown = locationRepository.findById(draft.getHometownProvinceId())
                .orElseThrow(() -> new RuntimeException("Quê quán không hợp lệ"));
        profile.setHometown(hometown);

        Location currentCity = locationRepository.findById(draft.getCurrentCityId())
                .orElseThrow(() -> new RuntimeException("Thành phố hiện tại không hợp lệ"));
        profile.setCurrentCity(currentCity);

        // 2. Lưu Working Districts
        helperWorkingDistrictRepository.deleteByHelper_Id(user.getId());
        helperWorkingDistrictRepository.flush();
        for (Integer districtId : new java.util.HashSet<>(draft.getWorkingDistrictIds())) {
            Location district = locationRepository.findById(districtId)
                    .orElseThrow(() -> new RuntimeException("Quận/Huyện không hợp lệ: " + districtId));
            helperWorkingDistrictRepository.save(HelperWorkingDistrict.builder()
                    .helper(user)
                    .location(district)
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

        // 4. Update User status & Avatar
        user.setStatus(UserStatus.PENDING_REVIEW);
        user.setAvatarUrl(draft.getSelfieUrl());

        helperProfileRepository.save(profile);
        userRepository.save(user);

        // 5. Xóa Cache
        registrationCacheService.removeDraft(email);

        log.info("Registration successfully persisted for helper: {}", email);
    }

}
