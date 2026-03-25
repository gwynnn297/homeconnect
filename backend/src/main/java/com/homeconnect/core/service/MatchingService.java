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
import com.homeconnect.core.repository.ServiceRepository;
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
import java.util.Optional;
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
    private final ServiceRepository serviceRepository;
    private final EmailService emailService;
    private final NotificationService notificationService;

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

        // --- Bước 0: Hủy các lời mời cũ chưa được phản hồi thay vì xóa (Để thợ biết lý do) ---
        List<JobApplication> pendingInvites = jobApplicationRepository.findByPostId(postId).stream()
                .filter(app -> "INVITED".equals(app.getType()) && "PENDING".equals(app.getStatus()))
                .collect(Collectors.toList());
        
        for (JobApplication inv : pendingInvites) {
            inv.setStatus("CANCELLED");
            jobApplicationRepository.save(inv);
            notificationService.createNotification(
                inv.getHelperId(),
                "Lời mời đã hủy",
                String.format("Lời mời cho công việc #%d đã bị hủy do khách hàng thay đổi thông tin (quận/giờ) không còn phù hợp.", postId),
                "INVITATION_CANCELLED"
            );
        }
        log.info("Đã hủy (có thông báo) {} lời mời PENDING cũ cho Job #{}", pendingInvites.size(), postId);

        try {
            // 1. Lấy thông tin job post
            JobPost jobPost = jobPostRepository.findById(postId)
                    .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy job post với ID: " + postId));

            log.info("Chi tiết Job Post: Category ID={}, Service IDs={}, Ngày={}, Giờ={}, Thời lượng={}h, Địa điểm={}",
                    jobPost.getCategory().getCategoryId(),
                    jobPost.getServiceId() != null ? jobPost.getServiceId() : "N/A",
                    jobPost.getWorkDate(),
                    jobPost.getStartTime(),
                    jobPost.getDurationHours(),
                    jobPost.getAddress() != null ? jobPost.getAddress().getAddressDetail() : "N/A");


            // 2. Lọc nền tảng ở DB: service + online + KYC + lịch rảnh
            long durationSecs = (long) jobPost.getDurationHours() * 3600;
            List<Long> eligibleHelperIds = helperProfileRepository.findEligibleHelperIdsWithSchedule(
                    jobPost.getCategory().getCategoryId(),
                    jobPost.getWorkDate(),
                    jobPost.getStartTime(),
                    durationSecs);


            log.info("Kết quả lọc nền tảng (service + online + KYC + schedule): {} helper", eligibleHelperIds.size());

            if (eligibleHelperIds.isEmpty()) {
                log.warn("Không tìm thấy helper ở bước lọc nền tảng cho Category ID: {}, Ngày: {}, Giờ: {}",
                        jobPost.getCategory().getCategoryId(), jobPost.getWorkDate(), jobPost.getStartTime());

                return;
            }

            // 3. Filter theo working districts ở service layer
            List<Long> districtMatchedHelperIds = filterHelpersByWorkingDistrict(eligibleHelperIds,
                    jobPost.getAddress() != null ? jobPost.getAddress().getAddressDetail() : null);
            log.info("Kết quả lọc working district: {} helper", districtMatchedHelperIds.size());
            if (districtMatchedHelperIds.isEmpty()) {
                log.warn(
                        "Không tìm thấy helper theo working district cho Job Post ID: {}, địa chỉ job='{}', candidates={} ",
                        postId, jobPost.getAddress() != null ? jobPost.getAddress().getAddressDetail() : "N/A", eligibleHelperIds);
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
            if (jobPost.getAddress() != null && jobPost.getAddress().getLatitude() != null && jobPost.getAddress().getLongitude() != null) {
                finalHelperIds = filterHelpersByDistance(rankedHelperIds, jobPost);
                log.info("Sau khi filter khoảng cách: {} helper trong {}km", finalHelperIds.size(), MAX_DISTANCE_KM);
            }

            // 6. Xử lý các ứng tuyển cũ (APPLIED): Hủy những người không còn phù hợp & báo Cập nhật cho những người vẫn phù hợp
            List<JobApplication> existingAppliedApps = jobApplicationRepository.findByPostId(postId).stream()
                    .filter(app -> "APPLIED".equals(app.getType()) && "PENDING".equals(app.getStatus()))
                    .collect(Collectors.toList());

            for (JobApplication oldApp : existingAppliedApps) {
                if (!finalHelperIds.contains(oldApp.getHelperId())) {
                    // Thợ cũ không còn phù hợp với yêu cầu mới (Khác Quận, quá xa GPS, v.v.)
                    oldApp.setStatus("CANCELLED");
                    jobApplicationRepository.save(oldApp);
                    notificationService.createNotification(
                        oldApp.getHelperId(),
                        "Ứng tuyển bị hủy",
                        String.format("Công việc #%d đã thay đổi thông tin (quận/giờ/địa điểm) không còn phù hợp với khu vực làm việc của bạn.", postId),
                        "JOB_UPDATED_UNFIT"
                    );
                    log.info("Đã tự động hủy ứng tuyển của thợ {} do không còn phù hợp với Job #{} sau cập nhật", oldApp.getHelperId(), postId);
                } else {
                    // Thợ cũ VẪN phù hợp với yêu cầu mới -> Gửi thông báo cập nhật thông tin
                    notificationService.createNotification(
                        oldApp.getHelperId(),
                        "Công việc đã cập nhật",
                        String.format("Công việc #%d (%s) bạn ứng tuyển đã được khách hàng chỉnh sửa thông tin. Vui lòng kiểm tra lại.", postId, jobPost.getTitle()),
                        "JOB_UPDATED"
                    );
                    log.info("Đã gửi thông báo cập nhật cho thợ {} (vẫn phù hợp) của Job #{}", oldApp.getHelperId(), postId);
                }
            }

            if (finalHelperIds.isEmpty()) {
                log.warn(
                        "Không tìm thấy helper mới sau khi filter cho Job Post ID: {}, candidates={}",
                        postId, rankedHelperIds);
                return;
            }

            // 7. Gửi lời mời cho thợ mới (Những người chưa từng ứng tuyển hay được mời)
            int inviteCount = 0;
            for (Long helperId : finalHelperIds) {
                // 7.1. Kiểm tra xem đã có application chưa
                Optional<JobApplication> existingApp = jobApplicationRepository.findByPostIdAndHelperId(postId, helperId);
                
                if (existingApp.isPresent()) {
                    // Đã xử lý thông báo ứng tuyển ở bước 6 hoặc đã mời rồi -> Bỏ qua
                    continue; 
                }

                // 7.2. Tạo lời mời cho thợ mới (INVITED)
                JobApplication invitation = JobApplication.builder()
                        .postId(postId)
                        .helperId(helperId)
                        .type("INVITED")
                        .status("PENDING")
                        .build();

                jobApplicationRepository.save(invitation);
                
                // Gửi notification mời việc mới
                notificationService.createMatchingNotification(helperId, postId, jobPost);

                inviteCount++;

                // Gửi email thông báo
                sendJobInvitationEmail(helperId, postId, jobPost);
                log.debug("Đã mời Helper ID: {} cho Job Post ID: {}", helperId, postId);
            }

            log.info("Matching hoàn tất: Đã gửi thêm {} lời mời mới cho Job #{}", inviteCount, postId);

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
                            jobPost.getAddress().getLatitude(),
                            jobPost.getAddress().getLongitude());
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
        // Resolve service names
        String categoryName = jobPost.getCategory() != null ? jobPost.getCategory().getName() : "N/A";
        StringBuilder serviceDetails = new StringBuilder(categoryName);
        
        List<Integer> childServiceIds = parseServiceIds(jobPost.getServiceId());
        if (!childServiceIds.isEmpty()) {
            serviceDetails.append(" (Bao gồm: ");
            List<String> childNames = new java.util.ArrayList<>();
            for (Integer id : childServiceIds) {
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
 
                Vui lòng mở ứng dụng để xem chi tiết và phản hồi lời mời.
 
                Hãy nhanh chóng - các helper khác cũng có thể nhận việc này!
 
                Trân trọng,
                HomeConnect Team
                """,
                helperName != null ? helperName : "Helper",
                serviceDetails.toString(),
                jobPost.getWorkDate(),
                jobPost.getStartTime(),
                jobPost.getDurationHours(),
                jobPost.getAddress() != null ? 
                    String.format("%s, %s, %s", 
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
                } catch (NumberFormatException ignored) {}
            }
        }
        return sIds;
    }

    // Lấy số lượng application cho job post
    public int getApplicationCount(Long postId) {
        return jobApplicationRepository.findByPostId(postId).size();
    }
}