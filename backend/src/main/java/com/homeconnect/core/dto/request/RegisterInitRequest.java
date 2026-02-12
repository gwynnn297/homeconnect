package com.homeconnect.core.dto.request;

import com.homeconnect.core.enums.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 📝 DTO cho bước 1: Đăng ký tài khoản (Gửi OTP)
 */
@Data
public class RegisterInitRequest {
    
    @NotBlank(message = "Họ tên không được để trống")
    @Size(max = 100, message = "Họ tên không được quá 100 ký tự")
    private String fullName;
    
    @NotBlank(message = "Số điện thoại không được để trống")
    @Pattern(
        regexp = "^(0[3|5|7|8|9])+([0-9]{8})$", 
        message = "Số điện thoại phải là số Việt Nam hợp lệ (10 chữ số, bắt đầu từ 03,05,07,08,09)"
    )
    private String phone;
    
    @NotBlank(message = "Email không được để trống")
    @Email(message = "Định dạng email không hợp lệ")
    @Size(max = 100, message = "Email không được quá 100 ký tự")
    private String email;
    
    @NotBlank(message = "Mật khẩu không được để trống")
    @Size(min = 8, max = 50, message = "Mật khẩu phải từ 8-50 ký tự")
    @Pattern(
        regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).+$",
        message = "Mật khẩu phải có ít nhất 1 chữ thường, 1 chữ hoa và 1 số"
    )
    private String password;
    
    @NotNull(message = "Vai trò không được để trống")
    private UserRole role;
}