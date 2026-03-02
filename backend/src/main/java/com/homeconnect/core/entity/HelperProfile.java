package com.homeconnect.core.entity;

import com.homeconnect.core.enums.KycStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Entity HelperProfile - Bảng helper_profiles
 * Hồ sơ bổ sung cho User có role = HELPER
 */
@Entity
@Table(name = "helper_profiles", indexes = {
    @Index(name = "idx_user_id", columnList = "user_id"),
    @Index(name = "idx_kyc_status", columnList = "kyc_status"),
    @Index(name = "idx_identity_number", columnList = "identity_number")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HelperProfile {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "profile_id")
    private Integer profileId;
    
    @OneToOne
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;  // Liên kết 1-1 với User
    
    @Column(name = "bio", columnDefinition = "TEXT", nullable = false)
    private String bio;  // Giới thiệu bản thân
    
    @Column(name = "experience_years", nullable = false)
    private Integer experienceYears;  // Số năm kinh nghiệm
    
    @ManyToOne
    @JoinColumn(name = "hometown_id", nullable = false)
    private Location hometown;  // Quê quán

    @Column(name = "identity_number", unique = true, length = 20)
    private String identityNumber;  // Số CMND/CCCD
    
    @Column(name = "identity_front_url", columnDefinition = "TEXT")
    private String identityFrontUrl;  // Ảnh mặt trước CMND
    
    @Column(name = "identity_back_url", columnDefinition = "TEXT")
    private String identityBackUrl;  // Ảnh mặt sau CMND
    
    @Column(name = "selfie_url", columnDefinition = "TEXT")
    private String selfieUrl;  // Ảnh selfie
    
    @Enumerated(EnumType.STRING)
    @Column(name = "kyc_status", length = 20)
    @Builder.Default
    private KycStatus kycStatus = KycStatus.PENDING;  // Trạng thái KYC

    @Column(name = "is_online")
    private Boolean isOnline; // Công tắc nhận việc (V7)

    @Column(name = "rating_average")
    private java.math.BigDecimal ratingAverage; // Đánh giá trung bình (V7)

    @Column(name = "total_reviews")
    private Integer totalReviews; // Tổng số lượt đánh giá (V7)
    
    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;  // Lý do từ chối KYC (nếu bị từ chối)
    
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;  // Thời gian cập nhật cuối
}
