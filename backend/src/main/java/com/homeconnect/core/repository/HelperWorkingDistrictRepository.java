package com.homeconnect.core.repository;

import com.homeconnect.core.entity.HelperWorkingDistrict;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface HelperWorkingDistrictRepository extends JpaRepository<HelperWorkingDistrict, Integer> {
    @Modifying
    void deleteByHelper_Id(Long helperId);

    // Admin: lấy danh sách working district của helper
    List<HelperWorkingDistrict> findByHelper_Id(Long helperId);

    // đếm số lượng working district của helper
    long countByHelper_Id(Long helperId);
}
