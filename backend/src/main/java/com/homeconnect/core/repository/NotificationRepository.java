package com.homeconnect.core.repository;

import com.homeconnect.core.entity.Notification;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);

    Optional<Notification> findByNotificationIdAndUserId(Long notificationId, Long userId);

    List<Notification> findByUserIdAndIsReadFalse(Long userId);

    boolean existsByUserIdAndTypeAndContentContainingAndCreatedAtAfter(
            Long userId,
            String type,
            String content,
            LocalDateTime createdAt);
}
