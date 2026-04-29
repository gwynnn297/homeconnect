package com.homeconnect.core.service;

import com.homeconnect.core.entity.Booking;
import com.homeconnect.core.entity.User;
import com.homeconnect.core.enums.BookingStatus;
import com.homeconnect.core.enums.CustomerTier;
import com.homeconnect.core.repository.BookingRepository;
import com.homeconnect.core.repository.UserRepository;
import lombok.Builder;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;

@Service
@RequiredArgsConstructor
@Slf4j
public class LoyaltyService {

    private static final BigDecimal SILVER_DISCOUNT = new BigDecimal("0.05");
    private static final BigDecimal GOLD_DISCOUNT = new BigDecimal("0.10");

    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private static final ZoneId LOYALTY_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    public CustomerTier resolveTierByCompletedCount(int count) {
        if (count >= 6) return CustomerTier.GOLD;
        if (count >= 3) return CustomerTier.SILVER;
        return CustomerTier.BRONZE;
    }

    public BigDecimal resolveDiscountRate(CustomerTier tier) {
        if (tier == CustomerTier.GOLD) return GOLD_DISCOUNT;
        if (tier == CustomerTier.SILVER) return SILVER_DISCOUNT;
        return BigDecimal.ZERO;
    }

    public BigDecimal calculateDiscountAmount(BigDecimal originalPrice, CustomerTier tier) {
        BigDecimal price = originalPrice == null ? BigDecimal.ZERO : originalPrice;
        return price.multiply(resolveDiscountRate(tier)).setScale(2, RoundingMode.HALF_UP);
    }

    public String buildProgressMessage(int completedCount) {
        LoyaltySummary summary = buildSummary(completedCount);
        if (summary.getOrdersToNextTier() == 0) {
            return "Bạn đã đạt hạng Vàng (VIP) trong tháng này với ưu đãi giảm 10% cho mỗi đơn mới.";
        }
        return String.format("Bạn đã đặt %d đơn trong tháng này, còn %d đơn nữa để lên Hạng %s (Giảm %s)!",
                completedCount,
                summary.getOrdersToNextTier(),
                summary.getNextTierLabel(),
                summary.getNextTierDiscountLabel());
    }

    public LoyaltySummary buildSummary(User user) {
        return buildSummaryForCustomer(user.getId());
    }

    public LoyaltySummary buildSummaryForCustomer(Long customerId) {
        int completed = (int) getMonthlyCompletedCount(customerId);
        return buildSummary(completed);
    }

    public long getMonthlyCompletedCount(Long customerId) {
        LocalDate now = LocalDate.now(LOYALTY_ZONE);
        LocalDateTime from = now.withDayOfMonth(1).atStartOfDay();
        LocalDateTime to = now.plusMonths(1).withDayOfMonth(1).atStartOfDay();
        return bookingRepository.countCompletedByCustomerInRange(
                customerId,
                BookingStatus.COMPLETED,
                from,
                to
        );
    }

    public LoyaltySummary buildSummary(int completedCount) {
        CustomerTier currentTier = resolveTierByCompletedCount(completedCount);
        BigDecimal currentDiscountRate = resolveDiscountRate(currentTier);

        CustomerTier nextTier = null;
        int ordersToNext = 0;
        int progressPercent = 100;

        if (completedCount < 3) {
            nextTier = CustomerTier.SILVER;
            ordersToNext = 3 - completedCount;
            progressPercent = Math.min(100, Math.max(0, (int) Math.round((completedCount / 3.0) * 100)));
        } else if (completedCount < 6) {
            nextTier = CustomerTier.GOLD;
            ordersToNext = 6 - completedCount;
            progressPercent = Math.min(100, Math.max(0, (int) Math.round(((completedCount - 3) / 3.0) * 100)));
        }

        String nextTierDiscountLabel = nextTier == CustomerTier.GOLD ? "10%" : "5%";
        return LoyaltySummary.builder()
                .completedBookingCount(completedCount)
                .currentTier(currentTier)
                .currentDiscountRate(currentDiscountRate)
                .nextTier(nextTier)
                .ordersToNextTier(ordersToNext)
                .progressPercent(progressPercent)
                .nextTierLabel(nextTier == null ? null : toDisplayLabel(nextTier))
                .nextTierDiscountLabel(nextTier == null ? null : nextTierDiscountLabel)
                .progressMessage(buildProgressMessageFromSummary(completedCount, ordersToNext, nextTier, nextTierDiscountLabel))
                .build();
    }

    private String buildProgressMessageFromSummary(int completedCount, int ordersToNext, CustomerTier nextTier, String nextTierDiscountLabel) {
        if (nextTier == null) {
            return "Bạn đã đạt hạng Vàng (VIP) trong tháng này với ưu đãi giảm 10% cho mỗi đơn mới.";
        }
        return String.format("Bạn đã đặt %d đơn trong tháng này, còn %d đơn nữa để lên Hạng %s (Giảm %s)!",
                completedCount, ordersToNext, toDisplayLabel(nextTier), nextTierDiscountLabel);
    }

    @Transactional
    public void onBookingCompleted(Long bookingId) {
        Booking booking = bookingRepository.findByIdForUpdate(bookingId)
                .orElseThrow(() -> new RuntimeException("Khong tim thay booking: " + bookingId));

        if (booking.getStatus() != BookingStatus.COMPLETED) {
            return;
        }
        if (Boolean.TRUE.equals(booking.getLoyaltyProcessed())) {
            return;
        }

        Long customerId = booking.getCustomer().getId();
        User customer = userRepository.findById(customerId)
                .orElseThrow(() -> new RuntimeException("Khong tim thay customer"));

        booking.setLoyaltyProcessed(true);
        bookingRepository.save(booking);

        int afterCount = (int) getMonthlyCompletedCount(customerId);
        int beforeCount = Math.max(0, afterCount - 1);
        CustomerTier beforeTier = resolveTierByCompletedCount(beforeCount);
        CustomerTier afterTier = resolveTierByCompletedCount(afterCount);

        if (afterTier != beforeTier) {
            String tierLabel = toDisplayLabel(afterTier);
            String discountLabel = resolveDiscountRate(afterTier).multiply(BigDecimal.valueOf(100))
                    .setScale(0, RoundingMode.HALF_UP) + "%";
            notificationService.createNotification(
                    customer.getId(),
                    "Chúc mừng bạn đã thăng hạng!",
                    String.format("Bạn đã đạt hạng %s trong tháng này. Ưu đãi mới: giảm %s cho các đơn tiếp theo.", tierLabel, discountLabel),
                    "LOYALTY_TIER_UP"
            );
        }

        log.info("[Loyalty] Booking #{} processed. Customer #{} count {} -> {}, tier {} -> {}",
                bookingId, customer.getId(), beforeCount, afterCount, beforeTier, afterTier);
    }

    public String toDisplayLabel(CustomerTier tier) {
        return switch (tier) {
            case BRONZE -> "Thành viên";
            case SILVER -> "Bạc";
            case GOLD -> "Vàng";
        };
    }

    @Getter
    @Builder
    public static class LoyaltySummary {
        private Integer completedBookingCount;
        private CustomerTier currentTier;
        private BigDecimal currentDiscountRate;
        private CustomerTier nextTier;
        private Integer ordersToNextTier;
        private Integer progressPercent;
        private String nextTierLabel;
        private String nextTierDiscountLabel;
        private String progressMessage;
    }
}
