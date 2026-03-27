package com.homeconnect.core.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Getter
@Builder
public class JobApplicationStatusResponse {
    // --- Thông tin ứng tuyển cơ bản ---
    private Long applicationId;
    private String type;   // APPLIED, INVITED
    private String status; // PENDING, ACCEPTED, REJECTED, CANCELLED, EXPIRED
    private LocalDateTime createdAt;
    private boolean exists; // true nếu thợ đã có tương tác với bài này

    // --- Thông tin bài đăng (luôn trả về khi exists=true) ---
    private Long postId;
    private String jobTitle;
    private String jobDescription;
    private LocalDate workDate;
    private LocalTime startTime;
    private Integer durationHours;
    private BigDecimal offerPrice;
    private String categoryName;
    private String jobStatus;

    // --- Địa chỉ chi tiết khách hàng (CHỈ trả về khi status = ACCEPTED) ---
    private String addressDetail;   // Số nhà, tên đường
    private String wardName;        // Phường/Xã
    private String districtName;    // Quận/Huyện
    private String provinceName;    // Tỉnh/Thành phố
    private BigDecimal latitude;
    private BigDecimal longitude;
    private String fullAddress;     // Địa chỉ đầy đủ đã ghép
}
