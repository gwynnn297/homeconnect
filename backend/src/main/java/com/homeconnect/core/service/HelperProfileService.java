package com.homeconnect.core.service;

import com.homeconnect.core.dto.request.UpdateKycRequest;
import com.homeconnect.core.entity.HelperProfile;
import com.homeconnect.core.entity.Location;
import com.homeconnect.core.entity.User;
import com.homeconnect.core.enums.KycStatus;
import com.homeconnect.core.enums.UserRole;
import com.homeconnect.core.repository.HelperProfileRepository;
import com.homeconnect.core.repository.LocationRepository;
import com.homeconnect.core.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * 🔧 Service quản lý hồ sơ Helper
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class HelperProfileService {

    private final HelperProfileRepository helperProfileRepository;
    private final UserRepository userRepository;
    private final LocationRepository locationRepository;

    /**
     * Tạo hồ sơ Helper mới với KYC PENDING
     */
    public HelperProfile createHelperProfile(User user) {
        log.info(" Tạo HelperProfile cho User ID: {}", user.getId());
        
        HelperProfile helperProfile = HelperProfile.builder()
                .user(user)
                .bio("") // Sẽ cập nhật sau
                .experienceYears(null) // Sẽ cập nhật sau
                .kycStatus(KycStatus.PENDING) // Chờ KYC
                .build();
        
        return helperProfileRepository.save(helperProfile);
    }

    /**
     * 🛠 Cập nhật hồ sơ KYC (BE-05)
     */
    @Transactional
    public void updateKyc(String email, UpdateKycRequest request) {
        log.info("🛠 Cập nhật KYC cho User Email: {}", email);

        // 1. Tìm User
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người dùng"));

        // 2. Kiểm tra Role
        if (user.getRole() != UserRole.HELPER) {
            throw new RuntimeException("Chỉ Helper mới có thể cập nhật hồ sơ KYC");
        }

        // 3. Tìm HelperProfile (Nếu chưa có thì tạo mới luôn cho user này)
        HelperProfile profile = helperProfileRepository.findByUser_Id(user.getId())
                .orElseGet(() -> HelperProfile.builder()
                        .user(user)
                        .bio("")
                        .kycStatus(KycStatus.PENDING)
                        .build());

        // 4. Tìm quê quán (Location)
        Location hometown = locationRepository.findById(request.getHometown())
                .orElseThrow(() -> new RuntimeException("Quê quán không hợp lệ (ID không tồn tại)"));

        // 5. Cập nhật thông tin HelperProfile
        profile.setIdentityFrontUrl(request.getCccdFront());
        profile.setIdentityBackUrl(request.getCccdBack());
        profile.setSelfieUrl(request.getAvatar());
        profile.setAddressDetail(request.getAddress());
        profile.setHometown(hometown);
        profile.setKycStatus(KycStatus.WAITING_APPROVAL); // Chuyển trạng thái sang Chờ Duyệt

        // 6. Cập nhật Avatar cho User (Dùng chung với selfie cho KYC)
        user.setAvatarUrl(request.getAvatar());

        // 7. Lưu thay đổi
        helperProfileRepository.save(profile);
        userRepository.save(user);

        log.info(" Đã nộp hồ sơ KYC cho User Email: {}. Trạng thái hiện tại: WAITING_APPROVAL", email);
    }
}