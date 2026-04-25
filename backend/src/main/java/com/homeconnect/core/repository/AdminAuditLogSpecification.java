package com.homeconnect.core.repository;

import com.homeconnect.core.entity.AdminAuditLog;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDateTime;

public final class AdminAuditLogSpecification {
    private AdminAuditLogSpecification() {
    }

    public static Specification<AdminAuditLog> withFilters(
            Long actorId,
            String eventType,
            String targetType,
            LocalDateTime from,
            LocalDateTime to) {
        return (root, query, cb) -> {
            var predicates = cb.conjunction();
            if (actorId != null) {
                predicates.getExpressions().add(cb.equal(root.get("actorId"), actorId));
            }
            if (eventType != null && !eventType.isBlank()) {
                predicates.getExpressions().add(cb.equal(root.get("eventType"), eventType));
            }
            if (targetType != null && !targetType.isBlank()) {
                predicates.getExpressions().add(cb.equal(root.get("targetType"), targetType));
            }
            if (from != null) {
                predicates.getExpressions().add(cb.greaterThanOrEqualTo(root.get("createdAt"), from));
            }
            if (to != null) {
                predicates.getExpressions().add(cb.lessThanOrEqualTo(root.get("createdAt"), to));
            }
            return predicates;
        };
    }
}
