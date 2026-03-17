package com.homeconnect.core.repository;

import com.homeconnect.core.entity.HelperSchedule;
import com.homeconnect.core.enums.ScheduleStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface HelperScheduleRepository extends JpaRepository<HelperSchedule, Long> {

    List<HelperSchedule> findByHelperIdOrderByWorkDateAscStartTimeAsc(Long helperId);

    List<HelperSchedule> findByHelperIdAndWorkDateBetween(Long helperId, LocalDate startDate, LocalDate endDate);

    List<HelperSchedule> findByHelperIdAndWorkDateAndStatusIn(Long helperId, LocalDate workDate, List<ScheduleStatus> statuses);

    @Modifying
    @Query("DELETE FROM HelperSchedule hs WHERE hs.helper.id = :helperId AND hs.workDate = :workDate " +
           "AND hs.status IN :statuses " +
           "AND (hs.startTime < :newEndTime AND hs.endTime > :newStartTime)")
    void deleteOverlappingSchedules(@Param("helperId") Long helperId, 
                                    @Param("workDate") LocalDate workDate, 
                                    @Param("newStartTime") java.time.LocalTime newStartTime,
                                    @Param("newEndTime") java.time.LocalTime newEndTime,
                                    @Param("statuses") List<ScheduleStatus> statuses);

    List<HelperSchedule> findByGroupId(String groupId);

    @Modifying
    @Query("DELETE FROM HelperSchedule hs WHERE hs.helper.id = :helperId AND hs.workDate = :workDate AND hs.status IN :statuses")
    void deleteByHelperIdAndWorkDateAndStatusIn(@Param("helperId") Long helperId, 
                                                @Param("workDate") LocalDate workDate, 
                                                @Param("statuses") List<ScheduleStatus> statuses);

    @Modifying
    @Query("DELETE FROM HelperSchedule hs WHERE hs.helper.id = :helperId AND hs.workDate >= :startDate AND hs.workDate <= :endDate AND hs.status IN :statuses")
    void deleteByHelperIdAndWorkDateBetweenAndStatusIn(@Param("helperId") Long helperId, 
                                                       @Param("startDate") LocalDate startDate, 
                                                       @Param("endDate") LocalDate endDate, 
                                                       @Param("statuses") List<ScheduleStatus> statuses);

    @Modifying
    @Query("DELETE FROM HelperSchedule hs WHERE hs.groupId = :groupId AND hs.workDate IN :dates AND hs.status IN :statuses")
    void deleteByGroupIdAndWorkDateInAndStatusIn(@Param("groupId") String groupId,
                                                 @Param("dates") List<LocalDate> dates,
                                                 @Param("statuses") List<ScheduleStatus> statuses);

    long countByHelperIdAndStatusAndWorkDateBetween(Long helperId, ScheduleStatus status, LocalDate startDate, LocalDate endDate);
}
