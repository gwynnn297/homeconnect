package com.homeconnect.core.task;

import com.homeconnect.core.service.JobService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * [BE-Task-02] Tác vụ định kỳ: Tự động hết hạn bài đăng công việc
 *
 * Chạy mỗi 10 phút để quét và chuyển trạng thái các bài đăng PUBLISHED
 * đã qua giờ bắt đầu công việc sang EXPIRED.
 *
 * Luồng xử lý cho mỗi bài đăng hết hạn:
 *   1. Trạng thái -> EXPIRED
 *   2. Hoàn tiền ký quỹ về ví khách hàng
 *   3. Hủy toàn bộ đơn ứng tuyển/lời mời PENDING
 *   4. Gửi thông báo cho khách hàng và thợ liên quan
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class JobAutomationTask {

    private final JobService jobService;

    /**
     * Chạy mỗi 10 phút một lần để kiểm tra và hết hạn các bài đăng.
     * fixedRate = 600_000ms = 10 phút
     * initialDelay = 60_000ms = 60 giây sau khi ứng dụng khởi động mới chạy lần đầu.
     */
    @Scheduled(fixedRate = 600_000, initialDelay = 60_000)
    public void runJobAutoExpiry() {
        log.info("[JobAutomationTask] Bắt đầu kiểm tra bài đăng hết hạn...");
        try {
            jobService.cleanupExpiredJobs();
        } catch (Exception e) {
            log.error("[JobAutomationTask] Lỗi nghiêm trọng khi thực thi tác vụ tự động hết hạn: {}", e.getMessage(), e);
        }
        log.info("[JobAutomationTask] Hoàn tất kiểm tra.");
    }
}
