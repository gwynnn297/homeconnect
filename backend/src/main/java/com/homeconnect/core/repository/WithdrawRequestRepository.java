package com.homeconnect.core.repository;

import com.homeconnect.core.entity.WithdrawRequest;
import com.homeconnect.core.enums.WithdrawStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface WithdrawRequestRepository extends JpaRepository<WithdrawRequest, Integer> {
    Optional<WithdrawRequest> findByExternalId(String externalId);
    Page<WithdrawRequest> findByStatus(WithdrawStatus status, Pageable pageable);
    
    // Tìm các yêu cầu rút tiền của một người dùng cụ thể
    Page<WithdrawRequest> findByWalletUserId(Long userId, Pageable pageable);

    java.util.List<WithdrawRequest> findByBankAccountRefBankAccountId(Integer bankAccountId);
}
