package com.homeconnect.core.dto.response;

import com.homeconnect.core.enums.WithdrawStatus;
import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class WithdrawRequestResponse {
    private Integer requestId;
    private Long userId;
    private String userFullName;
    private BigDecimal amount;
    private String bankName;
    private String bankAccount;
    private String accountHolderName;
    private WithdrawStatus status;
    private String adminNote;
    private String failureReason;
    private String qrCode;
    private LocalDateTime createdAt;
}
