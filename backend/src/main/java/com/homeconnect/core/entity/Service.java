package com.homeconnect.core.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

/**
 * Entity Service - Bảng services
 * Danh mục dịch vụ hệ thống cung cấp
 */
@Entity
@Table(name = "services", indexes = {
    @Index(name = "idx_is_active", columnList = "is_active")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Service {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "service_id")
    private Integer serviceId;
    
    @Column(name = "name", nullable = false, length = 100)
    private String name;  // Tên dịch vụ (VD: Dọn dẹp nhà, Chăm sóc trẻ em)
    
    @Column(name = "icon_url", columnDefinition = "TEXT")
    private String iconUrl;  // Đường dẫn icon dịch vụ
    
    @Column(name = "base_price", precision = 15, scale = 2)
    private BigDecimal basePrice;  // Giá cơ bản (VNĐ)
    
    @Column(name = "is_active")
    private Boolean isActive = true;  // Dịch vụ còn hoạt động không
}
