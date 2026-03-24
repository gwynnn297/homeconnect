package com.homeconnect.core.repository;

import com.homeconnect.core.entity.Booking;
import com.homeconnect.core.enums.BookingStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;


import java.util.List;

@Repository
public interface BookingRepository extends JpaRepository<Booking, Long> {
    List<Booking> findByHelperIdAndStatus(Long helperId, BookingStatus status);

    @Query("SELECT COUNT(b) FROM Booking b " +
           "WHERE b.helper.id = :helperId " +
           "AND b.status IN :statuses " +
           "AND (b.scheduledStartTime < :endTime AND b.scheduledEndTime > :startTime)")

    long countOverlappingBookings(@Param("helperId") Long helperId,
                                  @Param("statuses") java.util.Collection<com.homeconnect.core.enums.BookingStatus> statuses,
                                  @Param("startTime") java.time.LocalDateTime startTime,
                                  @Param("endTime") java.time.LocalDateTime endTime);
}

