package com.homeconnect.core.repository;

import com.homeconnect.core.entity.JobPost;
import com.homeconnect.core.entity.User;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Bộ lọc danh sách tin đăng (job_posts) cho Admin.
 */
public final class JobPostSpecification {

    private JobPostSpecification() {
    }

    public static Specification<JobPost> forAdmin(
            String status,
            Integer categoryId,
            LocalDate workDateFrom,
            LocalDate workDateTo,
            Long customerId,
            String search) {

        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (status != null && !status.isBlank()) {
                predicates.add(cb.equal(root.get("status"), status.trim()));
            }
            if (categoryId != null) {
                predicates.add(cb.equal(root.get("category").get("categoryId"), categoryId));
            }
            if (workDateFrom != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("workDate"), workDateFrom));
            }
            if (workDateTo != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("workDate"), workDateTo));
            }
            if (customerId != null) {
                predicates.add(cb.equal(root.get("customerId"), customerId));
            }

            if (search != null && !search.isBlank()) {
                String term = search.trim();
                Join<JobPost, User> customer = root.join("customer", JoinType.LEFT);
                List<Predicate> ors = new ArrayList<>();
                ors.add(cb.like(cb.lower(root.get("title")), "%" + term.toLowerCase() + "%"));
                try {
                    Long postId = Long.parseLong(term);
                    ors.add(cb.equal(root.get("postId"), postId));
                } catch (NumberFormatException ignored) {
                }
                ors.add(cb.like(cb.lower(customer.get("fullName")), "%" + term.toLowerCase() + "%"));
                ors.add(cb.like(cb.lower(customer.get("email")), "%" + term.toLowerCase() + "%"));
                if (term.chars().allMatch(Character::isDigit)) {
                    ors.add(cb.equal(customer.get("phone"), term));
                }
                predicates.add(cb.or(ors.toArray(Predicate[]::new)));
            }

            if (search != null && !search.isBlank()) {
                query.distinct(true);
            }

            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }
}
