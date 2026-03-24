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
        @UniqueConstraint(name = "unique_helper_category", columnNames = {"helper_id", "category_id"})
    },
    indexes = {
        @Index(name = "idx_helper_id", columnList = "helper_id"),
        @Index(name = "idx_category_id", columnList = "category_id"),
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
    @JoinColumn(name = "category_id", nullable = false)
    private ServiceCategory category;  // Danh mục dịch vụ đăng ký
    
    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;  // Helper còn nhận danh mục này không
}

