package com.homeconnect.core.repository;

import com.homeconnect.core.entity.HelperService;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;

@Repository
public interface HelperServiceRepository extends JpaRepository<HelperService, Integer> {
    @Modifying
    void deleteByHelper_Id(Long helperId);
}
