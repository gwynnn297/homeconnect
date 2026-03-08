package com.homeconnect.core.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response DTO cho Admin Statistics Dashboard
 * Sử dụng cho GET /api/v1/admin/statistics
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminStatisticsResponse {

    // ========== USER STATISTICS ==========
    private UserStats userStats;

    // ========== HELPER STATISTICS ==========
    private HelperStats helperStats;

    // ========== SYSTEM STATISTICS ==========
    private SystemStats systemStats;

    private String message;

    // ========== NESTED CLASSES ==========

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
        private long pendingKyc; // PENDING
        private long waitingApproval; // WAITING_APPROVAL
        private long verifiedHelpers; // VERIFIED
        private long rejectedHelpers; // REJECTED
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SystemStats {
        private long totalServices;
        private long totalLocations;
        // Có thể thêm sau: totalBookings, totalRevenue, etc.
    }
}
