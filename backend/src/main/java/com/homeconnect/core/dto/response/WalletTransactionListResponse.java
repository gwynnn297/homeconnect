package com.homeconnect.core.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Response DTO cho danh sách giao dịch ví (với phân trang)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WalletTransactionListResponse {
    private List<WalletTransactionResponse> transactions;
    private Integer currentPage;
    private Integer totalPages;
    private Long totalElements;
}
