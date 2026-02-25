package com.homeconnect.core.repository;

import com.homeconnect.core.entity.HelperWorkingDistrict;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;

@Repository
public interface HelperWorkingDistrictRepository extends JpaRepository<HelperWorkingDistrict, Integer> {
    @Modifying
    void deleteByHelper_Id(Long helperId);
}
