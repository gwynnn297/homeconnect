package com.homeconnect.core.repository;

import com.homeconnect.core.entity.HelperService;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface HelperServiceRepository extends JpaRepository<HelperService, Integer> {
    @Modifying
    void deleteByHelper_Id(Long helperId);

    // Admin: lấy danh sách service của helper
    List<HelperService> findByHelper_Id(Long helperId);

    // Admin: đếm số lượng service của helper
    long countByHelper_Id(Long helperId);
}
