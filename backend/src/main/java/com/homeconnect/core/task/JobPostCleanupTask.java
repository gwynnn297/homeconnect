package com.homeconnect.core.task;

import com.homeconnect.core.entity.JobPost;
import com.homeconnect.core.repository.JobPostRepository;
import com.homeconnect.core.service.JobService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

/**
 * Tác vụ tự động dọn dẹp bài đăng quá ngày làm việc (workDate)
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JobPostCleanupTask {

    private final JobPostRepository jobPostRepository;
    private final JobService jobService;

    /**
     * Tự động hủy các bài đăng PUBLISHED có workDate < hôm nay
     * Chạy mỗi giờ một lần.
     */
    @Scheduled(cron = "0 0 * * * *") // Chạy vào đầu mỗi giờ
    public void cleanupExpiredJobs() {
        log.info("Bắt đầu quét các bài đăng việc làm hết hạn...");
        
        LocalDate today = LocalDate.now();
        List<JobPost> expiredJobs = jobPostRepository.findExpiredJobPosts(today, java.time.LocalTime.now(), java.time.LocalDateTime.now());

        if (expiredJobs.isEmpty()) {
            log.info("Không có bài đăng nào hết hạn.");
            return;
        }

        log.info("Phát hiện {} bài đăng hết hạn ngày làm việc. Đang tiến hành hủy tự động...", expiredJobs.size());

        for (JobPost job : expiredJobs) {
            try {
                // Gọi tới JobService với customerId = null để chỉ định đây là system cleanup
                jobService.cancelJobPost(job.getPostId(), null);
                log.info("Đã tự động hủy và hoàn tiền bài đăng #{} do hết hạn workDate ({})", 
                        job.getPostId(), job.getWorkDate());
            } catch (Exception e) {
                log.error("Lỗi khi dọn dẹp bài đăng #{}: {}", job.getPostId(), e.getMessage());
            }
        }
        
        log.info("Đã hoàn tất dọn dẹp bài đăng hết hạn.");
    }
}
