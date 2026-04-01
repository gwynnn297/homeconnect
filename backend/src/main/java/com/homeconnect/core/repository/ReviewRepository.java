package com.homeconnect.core.repository;

import com.homeconnect.core.entity.Review;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ReviewRepository extends JpaRepository<Review, Integer> {

    List<Review> findByHelperIdAndIsVisibleTrueOrderByCreatedAtDesc(Long helperId, Pageable pageable);

    @Query("SELECT AVG(r.rating) FROM Review r WHERE r.helper.id = :helperId AND r.isVisible = true")
    Double getAverageRatingByHelperId(@Param("helperId") Long helperId);

    @Query("SELECT COUNT(r) FROM Review r WHERE r.helper.id = :helperId AND r.isVisible = true")
    Long countReviewsByHelperId(@Param("helperId") Long helperId);

    @Query("SELECT r.rating, COUNT(r) FROM Review r WHERE r.helper.id = :helperId AND r.isVisible = true GROUP BY r.rating")
    List<Object[]> getRatingDistributionByHelperId(@Param("helperId") Long helperId);

    List<Review> findByCustomerIdOrderByCreatedAtDesc(Long customerId, Pageable pageable);

    java.util.Optional<Review> findByBookingId(Long bookingId);

    boolean existsByBookingId(Long bookingId);
}
