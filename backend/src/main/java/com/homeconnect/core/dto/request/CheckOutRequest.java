package com.homeconnect.core.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Schema(description = "Yêu cầu Check-out: Helper gửi ảnh hoàn thành công việc")
public class CheckOutRequest {

    @NotBlank(message = "Ảnh hoàn thành không được để trống")
    @Size(max = 500, message = "URL ảnh hoàn thành không được vượt quá 500 ký tự")
    @Pattern(regexp = "^https?://.+$", message = "URL ảnh hoàn thành phải bắt đầu bằng http:// hoặc https://")
    @Schema(
        description = "URL ảnh sau khi hoàn thành (Upload lên Firebase/Cloud trước, rồi gửi URL vào đây)",
        example = "https://firebasestorage.googleapis.com/v0/b/homeconnect.../after_clean.jpg"
    )
    private String checkoutPhotoUrl;

    @Size(max = 500, message = "Lý do hoàn thành không được vượt quá 500 ký tự")
    @Schema(description = "Lý do hoàn thành (Bắt buộc chọn nếu làm < 80% thời gian: Làm xong sớm, Khách cho về sớm...)", example = "Làm xong sớm")
    private String checkoutReason;

    @NotNull(message = "Latitude không được để trống")
    @Schema(description = "Vĩ độ GPS hiện tại của helper khi check-out", example = "10.762622")
    private BigDecimal latitude;

    @NotNull(message = "Longitude không được để trống")
    @Schema(description = "Kinh độ GPS hiện tại của helper khi check-out", example = "106.660172")
    private BigDecimal longitude;
}
