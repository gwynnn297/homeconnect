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
        @UniqueConstraint(name = "unique_helper_district", columnNames = {"helper_id", "district_code"})
    },
    indexes = {
        @Index(name = "idx_helper_id", columnList = "helper_id"),
        @Index(name = "idx_district_code", columnList = "district_code")
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
    
    @Column(name = "district_name", nullable = false)
    private String districtName; // Tên Quận/Huyện

    @Column(name = "district_code", nullable = false)
    private String districtCode; // Mã Quận/Huyện từ API
}
