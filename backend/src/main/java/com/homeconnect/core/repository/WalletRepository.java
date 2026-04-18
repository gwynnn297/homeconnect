package com.homeconnect.core.repository;

import com.homeconnect.core.entity.Wallet;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.Optional;

@Repository
public interface WalletRepository extends JpaRepository<Wallet, Integer> {

    Optional<Wallet> findByUserId(Long userId);

    /**
     * Tìm ví và lock row để tránh race condition khi hold/release money
     * Sử dụng Pessimistic Write Lock (SELECT ... FOR UPDATE)
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT w FROM Wallet w WHERE w.user.id = :userId")
    Optional<Wallet> findByUserIdWithLock(@Param("userId") Long userId);

    @Query("SELECT COALESCE(SUM(w.availableBalance), 0) FROM Wallet w")
    BigDecimal sumAvailableBalance();

    @Query("SELECT COALESCE(SUM(w.holdBalance), 0) FROM Wallet w")
    BigDecimal sumHoldBalance();

    @Query("SELECT COALESCE(SUM(w.debtBalance), 0) FROM Wallet w")
    BigDecimal sumDebtBalance();
}