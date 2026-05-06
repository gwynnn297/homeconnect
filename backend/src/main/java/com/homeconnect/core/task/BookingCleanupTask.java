package com.homeconnect.core.task;

import com.homeconnect.core.entity.Booking;
import com.homeconnect.core.entity.HelperSchedule;
import com.homeconnect.core.enums.BookingStatus;
import com.homeconnect.core.enums.ScheduleStatus;
import com.homeconnect.core.repository.BookingRepository;
import com.homeconnect.core.repository.HelperScheduleRepository;
import com.homeconnect.core.service.WalletService;
import com.homeconnect.core.service.NotificationService;
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
    private final WalletService walletService;
    private final NotificationService notificationService;
    private final NoShowBookingProcessor noShowBookingProcessor;

    /**
     * Tự động hủy các đơn đặt trực tiếp quá 10 phút chưa phản hồi
     * Chạy mỗi phút 1 lần.
     */
    @Scheduled(fixedRate = 60000)
    @Transactional
    public void cleanupExpiredBookings() {
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(15);
        log.info("[CleanupTask] cleanupExpiredBookings chạy. Cutoff: {}", cutoff);
        
        List<Booking> expiredBookings = bookingRepository.findByStatusAndCreatedAtBefore(
                BookingStatus.PENDING_ACCEPTANCE, cutoff);

        if (expiredBookings.isEmpty()) {
            log.info("[CleanupTask] Không có đơn PENDING_ACCEPTANCE hết hạn.");
            return;
        }

        log.info("Phát hiện {} đơn hàng hết hạn chờ xác nhận. Đang tiến hành dọn dẹp...", expiredBookings.size());

        for (Booking booking : expiredBookings) {
            log.info("Hủy đơn hàng quá hạn ID: {}. Khách: {}, Thợ: {}", 
                    booking.getId(), booking.getCustomer().getId(), booking.getHelper().getId());
            
            booking.setStatus(BookingStatus.EXPIRED);
            booking.setCancelSource("SYSTEM");
            booking.setCancelReason("Hết hạn 15 phút: thợ không phản hồi");
            booking.setCancelledAt(LocalDateTime.now());
            booking.setTimeoutAt(LocalDateTime.now());
            
            // Tìm và giải phóng các slot lịch đang bị khóa (BUSY) vì direct booking hết hạn
            List<HelperSchedule> schedules = helperScheduleRepository.findByBooking(booking);
            for (HelperSchedule schedule : schedules) {
                schedule.setStatus(ScheduleStatus.AVAILABLE);
                schedule.setBooking(null);
                helperScheduleRepository.save(schedule);
                log.debug("Giải phóng lịch ID: {} của thợ {}", schedule.getId(), booking.getHelper().getId());
            }
            
            bookingRepository.save(booking);

            if (booking.getPaymentStatus() == com.homeconnect.core.enums.PaymentStatus.HOLDING) {
                walletService.refundHold(
                        booking.getCustomer().getId(),
                        booking.getTotalPrice(),
                        booking.getId(),
                        "Timeout 15 phút: tự động hủy và hoàn tiền hold");
            }
            
            // Thông báo cho Khách hàng
            notificationService.createNotification(
                    booking.getCustomer().getId(),
                    "Đơn đặt trực tiếp hết hạn",
                    String.format("Yêu cầu đặt thợ (Đơn #%d) đã tự động hủy do thợ chưa thể phản hồi lúc này. Tiền giữ chỗ đã được hoàn lại ví của bạn.", booking.getId()),
                    "BOOKING_EXPIRED"
            );

            // Thông báo cho Thợ
            notificationService.createNotification(
                    booking.getHelper().getId(),
                    "Yêu cầu đặt lịch hết hạn",
                    String.format("Yêu cầu đặt lịch mới (Đơn #%d) đã bị hủy do quá thời gian 15 phút phản hồi.", booking.getId()),
                    "BOOKING_EXPIRED"
            );
        }

        
        log.info("Đã dọn dẹp xong {} đơn hàng quá hạn.", expiredBookings.size());
    }

    /**
     * Tự động hủy các đơn hàng đã chốt (CONFIRMED) mà thợ không đến (No-Show).
     * Mỗi đơn được xử lý trong transaction độc lập (REQUIRES_NEW) qua NoShowBookingProcessor.
     */
    @Scheduled(fixedRate = 60000)
    public void cleanupNoShowBookings() {
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(30);
        log.info("[CleanupTask] cleanupNoShowBookings chạy. Cutoff: {}", cutoff);

        List<Booking> noShowBookings = bookingRepository.findNoShowBookings(BookingStatus.CONFIRMED, cutoff);
        log.info("[CleanupTask] Query NoShow trả về {} đơn.", noShowBookings.size());

        if (noShowBookings.isEmpty()) return;

        log.info("Phát hiện {} đơn hàng thợ No-Show. Đang xử lý...", noShowBookings.size());

        for (Booking booking : noShowBookings) {
            try {
                noShowBookingProcessor.process(booking);
            } catch (Exception e) {
                log.error("[NoShow] Lỗi xử lý đơn #{}: {}", booking.getId(), e.getMessage(), e);
            }
        }

        log.info("Đã xử lý xong {} đơn No-Show.", noShowBookings.size());
    }
}

