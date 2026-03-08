package com.homeconnect.core.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response cho API cập nhật KYC và Đăng ký
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateKycResponse {
    private boolean success;
    private String message;
}
