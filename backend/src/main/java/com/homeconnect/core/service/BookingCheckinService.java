package com.homeconnect.core.service;

import com.homeconnect.core.dto.request.booking.CheckinVerifyRequest;
import com.homeconnect.core.dto.response.booking.CheckinChallengeResponse;
import com.homeconnect.core.dto.response.booking.CheckinVerifyResponse;
import com.homeconnect.core.entity.Address;
import com.homeconnect.core.entity.Booking;
import com.homeconnect.core.entity.HelperProfile;
import com.homeconnect.core.enums.BookingStatus;
import com.homeconnect.core.exception.ApiException;
import com.homeconnect.core.repository.BookingRepository;
import com.homeconnect.core.repository.HelperProfileRepository;
import com.homeconnect.core.util.GeoUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;
import org.springframework.core.ParameterizedTypeReference;

import java.net.URI;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
@Slf4j
public class BookingCheckinService {

    private static final List<String> ACTION_POOL = List.of("TURN_LEFT", "TURN_RIGHT", "OPEN_MOUTH");

    private final BookingRepository bookingRepository;
    private final HelperProfileRepository helperProfileRepository;
    private final RestTemplate restTemplate;
    private final NotificationService notificationService;
    private final BookingService bookingService;

    private final Map<String, CheckinChallengeState> challengeStore = new ConcurrentHashMap<>();

    @Value("${app.facepp.api-key:}")
    private String faceppApiKey;

    @Value("${app.facepp.api-secret:}")
    private String faceppApiSecret;

    @Value("${app.facepp.compare-url:https://api-us.faceplusplus.com/facepp/v3/compare}")
    private String faceppCompareUrl;

    @Value("${app.facepp.min-confidence:80}")
    private double minConfidence;

    @Value("${app.checkin.challenge-ttl-seconds:10800}")
    private int challengeTtlSeconds;

    @Value("${app.checkin.max-attempts:3}")
    private int maxAttempts;

    @Value("${app.checkin.allowed-window-minutes:180}")
    private int allowedCheckinWindowMinutes;

    @Value("${app.checkin.max-distance-meters:500}")
    private double maxCheckinDistanceMeters;

    public CheckinChallengeResponse createChallenge(Long bookingId, Long helperId) {
        Booking booking = validateBookingForCheckin(bookingId, helperId);
        validateCheckinTimeWindow(booking);

        List<String> requiredActions = new ArrayList<>(ACTION_POOL);
        Collections.shuffle(requiredActions);
        requiredActions = requiredActions.subList(0, 2);

        String challengeId = UUID.randomUUID().toString();
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime expiresAt = now.plusSeconds(challengeTtlSeconds);

        challengeStore.put(challengeId, new CheckinChallengeState(
                challengeId,
                booking.getId(),
                helperId,
                requiredActions,
                expiresAt,
                false,
                0));

        log.info(
                "[CHECKIN][CHALLENGE][CREATED] bookingId={}, helperId={}, challengeId={}, requiredActions={}, ttlSeconds={}, expiresAt={}",
                bookingId,
                helperId,
                shortChallenge(challengeId),
                requiredActions,
                challengeTtlSeconds,
                expiresAt);

        return CheckinChallengeResponse.builder()
                .challengeId(challengeId)
                .requiredActions(requiredActions)
                .ttlSeconds(challengeTtlSeconds)
                .expiresAt(expiresAt)
                .build();
    }

    @Transactional
    public CheckinVerifyResponse verifyAndCheckin(Long bookingId, Long helperId, CheckinVerifyRequest request) {
        Booking booking = validateBookingForCheckin(bookingId, helperId);
        validateCheckinTimeWindow(booking);

        log.info("[CHECKIN][VERIFY][START] bookingId={}, helperId={}, challengeId={}, bookingStatus={}",
                bookingId,
                helperId,
                shortChallenge(request.getChallengeId()),
                booking.getStatus());

        CheckinChallengeState challenge = challengeStore.get(request.getChallengeId());
        if (challenge == null || !Objects.equals(challenge.bookingId(), bookingId)
                || !Objects.equals(challenge.helperId(), helperId)) {
            log.warn("[CHECKIN][VERIFY][FAIL] reason=INVALID_CHALLENGE bookingId={}, helperId={}, challengeId={}",
                    bookingId,
                    helperId,
                    shortChallenge(request.getChallengeId()));
            throw new ApiException("Challenge không hợp lệ hoặc không khớp booking", HttpStatus.BAD_REQUEST);
        }

        if (challenge.used()) {
            log.warn("[CHECKIN][VERIFY][FAIL] reason=CHALLENGE_USED bookingId={}, helperId={}, challengeId={}",
                    bookingId,
                    helperId,
                    shortChallenge(challenge.challengeId()));
            throw new ApiException("Challenge đã được sử dụng", HttpStatus.BAD_REQUEST);
        }

        if (challenge.expiresAt().isBefore(LocalDateTime.now())) {
            challengeStore.remove(challenge.challengeId());
            log.warn("[CHECKIN][VERIFY][FAIL] reason=CHALLENGE_EXPIRED bookingId={}, helperId={}, challengeId={}",
                    bookingId,
                    helperId,
                    shortChallenge(challenge.challengeId()));
            throw new ApiException("Challenge đã hết hạn, vui lòng tạo lại", HttpStatus.BAD_REQUEST);
        }

        if (challenge.attempts() >= maxAttempts) {
            challengeStore.remove(challenge.challengeId());
            log.warn(
                    "[CHECKIN][VERIFY][FAIL] reason=MAX_ATTEMPTS bookingId={}, helperId={}, challengeId={}, attempts={}, maxAttempts={}",
                    bookingId,
                    helperId,
                    shortChallenge(challenge.challengeId()),
                    challenge.attempts(),
                    maxAttempts);
            throw new ApiException("Bạn đã vượt quá số lần thử cho challenge này", HttpStatus.TOO_MANY_REQUESTS);
        }

        List<String> performed = request.getPerformedActions() == null
                ? List.of()
                : request.getPerformedActions().stream().map(String::toUpperCase).toList();
        List<String> missingActions = challenge.requiredActions().stream()
                .filter(action -> !performed.contains(action))
                .toList();

        boolean actionsSatisfied = missingActions.isEmpty();
        log.info(
                "[CHECKIN][VERIFY][ACTIONS] bookingId={}, helperId={}, challengeId={}, required={}, performed={}, missing={}, passed={}",
                bookingId,
                helperId,
                shortChallenge(challenge.challengeId()),
                challenge.requiredActions(),
                performed,
                missingActions,
                actionsSatisfied);

        if (!actionsSatisfied) {
            challengeStore.put(challenge.challengeId(), challenge.withAttempts(challenge.attempts() + 1));
            log.warn(
                    "[CHECKIN][VERIFY][FAIL] reason=ACTIONS_NOT_SATISFIED bookingId={}, helperId={}, challengeId={}, attempts={}",
                    bookingId,
                    helperId,
                    shortChallenge(challenge.challengeId()),
                    challenge.attempts() + 1);
            throw new ApiException("Bạn chưa hoàn thành đầy đủ các thao tác liveness", HttpStatus.BAD_REQUEST);
        }

        validateLocationWithinRadius(booking, request.getLatitude(), request.getLongitude());

        HelperProfile helperProfile = helperProfileRepository.findByUser_Id(helperId)
                .orElseThrow(() -> new ApiException("Không tìm thấy hồ sơ helper", HttpStatus.NOT_FOUND));

        if (helperProfile.getSelfieUrl() == null || helperProfile.getSelfieUrl().isBlank()) {
            log.warn("[CHECKIN][VERIFY][FAIL] reason=MISSING_SELFIE bookingId={}, helperId={}", bookingId, helperId);
            throw new ApiException("Helper chưa có ảnh selfie KYC để đối chiếu", HttpStatus.BAD_REQUEST);
        }

        String liveBase64 = sanitizeBase64(request.getLiveImageBase64());
        String proofImage = resolveProofImage(request);
        log.info("[CHECKIN][VERIFY][FACE_COMPARE_START] bookingId={}, helperId={}, challengeId={}, liveImageLength={}",
                bookingId,
                helperId,
                shortChallenge(challenge.challengeId()),
                liveBase64.length());

        FaceCompareResult compareResult = compareFace(helperProfile.getSelfieUrl(), liveBase64);

        if (!compareResult.success()) {
            challengeStore.put(challenge.challengeId(), challenge.withAttempts(challenge.attempts() + 1));
            log.warn(
                    "[CHECKIN][VERIFY][FAIL] reason=FACE_COMPARE_REJECTED bookingId={}, helperId={}, challengeId={}, attempts={}, message={}",
                    bookingId,
                    helperId,
                    shortChallenge(challenge.challengeId()),
                    challenge.attempts() + 1,
                    compareResult.message());
            return CheckinVerifyResponse.builder()
                    .matched(false)
                    .confidence(0d)
                    .threshold(minConfidence)
                    .bookingStatus(booking.getStatus().name())
                    .message(compareResult.message())
                    .build();
        }

        double confidence = compareResult.confidence();
        log.info("[CHECKIN][VERIFY][CONFIDENCE] bookingId={}, helperId={}, challengeId={}, confidence={}, threshold={}",
                bookingId,
                helperId,
                shortChallenge(challenge.challengeId()),
                confidence,
                minConfidence);

        if (confidence < minConfidence) {
            challengeStore.put(challenge.challengeId(), challenge.withAttempts(challenge.attempts() + 1));
            log.warn(
                    "[CHECKIN][VERIFY][FAIL] reason=LOW_CONFIDENCE bookingId={}, helperId={}, challengeId={}, attempts={}, confidence={}, threshold={}",
                    bookingId,
                    helperId,
                    shortChallenge(challenge.challengeId()),
                    challenge.attempts() + 1,
                    confidence,
                    minConfidence);
            return CheckinVerifyResponse.builder()
                    .matched(false)
                    .confidence(confidence)
                    .threshold(minConfidence)
                    .bookingStatus(booking.getStatus().name())
                    .message("Khuôn mặt không khớp, vui lòng thử lại!")
                    .build();
        }

        booking.setStatus(BookingStatus.ARRIVED);
        booking.setArrivedAt(LocalDateTime.now());
        booking.setArrivalProofImage(proofImage);
        bookingRepository.save(booking);

        challengeStore.remove(challenge.challengeId());
        log.info(
                "[CHECKIN][VERIFY][SUCCESS] bookingId={}, helperId={}, challengeId={}, newBookingStatus={}, confidence={}",
                bookingId,
                helperId,
                shortChallenge(challenge.challengeId()),
                BookingStatus.ARRIVED,
                confidence);

        // Realtime cho Customer: chuông + cập nhật màn quản lý bài đăng/chi tiết đơn không cần F5.
        try {
            Long customerId = booking.getCustomer() != null ? booking.getCustomer().getId() : null;
            if (customerId != null) {
                notificationService.createNotification(
                        customerId,
                        "Thợ đã check-in",
                        "Đơn #" + bookingId + ": Thợ đã xác nhận đến địa điểm. Vui lòng kiểm tra và xác nhận trên ứng dụng.",
                        "HELPER_CHECKIN");
            }
        } catch (Exception e) {
            log.warn("[CHECKIN] Skip customer notification: {}", e.getMessage());
        }

        try {
            bookingService.pushBookingUpdate(bookingId);
        } catch (Exception e) {
            log.warn("[CHECKIN] Skip booking_update push: {}", e.getMessage());
        }

        return CheckinVerifyResponse.builder()
                .matched(true)
                .confidence(confidence)
                .threshold(minConfidence)
                .bookingStatus(BookingStatus.ARRIVED.name())
                .message("Check-in thành công")
                .build();
    }

    private Booking validateBookingForCheckin(Long bookingId, Long helperId) {
        Booking booking = bookingRepository.findByIdAndHelper_Id(bookingId, helperId)
                .orElseThrow(
                        () -> new ApiException("Không tìm thấy booking hoặc bạn không có quyền", HttpStatus.NOT_FOUND));

        if (booking.getStatus() != BookingStatus.CONFIRMED) {
            throw new ApiException("Booking hiện không ở trạng thái cho phép check-in", HttpStatus.BAD_REQUEST);
        }

        return booking;
    }

    private FaceCompareResult compareFace(String selfieUrl, String liveBase64) {
        if (faceppApiKey == null || faceppApiKey.isBlank() || faceppApiSecret == null || faceppApiSecret.isBlank()) {
            throw new ApiException("Chưa cấu hình Face++ API key/secret", HttpStatus.INTERNAL_SERVER_ERROR);
        }

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("api_key", faceppApiKey);
        body.add("api_secret", faceppApiSecret);
        body.add("image_url1", selfieUrl);
        body.add("image_base64_2", liveBase64);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        ResponseEntity<Map<String, Object>> response;
        try {
            response = restTemplate.exchange(
                    RequestEntity
                            .post(URI
                                    .create(Objects.requireNonNull(faceppCompareUrl, "Face++ compare url is required")))
                            .contentType(MediaType.MULTIPART_FORM_DATA)
                            .body(body),
                    new ParameterizedTypeReference<>() {
                    });
        } catch (ResourceAccessException ex) {
            log.warn("[CHECKIN][FACEPP][TIMEOUT] compareUrl={}, message={}", faceppCompareUrl, ex.getMessage());
            throw new ApiException("Dịch vụ nhận diện khuôn mặt đang phản hồi chậm. Vui lòng thử lại sau vài giây.",
                    HttpStatus.GATEWAY_TIMEOUT);
        }

        Map<?, ?> responseBody = response.getBody();
        if (responseBody == null) {
            log.warn("[CHECKIN][FACEPP][FAIL] reason=EMPTY_RESPONSE");
            throw new ApiException("Không nhận được phản hồi từ Face++", HttpStatus.BAD_GATEWAY);
        }

        Object errorMessage = responseBody.get("error_message");
        if (errorMessage != null && !String.valueOf(errorMessage).isBlank()) {
            log.warn("[CHECKIN][FACEPP][FAIL] reason=ERROR_MESSAGE value={}", errorMessage);
            throw new ApiException("Face++ lỗi: " + errorMessage, HttpStatus.BAD_GATEWAY);
        }

        Object confidenceObj = responseBody.get("confidence");
        if (confidenceObj == null) {
            boolean faceMissing = isFaceMissing(responseBody);
            if (faceMissing) {
                log.info("[CHECKIN][FACEPP][NO_FACE] faces1/faces2 empty, cannot compute confidence");
                return new FaceCompareResult(false, 0d,
                        "Không nhận diện rõ khuôn mặt live. Vui lòng đủ sáng, nhìn thẳng camera và giữ máy ổn định.");
            }
            log.warn("[CHECKIN][FACEPP][FAIL] reason=MISSING_CONFIDENCE keys={}", responseBody.keySet());
            throw new ApiException("Không nhận được confidence từ Face++", HttpStatus.BAD_GATEWAY);
        }

        try {
            return new FaceCompareResult(true, Double.parseDouble(String.valueOf(confidenceObj)), "");
        } catch (NumberFormatException e) {
            throw new ApiException("Confidence từ Face++ không hợp lệ", HttpStatus.BAD_GATEWAY);
        }
    }

    private boolean isFaceMissing(Map<?, ?> responseBody) {
        Object faces1 = responseBody.get("faces1");
        Object faces2 = responseBody.get("faces2");

        boolean missing1 = !(faces1 instanceof List<?> list1) || list1.isEmpty();
        boolean missing2 = !(faces2 instanceof List<?> list2) || list2.isEmpty();
        return missing1 || missing2;
    }

    private String sanitizeBase64(String input) {
        if (input == null || input.isBlank()) {
            throw new ApiException("Ảnh live base64 không hợp lệ", HttpStatus.BAD_REQUEST);
        }

        int commaIdx = input.indexOf(',');
        if (commaIdx >= 0) {
            return input.substring(commaIdx + 1).replaceAll("\\s", "");
        }
        return input.replaceAll("\\s", "");
    }

    private String resolveProofImage(CheckinVerifyRequest request) {
        String proofImageUrl = request.getProofImageUrl();
        if (proofImageUrl != null && !proofImageUrl.isBlank()) {
            return proofImageUrl.trim();
        }

        String proofBase64 = request.getProofImageBase64();
        if (proofBase64 != null && !proofBase64.isBlank()) {
            return "data:image/jpeg;base64," + sanitizeBase64(proofBase64);
        }

        throw new ApiException("Thiếu ảnh chứng minh địa điểm", HttpStatus.BAD_REQUEST);
    }

    private void validateCheckinTimeWindow(Booking booking) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime start = booking.getScheduledStartTime();
        if (start == null) {
            throw new ApiException("Booking thiếu thời gian bắt đầu để xác thực check-in", HttpStatus.BAD_REQUEST);
        }

        LocalDateTime earliest = start.minusMinutes(allowedCheckinWindowMinutes);
        LocalDateTime latest = start.plusMinutes(allowedCheckinWindowMinutes);
        if (now.isBefore(earliest) || now.isAfter(latest)) {
            throw new ApiException(
                    "Chỉ được check-in trong khoảng trước/sau " + allowedCheckinWindowMinutes
                            + " phút so với lịch làm việc",
                    HttpStatus.BAD_REQUEST);
        }
    }

    private void validateLocationWithinRadius(Booking booking, BigDecimal latitude, BigDecimal longitude) {
        if (latitude == null || longitude == null) {
            throw new ApiException("Thiếu vị trí GPS để xác thực check-in", HttpStatus.BAD_REQUEST);
        }

        Address address = booking.getAddress();
        if (address == null || address.getLatitude() == null || address.getLongitude() == null) {
            throw new ApiException("Đơn hàng chưa có tọa độ địa chỉ để xác thực vị trí", HttpStatus.BAD_REQUEST);
        }

        double distanceMeters = GeoUtil.haversineMeters(
                latitude.doubleValue(),
                longitude.doubleValue(),
                address.getLatitude().doubleValue(),
                address.getLongitude().doubleValue());
        if (distanceMeters > maxCheckinDistanceMeters) {
            throw new ApiException(
                    String.format(
                            "Bạn đang cách địa điểm làm việc %.0f m, vượt quá giới hạn %.0f m để check-in",
                            distanceMeters,
                            maxCheckinDistanceMeters),
                    HttpStatus.BAD_REQUEST);
        }
    }

    private record FaceCompareResult(boolean success, double confidence, String message) {
    }

    private String shortChallenge(String challengeId) {
        if (challengeId == null || challengeId.isBlank()) {
            return "null";
        }
        return challengeId.length() <= 8 ? challengeId : challengeId.substring(0, 8);
    }

    private record CheckinChallengeState(
            String challengeId,
            Long bookingId,
            Long helperId,
            List<String> requiredActions,
            LocalDateTime expiresAt,
            boolean used,
            int attempts) {
        CheckinChallengeState withAttempts(int newAttempts) {
            return new CheckinChallengeState(challengeId, bookingId, helperId, requiredActions, expiresAt, used,
                    newAttempts);
        }
    }
}
