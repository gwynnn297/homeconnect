package com.homeconnect.core.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BookingReportRequest {

    @NotBlank(message = "Lý do khiếu nại không được để trống")
    @Size(min = 10, max = 2000, message = "Lý do khiếu nại từ 10 đến 2000 ký tự")
    private String reason;

    @NotBlank(message = "Ảnh minh chứng bắt buộc")
    @Size(max = 1000, message = "URL minh chứng tối đa 1000 ký tự")
    private String evidenceUrl;
}
