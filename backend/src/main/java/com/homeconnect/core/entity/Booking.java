package com.homeconnect.core.entity;

import com.homeconnect.core.enums.BookingStatus;
import com.homeconnect.core.enums.PaymentStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "bookings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Booking {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "booking_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    private User customer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "helper_id", nullable = false)
    private User helper;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id", nullable = false)
    private ServiceCategory category;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "address_id")
    private Address address;

    @Column(name = "job_post_id")
    private Long jobPostId;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "job_post_id", referencedColumnName = "post_id", insertable = false, updatable = false)
    private JobPost jobPost;

    @Column(name = "scheduled_start_time", nullable = false)
    private LocalDateTime scheduledStartTime;

    @Column(name = "scheduled_end_time", nullable = false)
    private LocalDateTime scheduledEndTime;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 30)
    @Builder.Default
    private BookingStatus status = BookingStatus.PENDING;

    @Column(name = "total_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalPrice;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status", length = 30)
    @Builder.Default
    private PaymentStatus paymentStatus = PaymentStatus.HOLDING;

    @Column(name = "expired_at")
    private LocalDateTime expiredAt;

    // ===== PB-14: Execution Fields (Phúc + Tú) =====

    @Column(name = "checkin_photo_url", length = 500)
    private String checkinPhotoUrl;         // Ảnh TRƯỚC khi làm (Phúc check-in)

    @Column(name = "checkout_photo_url", length = 500)
    private String checkoutPhotoUrl;        // Ảnh SAU khi làm (Tú check-out)

    @Column(name = "checkout_reason", length = 500)
    private String checkoutReason;          // Lý do hoàn thành sớm

    @Column(name = "checked_in_at")
    private LocalDateTime checkedInAt;      // Lúc thợ check-in (Phúc)

    @Column(name = "checked_out_at")
    private LocalDateTime checkedOutAt;     // Lúc thợ báo xong (Tú)

    @Column(name = "confirmed_start_at")
    private LocalDateTime confirmedStartAt; // Lúc khách xác nhận bắt đầu (Tú)

    @Column(name = "confirmed_done_at")
    private LocalDateTime confirmedDoneAt;  // Lúc khách xác nhận hoàn thành (Tú)

    @Column(name = "is_flagged")
    @Builder.Default
    private Boolean isFlagged = false;      // Đánh dấu đơn bất thường

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
