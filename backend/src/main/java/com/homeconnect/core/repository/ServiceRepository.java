package com.homeconnect.core.repository;

import com.homeconnect.core.entity.Service;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ServiceRepository extends JpaRepository<Service, Integer> {
    List<Service> findByIsActiveTrue();

    List<Service> findByCategoryCategoryIdAndIsActiveTrue(Integer categoryId);

    boolean existsByName(String name);
    
}
