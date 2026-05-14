package com.homeconnect.core.task;

import com.homeconnect.core.entity.Booking;
import com.homeconnect.core.entity.HelperSchedule;
import com.homeconnect.core.enums.BookingStatus;
import com.homeconnect.core.enums.ScheduleStatus;
import com.homeconnect.core.repository.BookingRepository;
import com.homeconnect.core.repository.HelperScheduleRepository;
import com.homeconnect.core.service.NotificationService;
import com.homeconnect.core.service.WalletService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Xử lý từng đơn vắng mặt trong transaction độc lập.
 * Tách thành bean riêng để tránh Spring AOP self-invocation bug.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NoShowBookingProcessor {

    private final BookingRepository bookingRepository;
    private final HelperScheduleRepository helperScheduleRepository;
    private final WalletService walletService;
    private final NotificationService notificationService;

    /**
     * REQUIRES_NEW: mỗi booking có transaction độc lập.
     * 1 booking lỗi không ảnh hưởng booking khác.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void process(Booking booking) {
        log.info("[NoShow] Xử lý đơn #{}. Khách: {}, Thợ: {}",
                booking.getId(), booking.getCustomer().getId(), booking.getHelper().getId());

        // 1. Cập nhật trạng thái → EXPIRED
        booking.setStatus(BookingStatus.EXPIRED);
        booking.setCancelSource("SYSTEM");
        booking.setCancelReason("Thợ vắng mặt: thợ không đến sau 30 phút");
        booking.setCancelledAt(LocalDateTime.now());
        booking.setNoShowActor("HELPER");
        bookingRepository.save(booking);
        log.info("[NoShow] Đã lưu trạng thái EXPIRED cho đơn #{}", booking.getId());

        // 2. Giải phóng lịch thợ
        try {
            List<HelperSchedule> schedules = helperScheduleRepository.findByBooking(booking);
            for (HelperSchedule schedule : schedules) {
                schedule.setStatus(ScheduleStatus.AVAILABLE);
                schedule.setBooking(null);
                helperScheduleRepository.save(schedule);
            }
        } catch (Exception e) {
            log.error("[NoShow] Lỗi giải phóng lịch đơn #{}: {}", booking.getId(), e.getMessage());
        }

        // 3. Hoàn tiền hold (không để lỗi ở đây block việc lưu status)
        try {
            if (booking.getPaymentStatus() == com.homeconnect.core.enums.PaymentStatus.HOLDING) {
                walletService.refundHold(
                        booking.getCustomer().getId(),
                        booking.getTotalPrice(),
                        booking.getId(),
                        "Thợ vắng mặt: hoàn tiền hold");
            }
        } catch (Exception e) {
            log.error("[NoShow] Lỗi hoàn tiền đơn #{}: {}", booking.getId(), e.getMessage());
        }

        // 4. Thông báo
        try {
            notificationService.createNotification(
                    booking.getCustomer().getId(),
                    "Thợ không đến đúng hẹn",
                    String.format("Đơn #%d đã bị hủy do thợ không đến đúng hẹn. Tiền giữ chỗ đã được hoàn lại 100%% vào ví của bạn.", booking.getId()),
                    "BOOKING_NO_SHOW");

            notificationService.createNotification(
                    booking.getHelper().getId(),
                    "Bạn đã lỡ hẹn công việc",
                    String.format("Đơn #%d đã bị hệ thống hủy do bạn không xác nhận có mặt sau 30 phút quá giờ bắt đầu.", booking.getId()),
                    "BOOKING_NO_SHOW");
        } catch (Exception e) {
            log.error("[NoShow] Lỗi gửi thông báo đơn #{}: {}", booking.getId(), e.getMessage());
        }

        log.info("[NoShow] Xử lý xong đơn #{}", booking.getId());
    }
}
