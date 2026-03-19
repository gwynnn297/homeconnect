package com.homeconnect.core.service;

import com.homeconnect.core.entity.Booking;
import com.homeconnect.core.entity.HelperSchedule;
import com.homeconnect.core.enums.BookingStatus;
import com.homeconnect.core.enums.ScheduleStatus;
import com.homeconnect.core.exception.ApiException;
import com.homeconnect.core.repository.BookingRepository;
import com.homeconnect.core.repository.HelperScheduleRepository;
import com.homeconnect.core.util.ConflictEngine;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class BookingService {

    private final BookingRepository bookingRepository;
    private final HelperScheduleRepository helperScheduleRepository;
    private final ConflictEngine conflictEngine;

    /**
     * Xác nhận đơn hàng và cập nhật lịch của Helper sang BUSY
     */
    @Transactional
    public void confirmBooking(Long bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ApiException("Booking not found", HttpStatus.NOT_FOUND));

        if (booking.getStatus() != BookingStatus.PENDING) {
            throw new ApiException("Booking is already processed", HttpStatus.BAD_REQUEST);
        }

        // 1. Tìm slot rảnh tương ứng của Helper
        List<HelperSchedule> schedules = helperScheduleRepository.findByHelperIdAndWorkDateAndStatusIn(
                booking.getHelper().getId(), 
                booking.getScheduledStartTime().toLocalDate(), 
                List.of(ScheduleStatus.AVAILABLE));

        HelperSchedule targetSchedule = null;
        for (HelperSchedule schedule : schedules) {
            if (conflictEngine.isOverlap(
                    booking.getScheduledStartTime().toLocalTime(), 
                    booking.getScheduledEndTime().toLocalTime(), 
                    schedule.getStartTime(), 
                    schedule.getEndTime())) {
                targetSchedule = schedule;
                break;
            }
        }

        if (targetSchedule == null) {
            throw new ApiException("Không tìm thấy lịch rảnh phù hợp.", HttpStatus.CONFLICT);
        }

        // 2b. Kiểm tra buffer di chuyển 30 phút với các slot BUSY khác trong ngày
        List<HelperSchedule> busySlotsOnDay = helperScheduleRepository.findByHelperIdAndWorkDateAndStatusIn(
                booking.getHelper().getId(),
                booking.getScheduledStartTime().toLocalDate(),
                List.of(ScheduleStatus.BUSY));

        for (HelperSchedule busySlot : busySlotsOnDay) {
            if (busySlot.getId().equals(targetSchedule.getId())) continue; // bỏ qua chính nó
            if (conflictEngine.checkConflictWithBuffer(
                    booking.getScheduledStartTime().toLocalTime(),
                    booking.getScheduledEndTime().toLocalTime(),
                    busySlot,
                    ConflictEngine.TRAVEL_BUFFER_MINUTES)) {
                throw new ApiException(
                    "Không thể xác nhận đơn hàng: Helper cần ít nhất 30 phút di chuyển giữa các đơn.",
                    HttpStatus.CONFLICT);
            }
        }

        // 3. Cập nhật trạng thái
        booking.setStatus(BookingStatus.CONFIRMED);
        targetSchedule.setStatus(ScheduleStatus.BUSY);
        targetSchedule.setBooking(booking);

        bookingRepository.save(booking);
        helperScheduleRepository.save(targetSchedule);
    }
}
