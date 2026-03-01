package com.homeconnect.core.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO Request cho Admin Review Helper KYC
 * Sử dụng cho API: PATCH /api/v1/admin/helpers/{id}/review
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HelperReviewRequest {
    
    @NotNull(message = "Action không được để trống")
    @Pattern(regexp = "^(VERIFIED|REJECTED)$", message = "Action chỉ được là VERIFIED hoặc REJECTED")
    private String action;  // VERIFIED hoặc REJECTED
    
    private String rejectionReason;  // Lý do từ chối (bắt buộc nếu action = REJECTED)
    
    /**
     * Validate logic: nếu action = REJECTED thì rejectionReason bắt buộc
     */
    public boolean isValid() {
        if ("REJECTED".equals(action)) {
            return rejectionReason != null && !rejectionReason.trim().isEmpty();
        }
        return true;
    }
}