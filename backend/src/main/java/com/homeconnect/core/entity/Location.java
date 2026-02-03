package com.homeconnect.core.entity;

import com.homeconnect.core.enums.LocationType;
import jakarta.persistence.*;
import lombok.*;

/**
 * Entity Location - Bảng locations
 * Lưu trữ địa điểm (Tỉnh/Thành, Quận/Huyện)
 */
@Entity
@Table(name = "locations", indexes = {
    @Index(name = "idx_parent_id", columnList = "parent_id"),
    @Index(name = "idx_type", columnList = "type")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Location {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "location_id")
    private Integer locationId;
    
    @Column(name = "name", nullable = false, length = 100)
    private String name;  // Tên địa điểm (VD: Hà Nội, Quận 1)
    
    @ManyToOne
    @JoinColumn(name = "parent_id")
    private Location parent;  // Địa điểm cha (NULL nếu là Tỉnh)
    
    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 20)
    private LocationType type;  // Loại: PROVINCE hoặc DISTRICT
}
