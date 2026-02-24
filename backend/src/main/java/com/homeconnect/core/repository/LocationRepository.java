package com.homeconnect.core.repository;

import com.homeconnect.core.entity.Location;
import com.homeconnect.core.enums.LocationType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository for Location entity
 */
@Repository
public interface LocationRepository extends JpaRepository<Location, Integer> {

    /**
     * Tìm danh sách địa điểm theo loại (PROVINCE hoặc DISTRICT)
     */
    List<Location> findByType(LocationType type);
}
