package com.homeconnect.core.service;

import com.homeconnect.core.dto.response.NotificationResponse;
import com.homeconnect.core.entity.JobPost;
import com.homeconnect.core.entity.Notification;
import com.homeconnect.core.repository.NotificationRepository;
import com.homeconnect.core.exception.ApiException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.http.HttpStatus;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Service quản lý thông báo cho người dùng.
 * Bao gồm:
 * - Lấy danh sách thông báo gần nhất
 * - Đăng ký nhận thông báo realtime qua SSE
 * - Tạo thông báo matching và push realtime cho helper
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;

    // Danh sách kết nối SSE theo từng userId (1 user có thể mở nhiều tab)
    private final Map<Long, CopyOnWriteArrayList<SseEmitter>> emittersByUserId = new ConcurrentHashMap<>();

    /**
     * Lấy danh sách thông báo mới nhất của user.
     * Giới hạn limit trong khoảng [1..100] để tránh query quá nặng.
     */
    @Transactional(readOnly = true)
    public List<NotificationResponse> getLatestNotifications(Long userId, int limit) {
        int boundedLimit = Math.min(Math.max(limit, 1), 100);
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId, PageRequest.of(0, boundedLimit))
                .stream()
                .map(this::toResponse)
                .toList();
    }

    /**
     * Đăng ký kênh SSE realtime cho user hiện tại.
     * - timeout = 0L: giữ kết nối lâu dài
     * - tự dọn emitter khi complete/timeout/error
     */
    public SseEmitter subscribe(Long userId) {
        SseEmitter emitter = new SseEmitter(0L);
        emittersByUserId.computeIfAbsent(userId, key -> new CopyOnWriteArrayList<>()).add(emitter);

        emitter.onCompletion(() -> removeEmitter(userId, emitter));
        emitter.onTimeout(() -> removeEmitter(userId, emitter));
        emitter.onError(ex -> removeEmitter(userId, emitter));

        try {
            emitter.send(SseEmitter.event()
                    .name("connected")
                    .data(Map.of("message", "Đã kết nối realtime notifications")));
        } catch (IOException e) {
            removeEmitter(userId, emitter);
        }
        return emitter;
    }

    /**
     * Tạo thông báo MATCHING khi helper được mời vào job,
     * sau đó đẩy ngay notification realtime nếu helper đang online trên web.
     */
@Transactional
    public NotificationResponse createMatchingNotification(Long helperId, Long postId, JobPost jobPost) {
        String location = jobPost.getAddress() != null ? 
                jobPost.getAddress().getWardName() + ", " + jobPost.getAddress().getDistrictName() : "N/A";

        Notification notification = Notification.builder()
                .userId(helperId)
                .title("Bạn có việc mới phù hợp")
                .content(String.format("Job #%d: %s - %s - %s lúc %s (%d giờ)",
                        postId,
                        jobPost.getTitle(),
                        location,
                        jobPost.getWorkDate(),
                        jobPost.getStartTime(),
                        jobPost.getDurationHours()))
                .type("MATCHING")
                .isRead(false)
                .build();

        Notification saved = notificationRepository.save(notification);
        NotificationResponse response = toResponse(saved);
        pushRealtime(helperId, response);
        return response;
    }

    /**
     * Tạo thông báo chung và đẩy realtime.
     */
    @Transactional
    public NotificationResponse createNotification(Long userId, String title, String content, String type) {
        Notification notification = Notification.builder()
                .userId(userId)
                .title(title)
                .content(content)
                .type(type)
                .isRead(false)
                .build();

        Notification saved = notificationRepository.save(notification);
        NotificationResponse response = toResponse(saved);
        pushRealtime(userId, response);
        return response;
    }

    /**
     * Đánh dấu 1 thông báo đã đọc (chỉ chủ sở hữu mới được update)
     */
    @Transactional
    public NotificationResponse markAsRead(Long userId, Long notificationId) {
        Notification notification = notificationRepository.findByNotificationIdAndUserId(notificationId, userId)
                .orElseThrow(() -> new ApiException("Không tìm thấy thông báo", HttpStatus.NOT_FOUND));

        if (Boolean.TRUE.equals(notification.getIsRead())) {
            return toResponse(notification);
        }

        notification.setIsRead(true);
        Notification saved = notificationRepository.save(notification);
        return toResponse(saved);
    }

    /**
     * Đánh dấu tất cả thông báo của user là đã đọc
     */
    @Transactional
    public int markAllAsRead(Long userId) {
        List<Notification> unread = notificationRepository.findByUserIdAndIsReadFalse(userId);
        if (unread.isEmpty()) return 0;
        unread.forEach(n -> n.setIsRead(true));
        notificationRepository.saveAll(unread);
        return unread.size();
    }

    /**
     * Gửi payload realtime đến toàn bộ SSE emitter của user.
     * Nếu emitter lỗi thì remove khỏi danh sách để tránh leak.
     */
private void pushRealtime(Long userId, NotificationResponse payload) {
        List<SseEmitter> emitters = emittersByUserId.get(userId);
        if (emitters == null || emitters.isEmpty()) {
            return;
        }

        emitters.forEach(emitter -> {
            try {
                emitter.send(SseEmitter.event().name("notification").data(payload));
            } catch (IOException e) {
                removeEmitter(userId, emitter);
            }
        });
    }

    // Gỡ emitter ra khỏi map khi kết nối đã đóng hoặc lỗi
    private void removeEmitter(Long userId, SseEmitter emitter) {
        CopyOnWriteArrayList<SseEmitter> emitters = emittersByUserId.get(userId);
        if (emitters == null) {
            return;
        }
        emitters.remove(emitter);
        if (emitters.isEmpty()) {
            emittersByUserId.remove(userId);
        }
    }

    // Mapping Entity -> Response DTO dùng chung cho API và realtime payload
    private NotificationResponse toResponse(Notification notification) {
        return NotificationResponse.builder()
                .notificationId(notification.getNotificationId())
                .title(notification.getTitle())
                .content(notification.getContent())
                .type(notification.getType())
                .isRead(notification.getIsRead())
                .createdAt(notification.getCreatedAt())
                .build();
    }
}