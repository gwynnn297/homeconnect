package com.homeconnect.core.repository;

import com.homeconnect.core.entity.JobPostEditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JobPostEditLogRepository extends JpaRepository<JobPostEditLog, Long> {
    Page<JobPostEditLog> findByPostId(Long postId, Pageable pageable);
}
