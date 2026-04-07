package com.homeconnect.core.repository;

import com.homeconnect.core.entity.Booking;
import com.homeconnect.core.enums.BookingStatus;
import com.homeconnect.core.enums.PaymentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface BookingRepository extends JpaRepository<Booking, Long> {
    List<Booking> findByHelperIdAndStatus(Long helperId, BookingStatus status);

       Optional<Booking> findByIdAndHelper_Id(Long bookingId, Long helperId);

       List<Booking> findByHelper_IdAndJobPostIdInAndStatusInOrderByCreatedAtDesc(
                     Long helperId,
                     Collection<Long> jobPostIds,
                     Collection<BookingStatus> statuses);

           List<Booking> findByCustomer_IdAndJobPostIdInOrderByCreatedAtDesc(
                  Long customerId,
                  Collection<Long> jobPostIds);

           Optional<Booking> findTopByJobPostIdAndCustomer_IdOrderByCreatedAtDesc(Long jobPostId, Long customerId);

    @Query("SELECT COUNT(b) FROM Booking b " +
           "WHERE b.helper.id = :helperId " +
           "AND b.status IN :statuses " +
           "AND (b.scheduledStartTime < :endTime AND b.scheduledEndTime > :startTime)")
    long countOverlappingBookings(@Param("helperId") Long helperId,
                                  @Param("statuses") java.util.Collection<com.homeconnect.core.enums.BookingStatus> statuses,
                                  @Param("startTime") java.time.LocalDateTime startTime,
                                  @Param("endTime") java.time.LocalDateTime endTime);

    List<com.homeconnect.core.entity.Booking> findByStatusAndCreatedAtBefore(com.homeconnect.core.enums.BookingStatus status, java.time.LocalDateTime dateTime);

    List<com.homeconnect.core.entity.Booking> findByStatusAndCheckedOutAtBefore(com.homeconnect.core.enums.BookingStatus status, java.time.LocalDateTime dateTime);

    boolean existsByAddress_AddressId(Integer addressId);

    /**
     * Tìm các booking đã COMPLETED, tiền vẫn đang HOLDING,
     * và thời gian checkout (scheduledEndTime) đã qua cutoff.
     * Dùng cho cronjob auto salary release.
     */
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"helper", "customer", "category"})
    @Query("SELECT b FROM Booking b " +
           "WHERE b.status = :status " +
           "AND b.paymentStatus = :paymentStatus " +
           "AND b.scheduledEndTime < :cutoff")
    List<Booking> findCompletedBookingsReadyForRelease(
            @Param("status") BookingStatus status,
            @Param("paymentStatus") PaymentStatus paymentStatus,
            @Param("cutoff") LocalDateTime cutoff);
}

