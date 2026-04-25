package com.homeconnect.core.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "admin_audit_logs", indexes = {
        @Index(name = "idx_admin_audit_actor_id", columnList = "actor_id"),
        @Index(name = "idx_admin_audit_event_type", columnList = "event_type"),
        @Index(name = "idx_admin_audit_created_at", columnList = "created_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AdminAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "audit_id")
    private Long auditId;

    @Column(name = "event_type", nullable = false, length = 100)
    private String eventType;

    @Column(name = "actor_id", nullable = false)
    private Long actorId;

    @Column(name = "actor_email", nullable = false, length = 255)
    private String actorEmail;

    @Column(name = "actor_role", nullable = false, length = 30)
    private String actorRole;

    @Column(name = "target_type", nullable = false, length = 50)
    private String targetType;

    @Column(name = "target_id")
    private Long targetId;

    @Column(name = "result", nullable = false, length = 20)
    private String result;

    @Column(name = "reason", columnDefinition = "TEXT")
    private String reason;

    @Column(name = "trace_id", length = 100)
    private String traceId;

    @Column(name = "metadata_json", columnDefinition = "json")
    private String metadataJson;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
