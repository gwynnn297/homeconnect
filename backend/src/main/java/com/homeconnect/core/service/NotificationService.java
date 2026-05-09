package com.homeconnect.core.service;

import com.homeconnect.core.socket.SocketIOService;
import com.homeconnect.core.dto.response.NotificationResponse;
import com.homeconnect.core.dto.response.NotificationPageResponse;
import com.homeconnect.core.entity.JobPost;
import com.homeconnect.core.entity.Notification;
import com.homeconnect.core.repository.NotificationRepository;
import com.homeconnect.core.exception.ApiException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.http.HttpStatus;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Service quản lý thông báo cho người dùng.
 * Bao gồm:
 * - Lấy danh sách thông báo gần nhất
 * - Đăng ký nhận thông báo realtime qua SSE
 * - Tạo thông báo matching và push realtime cho thợ
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {

    private static final int MAX_NOTIFICATION_TYPE_LENGTH = 20;
    private final NotificationRepository notificationRepository;
    private final SocketIOService socketIOService;
    @Value("${app.notification.sse.enabled:false}")
    private boolean sseEnabled;

    // Danh sách kết nối SSE theo từng userId (1 user có thể mở nhiều tab)
    private final Map<Long, CopyOnWriteArrayList<SseEmitter>> emittersByUserId = new ConcurrentHashMap<>();

    /**
     * Lấy danh sách thông báo mới nhất của user.
     * Giới hạn limit trong khoảng [1..100] để tránh query quá nặng.
     */
    @Transactional(readOnly = true)
    public NotificationPageResponse getNotifications(Long userId, String type, int page, int limit) {
        int boundedLimit = Math.min(Math.max(limit, 1), 100);
        int safePage = Math.max(page, 1);
        Pageable pageable = PageRequest.of(safePage - 1, boundedLimit);

        var notificationsPage = (type == null || type.isBlank())
                ? notificationRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable)
                : notificationRepository.findByUserIdAndTypeOrderByCreatedAtDesc(userId, type.trim().toUpperCase(), pageable);

        return NotificationPageResponse.builder()
                .data(notificationsPage.getContent().stream().map(this::toResponse).toList())
                .totalRecords(notificationsPage.getTotalElements())
                .totalPages(notificationsPage.getTotalPages())
                .currentPage(safePage)
                .build();
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
     * Tạo thông báo MATCHING khi thợ được mời vào job,
     * sau đó đẩy ngay notification realtime nếu thợ đang online trên web.
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
        
        // CHỈ đẩy realtime sau khi transaction đã commit thành công 
        // để tránh thông báo trùng lặp khi transaction bị rollback/retry
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    try {
                        pushRealtime(helperId, response);
                    } catch (Exception e) {
                        // Tuyệt đối không để exception realtime làm fail luồng nghiệp vụ chính
                        log.warn("Skip realtime push afterCommit for helper {}: {}", helperId, e.getMessage());
                    }
                }
            });
        } else {
            pushRealtime(helperId, response);
        }
        
        return response;
    }

    /**
     * Tạo thông báo chung và đẩy realtime.
     */
    @Transactional
    public NotificationResponse createNotification(Long userId, String title, String content, String type) {
        String safeType = normalizeType(type);
        Notification notification = Notification.builder()
                .userId(userId)
                .title(title)
                .content(content)
                .type(safeType)
                .isRead(false)
                .build();

        Notification saved = notificationRepository.save(notification);
        NotificationResponse response = toResponse(saved);

        // CHỈ đẩy realtime sau khi transaction đã commit thành công
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    try {
                        pushRealtime(userId, response);
                    } catch (Exception e) {
                        // Tuyệt đối không để exception realtime làm fail luồng nghiệp vụ chính
                        log.warn("Skip realtime push afterCommit for user {}: {}", userId, e.getMessage());
                    }
                }
            });
        } else {
            pushRealtime(userId, response);
        }

        return response;
    }

    private String normalizeType(String rawType) {
        if (rawType == null || rawType.isBlank()) {
            return "SYSTEM";
        }
        String compactType = rawType.trim().replace(' ', '_');
        if (compactType.length() <= MAX_NOTIFICATION_TYPE_LENGTH) {
            return compactType;
        }
        String shortened = compactType.substring(0, MAX_NOTIFICATION_TYPE_LENGTH);
        log.warn("Notification type '{}' vượt quá {} ký tự, tự rút gọn còn '{}'",
                compactType, MAX_NOTIFICATION_TYPE_LENGTH, shortened);
        return shortened;
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
        try {
            // 1. Gửi qua Socket.IO (Room user_ID)
            socketIOService.sendMessage(userId.toString(), "new_notification", toSocketPayload(payload));
        } catch (Exception e) {
            log.warn("Socket push failed for user {}: {}", userId, e.getMessage());
        }

        // 2. Gửi qua SSE (tùy chọn - mặc định tắt để tránh spam IOException khi client ngắt stream)
        if (!sseEnabled) {
            return;
        }

        // Duy trì cho backward compatibility khi bật app.notification.sse.enabled=true
        List<SseEmitter> emitters = emittersByUserId.get(userId);
        if (emitters == null || emitters.isEmpty()) {
            return;
        }

        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name("notification").data(payload));
            } catch (IOException e) {
                // Lỗi này thường xảy ra khi người dùng tắt tab hoặc mạng ngắt
                // Ta chỉ cần log nhẹ nhàng và gỡ emitter đó đi
                log.debug("SSE connection for user {} aborted: {}", userId, e.getMessage());
                removeEmitter(userId, emitter);
                try {
                    emitter.complete();
                } catch (Exception ignored) {
                    // ignore
                }
            } catch (Exception e) {
                log.warn("Error sending SSE for user {}: {}", userId, e.getMessage());
                removeEmitter(userId, emitter);
                try {
                    emitter.completeWithError(e);
                } catch (Exception ignored) {
                    // ignore
                }
            }
        }
    }

    // Payload cho netty-socketio phải tránh Java time object trực tiếp
    // vì mapper mặc định của thư viện không hỗ trợ LocalDateTime.
    private Map<String, Object> toSocketPayload(NotificationResponse payload) {
        Map<String, Object> data = new HashMap<>();
        data.put("notificationId", payload.getNotificationId());
        data.put("title", payload.getTitle());
        data.put("content", payload.getContent());
        data.put("type", payload.getType());
        data.put("isRead", payload.getIsRead());
        data.put("createdAt", payload.getCreatedAt() != null ? payload.getCreatedAt().toString() : null);
        return data;
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