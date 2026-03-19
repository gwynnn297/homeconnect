package com.homeconnect.core.repository;

import com.homeconnect.core.entity.Address;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AddressRepository extends JpaRepository<Address, Integer> {
    List<Address> findByUser_Id(Long userId);

    Optional<Address> findByUser_IdAndIsDefaultTrue(Long userId);

    List<Address> findByUser_IdAndIsDefaultTrueOrderByAddressIdAsc(Long userId);

    // Batch fetch default addresses cho nhiều users
    @Query("SELECT a FROM Address a WHERE a.user.id IN :userIds AND a.isDefault = true")
    List<Address> findDefaultAddressesByUserIds(@Param("userIds") List<Long> userIds);
}
