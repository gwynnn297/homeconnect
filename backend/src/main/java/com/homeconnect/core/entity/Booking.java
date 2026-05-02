package com.homeconnect.core.entity;

import com.homeconnect.core.enums.BookingStatus;
import com.homeconnect.core.enums.PaymentStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

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

    @Column(name = "arrived_at")
    private LocalDateTime arrivedAt;

    @Lob
    @Column(name = "arrival_proof_image", columnDefinition = "LONGTEXT")
    private String arrivalProofImage;

    @Column(name = "customer_arrival_confirmed", nullable = false)
    @Builder.Default
    private Boolean customerArrivalConfirmed = false;

    @Column(name = "customer_arrival_confirmed_at")
    private LocalDateTime customerArrivalConfirmedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 30)
    @Builder.Default
    private BookingStatus status = BookingStatus.PENDING;

    @Column(name = "total_price", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalPrice;

    @Column(name = "original_price", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal originalPrice = BigDecimal.ZERO;

    @Column(name = "discount_rate", nullable = false, precision = 5, scale = 4)
    @Builder.Default
    private BigDecimal discountRate = BigDecimal.ZERO;

    @Column(name = "discount_amount", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal discountAmount = BigDecimal.ZERO;

    @Column(name = "final_price", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal finalPrice = BigDecimal.ZERO;

    @Column(name = "tier_at_booking", nullable = false, length = 20)
    @Builder.Default
    private String tierAtBooking = "BRONZE";

    @Column(name = "loyalty_processed", nullable = false)
    @Builder.Default
    private Boolean loyaltyProcessed = false;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status", length = 30)
    @Builder.Default
    private PaymentStatus paymentStatus = PaymentStatus.HOLDING;

    /** FK sang direct_booking_requests (null nếu booking từ marketplace) */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "direct_booking_request_id")
    private DirectBookingRequestEntity directBookingRequest;

    /** Mô tả từ khách (copy từ direct_booking_requests.description để truy cập nhanh) */
    @Column(name = "description", columnDefinition = "TEXT")
    private String description;


    @Column(name = "cancel_source", length = 30)
    private String cancelSource;

    @Column(name = "cancel_reason", columnDefinition = "TEXT")
    private String cancelReason;

    @Column(name = "cancelled_by_admin_id")
    private Long cancelledByAdminId;

    @Column(name = "cancelled_at")
    private LocalDateTime cancelledAt;

    @Column(name = "price_snapshot", precision = 12, scale = 2)
    private BigDecimal priceSnapshot;

    @Column(name = "no_show_actor", length = 20)
    private String noShowActor;

    @Column(name = "timeout_at")
    private LocalDateTime timeoutAt;

    @Column(name = "penalty_amount", precision = 12, scale = 2)
    private BigDecimal penaltyAmount;

    @Column(name = "refund_amount", precision = 12, scale = 2)
    private BigDecimal refundAmount;

    @Column(name = "dispute_reason", columnDefinition = "TEXT")
    private String disputeReason;

    @Column(name = "evidence_url", length = 1000)
    private String evidenceUrl;

    @Column(name = "disputed_at")
    private LocalDateTime disputedAt;

    @Column(name = "dispute_resolved_at")
    private LocalDateTime disputeResolvedAt;

    @Column(name = "dispute_resolution_action", length = 30)
    private String disputeResolutionAction;

    @Column(name = "dispute_resolved_by_admin_id")
    private Long disputeResolvedByAdminId;

    @Column(name = "helper_dispute_message", columnDefinition = "TEXT")
    private String helperDisputeMessage;

    @Column(name = "helper_dispute_evidence_url", length = 1000)
    private String helperDisputeEvidenceUrl;

    @Column(name = "helper_dispute_at")
    private LocalDateTime helperDisputeAt;

    @Column(name = "dispute_refund_ratio", precision = 5, scale = 2)
    private BigDecimal disputeRefundRatio;

    @Column(name = "dispute_refund_amount", precision = 12, scale = 2)
    private BigDecimal disputeRefundAmount;

    @Column(name = "dispute_admin_note", columnDefinition = "TEXT")
    private String disputeAdminNote;

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
