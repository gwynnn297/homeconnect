package com.homeconnect.core.task;

import com.homeconnect.core.entity.JobPost;
import com.homeconnect.core.repository.JobApplicationRepository;
import com.homeconnect.core.repository.JobPostRepository;
import com.homeconnect.core.service.MatchingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Quét lại matching định kỳ để bắt các thay đổi điều kiện từ phía helper
 * (KYC/online/lịch/khu vực/dịch vụ...) ngay cả khi JobPost không đổi.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class MatchingRematchTask {

    private static final List<String> ACTIVE_APPLICATION_STATUSES = List.of("PENDING", "ACCEPTED", "ASSIGNED");

    private final JobPostRepository jobPostRepository;
    private final JobApplicationRepository jobApplicationRepository;
    private final MatchingService matchingService;

    private final AtomicBoolean running = new AtomicBoolean(false);

    @Value("${matching.rematch.batch-size:30}")
    private int rematchBatchSize;

    /**
     * Quét lại theo chu kỳ để tăng cơ hội ghép cho các job chưa có thợ active.
     */
    @Scheduled(
            fixedDelayString = "${matching.rematch.fixed-delay-ms:300000}",
            initialDelayString = "${matching.rematch.initial-delay-ms:120000}")
    public void rematchActiveJobs() {
        if (!running.compareAndSet(false, true)) {
            log.info("[MatchingRematchTask] Bỏ qua lượt quét vì lượt trước vẫn đang chạy.");
            return;
        }

        try {
            List<JobPost> activeJobs = jobPostRepository.findActiveJobPosts(LocalDate.now(), java.time.LocalTime.now(), LocalDateTime.now());

            int triggered = 0;
            for (JobPost job : activeJobs) {
                if (triggered >= rematchBatchSize) {
                    break;
                }

                boolean hasActiveApplications = jobApplicationRepository.existsByPostIdAndStatusIn(
                        job.getPostId(),
                        ACTIVE_APPLICATION_STATUSES);
                if (hasActiveApplications) {
                    continue;
                }

                matchingService.findAndInviteHelpers(job.getPostId());
                triggered++;
            }

            log.info("[MatchingRematchTask] Quét lại {} job (batch-size={}) để tìm thêm helper phù hợp.",
                    triggered, rematchBatchSize);
        } catch (Exception e) {
            log.error("[MatchingRematchTask] Lỗi khi quét lại matching: {}", e.getMessage(), e);
        } finally {
            running.set(false);
        }
    }
}
