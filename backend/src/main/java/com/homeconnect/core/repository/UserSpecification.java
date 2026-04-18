package com.homeconnect.core.repository;

import com.homeconnect.core.entity.User;
import com.homeconnect.core.enums.UserRole;
import com.homeconnect.core.enums.UserStatus;
import org.springframework.data.jpa.domain.Specification;

import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.List;

/**
 * Điều kiện lọc danh sách user cho Admin.
 */
public final class UserSpecification {

    private UserSpecification() {
    }

    public static Specification<User> withFilters(UserRole role, UserStatus status, String search) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (role != null) {
                predicates.add(cb.equal(root.get("role"), role));
            }
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (search != null && !search.isBlank()) {
                String term = "%" + search.trim().toLowerCase() + "%";
                Predicate email = cb.like(cb.lower(root.get("email")), term);
                Predicate phone = cb.like(cb.lower(root.get("phone")), term);
                Predicate fullName = cb.like(cb.lower(root.get("fullName")), term);
                predicates.add(cb.or(email, phone, fullName));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }
}
