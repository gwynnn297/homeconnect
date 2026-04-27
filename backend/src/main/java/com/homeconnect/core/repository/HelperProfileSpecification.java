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

            // Luôn bắt buộc thợ phải Online và đã được Xác thực (KYC VERIFIED)
            predicates.add(cb.equal(root.get("isOnline"), true));
            predicates.add(cb.equal(root.get("kycStatus"), KycStatus.VERIFIED));

            // ===== RÀNG BUỘC TỈNH/THÀNH (Automated Gating) =====
            // Lọc thợ dựa trên KHU VỰC LÀM VIỆC (Working Districts), không phải địa chỉ nhà
            if (province != null && !province.isBlank()) {
                Subquery<Long> districtSubquery = query.subquery(Long.class);
                var districtRoot = districtSubquery.from(HelperWorkingDistrict.class);
                districtSubquery.select(districtRoot.get("helper").get("id"))
                        .where(cb.equal(districtRoot.get("provinceCode"), province));
                predicates.add(root.get("user").get("id").in(districtSubquery));
            }

            // Lọc theo Quận/Huyện làm việc (District)
            if (district != null && !district.isBlank()) {
                Join<HelperProfile, User> userJoin = root.join("user");
                Join<User, HelperWorkingDistrict> districtJoin = userJoin.join("workingDistricts");
                predicates.add(cb.or(
                        cb.equal(districtJoin.get("districtCode"), district),
                        cb.like(cb.lower(districtJoin.get("districtName")), "%" + district.toLowerCase() + "%")
                ));
            }

            // Lọc theo Dịch vụ (Service)
            if (serviceId != null) {
                Join<HelperProfile, User> userJoin = root.join("user");
                Join<User, HelperService> serviceJoin = userJoin.join("services");
                predicates.add(cb.equal(serviceJoin.get("category").get("categoryId"), serviceId));
                predicates.add(cb.equal(serviceJoin.get("isActive"), true));
            }

            // Lọc theo Đánh giá tối thiểu (Rating)
            if (minRating != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("ratingAverage"), minRating));
            }

            // Lọc theo Quê quán (Hometown)
            if (hometownCode != null && !hometownCode.isBlank()) {
                // Ở đây ta so khớp theo tên Tỉnh (String) gửi lên từ FE
                predicates.add(cb.equal(root.get("hometownName"), hometownCode));
            }

            query.distinct(true); // Tránh trùng lặp khi join nhiều bảng
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
