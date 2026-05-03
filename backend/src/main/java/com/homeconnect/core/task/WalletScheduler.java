package com.homeconnect.core.task;

import com.homeconnect.core.entity.Booking;
import com.homeconnect.core.entity.WithdrawRequest;
import com.homeconnect.core.enums.BookingStatus;
import com.homeconnect.core.enums.PaymentStatus;
import com.homeconnect.core.repository.BookingRepository;
import com.homeconnect.core.repository.WithdrawRequestRepository;
import com.homeconnect.core.service.NotificationService;
import com.homeconnect.core.service.LoyaltyService;
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
 *    c. Cộng available_balance ví thợ (totalPrice - commission) 
 *    d. Cập nhật paymentStatus = RELEASED
 *    e. Push Notification báo nhận lương cho thợ
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class WalletScheduler {

    private final BookingRepository bookingRepository;
    private final WalletService walletService;
    private final LoyaltyService loyaltyService;
    private final NotificationService notificationService;
    private final WithdrawRequestRepository withdrawRequestRepository;

    @Value("${wallet.salary.release.delay.hours:2}")
    private int releaseDelayHours;

    @Value("${wallet.withdraw.stale.minutes:5}")
    private int withdrawStaleMinutes;

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

                // 3. Push Notification cho thợ
                String helperName = booking.getHelper().getFullName();
                String categoryName = booking.getCategory() != null
                        ? booking.getCategory().getName() : "Dịch vụ";
                Long postId = booking.getJobPostId() != null ? booking.getJobPostId() : booking.getId();

                notificationService.createNotification(
                        booking.getHelper().getId(),
                        " Bạn đã nhận được lương!",
                        String.format("Job #%d: Bạn nhận được %s VNĐ từ dịch vụ %s. " +
                                "Số tiền đã được cộng vào ví khả dụng.",
                                postId, helperSalary.toPlainString(), categoryName),
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

    /**
     * [PB-14 Conflict 2] Auto-Finish Timer: Chạy mỗi giờ.
     * Nếu Khách im lặng 24h sau khi Thợ check-out -> Tự động COMPLETED.
     */
    @Scheduled(cron = "0 0 * * * *") // mỗi đầu giờ
    public void autoConfirmComplete() {
        LocalDateTime cutoff = LocalDateTime.now().minusHours(24);

        List<Booking> pendingBookings = bookingRepository.findByStatusAndCheckedOutAtBefore(
                BookingStatus.PENDING_COMPLETION, cutoff);

        if (pendingBookings.isEmpty()) return;

        log.info("[AutoConfirm] Tìm thấy {} booking PENDING_COMPLETION quá 24h, tự động COMPLETED.", pendingBookings.size());

        for (Booking booking : pendingBookings) {
            try {
                booking.setStatus(BookingStatus.COMPLETED);
                booking.setConfirmedDoneAt(LocalDateTime.now());
                

                bookingRepository.save(booking);
                loyaltyService.onBookingCompleted(booking.getId());

                notificationService.createNotification(booking.getCustomer().getId(),
                "Đơn hàng đã tự động hoàn thành",
                "Vì bạn không phản hồi trong 24h, đơn hàng #" + booking.getId() + " đã được tự động hoàn thành.",
                "AUTO_COMPLETED");

        notificationService.createNotification(booking.getHelper().getId(),
                "Đơn hàng đã được duyệt tự động",
                "Khách im lặng 24h, đơn hàng #" + booking.getId() + " đã tự động COMPLETED. Lương sẽ sớm được giải ngân.",
                "AUTO_COMPLETED");


                log.info("[AutoConfirm] Booking #{} → COMPLETED (auto).", booking.getId());
            } catch (Exception e) {
                log.error("[AutoConfirm] Lỗi tự động hoàn thành Booking #{}: {}", booking.getId(), e.getMessage());
            }
        }
    }
    /**
     * [Auto-Refund] Tự động hoàn tiền nếu Admin đã duyệt nhưng chưa chuyển tiền sau N phút.
     * Chạy mỗi phút. Tìm các WithdrawRequest ở trạng thái PROCESSING quá thời gian cho phép.
     */
    @Scheduled(cron = "0 * * * * *")
    public void autoRefundStaleWithdrawals() {
        LocalDateTime threshold = LocalDateTime.now().minusMinutes(withdrawStaleMinutes);

        List<WithdrawRequest> staleRequests = withdrawRequestRepository.findStaleProcessingRequests(threshold);

        if (staleRequests.isEmpty()) return;

        log.warn("[AutoRefund] Tìm thấy {} đơn rút tiền bị treo (PROCESSING > {}p). Đang hoàn tiền...",
                staleRequests.size(), withdrawStaleMinutes);

        for (WithdrawRequest req : staleRequests) {
            try {
                walletService.rejectWithdraw(
                        req.getRequestId(),
                        String.format("Tự động hoàn tiền: Admin chưa chuyển khoản sau %d phút. Vui lòng thử lại.", withdrawStaleMinutes),
                        "SYSTEM"
                );
                log.info("[AutoRefund] Đã hoàn {} VNĐ cho yêu cầu rút #{} (User: {}).",
                        req.getAmount(), req.getRequestId(), req.getWallet().getUser().getId());
            } catch (Exception e) {
                log.error("[AutoRefund] Lỗi hoàn tiền đơn #{}: {}", req.getRequestId(), e.getMessage(), e);
            }
        }
    }
}
