package com.homeconnect.core.dto.request;

import com.homeconnect.core.enums.UserRole;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RegisterRequest {
    @NotBlank(message = "Email Không được để trống")
    @Email(message = "Email không hợp lệ")
    private String email;
    @Size(min = 6, message = "Mật khẩu phải có ít nhất 6 ký tự")
    private String password;
    private String fullName;
    private String phone;
    private UserRole role;

}
