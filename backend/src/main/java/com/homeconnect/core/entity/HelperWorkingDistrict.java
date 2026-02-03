package com.homeconnect.core.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * Entity HelperWorkingDistrict - Bảng helper_working_districts
 * Khu vực làm việc của Helper (1 Helper có thể chọn nhiều Quận)
 */
@Entity
@Table(name = "helper_working_districts", 
    uniqueConstraints = {
        @UniqueConstraint(name = "unique_helper_location", columnNames = {"helper_id", "location_id"})
    },
    indexes = {
        @Index(name = "idx_helper_id", columnList = "helper_id"),
        @Index(name = "idx_location_id", columnList = "location_id")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HelperWorkingDistrict {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;
    
    @ManyToOne
    @JoinColumn(name = "helper_id", nullable = false)
    private User helper;  // Helper (User có role = HELPER)
    
    @ManyToOne
    @JoinColumn(name = "location_id", nullable = false)
    private Location location;  // Khu vực làm việc (Quận/Huyện)
}
