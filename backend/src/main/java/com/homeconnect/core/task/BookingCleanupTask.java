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

    /**
     * Tự động hủy các đơn đặt trực tiếp quá 10 phút chưa phản hồi
     * Chạy mỗi phút 1 lần.
     */
    @Scheduled(fixedRate = 60000)
    @Transactional
    public void cleanupExpiredBookings() {
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(15);
        
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
     * Tự động hủy các đơn hàng đã chốt (CONFIRMED) mà thợ không đến (No-Show)
     * Thư giãn 30 phút sau giờ bắt đầu dự kiến nếu vẫn chưa ARRIVED/IN_PROGRESS.
     */
    @Scheduled(fixedRate = 60000) // 1 phút quét 1 lần
    @Transactional
    public void cleanupNoShowBookings() {
        // Cutoff: 30 phút sau giờ bắt đầu dự kiến
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(30);

        List<Booking> noShowBookings = bookingRepository.findByStatusAndScheduledStartTimeBefore(
                BookingStatus.CONFIRMED, cutoff);

        if (noShowBookings.isEmpty()) {
            return;
        }

        log.info("Phát hiện {} đơn hàng thợ không đến (No-Show). Đang tiến hành xử lý...", noShowBookings.size());

        for (Booking booking : noShowBookings) {
            log.info("Xử lý No-Show đơn hàng ID: {}. Khách: {}, Thợ: {}",
                    booking.getId(), booking.getCustomer().getId(), booking.getHelper().getId());

            booking.setStatus(BookingStatus.EXPIRED);
            booking.setCancelSource("SYSTEM");
            booking.setCancelReason("Hết hạn 30 phút: thợ không xác nhận địa điểm (No-Show)");
            booking.setCancelledAt(LocalDateTime.now());
            booking.setTimeoutAt(LocalDateTime.now());

            // Giải phóng lịch thợ
            List<HelperSchedule> schedules = helperScheduleRepository.findByBooking(booking);
            for (HelperSchedule schedule : schedules) {
                schedule.setStatus(ScheduleStatus.AVAILABLE);
                schedule.setBooking(null);
                helperScheduleRepository.save(schedule);
            }

            bookingRepository.save(booking);

            // Hoàn tiền Hold 100% nếu có
            if (booking.getPaymentStatus() == com.homeconnect.core.enums.PaymentStatus.HOLDING) {
                walletService.refundHold(
                        booking.getCustomer().getId(),
                        booking.getTotalPrice(),
                        booking.getId(),
                        "Thợ không đến đúng hẹn: Hệ thống tự động hoàn tiền");
            }

            // Thông báo
            String msgCustomer = String.format("Đơn hàng #%d đã bị hủy do thợ chưa thể đến địa điểm làm việc đúng hẹn. Hệ thống đã hoàn trả 100%% tiền giữ chỗ vào ví của bạn.", booking.getId());
            notificationService.createNotification(booking.getCustomer().getId(), "Thợ không đến đúng hẹn", msgCustomer, "BOOKING_NO_SHOW");

            String msgHelper = String.format("Đơn hàng #%d đã bị hệ thống hủy do bạn chưa xác nhận có mặt tại địa điểm sau 30 phút quá giờ bắt đầu.", booking.getId());
            notificationService.createNotification(booking.getHelper().getId(), "Bạn đã lỡ hẹn công việc", msgHelper, "BOOKING_NO_SHOW");
        }
        
        log.info("Đã xử lý xong {} đơn hàng No-Show.", noShowBookings.size());
    }
}
