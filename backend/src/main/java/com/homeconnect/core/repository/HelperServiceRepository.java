package com.homeconnect.core.repository;

import com.homeconnect.core.entity.HelperService;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;

@Repository
public interface HelperServiceRepository extends JpaRepository<HelperService, Integer> {
    @Modifying(clearAutomatically = true)
    @org.springframework.data.jpa.repository.Query("DELETE FROM HelperService hs WHERE hs.helper.id = :helperId")
    void deleteByHelper_Id(Long helperId);

    java.util.List<HelperService> findByHelper_Id(Long helperId);
}
