package com.homeconnect.core.util;

import com.homeconnect.core.entity.HelperSchedule;
import org.springframework.stereotype.Component;

import java.time.LocalTime;

@Component
public class ConflictEngine {

    /** Số phút thời gian đệm di chuyển giữa các ca */
    public static final int TRAVEL_BUFFER_MINUTES = 30;

    /**
     * Kiểm tra xem hai khoảng thời gian có bị đè lên nhau (overlap) không.
     * Rule: (start1 < end2) AND (end1 > start2)
     */
    public boolean isOverlap(LocalTime start1, LocalTime end1, LocalTime start2, LocalTime end2) {
        return start1.isBefore(end2) && end1.isAfter(start2);
    }

    /**
     * Kiểm tra overlap có tính thêm buffer di chuyển (theo phút).
     * Mở rộng khoảng thời gian hiện có sang hai phía trước khi check.
     * Ví dụ: buffer=30, existSlot=07:00-09:00 → vùng cấm = 06:30-09:30
     */
    public boolean isOverlapWithBuffer(LocalTime start1, LocalTime end1,
                                       LocalTime start2, LocalTime end2,
                                       int bufferMinutes) {
        LocalTime bufferedStart2 = start2.minusMinutes(bufferMinutes);
        LocalTime bufferedEnd2   = end2.plusMinutes(bufferMinutes);
        return isOverlap(start1, end1, bufferedStart2, bufferedEnd2);
    }

    /**
     * Kiểm tra conflict giữa một slot mới với một slot hiện có trong DB
     */
    public boolean checkConflict(LocalTime newStart, LocalTime newEnd, HelperSchedule existingSchedule) {
        return isOverlap(newStart, newEnd, existingSchedule.getStartTime(), existingSchedule.getEndTime());
    }

    /**
     * Kiểm tra conflict có tính buffer di chuyển
     */
    public boolean checkConflictWithBuffer(LocalTime newStart, LocalTime newEnd,
                                           HelperSchedule existingSchedule, int bufferMinutes) {
        return isOverlapWithBuffer(newStart, newEnd,
                existingSchedule.getStartTime(), existingSchedule.getEndTime(),
                bufferMinutes);
    }
}
