package com.homeconnect.core.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

/**
 * 📝 DTO cho bước 2: Xác thực OTP và hoàn tất đăng ký
 */
@Data
public class RegisterVerifyRequest {
    
    @NotBlank(message = "Email không được để trống")
    @Email(message = "Định dạng email không hợp lệ")
    private String email;
    
    @NotBlank(message = "Mã OTP không được để trống")
    @Pattern(
        regexp = "^[0-9]{6}$",
        message = "Mã OTP phải là 6 chữ số"
    )
    private String otpCode;
}