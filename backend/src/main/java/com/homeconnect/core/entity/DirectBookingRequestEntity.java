package com.homeconnect.core.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * Bảng yêu cầu đặt thợ trực tiếp (direct_booking_requests).
 * Song song với job_posts, nhưng dành cho flow đặt trực tiếp (không đấu thầu).
 * Mỗi Booking đặt trực tiếp sẽ có FK trỏ về bảng này.
 */
@Entity
@Table(name = "direct_booking_requests",
    indexes = {
        @Index(name = "idx_dbr_customer", columnList = "customer_id"),
        @Index(name = "idx_dbr_helper",   columnList = "helper_id"),
        @Index(name = "idx_dbr_work_date", columnList = "work_date")
    })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DirectBookingRequestEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    /** Khách hàng gửi yêu cầu */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    private User customer;

    /** Thợ được đặt trực tiếp */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "helper_id", nullable = false)
    private User helper;

    /** Danh mục dịch vụ chính */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id", nullable = false)
    private ServiceCategory category;

    /** Địa chỉ đã lưu (nullable nếu nhập tay) */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "address_id")
    private Address address;

    /** Ngày làm việc */
    @Column(name = "work_date", nullable = false)
    private LocalDate workDate;

    /** Giờ bắt đầu */
    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    /** Số giờ làm */
    @Column(name = "duration_hours", nullable = false)
    private Integer durationHours;

    /**
     * Diện tích / số trẻ / số món — tùy danh mục.
     * Cat 1,4,6: m². Cat 2: số người. Cat 5: số trẻ. Cat 7: số hạng mục.
     */
    @Column(name = "work_size")
    private Double workSize;

    /** Ghi chú / mô tả từ khách */
    @Column(name = "description", columnDefinition = "TEXT")
    private String description;


    /**
     * Danh sách ID dịch vụ con (comma-separated, VD: "10,11,12").
     * Dùng cho sub-services giống CustomerPostJobPage.
     */
    @Column(name = "service_ids", length = 500)
    private String serviceIds;

    @Column(name = "is_premium")
    private Boolean isPremium;

    @Column(name = "has_pets")
    private Boolean hasPets;

    @Column(name = "bring_tools")
    private Boolean bringTools;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
