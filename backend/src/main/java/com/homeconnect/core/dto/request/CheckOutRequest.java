package com.homeconnect.core.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
@Schema(description = "Yêu cầu Check-out: Helper gửi ảnh hoàn thành công việc")
public class CheckOutRequest {

    @NotBlank(message = "Ảnh hoàn thành không được để trống")
    @Schema(
        description = "URL ảnh sau khi hoàn thành (Upload lên Firebase/Cloud trước, rồi gửi URL vào đây)",
        example = "https://firebasestorage.googleapis.com/v0/b/homeconnect.../after_clean.jpg"
    )
    private String checkoutPhotoUrl;

    @Schema(description = "Lý do hoàn thành (Bắt buộc chọn nếu làm < 80% thời gian: Làm xong sớm, Khách cho về sớm...)", example = "Làm xong sớm")
    private String checkoutReason;
}
