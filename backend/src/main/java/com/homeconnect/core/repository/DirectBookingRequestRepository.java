package com.homeconnect.core.repository;

import com.homeconnect.core.entity.DirectBookingRequestEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface DirectBookingRequestRepository extends JpaRepository<DirectBookingRequestEntity, Long> {
}
