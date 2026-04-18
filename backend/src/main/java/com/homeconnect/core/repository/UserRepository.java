package com.homeconnect.core.repository;

import com.homeconnect.core.entity.User;
import com.homeconnect.core.enums.UserRole;
import com.homeconnect.core.enums.UserStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long>, JpaSpecificationExecutor<User> {
    Optional<User> findByEmail(String email);

    Optional<User> findByPhone(String phone);


    Optional<User> findByEmailOrPhone(String email, String phone);

    // Admin: đếm số lượng user theo role
    long countByRole(UserRole role);

    // Admin: đếm số lượng user theo status
    long countByStatus(UserStatus status);

    // Admin: Lấy danh sách user theo role với pagination
    List<User> findByRole(UserRole role);

    /** Đếm admin đang hoạt động — dùng khi khóa tài khoản ADMIN. */
    long countByRoleAndStatus(UserRole role, UserStatus status);
}
