package com.homeconnect.core.repository;

import com.homeconnect.core.entity.JobPost;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Collection;

@Repository
public interface JobPostRepository extends JpaRepository<JobPost, Long>, JpaSpecificationExecutor<JobPost> {

    long countByCustomerId(Long customerId);
    long countByCustomerIdAndCreatedAtBetween(Long customerId, LocalDateTime from, LocalDateTime to);

    List<JobPost> findByCustomerIdOrderByCreatedAtDesc(Long customerId);
    List<JobPost> findByCustomerIdAndStatusInOrderByCreatedAtDesc(Long customerId, Collection<String> statuses);

    @Query("SELECT jp FROM JobPost jp WHERE jp.status = 'PUBLISHED' " +
           "AND (jp.workDate > :today OR (jp.workDate = :today AND jp.startTime > :nowTime)) " +
           "AND (jp.expiresAt IS NULL OR jp.expiresAt > :nowDateTime) ORDER BY jp.createdAt DESC")
    List<JobPost> findActiveJobPosts(@Param("today") java.time.LocalDate today, 
                                     @Param("nowTime") java.time.LocalTime nowTime,
                                     @Param("nowDateTime") java.time.LocalDateTime nowDateTime);

    /**
     * Tìm các bài đăng PUBLISHED đã hết hạn:
     * - workDate < today
     * - HOẶC workDate = today VÀ startTime <= currentTime
     * - HOẶC expiresAt <= nowDateTime
     */
    @Query("SELECT jp FROM JobPost jp WHERE jp.status = 'PUBLISHED' " +
           "AND (jp.workDate < :today " +
           "OR (jp.workDate = :today AND jp.startTime <= :currentTime) " +
           "OR (jp.expiresAt IS NOT NULL AND jp.expiresAt <= :nowDateTime))")
    List<JobPost> findExpiredJobPosts(@Param("today") LocalDate today, 
                                      @Param("currentTime") LocalTime currentTime,
                                      @Param("nowDateTime") LocalDateTime nowDateTime);
    List<JobPost> findByPostIdInOrderByCreatedAtDesc(Collection<Long> postIds);
    boolean existsByAddress_AddressId(Integer addressId);

    @Query("SELECT jp.status, COUNT(jp) FROM JobPost jp GROUP BY jp.status")
    List<Object[]> countGroupedByStatus();
}