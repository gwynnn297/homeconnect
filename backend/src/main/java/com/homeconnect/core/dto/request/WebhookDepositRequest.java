package com.homeconnect.core.dto.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request DTO từ Webhook (PayOS/Casso)
 * Cấu trúc này sẽ cần điều chỉnh theo format thực tế của payment gateway
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WebhookDepositRequest {

    private String transactionId; // Mã giao dịch từ ngân hàng
    private Long amount; // Số tiền
    private String description; // Nội dung chuyển khoản (VD: "HOMIE123 NAP TIEN")
    private String status; // Trạng thái giao dịch (SUCCESS, FAILED, etc.)
    private String signature; // Chữ ký để validate (tùy payment gateway)
    private Long timestamp; // Timestamp của giao dịch

    // Có thể thêm các field khác tùy theo payment gateway thực tế
}
