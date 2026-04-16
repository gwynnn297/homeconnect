package com.homeconnect.core.repository;

import com.homeconnect.core.entity.WithdrawAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface WithdrawAuditLogRepository extends JpaRepository<WithdrawAuditLog, Integer> {
    List<WithdrawAuditLog> findByRequestIdOrderByCreatedAtDesc(Integer requestId);
}
