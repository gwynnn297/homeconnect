package com.homeconnect.core.task;

import com.homeconnect.core.entity.JobPost;
import com.homeconnect.core.repository.JobPostRepository;
import com.homeconnect.core.repository.NotificationRepository;
import com.homeconnect.core.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

/**
 * Task tự động gửi thông báo nhắc nhở cho khách hàng khi bài đăng sắp đến giờ làm
 * mà vẫn chưa có ai ứng tuyển.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JobPostReminderTask {

    private final JobPostRepository jobPostRepository;
    private final NotificationRepository notificationRepository;
    private final NotificationService notificationService;

    /**
     * Quét mỗi 15 phút để tìm các bài đăng sắp bắt đầu trong 2 tiếng tới.
     */
    @Scheduled(fixedRate = 900000) // 15 phút
    @Transactional
    public void scanAndSendReminders() {
        LocalDateTime nowDateTime = LocalDateTime.now();
        LocalDate today = nowDateTime.toLocalDate();
        LocalTime nowTime = nowDateTime.toLocalTime();
        
        LocalDateTime twoHoursLater = nowDateTime.plusHours(2);
        LocalDate tomorrow = today.plusDays(1);
        LocalTime twoHoursFromNowTime = twoHoursLater.toLocalTime();
        
        boolean crossMidnight = !twoHoursLater.toLocalDate().equals(today);

        log.debug("[ReminderTask] Đang quét các bài đăng sắp bắt đầu trong 2 tiếng tới (CrossMidnight: {})...", crossMidnight);
        
        List<JobPost> jobs = jobPostRepository.findJobsNeedingReminder(today, tomorrow, nowTime, twoHoursFromNowTime, crossMidnight);
        
        if (jobs.isEmpty()) {
            return;
        }

        log.info("[ReminderTask] Phát hiện {} bài đăng sắp đến giờ làm.", jobs.size());

        for (JobPost job : jobs) {
            try {
                // Kiểm tra xem đã gửi thông báo nhắc nhở cho bài đăng này chưa bằng cách tìm trong Notification table
                // Nội dung tìm kiếm chứa mã bài đăng để phân biệt
                String searchContent = String.format("Mã #%d", job.getPostId());
                boolean alreadySent = notificationRepository.existsByUserIdAndTypeAndContentContainingAndCreatedAtAfter(
                        job.getCustomerId(),
                        "JOB_POST_REMINDER",
                        searchContent,
                        job.getCreatedAt() // Chỉ tìm các thông báo tạo sau khi bài đăng được tạo
                );

                if (alreadySent) {
                    continue;
                }

                // Nội dung thông báo theo yêu cầu người dùng
                String content = String.format(
                    "Chỉ còn 2 giờ nữa công việc (Mã #%d) sẽ bắt đầu nhưng hiện chưa có thợ ứng tuyển. " +
                    "Hãy thử chuyển sang 'Đặt thợ trực tiếp' để chọn ngay thợ 5 sao đang rảnh ở gần bạn. " +
                    "Bạn có thể hủy bài đăng này để được hoàn tiền vào ví trước khi đặt trực tiếp.", 
                    job.getPostId());

                notificationService.createNotification(
                    job.getCustomerId(),
                    "Tin đăng sắp bắt đầu - Chưa có thợ",
                    content,
                    "JOB_POST_REMINDER"
                );
                
                log.info("[ReminderTask] Đã gửi thông báo nhắc nhở cho bài đăng #{}", job.getPostId());
            } catch (Exception e) {
                log.error("[ReminderTask] Lỗi khi gửi thông báo cho bài đăng #{}: {}", job.getPostId(), e.getMessage());
            }
        }
    }
}
