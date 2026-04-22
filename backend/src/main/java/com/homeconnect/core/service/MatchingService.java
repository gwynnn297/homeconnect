package com.homeconnect.core.service;

import com.homeconnect.core.entity.JobApplication;
import com.homeconnect.core.entity.JobPost;
import com.homeconnect.core.entity.HelperProfile;
import com.homeconnect.core.entity.HelperWorkingDistrict;
import com.homeconnect.core.entity.User;
import com.homeconnect.core.repository.JobApplicationRepository;
import com.homeconnect.core.repository.JobPostRepository;
import com.homeconnect.core.repository.HelperProfileRepository;
import com.homeconnect.core.repository.HelperWorkingDistrictRepository;
import com.homeconnect.core.repository.UserRepository;
import com.homeconnect.core.repository.NotificationRepository;
import com.homeconnect.core.repository.ServiceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.text.Normalizer;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import java.time.LocalDate;
import java.time.LocalTime;

// BE-Match-01: Matching Engine Service
// Tự động tìm helper phù hợp và chỉ gửi email + thông báo (không tạo JobApplication).
// Thợ xem bài trên feed và chủ động ứng tuyển → mới có bản ghi type=APPLIED.
@Slf4j
@Service
@RequiredArgsConstructor
public class MatchingService {

    private final JobPostRepository jobPostRepository;
    private final HelperProfileRepository helperProfileRepository;
    private final HelperWorkingDistrictRepository helperWorkingDistrictRepository;
    private final JobApplicationRepository jobApplicationRepository;
    private final UserRepository userRepository;
    private final NotificationRepository notificationRepository;
    private final ServiceRepository serviceRepository;
    private final EmailService emailService;
    private final NotificationService notificationService;

    public enum MatchFailureReason {
        NONE,
        INVALID_INPUT,
        NO_AVAILABLE_SLOT,
        NO_HELPER_IN_DISTRICT,
        NO_HELPER_MEET_RATING
    }

    public static class MatchResult {
        private final List<Long> helperIds;
        private final MatchFailureReason failureReason;

        public MatchResult(List<Long> helperIds, MatchFailureReason failureReason) {
            this.helperIds = helperIds;
            this.failureReason = failureReason;
        }

        public List<Long> getHelperIds() {
            return helperIds;
        }

        public MatchFailureReason getFailureReason() {
            return failureReason;
        }
    }

    @Transactional(readOnly = true)
    public List<Long> findMatchingHelperIds(Integer categoryId, LocalDate workDate, LocalTime startTime,
            Integer durationHours,
            String districtName) {
        return findMatchingHelperIdsWithReason(categoryId, workDate, startTime, durationHours, districtName).getHelperIds();
    }

    @Transactional(readOnly = true)
    public MatchResult findMatchingHelperIdsWithReason(Integer categoryId, LocalDate workDate, LocalTime startTime,
            Integer durationHours,
            String districtName) {
        if (categoryId == null || workDate == null || startTime == null || durationHours == null
                || durationHours <= 0) {
            return new MatchResult(List.of(), MatchFailureReason.INVALID_INPUT);
        }

        long durationSecs = (long) durationHours * 3600;
        List<Long> eligibleHelperIds = helperProfileRepository.findEligibleHelperIdsWithSchedule(
                categoryId,
                workDate,
                startTime,
                durationSecs);

        if (eligibleHelperIds.isEmpty()) {
            return new MatchResult(List.of(), MatchFailureReason.NO_AVAILABLE_SLOT);
        }

        List<Long> districtMatchedIds = filterHelpersByWorkingDistrict(eligibleHelperIds, districtName);
        if (districtMatchedIds.isEmpty()) {
            return new MatchResult(List.of(), MatchFailureReason.NO_HELPER_IN_DISTRICT);
        }

        List<Long> finalIds = filterAndSortByRating(districtMatchedIds);
        if (finalIds.isEmpty()) {
            return new MatchResult(List.of(), MatchFailureReason.NO_HELPER_MEET_RATING);
        }
        return new MatchResult(finalIds, MatchFailureReason.NONE);
    }

    @Value("${matching.min-rating:3.0}")
    private BigDecimal MIN_RATING;

    @Value("${matching.min-reviews:0}")
    private Integer MIN_REVIEWS;

    @Value("${matching.notification-cooldown-minutes:120}")
    private long matchingNotificationCooldownMinutes;

    // BE-Match-01: Tìm helper phù hợp — chỉ notify (email + in-app), không tạo
    // INVITED.
    // Dùng cho cả tạo mới lẫn cập nhật bài đăng.
    // Khi cập nhật (các đơn PENDING đã có — chủ yếu do thợ đã APPLIED):
    // - Thợ VẪN phù hợp → Thông báo cập nhật tin
    // - Thợ KHÔNG còn phù hợp → Hủy application + thông báo
    // Thợ mới phù hợp → Chỉ gửi email + thông báo; họ vào feed và bấm ứng tuyển nếu
    // muốn.
    @Async
    @Transactional
    @SuppressWarnings("null")
    public void findAndInviteHelpers(Long postId) {
        log.info("[Matching] Bắt đầu matching cho Job Post ID: {}", postId);

        try {
            // ===== BƯỚC 1: Lấy thông tin job post =====
            JobPost jobPost = jobPostRepository.findById(postId)
                    .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy job post: " + postId));

            String jobDistrict = jobPost.getAddress() != null ? jobPost.getAddress().getDistrictName() : null;
            log.info("[Matching] Job #{}: Quận='{}', Ngày={}, Giờ={}, {}h",
                    postId, jobDistrict, jobPost.getWorkDate(), jobPost.getStartTime(), jobPost.getDurationHours());

            // ===== BƯỚC 2: Tìm thợ đủ điều kiện (KYC + Online + Lịch rảnh + Kỹ năng) =====
            long durationSecs = (long) jobPost.getDurationHours() * 3600;
            List<Long> eligibleHelperIds = helperProfileRepository.findEligibleHelperIdsWithSchedule(
                    jobPost.getCategory().getCategoryId(),
                    jobPost.getWorkDate(),
                    jobPost.getStartTime(),
                    durationSecs);

            log.info("[Matching] Job #{}: {} thợ đủ điều kiện nền tảng", postId, eligibleHelperIds.size());

            // ===== BƯỚC 3: Lọc theo quận làm việc =====
            List<Long> districtMatchedIds = filterHelpersByWorkingDistrict(eligibleHelperIds, jobDistrict);
            log.info("[Matching] Job #{}: {} thợ phù hợp quận '{}'", postId, districtMatchedIds.size(), jobDistrict);

            // ===== BƯỚC 4: Lọc + xếp hạng theo rating =====
            List<Long> finalHelperIds = districtMatchedIds.isEmpty()
                    ? List.of()
                    : filterAndSortByRating(districtMatchedIds);

            log.info("[Matching] Job #{}: {} thợ sau lọc rating", postId, finalHelperIds.size());

            // ===== BƯỚC 5: Xử lý tất cả application PENDING hiện tại =====
            // Phân loại: thợ VẪN phù hợp → thông báo cập nhật; thợ KHÔNG còn phù hợp → hủy
            // + thông báo hủy
            List<JobApplication> existingPendingApps = jobApplicationRepository.findByPostId(postId).stream()
                    .filter(app -> "PENDING".equals(app.getStatus()))
                    .collect(Collectors.toList());

            for (JobApplication app : existingPendingApps) {
                if (finalHelperIds.contains(app.getHelperId())) {
                    // Thợ VẪN phù hợp → Thông báo bài đăng đã cập nhật
                    notificationService.createNotification(
                            app.getHelperId(),
                            "Công việc đã cập nhật thông tin",
                            String.format(
                                    "Công việc '%s' (#%d) bạn đang quan tâm vừa được khách hàng chỉnh sửa thông tin. " +
                                            "Bạn vẫn phù hợp với khu vực làm việc. Vui lòng kiểm tra lại.",
                                    jobPost.getTitle(), postId),
                            "JOB_UPDATED");
                    log.info("[Matching] Job #{}: Thợ #{} ({}) vẫn phù hợp → Báo cập nhật",
                            postId, app.getHelperId(), app.getType());
                } else {
                    // Thợ KHÔNG còn phù hợp → Hủy application + thông báo hủy
                    app.setStatus("CANCELLED");
                    jobApplicationRepository.save(app);

                    String msg = "INVITED".equals(app.getType())
                            ? String.format(
                                    "Lời mời công việc '%s' (#%d) của bạn đã bị hủy do khách hàng đổi sang khu vực làm việc mới không phù hợp với bạn.",
                                    jobPost.getTitle(), postId)
                            : String.format(
                                    "Đơn ứng tuyển công việc '%s' (#%d) của bạn đã bị hủy tự động do khách hàng thay đổi khu vực làm việc.",
                                    jobPost.getTitle(), postId);

                    notificationService.createNotification(
                            app.getHelperId(),
                            "Lời mời bị hủy do thay đổi khu vực",
                            msg,
                            "INVITATION_CANCELLED");
                    log.info("[Matching] Job #{}: Thợ #{} ({}) không còn phù hợp → Hủy + thông báo",
                            postId, app.getHelperId(), app.getType());
                }
            }

            // ===== BƯỚC 6: Gửi lời mời cho thợ phù hợp mới =====
            if (finalHelperIds.isEmpty()) {
                log.warn("[Matching] Job #{}: Không tìm được thợ phù hợp. Thông báo cho khách hàng.", postId);
                notificationService.createNotification(
                        jobPost.getCustomerId(),
                        "Chưa tìm được thợ phù hợp",
                        String.format("Hệ thống chưa tìm được thợ phù hợp cho công việc '%s' tại '%s'. " +
                                "Bạn có thể thử điều chỉnh khu vực hoặc thời gian.", jobPost.getTitle(), jobDistrict),
                        "NO_HELPER_FOUND");
                return;
            }

            int notifyCount = 0;
            for (Long helperId : finalHelperIds) {
                Optional<JobApplication> existingApp = jobApplicationRepository.findByPostIdAndHelperId(postId,
                        helperId);

                if (existingApp.isPresent()) {
                    String status = existingApp.get().getStatus();
                    if ("PENDING".equals(status)) {
                        // Đã có đơn chờ (thợ đã ứng tuyển hoặc bản ghi INVITED cũ) — không spam thêm
                        continue;
                    }
                    if ("ACCEPTED".equals(status) || "ASSIGNED".equals(status)) {
                        continue;
                    }
                    // CANCELLED / REJECTED / EXPIRED: có thể nhắc lại qua notify (thợ tự apply lại
                    // trên feed)
                }

                if (!shouldNotifyHelperForPost(helperId, postId)) {
                    continue;
                }

                notificationService.createMatchingNotification(helperId, postId, jobPost);
                sendJobInvitationEmail(helperId, postId, jobPost);
                notifyCount++;
                log.debug("[Matching] Job #{}: Đã gửi thông báo + email cho thợ #{} (không tạo JobApplication)", postId,
                        helperId);
            }

            log.info(
                    "[Matching] Job #{}: Hoàn tất. Đã gửi {} thông báo (email + in-app), thợ ứng tuyển chủ động trên feed.",
                    postId, notifyCount);

        } catch (Exception e) {
            log.error("[Matching] Lỗi khi thực hiện matching cho Job Post ID: {}", postId, e);
        }
    }

    private boolean shouldNotifyHelperForPost(Long helperId, Long postId) {
        if (matchingNotificationCooldownMinutes <= 0) {
            return true;
        }

        LocalDateTime since = LocalDateTime.now().minusMinutes(matchingNotificationCooldownMinutes);
        String contentMarker = "Job #" + postId + ":";

        boolean recentlyNotified = notificationRepository.existsByUserIdAndTypeAndContentContainingAndCreatedAtAfter(
                helperId,
                "MATCHING",
                contentMarker,
                since);
        return !recentlyNotified;
    }

    // Filter helper theo khu vực làm việc đã đăng ký
    private List<Long> filterHelpersByWorkingDistrict(List<Long> helperIds, String jobDistrictName) {
        if (helperIds.isEmpty()) {
            return List.of();
        }

        // Nếu job thiếu districtName thì bỏ qua filter quận để tránh false-negative.
        if (jobDistrictName == null || jobDistrictName.isBlank()) {
            return helperIds;
        }

        String normalizedJobDistrict = normalizeLocationText(jobDistrictName);
        List<HelperWorkingDistrict> workingDistricts = helperWorkingDistrictRepository.findByHelper_IdIn(helperIds);

        Map<Long, List<String>> districtMapByHelper = workingDistricts.stream()
                .collect(Collectors.groupingBy(
                        wd -> wd.getHelper().getId(),
                        Collectors.mapping(HelperWorkingDistrict::getDistrictName, Collectors.toList())));

        return helperIds.stream()
                .filter(helperId -> districtMapByHelper.getOrDefault(helperId, List.of()).stream()
                        .map(this::normalizeLocationText)
                        .anyMatch(district -> !district.isBlank() && normalizedJobDistrict.equals(district)))
                .toList();
    }

    // Filter theo ngưỡng rating/reviews và sắp xếp helper theo rating giảm dần
    private List<Long> filterAndSortByRating(List<Long> helperIds) {
        if (helperIds.isEmpty()) {
            return List.of();
        }

        Map<Long, HelperProfile> profileByHelperId = helperProfileRepository.findByUser_IdIn(helperIds).stream()
                .collect(Collectors.toMap(hp -> hp.getUser().getId(), hp -> hp));

        return helperIds.stream()
                .filter(helperId -> {
                    HelperProfile profile = profileByHelperId.get(helperId);
                    if (profile == null) {
                        return false;
                    }

                    int totalReviews = profile.getTotalReviews() != null ? profile.getTotalReviews() : 0;
                    boolean hasReviewHistory = totalReviews > 0;

                    // Cho thợ mới (chưa có review) đi qua bước lọc để tránh false-negative khi hệ
                    // thống mới.
                    boolean passRating = !hasReviewHistory
                            || profile.getRatingAverage() == null
                            || profile.getRatingAverage().compareTo(MIN_RATING) >= 0;
                    boolean passReviews = !hasReviewHistory || totalReviews >= MIN_REVIEWS;
                    return passRating && passReviews;
                })
                .sorted(Comparator.comparing(
                        (Long helperId) -> {
                            HelperProfile profile = profileByHelperId.get(helperId);
                            return profile != null ? profile.getRatingAverage() : null;
                        },
                        Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(helperId -> {
                            HelperProfile profile = profileByHelperId.get(helperId);
                            return profile != null && profile.getTotalReviews() != null ? profile.getTotalReviews() : 0;
                        }, Comparator.reverseOrder()))
                .toList();
    }

    private String normalizeLocationText(String text) {
        if (text == null) {
            return "";
        }

        String withoutAccent = Normalizer.normalize(text, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");

        return withoutAccent
                .toLowerCase()
                .replaceAll("\\b(quan|huyen|thi xa|thanh pho|tp\\.?)\\b", "")
                .replaceAll("[^a-z0-9\\s]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    // Gửi email mời việc cho helper
    @SuppressWarnings("null")
    private void sendJobInvitationEmail(Long helperId, Long postId, JobPost jobPost) {
        try {
            User helper = userRepository.findById(helperId).orElse(null);
            if (helper == null) {
                log.warn("Không tìm thấy helper với ID: {}", helperId);
                return;
            }

            String subject = "Có việc mới phù hợp - " + jobPost.getTitle();
            String content = buildJobInvitationEmailContent(helper.getFullName(), jobPost);

            emailService.sendSimpleMessage(helper.getEmail(), subject, content);
            log.info("Đã gửi email mời việc tới Helper ID: {} cho Job Post ID: {}", helperId, postId);

        } catch (Exception e) {
            log.warn("Không gửi được email mời việc tới Helper {}: {}", helperId, e.getMessage());
            // Không throw exception - email không phải chuyện critical
        }
    }

    // Build nội dung email mời việc
    private String buildJobInvitationEmailContent(String helperName, JobPost jobPost) {
        // Resolve service names
        String categoryName = jobPost.getCategory() != null ? jobPost.getCategory().getName() : "N/A";
        StringBuilder serviceDetails = new StringBuilder(categoryName);

        List<Integer> childServiceIds = parseServiceIds(jobPost.getServiceId());
        if (!childServiceIds.isEmpty()) {
            serviceDetails.append(" (Bao gồm: ");
            List<String> childNames = new java.util.ArrayList<>();
            for (Integer id : childServiceIds) {
                if (id == null) {
                    continue;
                }
                serviceRepository.findById(id).ifPresent(s -> childNames.add(s.getName()));
            }
            serviceDetails.append(String.join(", ", childNames)).append(")");
        }

        return String.format("""
                Xin chào %s,

                Bạn có một cơ hội việc mới phù hợp với kỹ năng và lịch rảnh của bạn!

                Chi tiết việc:
                • Dịch vụ: %s
                • Ngày: %s

                • Giờ: %s (%d giờ)
                • Địa điểm: %s
                • Giá: %,d VNĐ

                Vui lòng mở ứng dụng, xem việc trong danh sách và ứng tuyển nếu bạn muốn nhận việc.

                Hãy nhanh chóng - các helper khác cũng có thể nhận việc này!

                Trân trọng,
                HomeConnect Team
                """,
                helperName != null ? helperName : "Helper",
                serviceDetails.toString(),
                jobPost.getWorkDate(),
                jobPost.getStartTime(),
                jobPost.getDurationHours(),
                jobPost.getAddress() != null ? String.format("%s, %s, %s",
                        jobPost.getAddress().getWardName(),
                        jobPost.getAddress().getDistrictName(),
                        jobPost.getAddress().getProvinceName()) : "N/A",
                jobPost.getOfferPrice().longValue());
    }

    private List<Integer> parseServiceIds(String serviceIdStr) {
        List<Integer> sIds = new java.util.ArrayList<>();
        if (serviceIdStr != null && !serviceIdStr.isEmpty()) {
            String[] split = serviceIdStr.split(",");
            for (String idStr : split) {
                try {
                    sIds.add(Integer.parseInt(idStr.trim()));
                } catch (NumberFormatException ignored) {
                }
            }
        }
        return sIds;
    }

    // Lấy số lượng application cho job post
    public int getApplicationCount(Long postId) {
        return jobApplicationRepository.findByPostId(postId).size();
    }
}