package com.homeconnect.core.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * Entity JobPost - Bảng job_posts
 * Đại diện cho một tin đăng việc của khách hàng
 */
@Entity
@Table(name = "job_posts", indexes = {
        @Index(name = "idx_customer_id", columnList = "customer_id"),
        @Index(name = "idx_service_id", columnList = "service_id"),
        @Index(name = "idx_status", columnList = "status"),
        @Index(name = "idx_work_date", columnList = "work_date")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JobPost {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "post_id")
    private Long postId;

    @Column(name = "customer_id", nullable = false)
    private Long customerId;




    @Column(name = "title")
    private String title;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "address_detail", columnDefinition = "TEXT")
    private String addressDetail;

    @Column(name = "latitude", precision = 10, scale = 8)
    private BigDecimal latitude;

    @Column(name = "longitude", precision = 11, scale = 8)
    private BigDecimal longitude;

    @Column(name = "work_date", nullable = false)
    private LocalDate workDate;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "duration_hours", nullable = false)
    private Integer durationHours;

    @Column(name = "offer_price", precision = 12, scale = 2, nullable = false)
    private BigDecimal offerPrice;

    @Builder.Default
    @Column(name = "status", length = 20)
    private String status = "PUBLISHED"; // PUBLISHED, ASSIGNED, COMPLETED, CANCELLED, EXPIRED

    @Column(name = "service_id", length = 255)
    private String serviceId;



    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id", nullable = false)
    private ServiceCategory category;






    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", referencedColumnName = "id", insertable = false, updatable = false)
    private User customer;
}
