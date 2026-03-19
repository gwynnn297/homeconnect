package com.homeconnect.core.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Entity JobApplication - Bảng job_applications
 * Đại diện cho việc ứng tuyển hoặc được mời cho một job post
 */
@Entity
@Table(name = "job_applications", indexes = {
        @Index(name = "idx_post_id", columnList = "post_id"),
        @Index(name = "idx_helper_id", columnList = "helper_id"),
        @Index(name = "idx_status", columnList = "status"),
        @Index(name = "idx_type", columnList = "type")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JobApplication {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "application_id")
    private Long applicationId;

    @Column(name = "post_id", nullable = false)
    private Long postId;

    @Column(name = "helper_id", nullable = false)
    private Long helperId;

    @Builder.Default
    @Column(name = "type", length = 20)
    private String type = "APPLIED"; // APPLIED (Tự xin), INVITED (Hệ thống match)

    @Builder.Default
    @Column(name = "status", length = 20)
    private String status = "PENDING"; // PENDING, ACCEPTED, REJECTED, EXPIRED

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    // Relationships
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "post_id", referencedColumnName = "post_id", insertable = false, updatable = false)
    private JobPost jobPost;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "helper_id", referencedColumnName = "id", insertable = false, updatable = false)
    private User helper;
}