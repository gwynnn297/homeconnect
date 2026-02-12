package com.homeconnect.core.repository;

import com.homeconnect.core.entity.HelperProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface HelperProfileRepository extends JpaRepository<HelperProfile, Integer> {
    Optional<HelperProfile> findByUserId(Long userId);
}