package com.homeconnect.core.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.math.BigDecimal;

@Data
public class WithdrawRequestDTO {
    @NotNull(message = "Số tiền rút không được để trống")
    @DecimalMin(value = "3000.0", message = "Số tiền rút tối thiểu là 3.000 VNĐ")
    private BigDecimal amount;

    private Integer bankAccountId;
}
