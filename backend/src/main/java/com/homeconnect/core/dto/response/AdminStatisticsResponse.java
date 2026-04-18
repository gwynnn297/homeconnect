package com.homeconnect.core.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.Map;

/**
 * Response DTO cho Admin Statistics Dashboard & Báo cáo
 * GET /api/v1/admin/statistics
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminStatisticsResponse {

    private UserStats userStats;
    private HelperStats helperStats;
    private SystemStats systemStats;

    /** Booking: phân bổ trạng thái đơn, thanh toán, cờ bất thường */
    private BookingSnapshot booking;

    /** Tin đăng chợ việc theo trạng thái */
    private JobPostSnapshot jobPost;

    /** Ứng tuyển đang chờ (toàn hệ thống) */
    private MarketplaceSnapshot marketplace;

    /** Ví tổng hợp + yêu cầu rút tiền */
    private FinanceSnapshot finance;

    private String message;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserStats {
        private long totalUsers;
        private long totalCustomers;
        private long totalHelpers;
        private long totalAdmins;
        private long activeUsers;
        private long blockedUsers;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class HelperStats {
        private long totalHelpers;
        private long pendingKyc;
        private long waitingApproval;
        private long verifiedHelpers;
        private long rejectedHelpers;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SystemStats {
        /** Dịch vụ con (services) */
        private long totalServices;
        /** Danh mục cha (service_categories) */
        private long totalCategories;
        /** Địa chỉ đã lưu (addresses) */
        private long totalAddresses;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BookingSnapshot {
        private long totalBookings;
        private long flaggedBookings;
        /** key = tên enum BookingStatus */
        private Map<String, Long> countByStatus;
        /** key = tên enum PaymentStatus */
        private Map<String, Long> countByPaymentStatus;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class JobPostSnapshot {
        private long totalPosts;
        /** key = PUBLISHED, ASSIGNED, ... */
        private Map<String, Long> countByStatus;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MarketplaceSnapshot {
        /** Ứng tuyển status = PENDING (chờ khách chọn / chờ xử lý) */
        private long pendingJobApplications;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FinanceSnapshot {
        private long totalWallets;
        private BigDecimal sumAvailableBalance;
        private BigDecimal sumHoldBalance;
        private BigDecimal sumDebtBalance;
        /** key = PENDING, PROCESSING, COMPLETED, REJECTED */
        private Map<String, Long> withdrawCountByStatus;
    }
}
