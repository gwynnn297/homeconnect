package com.homeconnect.core.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * Entity HelperService - Bảng helper_services
 * Dịch vụ mà Helper đăng ký làm (1 Helper có thể làm nhiều dịch vụ)
 */
@Entity
@Table(name = "helper_services",
    uniqueConstraints = {
        @UniqueConstraint(name = "unique_helper_service", columnNames = {"helper_id", "service_id"})
    },
    indexes = {
        @Index(name = "idx_helper_id", columnList = "helper_id"),
        @Index(name = "idx_service_id", columnList = "service_id"),
        @Index(name = "idx_is_active", columnList = "is_active")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HelperService {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;
    
    @ManyToOne
    @JoinColumn(name = "helper_id", nullable = false)
    private User helper;  // Helper (User có role = HELPER)
    
    @ManyToOne
    @JoinColumn(name = "service_id", nullable = false)
    private Service service;  // Dịch vụ đăng ký
    
    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;  // Helper còn nhận dịch vụ này không
}
