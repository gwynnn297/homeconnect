package com.homeconnect.core.dto.response;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class WithdrawRequestListResponse {
    private List<WithdrawRequestResponse> withdrawals;
    private long totalElements;
    private int totalPages;
}
