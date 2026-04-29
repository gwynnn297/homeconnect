package com.homeconnect.core.dto.request.admin;

import com.homeconnect.core.enums.DisputeResolutionAction;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminResolveDisputeRequest {

    @NotNull(message = "Action không được để trống")
    private DisputeResolutionAction action;

    @DecimalMin(value = "0.0", inclusive = false, message = "Refund ratio phải > 0")
    @DecimalMax(value = "1.0", inclusive = true, message = "Refund ratio phải <= 1")
    private BigDecimal refundRatio;

    @Size(max = 2000, message = "Ghi chú xử lý tối đa 2000 ký tự")
    private String adminNote;
}
