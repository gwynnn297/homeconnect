
package com.homeconnect.core.repository;

import com.homeconnect.core.entity.ServiceCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ServiceCategoryRepository extends JpaRepository<ServiceCategory, Integer> {
    List<ServiceCategory> findByIsActiveTrue();
    boolean existsByName(String name);
}