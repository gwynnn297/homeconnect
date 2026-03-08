package com.homeconnect.core.repository;

import com.homeconnect.core.entity.WalletTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface WalletTransactionRepository extends JpaRepository<WalletTransaction, Integer> {

    /**
     * Lấy lịch sử giao dịch của một ví (có phân trang)
     */
    Page<WalletTransaction> findByWallet_WalletIdOrderByCreatedAtDesc(Integer walletId, Pageable pageable);

    /**
     * Kiểm tra xem một giao dịch từ webhook đã tồn tại chưa (chống trùng lặp)
     * 
     * @param referenceId ID giao dịch từ ngân hàng/payment gateway
     */
    @Query("SELECT wt FROM WalletTransaction wt WHERE wt.referenceId = :referenceId AND wt.referenceType = 'WEBHOOK'")
    Optional<WalletTransaction> findByReferenceIdAndReferenceTypeWebhook(@Param("referenceId") Integer referenceId);
}
