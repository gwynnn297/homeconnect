package com.homeconnect.core.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class BankBindingRequest {
    @NotBlank(message = "Tên ngân hàng không được để trống")
    private String bankName;

    @NotBlank(message = "Mã ngân hàng không được để trống")
    private String bankCode;

    @NotBlank(message = "Số tài khoản không được để trống")
    private String accountNumber;

    @NotBlank(message = "Tên chủ tài khoản không được để trống")
    private String accountHolderName;

    private String qrCodeUrl;
}
