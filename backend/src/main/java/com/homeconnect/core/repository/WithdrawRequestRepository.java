package com.homeconnect.core.repository;

import com.homeconnect.core.entity.WithdrawRequest;
import com.homeconnect.core.enums.WithdrawStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface WithdrawRequestRepository extends JpaRepository<WithdrawRequest, Integer> {
    Optional<WithdrawRequest> findByExternalId(String externalId);
    Page<WithdrawRequest> findByStatus(WithdrawStatus status, Pageable pageable);
    
    // Tìm các yêu cầu rút tiền của một người dùng cụ thể
    Page<WithdrawRequest> findByWalletUserId(Long userId, Pageable pageable);

    java.util.List<WithdrawRequest> findByBankAccountRefBankAccountId(Integer bankAccountId);

    @Query("SELECT w.status, COUNT(w) FROM WithdrawRequest w GROUP BY w.status")
    List<Object[]> countGroupedByStatus();

    /**
     * Tìm các yêu cầu PROCESSING đã quá thời gian threshold (chưa được chuyển tiền).
     * Dùng JOIN FETCH để tránh LazyInitializationException trong scheduler.
     */
    @Query("SELECT w FROM WithdrawRequest w JOIN FETCH w.wallet wlt JOIN FETCH wlt.user WHERE w.status = 'PROCESSING' AND w.updatedAt < :threshold")
    List<WithdrawRequest> findStaleProcessingRequests(@Param("threshold") LocalDateTime threshold);
}
