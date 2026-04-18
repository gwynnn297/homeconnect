package com.homeconnect.core.dto.request.admin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Admin chỉ được đặt ACTIVE (mở khóa) hoặc BLOCKED (khóa).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AdminUpdateUserStatusRequest {

    @NotBlank(message = "Trạng thái không được để trống")
    @Pattern(regexp = "^(ACTIVE|BLOCKED)$", message = "Chỉ hỗ trợ ACTIVE hoặc BLOCKED")
    private String status;

    /** Ghi chú khi khóa (khuyến nghị, không bắt buộc). */
    @Size(max = 500)
    private String reason;
}
