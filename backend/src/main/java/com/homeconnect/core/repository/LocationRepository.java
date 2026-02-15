package com.homeconnect.core.repository;

import com.homeconnect.core.entity.Location;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Repository for Location entity
 */
@Repository
public interface LocationRepository extends JpaRepository<Location, Integer> {
}
