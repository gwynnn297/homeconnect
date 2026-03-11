package com.homeconnect.core.util;

import com.homeconnect.core.entity.HelperSchedule;
import org.springframework.stereotype.Component;

import java.time.LocalTime;

@Component
public class ConflictEngine {

    /**
     * Kiểm tra xem hai khoảng thời gian có bị đè lên nhau (overlap) không.
     * Rule: (start1 < end2) AND (end1 > start2)
     */
    public boolean isOverlap(LocalTime start1, LocalTime end1, LocalTime start2, LocalTime end2) {
        return start1.isBefore(end2) && end1.isAfter(start2);
    }

    /**
     * Kiểm tra conflict giữa một slot mới với một slot hiện có trong DB
     */
    public boolean checkConflict(LocalTime newStart, LocalTime newEnd, HelperSchedule existingSchedule) {
        return isOverlap(newStart, newEnd, existingSchedule.getStartTime(), existingSchedule.getEndTime());
    }
}
