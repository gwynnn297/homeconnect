package com.homeconnect.core.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class VerifyOtpRequest {
    @NotBlank(message = "Email không được để trống")
    @Email(message = "Định dạng email không hợp lệ")
    @Size(max = 100, message = "Email không được quá 100 ký tự")
    private String email;
    
    @NotBlank(message = "Mã OTP không được để trống")
    @Pattern(
        regexp = "^[0-9]{6}$",
        message = "Mã OTP phải là 6 chữ số"
    )
    private String otp;
}
