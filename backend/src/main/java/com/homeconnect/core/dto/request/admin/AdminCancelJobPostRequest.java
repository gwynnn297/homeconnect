package com.homeconnect.core.dto.request.admin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AdminCancelJobPostRequest {

    @NotBlank(message = "Lý do hủy không được để trống")
    @Size(min = 5, max = 1000, message = "Lý do hủy từ 5 đến 1000 ký tự")
    private String reason;
}
