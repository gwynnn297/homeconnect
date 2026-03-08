package com.homeconnect.core.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Entity Wallet - Bảng wallets
 * Quản lý ví tiền của người dùng
 */
@Entity
@Table(name = "wallets", indexes = {
        @Index(name = "idx_user_id", columnList = "user_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Wallet {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "wallet_id")
    private Integer walletId;

    @OneToOne
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user; // Liên kết 1-1 với User

    @Builder.Default
    @Column(name = "available_balance", precision = 15, scale = 2)
    private BigDecimal availableBalance = BigDecimal.ZERO; // Số dư khả dụng

    @Builder.Default
    @Column(name = "hold_balance", precision = 15, scale = 2)
    private BigDecimal holdBalance = BigDecimal.ZERO; // Số tiền đang bị giữ

    @Builder.Default
    @Column(name = "debt_balance", precision = 15, scale = 2)
    private BigDecimal debtBalance = BigDecimal.ZERO; // Số tiền nợ sàn

    @Builder.Default
    @Column(name = "is_frozen")
    private Boolean isFrozen = false; // Ví có bị đóng băng không

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt; // Thời gian cập nhật cuối
}
