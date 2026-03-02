package com.homeconnect.core.entity;

import com.homeconnect.core.enums.UserRole;
import com.homeconnect.core.enums.UserStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Entity User - Bảng users
 * Quản lý thông tin người dùng (Customer, Helper, Admin)
 */
@Entity
@Table(name = "users", indexes = {
        @Index(name = "idx_phone", columnList = "phone"),
        @Index(name = "idx_email", columnList = "email"),
        @Index(name = "idx_role", columnList = "role"),
        @Index(name = "idx_status", columnList = "status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "full_name", nullable = false, length = 100)
    private String fullName; // Họ và tên đầy đủ

    @Column(name = "phone", nullable = false, unique = true, length = 15)
    private String phone; // Số điện thoại

    @Column(name = "email", nullable = false, unique = true, length = 100)
    private String email; // Email đăng ký

    @Column(name = "password_hash", nullable = false)
    private String passwordHash; // Mật khẩu đã mã hóa

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 20)
    private UserRole role; // Vai trò: CUSTOMER, HELPER, ADMIN

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 20)
    private UserStatus status = UserStatus.PENDING_OTP; // Trạng thái tài khoản

    @Column(name = "gender", length = 20)
    private String gender; // MALE, FEMALE, OTHER

    @Column(name = "date_of_birth")
    private java.time.LocalDate dateOfBirth; // Ngày sinh (Chuyển từ HelperProfile sang)

    @Column(name = "avatar_url", columnDefinition = "TEXT")
    private String avatarUrl; // Đường dẫn ảnh đại diện

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt; // Thời gian tạo

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt; // Thời gian cập nhật cuối
}
