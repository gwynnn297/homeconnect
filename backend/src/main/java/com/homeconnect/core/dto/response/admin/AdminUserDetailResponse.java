package com.homeconnect.core.dto.response.admin;

import com.homeconnect.core.enums.KycStatus;
import com.homeconnect.core.enums.UserRole;
import com.homeconnect.core.enums.UserStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminUserDetailResponse {

    private Long userId;
    private String fullName;
    private String email;
    private String phone;
    private UserRole role;
    private UserStatus status;
    private String gender;
    private LocalDate dateOfBirth;
    private String avatarUrl;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    /** Địa chỉ mặc định (nếu có). */
    private AddressSummary defaultAddress;

    /** Ví (mọi user đăng ký thường có 1 ví). */
    private WalletSummary wallet;

    /** Số liệu hoạt động trên sàn. */
    private ActivityStats activity;

    /** Chỉ có khi role = HELPER và đã có hồ sơ helper. */
    private HelperSummary helperSummary;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AddressSummary {
        private String addressDetail;
        private String provinceName;
        private String districtName;
        private String wardName;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WalletSummary {
        private Integer walletId;
        private BigDecimal availableBalance;
        private BigDecimal holdBalance;
        private BigDecimal debtBalance;
        private Boolean isFrozen;
        /** Tổng thu nhập (giao dịch RELEASE), chủ yếu có ý nghĩa với Helper. */
        private BigDecimal totalEarnings;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ActivityStats {
        private long bookingsAsCustomer;
        private long bookingsAsHelper;
        private long jobPostsCreated;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class HelperSummary {
        private Integer profileId;
        private KycStatus kycStatus;
        private String rejectionReason;
        private Boolean isOnline;
        private BigDecimal ratingAverage;
        private Integer totalReviews;
    }
}
