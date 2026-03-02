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
    private final AddressRepository addressRepository;

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

        // Kiểm tra tính hợp lệ của Quê quán
        Location hometown = locationRepository.findById(request.getHometownId())
                .orElseThrow(() -> new RuntimeException("Mã tỉnh thành quê quán không hợp lệ"));
        if (hometown.getType() != com.homeconnect.core.enums.LocationType.PROVINCE) {
            throw new RuntimeException("Quê quán phải là Tỉnh/Thành phố");
        }

        // Kiểm tra tính hợp lệ của Tỉnh/Thành phố hiện tại
        Location province = locationRepository.findById(request.getProvinceId())
                .orElseThrow(() -> new RuntimeException("Tỉnh/Thành phố hiện tại không hợp lệ"));
        if (province.getType() != com.homeconnect.core.enums.LocationType.PROVINCE) {
            throw new RuntimeException("ID Tỉnh/Thành phố hiện tại không đúng loại");
        }

        // Kiểm tra Quận/Huyện hiện tại
        Location district = locationRepository.findById(request.getDistrictId())
                .orElseThrow(() -> new RuntimeException("Quận/Huyện hiện tại không hợp lệ"));
        if (district.getParent() == null || !district.getParent().getLocationId().equals(province.getLocationId())) {
            throw new RuntimeException("Quận/Huyện chọn không thuộc Tỉnh/Thành phố đã chọn");
        }
        if (district.getType() != com.homeconnect.core.enums.LocationType.DISTRICT) {
            throw new RuntimeException("ID Quận/Huyện hiện tại không đúng loại");
        }

        // Kiểm tra Phường/Xã hiện tại
        Location ward = locationRepository.findById(request.getWardId())
                .orElseThrow(() -> new RuntimeException(" Phường/Xã hiện tại không hợp lệ"));
        if (ward.getParent() == null || !ward.getParent().getLocationId().equals(district.getLocationId())) {
            throw new RuntimeException("Phường/Xã chọn không thuộc Quận/Huyện đã chọn");
        }

        // Kiểm tra danh sách Quận làm việc (Phải thuộc cùng Tỉnh với địa chỉ hiện tại)
        for (Integer dId : request.getWorkingDistrictIds()) {
            Location workingDistrict = locationRepository.findById(dId)
                    .orElseThrow(() -> new RuntimeException("Quận/Huyện làm việc không hợp lệ: " + dId));
            if (workingDistrict.getParent() == null || !workingDistrict.getParent().getLocationId().equals(province.getLocationId())) {
                throw new RuntimeException("Quận làm việc " + workingDistrict.getName() + " không thuộc Tỉnh/Thành phố hiện tại");
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
        draft.setHometownId(request.getHometownId());
        draft.setProvinceId(request.getProvinceId());
        draft.setDistrictId(request.getDistrictId());
        draft.setWardId(request.getWardId());
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

        Location hometown = locationRepository.findById(draft.getHometownId())
                .orElseThrow(() -> new RuntimeException("Quê quán không hợp lệ"));
        profile.setHometown(hometown);

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

        // 4. Update User status, Avatar & Date of Birth
        user.setStatus(UserStatus.PENDING_REVIEW);
        user.setAvatarUrl(draft.getSelfieUrl());
        user.setDateOfBirth(draft.getDateOfBirth());

        // 5. Save Default Address
        Location province = locationRepository.findById(draft.getProvinceId())
                .orElseThrow(() -> new RuntimeException("Tỉnh/Thành phố hiện tại không hợp lệ"));
        
        Location district = null;
        if (draft.getDistrictId() != null) {
            district = locationRepository.findById(draft.getDistrictId())
                    .orElseThrow(() -> new RuntimeException("Quận/Huyện hiện tại không hợp lệ"));
        }

        Location ward = null;
        if (draft.getWardId() != null) {
            ward = locationRepository.findById(draft.getWardId())
                    .orElseThrow(() -> new RuntimeException("Phường/Xã không hợp lệ"));
        }
        
        Address address = addressRepository.findByUser_IdAndIsDefaultTrue(user.getId())
                .orElse(Address.builder()
                        .user(user)
                        .isDefault(true)
                        .type("HOME")
                        .build());
        
        address.setAddressDetail(draft.getCurrentAddress());
        address.setProvince(province);
        address.setDistrict(district);
        address.setWard(ward);
        addressRepository.save(address);

        helperProfileRepository.save(profile);
        userRepository.save(user);

        // 5. Xóa Cache
        registrationCacheService.removeDraft(email);

        log.info("Registration successfully persisted for helper: {}", email);
    }

}
