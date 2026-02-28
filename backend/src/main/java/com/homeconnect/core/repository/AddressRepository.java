package com.homeconnect.core.repository;

import com.homeconnect.core.entity.Address;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AddressRepository extends JpaRepository<Address, Integer> {
    List<Address> findByUser_Id(Long userId);
    
    Optional<Address> findByUser_IdAndIsDefaultTrue(Long userId);
}
