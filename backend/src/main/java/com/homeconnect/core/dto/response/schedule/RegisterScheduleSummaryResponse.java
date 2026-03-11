package com.homeconnect.core.dto.response.schedule;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@io.swagger.v3.oas.annotations.media.Schema(description = "Thông tin tóm tắt kết quả đăng ký lịch")
public class RegisterScheduleSummaryResponse {
    @io.swagger.v3.oas.annotations.media.Schema(description = "Tổng số khung giờ được tạo thành công")
    private int created;      // Số slot đã tạo thành công
    
    @io.swagger.v3.oas.annotations.media.Schema(description = "Số khung giờ bị bỏ qua do trùng lịch BUSY")
    private int skippedBusy;  // Số slot bị bỏ qua do đã có đơn hàng (BUSY)
    
    @io.swagger.v3.oas.annotations.media.Schema(description = "Thông báo chi tiết")
    private String message;
}
