package com.homeconnect.core.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response DTO cho URL VietQR
 * Trả về URL ảnh QR code để Frontend hiển thị
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VietQRResponse {
    private String qrCodeUrl;
    private String bankCode;
    private String accountNumber;
    private Long amount;
    private String transferContent; // Nội dung chuyển khoản (VD: HOMIE123)
}
