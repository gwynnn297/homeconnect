package com.homeconnect.core.repository;

import com.homeconnect.core.entity.HelperProfile;
import com.homeconnect.core.enums.KycStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
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

    /**
     * BE-Match-01: Query tìm helper phù hợp để match với job post
     * Lọc theo: Dịch vụ + Online + KYC đã xác thực
     */
    @Query(value = """
            SELECT DISTINCT hp.user_id
            FROM helper_profiles hp
            JOIN helper_services hs ON hp.user_id = hs.helper_id
            WHERE hs.category_id = :categoryId
              AND hs.is_active = true
              AND hp.is_online = true
              AND hp.kyc_status = 'VERIFIED'
            """, nativeQuery = true)
    List<Long> findEligibleHelperIds(@Param("categoryId") Integer categoryId);


    // BE-Match-01: Tìm helper phù hợp với check lịch rảnh
    // Lọc theo: Dịch vụ + Online + KYC verified + Có slot available
    // Parameters:
    // - serviceId: Dịch vụ yêu cầu
    // - workDate: Ngày làm việc
    // - startTime: Thời gian bắt đầu (HH:mm:ss)
    // - durationSecs: Thời lượng tính bằng giây
    // Returns: Danh sách helper user ID có lịch rảnh phù hợp
    @Query(value = """
            SELECT hp.user_id
            FROM helper_profiles hp
            JOIN helper_services hs ON hp.user_id = hs.helper_id
            JOIN helper_schedules hs_sched ON hp.user_id = hs_sched.helper_id
            WHERE hs.category_id = :categoryId
              AND hs.is_active = true
              AND hp.is_online = true
              AND hp.kyc_status = 'VERIFIED'
              AND hs_sched.work_date = :workDate
              AND hs_sched.status = 'AVAILABLE'
              AND hs_sched.start_time <= :startTime
              AND ADDTIME(hs_sched.start_time, SEC_TO_TIME(:durationSecs)) <= hs_sched.end_time
            """, nativeQuery = true)
    List<Long> findEligibleHelperIdsWithSchedule(
            @Param("categoryId") Integer categoryId,
            @Param("workDate") java.time.LocalDate workDate,
            @Param("startTime") java.time.LocalTime startTime,
            @Param("durationSecs") long durationSecs
    );


    // Dùng cho matching: lấy nhanh hồ sơ helper để filter/ranking ở service layer
    List<HelperProfile> findByUser_IdIn(List<Long> userIds);
}
