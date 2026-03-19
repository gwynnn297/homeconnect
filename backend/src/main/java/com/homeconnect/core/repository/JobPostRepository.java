package com.homeconnect.core.repository;

import com.homeconnect.core.entity.JobPost;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface JobPostRepository extends JpaRepository<JobPost, Long> {

    List<JobPost> findByCustomerIdOrderByCreatedAtDesc(Long customerId);

    List<JobPost> findByStatusAndWorkDateBefore(String status, LocalDate expireDate);

    @Query("SELECT jp FROM JobPost jp WHERE jp.status = 'PUBLISHED' AND jp.workDate >= :today ORDER BY jp.createdAt DESC")
    List<JobPost> findActiveJobPosts(@Param("today") LocalDate today);
}