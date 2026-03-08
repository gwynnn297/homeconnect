package com.homeconnect.core.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Response DTO cho một giao dịch ví
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WalletTransactionResponse {
    private Integer transactionId;
    private BigDecimal amount;
    private String type; // DEPOSIT, WITHDRAW, PAYMENT, REFUND, HOLD, RELEASE
    private String referenceType; // JOB_POST, BOOKING, DEPOSIT, WEBHOOK
    private Integer referenceId;
    private String description;
    private LocalDateTime createdAt;
}
