package com.homeconnect.core.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "withdraw_audit_logs")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WithdrawAuditLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer auditId;

    @Column(name = "request_id", nullable = false)
    private Integer requestId;

    @Column(nullable = false)
    private String action;

    @Column(nullable = false)
    private String actor;

    private String note;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
