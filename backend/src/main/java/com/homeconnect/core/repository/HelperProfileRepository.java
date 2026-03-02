package com.homeconnect.core.repository;

import com.homeconnect.core.entity.HelperProfile;
import com.homeconnect.core.enums.KycStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface HelperProfileRepository extends JpaRepository<HelperProfile, Integer> {
    Optional<HelperProfile> findByUser_Id(Long userId);

    // admin: lấy KYC theo status với pagination
    @Query("SELECT hp FROM HelperProfile hp WHERE hp.kycStatus = :status")
    Page<HelperProfile> findByKycStatus(KycStatus status, Pageable pageable);

    // Admin: lấy tất cả helper với pagination
    Page<HelperProfile> findAll(Pageable pageable);

    // Admin: đếm số lượng helper theo KYC status
    long countByKycStatus(KycStatus status);

    // Kiểm tra tồn tại số CCCD
    boolean existsByIdentityNumber(String identityNumber);
}