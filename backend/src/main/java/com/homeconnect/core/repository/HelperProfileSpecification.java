package com.homeconnect.core.repository;

import com.homeconnect.core.entity.Address;
import com.homeconnect.core.entity.HelperProfile;
import com.homeconnect.core.entity.HelperService;
import com.homeconnect.core.entity.HelperWorkingDistrict;
import com.homeconnect.core.entity.User;
import com.homeconnect.core.enums.KycStatus;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Subquery;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

public class HelperProfileSpecification {

    public static Specification<HelperProfile> filterHelpers(
            Integer serviceId,
            String district,
            String province,
            BigDecimal minRating,
            String hometownCode) {

        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            // Join User một lần duy nhất để dùng chung cho các bộ lọc
            Join<HelperProfile, User> userJoin = root.join("user");

            // 1. Ràng buộc cứng: Online và Verified
            predicates.add(cb.equal(root.get("isOnline"), true));
            predicates.add(cb.equal(root.get("kycStatus"), KycStatus.VERIFIED));

            // 2. Lọc theo Tỉnh/Thành (Regional Gating)
            // Chỉ hiển thị thợ đã đăng ký khu vực làm việc tại tỉnh này.
            // Không dùng địa chỉ nhà để fallback (thợ ở Thái Nguyên không được hiện ở Đà Nẵng).
            if (province != null && !province.isBlank()) {
                Subquery<Long> wdSubquery = query.subquery(Long.class);
                var wdRoot = wdSubquery.from(HelperWorkingDistrict.class);
                wdSubquery.select(wdRoot.get("helper").get("id"))
                        .where(cb.equal(wdRoot.get("provinceCode"), province));
                predicates.add(userJoin.get("id").in(wdSubquery));
            }

            // 3. Lọc theo Quận/Huyện làm việc
            if (district != null && !district.isBlank()) {
                Join<User, HelperWorkingDistrict> districtJoin = userJoin.join("workingDistricts");
                predicates.add(cb.or(
                        cb.equal(districtJoin.get("districtCode"), district),
                        cb.like(cb.lower(districtJoin.get("districtName")), "%" + district.toLowerCase() + "%")
                ));
            }

            // 4. Lọc theo Dịch vụ (Service Category)
            if (serviceId != null) {
                Join<User, HelperService> serviceJoin = userJoin.join("services");
                predicates.add(cb.equal(serviceJoin.get("category").get("categoryId"), serviceId));
                predicates.add(cb.equal(serviceJoin.get("isActive"), true));
            }

            // 5. Đánh giá tối thiểu (Rating)
            if (minRating != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("ratingAverage"), minRating));
            }

            // 6. Quê quán (Hometown - String match)
            if (hometownCode != null && !hometownCode.isBlank()) {
                predicates.add(cb.equal(root.get("hometownName"), hometownCode));
            }

            query.distinct(true);
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
