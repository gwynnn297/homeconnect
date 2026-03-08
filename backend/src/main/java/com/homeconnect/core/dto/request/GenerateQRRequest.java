package com.homeconnect.core.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request DTO để sinh mã VietQR
 * Frontend gửi số tiền muốn nạp
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GenerateQRRequest {

    @NotNull(message = "Số tiền nạp không được để trống")
    @Min(value = 10000, message = "Số tiền nạp tối thiểu là 10,000 VNĐ")
    private Long amount; // Số tiền muốn nạp (VNĐ)
}
