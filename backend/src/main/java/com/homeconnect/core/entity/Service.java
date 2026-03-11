package com.homeconnect.core.entity;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import com.homeconnect.core.enums.ServiceUnit;

import java.time.LocalDateTime;

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
    
    @Column(name = "name", nullable = false, unique = true, length = 100)
    private String name;  // Tên dịch vụ (VD: Dọn nhà theo giờ)


    @Column(name = "description", columnDefinition = "TEXT")
    private String description;
    
    @Column(name = "base_price", precision = 15, scale = 2)
    private BigDecimal basePrice;  // Giá cơ bản (VNĐ)

    @Enumerated(EnumType.STRING)
    @Column(name = "unit", length = 20)
    private ServiceUnit unit; // Đơn vị tính: PER_HOUR, PER_M2...

    @Builder.Default
    @Column(name = "is_active")
    private Boolean isActive = true;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
