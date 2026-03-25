package com.homeconnect.core.task;

import com.homeconnect.core.entity.Booking;
import com.homeconnect.core.entity.HelperSchedule;
import com.homeconnect.core.enums.BookingStatus;
import com.homeconnect.core.enums.ScheduleStatus;
import com.homeconnect.core.repository.BookingRepository;
import com.homeconnect.core.repository.HelperScheduleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Task dọn dẹp các đơn hàng hết hạn chờ phản hồi (Timeout 10 phút)
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class BookingCleanupTask {

    private final BookingRepository bookingRepository;
    private final HelperScheduleRepository helperScheduleRepository;

    /**
     * Tự động hủy các đơn đặt trực tiếp quá 10 phút chưa phản hồi
     * Chạy mỗi phút 1 lần.
     */
    @Scheduled(fixedRate = 60000)
    @Transactional
    public void cleanupExpiredBookings() {
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(10);
        
        List<Booking> expiredBookings = bookingRepository.findByStatusAndCreatedAtBefore(
                BookingStatus.PENDING_ACCEPTANCE, cutoff);

        if (expiredBookings.isEmpty()) {
            return;
        }

        log.info("Phát hiện {} đơn hàng hết hạn chờ xác nhận. Đang tiến hành dọn dẹp...", expiredBookings.size());

        for (Booking booking : expiredBookings) {
            log.info("Hủy đơn hàng quá hạn ID: {}. Khách: {}, Thợ: {}", 
                    booking.getId(), booking.getCustomer().getId(), booking.getHelper().getId());
            
            booking.setStatus(BookingStatus.EXPIRED);
            
            // Tìm và giải phóng các slot lịch đang bị PENDING_LOCK
            List<HelperSchedule> schedules = helperScheduleRepository.findByBooking(booking);
            for (HelperSchedule schedule : schedules) {
                schedule.setStatus(ScheduleStatus.AVAILABLE);
                schedule.setBooking(null);
                helperScheduleRepository.save(schedule);
                log.debug("Giải phóng lịch ID: {} của thợ {}", schedule.getId(), booking.getHelper().getId());
            }
            
            bookingRepository.save(booking);
        }
        
        log.info("Đã dọn dẹp xong {} đơn hàng quá hạn.", expiredBookings.size());
    }
}
