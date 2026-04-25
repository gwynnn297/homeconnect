package com.homeconnect.core.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "user_violations", indexes = {
        @Index(name = "idx_user_violations_user_id", columnList = "user_id"),
        @Index(name = "idx_user_violations_booking_id", columnList = "booking_id"),
        @Index(name = "idx_user_violations_violation_type", columnList = "violation_type")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserViolation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "violation_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "booking_id")
    private Long bookingId;

    @Column(name = "violation_type", nullable = false, length = 50)
    private String violationType;

    @Builder.Default
    @Column(name = "severity", nullable = false, length = 20)
    private String severity = "MEDIUM";

    @Column(name = "penalty_amount", precision = 12, scale = 2)
    private BigDecimal penaltyAmount;

    @Column(name = "note", columnDefinition = "TEXT")
    private String note;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
