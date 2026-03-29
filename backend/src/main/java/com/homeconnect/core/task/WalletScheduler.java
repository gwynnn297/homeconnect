package com.homeconnect.core.task;

import com.homeconnect.core.entity.Booking;
import com.homeconnect.core.enums.BookingStatus;
import com.homeconnect.core.enums.PaymentStatus;
import com.homeconnect.core.repository.BookingRepository;
import com.homeconnect.core.service.NotificationService;
import com.homeconnect.core.service.WalletService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * [BE-Wallet-03] Auto Salary Release Cronjob
 * 
 * Chạy mỗi phút, quét tìm các Booking đã COMPLETED 
 * mà thời gian Check-out (scheduledEndTime) đã qua 2 tiếng.
 * 
 * Logic:
 * 1. Tìm booking: status=COMPLETED, paymentStatus=HOLDING, 
 *    scheduledEndTime < (now - 2h)
 * 2. Với mỗi booking:
 *    a. Tính commission = totalPrice * commissionRate
 *    b. Trừ hold_balance ví Khách (totalPrice)
 *    c. Cộng available_balance ví Helper (totalPrice - commission) 
 *    d. Cập nhật paymentStatus = RELEASED
 *    e. Push Notification báo nhận lương cho Helper
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WalletScheduler {

    private final BookingRepository bookingRepository;
    private final WalletService walletService;
    private final NotificationService notificationService;

    @Value("${wallet.salary.release.delay.hours:2}")
    private int releaseDelayHours;

    /**
     * Cronjob chạy mỗi phút (0 * * * * *).
     * Quét các booking COMPLETED đã qua releaseDelayHours tiếng check-out -> release salary.
     */
    @Scheduled(cron = "0 * * * * *")
    public void autoReleaseSalary() {
        LocalDateTime cutoff = LocalDateTime.now().minusHours(releaseDelayHours);

        List<Booking> eligibleBookings = bookingRepository.findCompletedBookingsReadyForRelease(
                BookingStatus.COMPLETED,
                PaymentStatus.HOLDING,
                cutoff);

        if (eligibleBookings.isEmpty()) {
            return;
        }

        log.info("[WalletScheduler] Tìm thấy {} booking cần release salary.", eligibleBookings.size());

        int successCount = 0;
        int failCount = 0;

        for (Booking booking : eligibleBookings) {
            try {
                // 1. Release salary (tính commission, trừ hold, cộng available)
                BigDecimal helperSalary = walletService.releaseSalary(booking);

                // 2. Cập nhật paymentStatus -> RELEASED
                booking.setPaymentStatus(PaymentStatus.RELEASED);
                bookingRepository.save(booking);

                // 3. Push Notification cho Helper
                String helperName = booking.getHelper().getFullName();
                String serviceName = booking.getService() != null 
                        ? booking.getService().getName() : "Dịch vụ";

                notificationService.createNotification(
                        booking.getHelper().getId(),
                        " Bạn đã nhận được lương!",
                        String.format("Bạn nhận được %s VNĐ từ đơn hàng #%d (%s). " +
                                "Số tiền đã được cộng vào ví khả dụng.",
                                helperSalary.toPlainString(), booking.getId(), serviceName),
                        "SALARY_RELEASED"
                );

                successCount++;
                log.info("[WalletScheduler] Release thành công Booking #{}: {} VNĐ cho Helper {} ({})",
                        booking.getId(), helperSalary, booking.getHelper().getId(), helperName);

            } catch (Exception e) {
                failCount++;
                log.error("[WalletScheduler] Lỗi release Booking #{}: {}", 
                        booking.getId(), e.getMessage(), e);
            }
        }

        log.info("[WalletScheduler] Hoàn tất: {} thành công, {} thất bại / {} tổng.",
                successCount, failCount, eligibleBookings.size());
    }
}
