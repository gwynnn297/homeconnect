package com.homeconnect.core.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Entity Address - Bảng addresses (PB-20)
 * Quản lý các địa chỉ của người dùng (Nhà riêng, Công ty, vv)
 */
@Entity
@Table(name = "addresses")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Address {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "address_id")
    private Integer addressId;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "address_detail", columnDefinition = "TEXT")
    private String addressDetail;

    @Column(name = "ward_name")
    private String wardName;

    @Column(name = "district_name")
    private String districtName;

    @Column(name = "province_name")
    private String provinceName;

    @Column(name = "province_code", length = 10)
    private String provinceCode;

    @Column(name = "district_code", length = 10)
    private String districtCode;

    @Column(name = "ward_code", length = 10)
    private String wardCode;

    @Column(name = "latitude", precision = 10, scale = 7, nullable = false)
    private BigDecimal latitude;

    @Column(name = "longitude", precision = 10, scale = 7, nullable = false)
    private BigDecimal longitude;
 
    @Builder.Default
    private Boolean isDefault = false;

    @Column(name = "type", length = 20)
    @Builder.Default
    private String type = "HOME"; // HOME, OFFICE, OTHER

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
