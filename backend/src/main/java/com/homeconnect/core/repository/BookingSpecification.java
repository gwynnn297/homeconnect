package com.homeconnect.core.repository;

import com.homeconnect.core.entity.Booking;
import com.homeconnect.core.entity.User;
import com.homeconnect.core.enums.BookingStatus;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Bộ lọc danh sách booking cho Admin.
 */
public final class BookingSpecification {

    private BookingSpecification() {
    }

    public static Specification<Booking> forAdmin(
            BookingStatus status,
            Boolean flaggedOnly,
            LocalDateTime scheduledFrom,
            LocalDateTime scheduledTo,
            String search) {

        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (Boolean.TRUE.equals(flaggedOnly)) {
                predicates.add(cb.isTrue(root.get("isFlagged")));
            }
            if (scheduledFrom != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("scheduledStartTime"), scheduledFrom));
            }
            if (scheduledTo != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("scheduledStartTime"), scheduledTo));
            }

            if (search != null && !search.isBlank()) {
                String term = search.trim();
                Join<Booking, User> customer = root.join("customer", JoinType.INNER);
                List<Predicate> ors = new ArrayList<>();
                ors.add(cb.like(cb.lower(customer.get("fullName")), "%" + term.toLowerCase() + "%"));
                try {
                    Long id = Long.parseLong(term);
                    ors.add(cb.equal(root.get("id"), id));
                } catch (NumberFormatException ignored) {
                    // chỉ tìm theo tên
                }
                predicates.add(cb.or(ors.toArray(Predicate[]::new)));
            }

            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }
}
