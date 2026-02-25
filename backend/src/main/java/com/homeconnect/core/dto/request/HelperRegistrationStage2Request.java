package com.homeconnect.core.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Yêu cầu Giai đoạn 2: Xác minh danh tính (CCCD)")
public class HelperRegistrationStage2Request {

    @NotBlank(message = "Số CCCD xác thực không được để trống")
    @Schema(description = "Nhập lại số CCCD/CMND để xác thực (phải khớp với Giai đoạn 1)", example = "037123456789")
    private String identityNumber;

    @NotBlank(message = "Ảnh mặt trước không được để trống")
    @Schema(description = "URL ảnh mặt trước CCCD", example = "https://storage.com/front.jpg")
    private String cccdFrontUrl;

    @NotBlank(message = "Ảnh mặt sau không được để trống")
    @Schema(description = "URL ảnh mặt sau CCCD", example = "https://storage.com/back.jpg")
    private String cccdBackUrl;

    @NotBlank(message = "Ảnh selfie không được để trống")
    @Schema(description = "URL ảnh chân dung", example = "https://storage.com/selfie.jpg")
    private String selfieUrl;
}
