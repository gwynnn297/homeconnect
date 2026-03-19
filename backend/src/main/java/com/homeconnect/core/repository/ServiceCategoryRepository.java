package com.homeconnect.core.repository;

import com.homeconnect.core.entity.ServiceCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ServiceCategoryRepository extends JpaRepository<ServiceCategory, Integer> {
    boolean existsByName(String name);
}
