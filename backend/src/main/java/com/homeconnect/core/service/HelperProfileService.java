package com.homeconnect.core.service;

import com.homeconnect.core.entity.HelperProfile;
import com.homeconnect.core.entity.User;
import com.homeconnect.core.enums.KycStatus;
import com.homeconnect.core.repository.HelperProfileRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

/**
 * 🔧 Service quản lý hồ sơ Helper
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class HelperProfileService {

    private final HelperProfileRepository helperProfileRepository;

    /**
     * Tạo hồ sơ Helper mới với KYC PENDING
     */
    public HelperProfile createHelperProfile(User user) {
        log.info("🔧 Tạo HelperProfile cho User ID: {}", user.getId());
        
        HelperProfile helperProfile = HelperProfile.builder()
                .user(user)
                .bio("") // Sẽ cập nhật sau
                .experienceYears(null) // Sẽ cập nhật sau
                .kycStatus(KycStatus.PENDING) // Chờ KYC
                .build();
        
        return helperProfileRepository.save(helperProfile);
    }
}