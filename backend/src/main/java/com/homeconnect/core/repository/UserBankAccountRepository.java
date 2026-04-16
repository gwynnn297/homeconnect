package com.homeconnect.core.repository;

import com.homeconnect.core.entity.UserBankAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface UserBankAccountRepository extends JpaRepository<UserBankAccount, Integer> {
    List<UserBankAccount> findByUserId(Long userId);

    Optional<UserBankAccount> findByUserIdAndIsDefaultTrue(Long userId);

    @Modifying
    @Query("UPDATE UserBankAccount b SET b.isDefault = false WHERE b.user.id = :userId")
    void resetDefaultByUserId(@Param("userId") Long userId);
}
