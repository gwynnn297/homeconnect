package com.homeconnect.core.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * Response DTO cho thông tin ví
 * Trả về cho API GET /api/v1/wallets/me
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WalletInfoResponse {
    private Integer walletId;
    private Long userId;
    private BigDecimal availableBalance; // Số dư khả dụng
    private BigDecimal holdBalance; // Số tiền đang giữ
    private BigDecimal debtBalance; // Số tiền nợ
    private Boolean isFrozen; // Ví có bị đóng băng không
    private BigDecimal totalEarnings; // Tổng thu nhập (chỉ có ý nghĩa với Helper, mặc định null/0 với Customer)
}
