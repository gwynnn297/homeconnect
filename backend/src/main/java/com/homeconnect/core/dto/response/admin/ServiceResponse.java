package com.homeconnect.core.dto.response.admin;

import com.homeconnect.core.enums.ServiceUnit;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Response DTO để trả về thông tin dịch vụ sau khi tạo
 * Tránh trả trực tiếp Entity để bảo mật và tối ưu hiệu năng (Lazy Loading).
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ServiceResponse {
    private Integer serviceId;
    private String name;
    private String description;
    private String iconUrl;
    private BigDecimal basePrice;
    private ServiceUnit unit;
    private String categoryName;
    private Boolean isActive;
    private LocalDateTime createdAt;
}
