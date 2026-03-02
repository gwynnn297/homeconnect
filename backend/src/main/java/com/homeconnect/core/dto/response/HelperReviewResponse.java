package com.homeconnect.core.dto.response;

import com.homeconnect.core.enums.KycStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * DTO Response cho Admin Review Helper KYC
 * Trả về thông tin sau khi review thành công
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HelperReviewResponse {
    
    private Integer helperId;               // ID của Helper (userid)
    private String helperName;             // Tên Helper
    private String helperEmail;            // Email Helper  
    private KycStatus kycStatus;           // Trạng thái KYC mới
    private String rejectionReason;        // Lý do từ chối (nếu có)
    private LocalDateTime reviewedAt;      // Thời gian review
    private String reviewedBy;             // Admin thực hiện review
    
    private String message;                // Thông báo kết quả
}