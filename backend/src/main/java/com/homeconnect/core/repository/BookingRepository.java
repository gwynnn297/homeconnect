package com.homeconnect.core.repository;

import com.homeconnect.core.entity.Booking;
import com.homeconnect.core.enums.BookingStatus;
import com.homeconnect.core.enums.PaymentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import jakarta.persistence.LockModeType;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface BookingRepository extends JpaRepository<Booking, Long>, JpaSpecificationExecutor<Booking> {

       long countByCustomer_Id(Long customerId);

       long countByHelper_Id(Long helperId);

       List<Booking> findByHelperIdAndStatus(Long helperId, BookingStatus status);

       List<Booking> findByHelper_IdAndStatusIn(Long helperId, Collection<BookingStatus> statuses);

       List<Booking> findByCustomer_IdAndStatusIn(Long customerId, Collection<BookingStatus> statuses);

       Optional<Booking> findByIdAndHelper_Id(Long bookingId, Long helperId);

       @Lock(LockModeType.PESSIMISTIC_WRITE)
       @Query("SELECT b FROM Booking b WHERE b.id = :bookingId")
       Optional<Booking> findByIdForUpdate(@Param("bookingId") Long bookingId);

       List<Booking> findByHelper_IdAndJobPostIdInAndStatusInOrderByCreatedAtDesc(
                     Long helperId,
                     Collection<Long> jobPostIds,
                     Collection<BookingStatus> statuses);

       List<Booking> findByCustomer_IdAndJobPostIdInOrderByCreatedAtDesc(
                     Long customerId,
                     Collection<Long> jobPostIds);

       Optional<Booking> findTopByJobPostIdAndCustomer_IdOrderByCreatedAtDesc(Long jobPostId, Long customerId);

       Optional<Booking> findTopByJobPostIdOrderByCreatedAtDesc(Long jobPostId);

       @Query("SELECT COUNT(b) FROM Booking b " +
                     "WHERE b.helper.id = :helperId " +
                     "AND b.status IN :statuses " +
                     "AND (b.scheduledStartTime < :endTime AND b.scheduledEndTime > :startTime)")
       long countOverlappingBookings(@Param("helperId") Long helperId,
                     @Param("statuses") java.util.Collection<com.homeconnect.core.enums.BookingStatus> statuses,
                     @Param("startTime") java.time.LocalDateTime startTime,
                     @Param("endTime") java.time.LocalDateTime endTime);

       @Query("SELECT COUNT(b) FROM Booking b " +
                     "WHERE b.helper.id = :helperId " +
                     "AND b.status IN :statuses " +
                     "AND (b.scheduledStartTime < :endTime AND b.scheduledEndTime > :startTime) " +
                     "AND (b.jobPostId IS NULL OR b.jobPostId != :excludeJobId)")
       long countOverlappingBookingsExcludeJob(@Param("helperId") Long helperId,
                     @Param("statuses") java.util.Collection<com.homeconnect.core.enums.BookingStatus> statuses,
                     @Param("startTime") java.time.LocalDateTime startTime,
                     @Param("endTime") java.time.LocalDateTime endTime,
                     @Param("excludeJobId") Long excludeJobId);

       @Lock(LockModeType.PESSIMISTIC_WRITE)
       @Query("SELECT b FROM Booking b " +
                     "WHERE b.helper.id = :helperId " +
                     "AND b.status IN :statuses " +
                     "AND (b.scheduledStartTime < :endTime AND b.scheduledEndTime > :startTime)")
       List<Booking> findOverlappingBookingsForUpdate(@Param("helperId") Long helperId,
                     @Param("statuses") java.util.Collection<BookingStatus> statuses,
                     @Param("startTime") LocalDateTime startTime,
                     @Param("endTime") LocalDateTime endTime);

       List<com.homeconnect.core.entity.Booking> findByStatusAndCreatedAtBefore(
                     com.homeconnect.core.enums.BookingStatus status, java.time.LocalDateTime dateTime);

       @Query("SELECT b FROM Booking b JOIN FETCH b.customer JOIN FETCH b.helper " +
                     "WHERE b.status = :status AND b.scheduledStartTime < :cutoff")
       List<com.homeconnect.core.entity.Booking> findNoShowBookings(
                     @Param("status") com.homeconnect.core.enums.BookingStatus status,
                     @Param("cutoff") java.time.LocalDateTime cutoff);

       List<com.homeconnect.core.entity.Booking> findByStatusAndCheckedOutAtBefore(
                     com.homeconnect.core.enums.BookingStatus status, java.time.LocalDateTime dateTime);

       boolean existsByAddress_AddressId(Integer addressId);

       /**
        * Tìm các booking đã COMPLETED, tiền vẫn đang HOLDING,
        * và thời gian checkout (scheduledEndTime) đã qua cutoff.
        * Dùng cho cronjob auto salary release.
        */
       @org.springframework.data.jpa.repository.EntityGraph(attributePaths = { "helper", "customer", "category" })
       @Query("SELECT b FROM Booking b " +
                     "WHERE b.status = :status " +
                     "AND b.paymentStatus = :paymentStatus " +
                     "AND b.scheduledEndTime < :cutoff")
       List<Booking> findCompletedBookingsReadyForRelease(
                     @Param("status") BookingStatus status,
                     @Param("paymentStatus") PaymentStatus paymentStatus,
                     @Param("cutoff") LocalDateTime cutoff);

       long countByIsFlaggedTrue();

       @Query("SELECT b.status, COUNT(b) FROM Booking b GROUP BY b.status")
       List<Object[]> countGroupedByStatus();

       @Query("SELECT b.paymentStatus, COUNT(b) FROM Booking b GROUP BY b.paymentStatus")
       List<Object[]> countGroupedByPaymentStatus();

       @Query("SELECT COUNT(b) FROM Booking b " +
                     "WHERE b.customer.id = :customerId " +
                     "AND b.status = :status " +
                     "AND b.confirmedDoneAt >= :from " +
                     "AND b.confirmedDoneAt < :to")
       long countCompletedByCustomerInRange(@Param("customerId") Long customerId,
                     @Param("status") BookingStatus status,
                     @Param("from") LocalDateTime from,
                     @Param("to") LocalDateTime to);

       Page<Booking> findByStatusOrderByDisputedAtDesc(BookingStatus status, Pageable pageable);

       /** Đặt trực tiếp của thợ - jobPostId IS NULL */
       List<Booking> findByHelper_IdAndJobPostIdIsNullAndStatusInOrderByCreatedAtDesc(
                     Long helperId, Collection<BookingStatus> statuses);

       /** Đặt trực tiếp của khách hàng - jobPostId IS NULL */
       List<Booking> findByCustomer_IdAndJobPostIdIsNullOrderByCreatedAtDesc(Long customerId);
}

