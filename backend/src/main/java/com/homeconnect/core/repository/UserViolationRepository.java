package com.homeconnect.core.repository;

import com.homeconnect.core.entity.UserViolation;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserViolationRepository extends JpaRepository<UserViolation, Long> {
    Page<UserViolation> findByViolationType(String violationType, Pageable pageable);
}
