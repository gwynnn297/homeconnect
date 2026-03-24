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
import com.homeconnect.core.repository.AddressRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

// BE-Match-01: Matching Engine Service
// Tự động tìm và mời helper phù hợp cho job post
@Slf4j
@Service
@RequiredArgsConstructor
public class MatchingService {

    private final JobPostRepository jobPostRepository;
    private final HelperProfileRepository helperProfileRepository;
    private final HelperWorkingDistrictRepository helperWorkingDistrictRepository;
    private final JobApplicationRepository jobApplicationRepository;
    private final UserRepository userRepository;
    private final AddressRepository addressRepository;
    private final EmailService emailService;

    @Value("${matching.min-rating:3.0}")
    private BigDecimal MIN_RATING;

    @Value("${matching.min-reviews:0}")
    private Integer MIN_REVIEWS;

    @Value("${matching.max-distance-km:5.0}")
    private Double MAX_DISTANCE_KM;

    // BE-Match-01: Tìm và mời helper phù hợp
    // Chạy async để không block API response
    // Criteria: Dịch vụ + Online + KYC + Lịch rảnh + Rating tối thiểu
    @Async
    @Transactional
    public void findAndInviteHelpers(Long postId) {
        log.info("Bắt đầu matching cho Job Post ID: {}", postId);

        try {
            // 1. Lấy thông tin job post
            JobPost jobPost = jobPostRepository.findById(postId)
                    .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy job post với ID: " + postId));

            log.info("Chi tiết Job Post: Service ID={}, Ngày={}, Giờ={}, Thời lượng={}h, Địa điểm={}",
                    jobPost.getServiceId(),
                    jobPost.getWorkDate(),
                    jobPost.getStartTime(),
                    jobPost.getDurationHours(),
                    jobPost.getAddressDetail());

            // 2. Lọc nền tảng ở DB: service + online + KYC + lịch rảnh
            long durationSecs = (long) jobPost.getDurationHours() * 3600;
            List<Long> eligibleHelperIds = helperProfileRepository.findEligibleHelperIdsWithSchedule(
                    jobPost.getServiceId(),
                    jobPost.getWorkDate(),
                    jobPost.getStartTime(),
                    durationSecs);

            log.info("Kết quả lọc nền tảng (service + online + KYC + schedule): {} helper", eligibleHelperIds.size());

            if (eligibleHelperIds.isEmpty()) {
                log.warn("Không tìm thấy helper ở bước lọc nền tảng cho Service ID: {}, Ngày: {}, Giờ: {}",
                        jobPost.getServiceId(), jobPost.getWorkDate(), jobPost.getStartTime());
                return;
            }

            // 3. Filter theo working districts ở service layer
            List<Long> districtMatchedHelperIds = filterHelpersByWorkingDistrict(eligibleHelperIds,
                    jobPost.getAddressDetail());
            log.info("Kết quả lọc working district: {} helper", districtMatchedHelperIds.size());
            if (districtMatchedHelperIds.isEmpty()) {
                log.warn(
                        "Không tìm thấy helper theo working district cho Job Post ID: {}, địa chỉ job='{}', candidates={} ",
                        postId, jobPost.getAddressDetail(), eligibleHelperIds);
                return;
            }

            // 4. Filter + ranking theo rating/reviews ở service layer
            List<Long> rankedHelperIds = filterAndSortByRating(districtMatchedHelperIds);
            log.info("Kết quả lọc rating/reviews: {} helper", rankedHelperIds.size());
            if (rankedHelperIds.isEmpty()) {
                log.warn(
                        "Không tìm thấy helper đạt ngưỡng rating/review cho Job Post ID: {}, minRating={}, minReviews={}, candidates={} ",
                        postId, MIN_RATING, MIN_REVIEWS, districtMatchedHelperIds);
                return;
            }

            log.info("Tìm thấy {} helper phù hợp sau district + rating: {}", rankedHelperIds.size(), rankedHelperIds);

            // 5. Filter theo khoảng cách GPS nếu có tọa độ
            List<Long> finalHelperIds = rankedHelperIds;
            if (jobPost.getLatitude() != null && jobPost.getLongitude() != null) {
                finalHelperIds = filterHelpersByDistance(rankedHelperIds, jobPost);
                log.info("Sau khi filter khoảng cách: {} helper trong {}km", finalHelperIds.size(), MAX_DISTANCE_KM);
            }

            if (finalHelperIds.isEmpty()) {
                log.warn(
                        "Không tìm thấy helper sau khi filter khoảng cách cho Job Post ID: {}, jobLat={}, jobLng={}, candidates={}",
                        postId, jobPost.getLatitude(), jobPost.getLongitude(), rankedHelperIds);
                return;
            }

            // 6. Gửi lời mời
            int inviteCount = 0;
            for (Long helperId : finalHelperIds) {
                // Kiểm tra xem đã mời chưa
                if (jobApplicationRepository.existsByPostIdAndHelperId(postId, helperId)) {
                    log.debug("Helper {} đã có application, bỏ qua", helperId);
                    continue;
                }

                // Tạo lời mời
                JobApplication invitation = JobApplication.builder()
                        .postId(postId)
                        .helperId(helperId)
                        .type("INVITED")
                        .status("PENDING")
                        .build();

                jobApplicationRepository.save(invitation);
                inviteCount++;

                // Gửi email thông báo
                sendJobInvitationEmail(helperId, postId, jobPost);
                log.debug("Đã mời Helper ID: {} cho Job Post ID: {}", helperId, postId);
            }

            log.info("Matching hoàn tất: Đã gửi {} lời mời cho Job Post ID: {}", inviteCount, postId);

        } catch (Exception e) {
            log.error("Lỗi khi thực hiện matching cho Job Post ID: {}", postId, e);
        }
    }

    // Filter helper theo khu vực làm việc đã đăng ký
    private List<Long> filterHelpersByWorkingDistrict(List<Long> helperIds, String jobAddressDetail) {
        if (helperIds.isEmpty() || jobAddressDetail == null || jobAddressDetail.isBlank()) {
            return List.of();
        }

        String normalizedJobAddress = normalizeLocationText(jobAddressDetail);
        List<HelperWorkingDistrict> workingDistricts = helperWorkingDistrictRepository.findByHelper_IdIn(helperIds);

        Map<Long, List<String>> districtMapByHelper = workingDistricts.stream()
                .collect(Collectors.groupingBy(
                        wd -> wd.getHelper().getId(),
                        Collectors.mapping(HelperWorkingDistrict::getDistrictName, Collectors.toList())));

        return helperIds.stream()
                .filter(helperId -> districtMapByHelper.getOrDefault(helperId, List.of()).stream()
                        .map(this::normalizeLocationText)
                        .anyMatch(district -> !district.isBlank() && normalizedJobAddress.contains(district)))
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

                    boolean passRating = profile.getRatingAverage() == null
                            || profile.getRatingAverage().compareTo(MIN_RATING) >= 0;
                    boolean passReviews = profile.getTotalReviews() == null || profile.getTotalReviews() >= MIN_REVIEWS;
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

    // Filter helper theo khoảng cách GPS dùng công thức Haversine
    private List<Long> filterHelpersByDistance(List<Long> helperIds, JobPost jobPost) {
        return helperIds.stream()
                .filter(helperId -> {
                    com.homeconnect.core.entity.Address address = addressRepository
                            .findByUser_IdAndIsDefaultTrueOrderByAddressIdAsc(helperId)
                            .stream()
                            .findFirst()
                            .orElse(null);

                    if (address == null || address.getLatitude() == null || address.getLongitude() == null) {
                        return false;
                    }

                    double distance = calculateDistance(
                            address.getLatitude(),
                            address.getLongitude(),
                            jobPost.getLatitude(),
                            jobPost.getLongitude());
                    return distance <= MAX_DISTANCE_KM;
                })
                .toList();
    }

    // Tính khoảng cách 2 tọa độ dùng công thức Haversine (kết quả tính bằng km)
    private double calculateDistance(BigDecimal lat1, BigDecimal lng1,
            BigDecimal lat2, BigDecimal lng2) {
        final int EARTH_RADIUS = 6371; // km

        double dLat = Math.toRadians(lat2.doubleValue() - lat1.doubleValue());
        double dLng = Math.toRadians(lng2.doubleValue() - lng1.doubleValue());

        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(Math.toRadians(lat1.doubleValue())) *
                        Math.cos(Math.toRadians(lat2.doubleValue())) *
                        Math.sin(dLng / 2) * Math.sin(dLng / 2);

        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS * c;
    }

    // Gửi email mời việc cho helper
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
        return String.format("""
                Xin chào %s,

                Bạn có một cơ hội việc mới phù hợp với kỹ năng và lịch rảnh của bạn!

                Chi tiết việc:
                • Dịch vụ: [Thông tin dịch vụ]
                • Ngày: %s
                • Giờ: %s (%d giờ)
                • Địa điểm: %s
                • Giá: %,d VNĐ

                Vui lòng mở ứng dụng để xem chi tiết và phản hồi lời mời.

                Hãy nhanh chóng - các helper khác cũng có thể nhận việc này!

                Trân trọng,
                HomeConnect Team
                """,
                helperName != null ? helperName : "Helper",
                jobPost.getWorkDate(),
                jobPost.getStartTime(),
                jobPost.getDurationHours(),
                jobPost.getAddressDetail(),
                jobPost.getOfferPrice().longValue());
    }

    // Lấy số lượng application cho job post
    public int getApplicationCount(Long postId) {
        return jobApplicationRepository.findByPostId(postId).size();
    }
}