package com.homeconnect.core.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.homeconnect.core.dto.request.ChatParseRequest;
import com.homeconnect.core.dto.request.ChatSessionCreateRequest;
import com.homeconnect.core.dto.request.ChatSessionMessageRequest;
import com.homeconnect.core.dto.request.CreateJobPostRequest;
import com.homeconnect.core.dto.request.EstimatePriceRequest;
import com.homeconnect.core.dto.response.BookingResponse;
import com.homeconnect.core.dto.response.ChatParseResponse;
import com.homeconnect.core.dto.response.EstimatePriceResponse;
import com.homeconnect.core.dto.response.JobPostResponse;
import com.homeconnect.core.dto.response.chat.ChatHelperCandidateResponse;
import com.homeconnect.core.dto.response.chat.ChatMessageResponse;
import com.homeconnect.core.dto.response.chat.ChatSendMessageResponse;
import com.homeconnect.core.dto.response.chat.ChatSessionResponse;
import com.homeconnect.core.entity.Address;
import com.homeconnect.core.entity.ChatMessage;
import com.homeconnect.core.entity.ChatSession;
import com.homeconnect.core.entity.HelperProfile;
import com.homeconnect.core.entity.HelperSchedule;
import com.homeconnect.core.entity.JobApplication;
import com.homeconnect.core.entity.ServiceCategory;
import com.homeconnect.core.entity.Wallet;
import com.homeconnect.core.enums.ScheduleStatus;
import com.homeconnect.core.exception.ApiException;
import com.homeconnect.core.exception.InsufficientBalanceException;
import com.homeconnect.core.repository.AddressRepository;
import com.homeconnect.core.repository.ChatMessageRepository;
import com.homeconnect.core.repository.ChatSessionRepository;
import com.homeconnect.core.repository.HelperProfileRepository;
import com.homeconnect.core.repository.HelperScheduleRepository;
import com.homeconnect.core.repository.JobApplicationRepository;
import com.homeconnect.core.repository.ServiceCategoryRepository;
import com.homeconnect.core.repository.UserRepository;
import com.homeconnect.core.repository.WalletRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChatSessionService {
    private static final String INVALID_REQUEST_MESSAGE = "Yêu cầu không đúng, vui lòng nhập lại yêu cầu.";

    private final ChatSessionRepository chatSessionRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final HelperProfileRepository helperProfileRepository;
    private final HelperScheduleRepository helperScheduleRepository;
    private final ServiceCategoryRepository serviceCategoryRepository;
    private final WalletRepository walletRepository;
    private final UserRepository userRepository;
    private final AddressRepository addressRepository;
    private final JobApplicationRepository jobApplicationRepository;
    private final MatchingService matchingService;
    private final JobService jobService;
    private final BookingService bookingService;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${app.ai.parser-url:http://localhost:8000/api/v1/chat/parse}")
    private String aiParserUrl;

    @Transactional
    @SuppressWarnings("null")
    public ChatSessionResponse createSession(Long customerId, ChatSessionCreateRequest request) {
        String channel = "web";
        if (request != null && StringUtils.hasText(request.getChannel())) {
            channel = request.getChannel().trim().toLowerCase();
        }

        Map<String, Object> initialContext = new HashMap<>();

        ChatSession session = ChatSession.builder()
                .customerId(customerId)
                .channel(channel)
                .status("active")
                .contextJson(writeJson(initialContext))
                .build();

        ChatSession saved = Objects.requireNonNull(chatSessionRepository.save(session));
        return toSessionResponse(saved);
    }

    @Transactional(readOnly = true)
    public ChatSessionResponse getSession(Long sessionId, Long customerId) {
        return toSessionResponse(getOwnedSession(sessionId, customerId));
    }

    @Transactional(readOnly = true)
    public List<ChatSessionResponse> getSessions(Long customerId) {
        return chatSessionRepository.findByCustomerIdAndStatusNotOrderByUpdatedAtDesc(customerId, "deleted").stream()
                .map(this::toSessionResponse)
                .toList();
    }

    @Transactional
    public void deleteSession(Long sessionId, Long customerId) {
        ChatSession session = getOwnedSession(sessionId, customerId);
        session.setStatus("deleted");
        session.setEndedAt(LocalDateTime.now());
        chatSessionRepository.save(session);
    }

    @Transactional(readOnly = true)
    public List<ChatMessageResponse> getMessages(Long sessionId, Long customerId) {
        ChatSession session = getOwnedSession(sessionId, customerId);
        return chatMessageRepository.findBySessionIdOrderByCreatedAtAsc(session.getId()).stream()
                .map(this::toMessageResponse)
                .toList();
    }

    @Transactional
    public ChatSendMessageResponse sendMessage(Long sessionId, Long customerId, ChatSessionMessageRequest request) {
        ChatSession session = getOwnedSession(sessionId, customerId);
        String content = request.getMessage().trim();
        ChatMessage userMessage = saveMessage(session.getId(), "customer", "text", content, null, null);
        ChatParseResponse parsed = callParser(content);

        Map<String, Object> context = readJsonMap(session.getContextJson());
        context.put("lastUserMessage", content);
        if (isInvalidRequest(parsed)) {
            Map<String, Object> invalidStructured = new HashMap<>();
            invalidStructured.put("parsed", Map.of());
            invalidStructured.put("missingFields", List.of());
            String invalidFollowUp = parsed != null ? parsed.getFollowUpQuestion() : null;
            ChatMessage assistantMessage = saveMessage(
                    session.getId(),
                    "assistant",
                    "text",
                    StringUtils.hasText(invalidFollowUp)
                            ? invalidFollowUp
                            : INVALID_REQUEST_MESSAGE,
                    invalidStructured,
                    "chat-orchestrator");
            session.setContextJson(writeJson(context));
            chatSessionRepository.save(session);
            return ChatSendMessageResponse.builder()
                    .session(toSessionResponse(session))
                    .userMessage(toMessageResponse(userMessage))
                    .assistantMessage(toMessageResponse(assistantMessage))
                    .build();
        }
        mergeParsedIntoContext(context, parsed);
        session.setLastIntent("book_service");

        ChatMessage assistantMessage = buildAssistantForCurrentContext(session, customerId, context, parsed);
        session.setContextJson(writeJson(context));
        chatSessionRepository.save(session);

        return ChatSendMessageResponse.builder()
                .session(toSessionResponse(session))
                .userMessage(toMessageResponse(userMessage))
                .assistantMessage(toMessageResponse(assistantMessage))
                .build();
    }

    @Transactional
    public ChatSendMessageResponse selectHelper(Long sessionId, Long customerId, Long helperId) {
        ChatSession session = getOwnedSession(sessionId, customerId);
        if (helperId == null) {
            throw new ApiException("Thiếu helperId", HttpStatus.BAD_REQUEST);
        }

        Map<String, Object> context = readJsonMap(session.getContextJson());
        List<String> missingFields = computeMissingFields(context);
        if (!missingFields.isEmpty()) {
            throw new ApiException("Phiên chat chưa đủ thông tin: " + String.join(", ", missingFields),
                    HttpStatus.BAD_REQUEST);
        }

        var helper = userRepository.findById(helperId)
                .orElseThrow(() -> new ApiException("Không tìm thấy helper", HttpStatus.NOT_FOUND));
        var helperProfile = helperProfileRepository.findByUser_Id(helperId)
                .orElseThrow(() -> new ApiException("Không tìm thấy hồ sơ helper", HttpStatus.NOT_FOUND));

        BigDecimal estimatedPrice = calculateEstimatedPrice(context);
        Wallet wallet = walletRepository.findByUserId(customerId)
                .orElseThrow(() -> new ApiException("Không tìm thấy ví của khách hàng", HttpStatus.BAD_REQUEST));

        context.put("selectedHelperId", helperId);
        context.put("selectedHelperName", helper.getFullName());
        context.put("selectedHelperRating", helperProfile.getRatingAverage());
        context.put("estimatedPrice", estimatedPrice);
        session.setContextJson(writeJson(context));
        chatSessionRepository.save(session);

        Map<String, Object> structured = new HashMap<>();
        structured.put("helperId", helperId);
        structured.put("helperName", helper.getFullName());
        structured.put("estimatedPrice", estimatedPrice);
        structured.put("walletBalance", wallet.getAvailableBalance());
        structured.put("addressId", getInt(context, "addressId"));

        ChatMessage assistantMessage;
        if (wallet.getAvailableBalance().compareTo(estimatedPrice) < 0) {
            BigDecimal shortfall = estimatedPrice.subtract(wallet.getAvailableBalance());
            structured.put("requiredTopup", shortfall);
            structured.put("topupUrl", "/customer/wallet?chatSessionId=" + sessionId);
            assistantMessage = saveMessage(
                    session.getId(),
                    "assistant",
                    "payment_redirect",
                    String.format(
                            "Ví chưa đủ. Bạn cần nạp thêm %s VNĐ, nạp xong quay lại mình sẽ tiếp tục xác nhận đơn.",
                            shortfall.stripTrailingZeros().toPlainString()),
                    structured,
                    "chat-orchestrator");
        } else {
            structured.put("canConfirm", true);
            assistantMessage = saveMessage(
                    session.getId(),
                    "assistant",
                    "booking_confirm",
                    String.format("Mọi thứ ổn rồi. Bạn bấm xác nhận để đặt lịch với helper %s nhé.",
                            helper.getFullName()),
                    structured,
                    "chat-orchestrator");
        }

        return ChatSendMessageResponse.builder()
                .session(toSessionResponse(session))
                .assistantMessage(toMessageResponse(assistantMessage))
                .build();
    }

    @Transactional
    public ChatSendMessageResponse selectAddress(Long sessionId, Long customerId, Integer addressId) {
        if (addressId == null) {
            throw new ApiException("Thiếu addressId", HttpStatus.BAD_REQUEST);
        }
        ChatSession session = getOwnedSession(sessionId, customerId);
        Address address = addressRepository.findById(addressId)
                .orElseThrow(() -> new ApiException("Không tìm thấy địa chỉ", HttpStatus.NOT_FOUND));

        if (address.getUser() == null || !Objects.equals(address.getUser().getId(), customerId)) {
            throw new ApiException("Địa chỉ không thuộc về bạn", HttpStatus.FORBIDDEN);
        }

        Map<String, Object> context = readJsonMap(session.getContextJson());
        context.put("addressId", address.getAddressId());
        context.put("districtName", address.getDistrictName());
        context.put("provinceName", address.getProvinceName());
        context.put("fullAddress", buildAddressString(address));
        session.setContextJson(writeJson(context));
        chatSessionRepository.save(session);

        ChatMessage assistantMessage = buildAssistantForCurrentContext(session, customerId, context, null);
        return ChatSendMessageResponse.builder()
                .session(toSessionResponse(session))
                .assistantMessage(toMessageResponse(assistantMessage))
                .build();
    }

    @Transactional
    public ChatSendMessageResponse confirmBooking(Long sessionId, Long customerId) {
        ChatSession session = getOwnedSession(sessionId, customerId);
        Map<String, Object> context = readJsonMap(session.getContextJson());

        Long selectedHelperId = getLong(context, "selectedHelperId");
        if (selectedHelperId == null) {
            throw new ApiException("Bạn chưa chọn helper để xác nhận", HttpStatus.BAD_REQUEST);
        }

        Integer addressId = getInt(context, "addressId");
        if (addressId == null) {
            throw new ApiException("Thiếu địa chỉ đặt lịch. Vui lòng chọn địa chỉ mặc định trong Hồ sơ.",
                    HttpStatus.BAD_REQUEST);
        }

        Long createdPostId = null;
        try {
            CreateJobPostRequest request = buildCreateRequestFromContext(context, addressId);
            JobPostResponse post = jobService.createJobPost(request, customerId);
            createdPostId = post.getPostId();

            JobApplication application = JobApplication.builder()
                    .postId(post.getPostId())
                    .helperId(selectedHelperId)
                    .type("APPLIED")
                    .status("PENDING")
                    .build();
            @SuppressWarnings("null")
            JobApplication savedApp = jobApplicationRepository.save(application);

            BookingResponse booking = bookingService.selectApplicant(post.getPostId(), savedApp.getApplicationId(),
                    customerId);

            context.put("jobPostId", post.getPostId());
            context.put("bookingId", booking.getBookingId());
            context.put("bookingStatus", booking.getStatus() != null ? booking.getStatus().name() : "CONFIRMED");
            context.put("isBooked", true);
            session.setStatus("closed");
            session.setEndedAt(LocalDateTime.now());
            session.setContextJson(writeJson(context));
            chatSessionRepository.save(session);

            Map<String, Object> structured = new HashMap<>();
            structured.put("bookingId", booking.getBookingId());
            structured.put("jobPostId", post.getPostId());
            structured.put("helperId", selectedHelperId);
            structured.put("totalPrice", booking.getTotalPrice());
            structured.put("bookingDetailUrl", "/customer/bookings/" + booking.getBookingId());

            ChatMessage assistantMessage = saveMessage(
                    session.getId(),
                    "assistant",
                    "booking_created",
                    "Đã đặt lịch thành công. Bạn có thể xem chi tiết lịch ngay bây giờ.",
                    structured,
                    "chat-orchestrator");

            return ChatSendMessageResponse.builder()
                    .session(toSessionResponse(session))
                    .assistantMessage(toMessageResponse(assistantMessage))
                    .build();
        } catch (ApiException ex) {
            if (isHelperRaceConflict(ex)) {
                safelyRollbackCreatedPost(createdPostId, customerId);
                List<ChatHelperCandidateResponse> alternatives = findCandidates(customerId, context).helpers().stream()
                        .filter(item -> !Objects.equals(item.getHelperId(), selectedHelperId))
                        .toList();

                Map<String, Object> structured = new HashMap<>();
                structured.put("helpers", alternatives);
                structured.put("raceConflict", true);
                structured.put("conflictReason", ex.getMessage());

                ChatMessage assistantMessage;
                if (alternatives.isEmpty()) {
                    assistantMessage = saveMessage(
                            session.getId(),
                            "assistant",
                            "text",
                            "Helper bạn chọn vừa bận mất slot rồi, hiện mình chưa có helper thay thế phù hợp. Bạn đổi giờ giúp mình nhé.",
                            structured,
                            "chat-orchestrator");
                } else {
                    assistantMessage = saveMessage(
                            session.getId(),
                            "assistant",
                            "helper_list",
                            "Helper bạn chọn vừa được chốt bởi người khác. Mình gợi ý ngay các helper thay thế phù hợp:",
                            structured,
                            "chat-orchestrator");
                }

                return ChatSendMessageResponse.builder()
                        .session(toSessionResponse(session))
                        .assistantMessage(toMessageResponse(assistantMessage))
                        .build();
            }
            throw ex;
        } catch (InsufficientBalanceException ex) {
            safelyRollbackCreatedPost(createdPostId, customerId);
            Wallet wallet = walletRepository.findByUserId(customerId).orElse(null);
            BigDecimal estimatedPrice = calculateEstimatedPrice(context);
            BigDecimal available = wallet != null ? wallet.getAvailableBalance() : BigDecimal.ZERO;
            BigDecimal shortfall = estimatedPrice.subtract(available).max(BigDecimal.ZERO);

            Map<String, Object> structured = new HashMap<>();
            structured.put("requiredTopup", shortfall);
            structured.put("estimatedPrice", estimatedPrice);
            structured.put("walletBalance", available);
            structured.put("topupUrl", "/customer/wallet?chatSessionId=" + sessionId);
            ChatMessage assistantMessage = saveMessage(
                    session.getId(),
                    "assistant",
                    "payment_redirect",
                    "Trong lúc xác nhận đơn, ví của bạn không đủ số dư. Bạn nạp thêm rồi quay lại nhé.",
                    structured,
                    "chat-orchestrator");

            return ChatSendMessageResponse.builder()
                    .session(toSessionResponse(session))
                    .assistantMessage(toMessageResponse(assistantMessage))
                    .build();
        }
    }

    @Transactional
    public ChatSendMessageResponse resumeAfterTopup(Long sessionId, Long customerId) {
        ChatSession session = getOwnedSession(sessionId, customerId);
        Map<String, Object> context = readJsonMap(session.getContextJson());

        Long selectedHelperId = getLong(context, "selectedHelperId");
        if (selectedHelperId == null) {
            ChatMessage assistantMessage = saveMessage(
                    session.getId(),
                    "assistant",
                    "text",
                    "Bạn chưa chọn helper trước đó. Mình sẽ tiếp tục từ bước gợi ý helper nhé.",
                    Map.of(),
                    "chat-orchestrator");
            return ChatSendMessageResponse.builder()
                    .session(toSessionResponse(session))
                    .assistantMessage(toMessageResponse(assistantMessage))
                    .build();
        }

        BigDecimal estimatedPrice = calculateEstimatedPrice(context);
        Wallet wallet = walletRepository.findByUserId(customerId)
                .orElseThrow(() -> new ApiException("Không tìm thấy ví của khách hàng", HttpStatus.BAD_REQUEST));

        Map<String, Object> structured = new HashMap<>();
        structured.put("helperId", selectedHelperId);
        structured.put("estimatedPrice", estimatedPrice);
        structured.put("walletBalance", wallet.getAvailableBalance());

        ChatMessage assistantMessage;
        if (wallet.getAvailableBalance().compareTo(estimatedPrice) < 0) {
            BigDecimal shortfall = estimatedPrice.subtract(wallet.getAvailableBalance());
            structured.put("requiredTopup", shortfall);
            structured.put("topupUrl", "/customer/wallet?chatSessionId=" + sessionId);
            assistantMessage = saveMessage(
                    session.getId(),
                    "assistant",
                    "payment_redirect",
                    "Mình đã kiểm tra lại, ví vẫn chưa đủ để xác nhận đơn. Bạn nạp thêm giúp mình nhé.",
                    structured,
                    "chat-orchestrator");
        } else {
            structured.put("canConfirm", true);
            assistantMessage = saveMessage(
                    session.getId(),
                    "assistant",
                    "booking_confirm",
                    "Mình thấy ví đã đủ tiền rồi. Bạn bấm xác nhận để tạo booking luôn nhé.",
                    structured,
                    "chat-orchestrator");
        }

        return ChatSendMessageResponse.builder()
                .session(toSessionResponse(session))
                .assistantMessage(toMessageResponse(assistantMessage))
                .build();
    }

    private ChatMessage buildAssistantForCurrentContext(ChatSession session, Long customerId,
            Map<String, Object> context,
            ChatParseResponse parsed) {
        List<String> missingFields = computeMissingFields(context);
        Map<String, Object> structured = new HashMap<>();
        structured.put("parsed", context);
        structured.put("missingFields", missingFields);

        if (isInvalidRequest(parsed)) {
            Map<String, Object> invalidStructured = new HashMap<>();
            invalidStructured.put("parsed", Map.of());
            invalidStructured.put("missingFields", List.of());
            String invalidFollowUp = parsed != null ? parsed.getFollowUpQuestion() : null;
            return saveMessage(
                    session.getId(),
                    "assistant",
                    "text",
                    StringUtils.hasText(invalidFollowUp)
                            ? invalidFollowUp
                            : INVALID_REQUEST_MESSAGE,
                    invalidStructured,
                    "chat-orchestrator");
        }

        if (!missingFields.isEmpty()) {
            if (missingFields.contains("addressId")) {
                structured.put("addresses", getAddressOptions(customerId));
                return saveMessage(
                        session.getId(),
                        "assistant",
                        "address_list",
                        "Bạn chọn địa chỉ làm việc trước giúp mình, rồi mình sẽ gợi ý helper phù hợp.",
                        structured,
                        "chat-orchestrator");
            }
            String followUp = buildFollowUpQuestion(parsed, missingFields);
            return saveMessage(session.getId(), "assistant", "text", followUp, structured, "chat-orchestrator");
        }

        CandidateSearchResult candidateResult = findCandidates(customerId, context);
        structured.put("helpers", candidateResult.helpers());
        if (candidateResult.reasonCode() != null) {
            structured.put("noHelperReason", candidateResult.reasonCode());
        }
        if (candidateResult.helpers().isEmpty()) {
            return saveMessage(
                    session.getId(),
                    "assistant",
                    "text",
                    candidateResult.message(),
                    structured,
                    "chat-orchestrator");
        }

        return saveMessage(
                session.getId(),
                "assistant",
                "helper_list",
                "Mình đã tìm được các helper phù hợp. Bạn chọn một người để tiếp tục nhé.",
                structured,
                "chat-orchestrator");
    }

    private boolean isInvalidRequest(ChatParseResponse parsed) {
        if (parsed == null) {
            return false;
        }
        boolean isFlaggedInvalid = parsed.getRaw() != null
                && Boolean.TRUE.equals(parsed.getRaw().get("invalidRequest"));
        boolean hasInvalidFollowUp = INVALID_REQUEST_MESSAGE.equals(parsed.getFollowUpQuestion());
        return isFlaggedInvalid || hasInvalidFollowUp;
    }

    private ChatParseResponse callParser(String message) {
        try {
            if (!StringUtils.hasText(aiParserUrl)) {
                throw new ApiException("Chưa cấu hình AI parser URL", HttpStatus.INTERNAL_SERVER_ERROR);
            }
            String parserUrl = aiParserUrl.trim();
            ChatParseRequest parseRequest = ChatParseRequest.builder().message(message).build();
            @SuppressWarnings("null")
            ChatParseResponse parsed = restTemplate.postForObject(parserUrl, parseRequest, ChatParseResponse.class);
            if (parsed == null) {
                throw new ApiException("Không nhận được phản hồi từ AI parser", HttpStatus.BAD_GATEWAY);
            }
            return parsed;
        } catch (ApiException ex) {
            throw ex;
        } catch (Exception ex) {
            log.error("Chat parser call failed", ex);
            throw new ApiException("Không parse được tin nhắn đặt lịch", HttpStatus.BAD_GATEWAY);
        }
    }

    private CandidateSearchResult findCandidates(Long customerId, Map<String, Object> context) {
        Integer categoryId = getInt(context, "categoryId");
        Integer durationHours = getInt(context, "durationHours");
        String workDate = getString(context, "workDate");
        String startTime = getString(context, "startTime");
        Integer addressId = getInt(context, "addressId");

        if (categoryId == null || durationHours == null || !StringUtils.hasText(workDate)
                || !StringUtils.hasText(startTime)
                || addressId == null) {
            return new CandidateSearchResult(
                    List.of(),
                    "INVALID_INPUT",
                    "Thông tin đặt lịch chưa hợp lệ. Bạn kiểm tra lại ngày giờ giúp mình nhé.");
        }

        Address customerAddress = addressRepository.findById(addressId).orElse(null);
        String districtHint = customerAddress != null ? customerAddress.getDistrictName()
                : getString(context, "districtName");

        LocalDate date = LocalDate.parse(workDate);
        LocalTime time = LocalTime.parse(startTime);
        MatchingService.MatchResult matchResult = matchingService.findMatchingHelperIdsWithReason(
                categoryId, date, time, durationHours, districtHint);
        List<Long> helperIds = matchResult.getHelperIds();
        if (helperIds.isEmpty()) {
            return new CandidateSearchResult(List.of(), mapNoHelperReasonCode(matchResult.getFailureReason()),
                    mapNoHelperMessage(matchResult.getFailureReason()));
        }

        EstimatePriceResponse estimate = estimatePriceDetails(context);
        BigDecimal estimatedPrice = estimate != null && estimate.getEstimatedPrice() != null
                ? estimate.getEstimatedPrice()
                : calculateEstimatedPrice(context);
        BigDecimal basePrice = estimate != null && estimate.getBasePrice() != null ? estimate.getBasePrice()
                : BigDecimal.ZERO;
        List<EstimatePriceResponse.ServiceFee> subFees = estimate != null && estimate.getServiceFees() != null
                ? estimate.getServiceFees()
                : List.of();
        BigDecimal subServiceTotal = subFees.stream()
                .map(fee -> fee.getPrice() != null ? fee.getPrice() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal rawOtherFee = estimatedPrice.subtract(basePrice).subtract(subServiceTotal);
        final BigDecimal otherFee = rawOtherFee.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : rawOtherFee;
        Map<Long, HelperProfile> profileMap = helperProfileRepository.findByUser_IdIn(helperIds).stream()
                .collect(Collectors.toMap(h -> h.getUser().getId(), h -> h));
        Map<Long, Address> helperAddressMap = addressRepository.findDefaultAddressesByUserIds(helperIds).stream()
                .collect(Collectors.toMap(a -> a.getUser().getId(), a -> a));

        List<ChatHelperCandidateResponse> helpers = helperIds.stream()
                .map(helperId -> {
                    HelperProfile profile = profileMap.get(helperId);
                    if (profile == null || profile.getUser() == null) {
                        return null;
                    }
                    List<HelperSchedule> schedules = helperScheduleRepository.findByHelperIdAndWorkDateAndStatusIn(
                            helperId, date, List.of(ScheduleStatus.AVAILABLE));
                    HelperSchedule matchedSlot = schedules.stream()
                            .filter(s -> s.getStartTime().compareTo(time) <= 0
                                    && s.getEndTime().compareTo(time.plusHours(durationHours)) >= 0)
                            .findFirst()
                            .orElse(null);

                    Address helperAddress = helperAddressMap.get(helperId);
                    BigDecimal distanceKm = computeDistanceKm(customerAddress, helperAddress);
                    String districtName = helperAddress != null ? helperAddress.getDistrictName() : null;

                    return ChatHelperCandidateResponse.builder()
                            .helperId(helperId)
                            .fullName(profile.getUser().getFullName())
                            .avatarUrl(profile.getUser().getAvatarUrl())
                            .ratingAverage(profile.getRatingAverage())
                            .totalReviews(profile.getTotalReviews())
                            .estimatedPrice(estimatedPrice)
                            .districtName(districtName)
                            .distanceKm(distanceKm)
                            .availableStartTime(matchedSlot != null ? matchedSlot.getStartTime() : null)
                            .availableEndTime(matchedSlot != null ? matchedSlot.getEndTime() : null)
                            .basePrice(basePrice)
                            .otherFee(otherFee)
                            .subServices(subFees.stream()
                                    .map(fee -> ChatHelperCandidateResponse.ServiceFeeItem.builder()
                                            .name(fee.getName())
                                            .price(fee.getPrice())
                                            .build())
                                    .toList())
                            .build();
                })
                .filter(Objects::nonNull)
                .sorted(Comparator
                        .comparing(ChatHelperCandidateResponse::getDistanceKm,
                                Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(ChatHelperCandidateResponse::getRatingAverage,
                                Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(5)
                .toList();
        return new CandidateSearchResult(helpers, null, null);
    }

    private String mapNoHelperReasonCode(MatchingService.MatchFailureReason reason) {
        if (reason == null)
            return "UNKNOWN";
        return switch (reason) {
            case INVALID_INPUT -> "INVALID_INPUT";
            case NO_AVAILABLE_SLOT -> "NO_AVAILABLE_SLOT";
            case NO_HELPER_IN_DISTRICT -> "NO_HELPER_IN_DISTRICT";
            case NO_HELPER_MEET_RATING -> "NO_HELPER_MEET_RATING";
            default -> "UNKNOWN";
        };
    }

    private String mapNoHelperMessage(MatchingService.MatchFailureReason reason) {
        if (reason == null) {
            return "Mình chưa tìm được helper phù hợp. Bạn thử đổi giờ hoặc khu vực nhé.";
        }
        return switch (reason) {
            case NO_AVAILABLE_SLOT -> "Không có helper rảnh đúng khung giờ bạn chọn. Bạn thử đổi giờ hoặc ngày nhé.";
            case NO_HELPER_IN_DISTRICT ->
                "Hiện chưa có helper nhận việc tại khu vực này. Bạn thử đổi địa chỉ hoặc khu vực lân cận nhé.";
            case NO_HELPER_MEET_RATING ->
                "Hiện chưa có helper phù hợp theo tiêu chí chất lượng. Bạn thử đổi giờ hoặc khu vực nhé.";
            case INVALID_INPUT -> "Thông tin đặt lịch chưa hợp lệ. Bạn kiểm tra lại ngày giờ giúp mình nhé.";
            default -> "Mình chưa tìm được helper phù hợp. Bạn thử đổi giờ hoặc khu vực nhé.";
        };
    }

    private record CandidateSearchResult(
            List<ChatHelperCandidateResponse> helpers,
            String reasonCode,
            String message) {
    }

    private BigDecimal calculateEstimatedPrice(Map<String, Object> context) {
        Integer categoryId = getInt(context, "categoryId");
        Integer durationHours = getInt(context, "durationHours");
        if (categoryId == null || durationHours == null) {
            return BigDecimal.ZERO;
        }

        try {
            EstimatePriceResponse estimate = estimatePriceDetails(context);
            if (estimate != null && estimate.getEstimatedPrice() != null) {
                return estimate.getEstimatedPrice();
            }
        } catch (Exception ex) {
            log.warn("Cannot estimate price from jobService: {}", ex.getMessage());
        }

        ServiceCategory category = serviceCategoryRepository.findById(categoryId).orElse(null);
        BigDecimal basePrice = category != null && category.getBasePrice() != null ? category.getBasePrice()
                : BigDecimal.ZERO;
        return basePrice.multiply(BigDecimal.valueOf(durationHours));
    }

    private EstimatePriceResponse estimatePriceDetails(Map<String, Object> context) {
        Integer categoryId = getInt(context, "categoryId");
        Integer durationHours = getInt(context, "durationHours");
        if (categoryId == null || durationHours == null) {
            return null;
        }

        EstimatePriceRequest req = EstimatePriceRequest.builder()
                .categoryId(categoryId)
                .durationHours(durationHours)
                .serviceIds(getIntList(context, "serviceIds"))
                .workSize(getDouble(context, "workSize"))
                .additionalData(getMap(context, "additionalData"))
                .build();
        return jobService.estimatePrice(req);
    }

    private List<Map<String, Object>> getAddressOptions(Long customerId) {
        return addressRepository.findByUser_Id(customerId).stream()
                .map(addr -> {
                    Map<String, Object> item = new HashMap<>();
                    item.put("addressId", addr.getAddressId());
                    item.put("addressDetail", addr.getAddressDetail());
                    item.put("wardName", addr.getWardName());
                    item.put("districtName", addr.getDistrictName());
                    item.put("provinceName", addr.getProvinceName());
                    item.put("isDefault", addr.getIsDefault());
                    item.put("fullAddress", buildAddressString(addr));
                    return item;
                })
                .toList();
    }

    private CreateJobPostRequest buildCreateRequestFromContext(Map<String, Object> context, Integer addressId) {
        Integer categoryId = getInt(context, "categoryId");
        Integer durationHours = getInt(context, "durationHours");
        String workDate = getString(context, "workDate");
        String startTime = getString(context, "startTime");
        if (categoryId == null || durationHours == null || !StringUtils.hasText(workDate)
                || !StringUtils.hasText(startTime)) {
            throw new ApiException("Ngữ cảnh chat chưa đủ dữ liệu để tạo booking", HttpStatus.BAD_REQUEST);
        }

        return CreateJobPostRequest.builder()
                .categoryId(categoryId)
                .serviceIds(getIntList(context, "serviceIds"))
                .workDate(LocalDate.parse(workDate))
                .startTime(LocalTime.parse(startTime))
                .durationHours(durationHours)
                .addressId(addressId)
                .title("Đặt lịch từ chatbot")
                .description(getString(context, "lastUserMessage"))
                .workSize(getDouble(context, "workSize"))
                .additionalData(getMap(context, "additionalData"))
                .build();
    }

    private String buildFollowUpQuestion(ChatParseResponse parsed, List<String> missingFields) {
        if (parsed != null && StringUtils.hasText(parsed.getFollowUpQuestion())) {
            return parsed.getFollowUpQuestion();
        }
        Map<String, String> labels = Map.of(
                "categoryId", "dịch vụ",
                "durationHours", "số giờ",
                "workDate", "ngày làm",
                "startTime", "giờ bắt đầu",
                "addressId", "địa chỉ làm việc");
        String missing = missingFields.stream().map(key -> labels.getOrDefault(key, key))
                .collect(Collectors.joining(", "));
        return "Mình còn thiếu " + missing + ". Bạn bổ sung giúp mình nhé?";
    }

    private List<String> computeMissingFields(Map<String, Object> context) {
        List<String> missing = new ArrayList<>();
        if (getInt(context, "categoryId") == null)
            missing.add("categoryId");
        if (getInt(context, "durationHours") == null)
            missing.add("durationHours");
        if (!StringUtils.hasText(getString(context, "workDate")))
            missing.add("workDate");
        if (!StringUtils.hasText(getString(context, "startTime")))
            missing.add("startTime");
        if (getInt(context, "addressId") == null)
            missing.add("addressId");
        return missing;
    }

    private void mergeParsedIntoContext(Map<String, Object> context, ChatParseResponse parsed) {
        if (parsed == null) {
            return;
        }
        if (parsed.getCategoryId() != null)
            context.put("categoryId", parsed.getCategoryId());
        if (parsed.getDurationHours() != null)
            context.put("durationHours", parsed.getDurationHours());
        if (StringUtils.hasText(parsed.getWorkDate()))
            context.put("workDate", parsed.getWorkDate());
        if (StringUtils.hasText(parsed.getStartTime()))
            context.put("startTime", parsed.getStartTime());
        if (StringUtils.hasText(parsed.getAddressText()))
            context.put("addressText", parsed.getAddressText());
        if (parsed.getServiceIds() != null && !parsed.getServiceIds().isEmpty())
            context.put("serviceIds", parsed.getServiceIds());
        context.put("needsAddressConfirmation", parsed.getNeedsAddressConfirmation());
    }

    private Integer getInt(Map<String, Object> data, String key) {
        Object value = data.get(key);
        if (value == null)
            return null;
        if (value instanceof Integer i)
            return i;
        if (value instanceof Number n)
            return n.intValue();
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private Long getLong(Map<String, Object> data, String key) {
        Object value = data.get(key);
        if (value == null)
            return null;
        if (value instanceof Long l)
            return l;
        if (value instanceof Number n)
            return n.longValue();
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> getMap(Map<String, Object> data, String key) {
        Object value = data.get(key);
        if (value instanceof Map<?, ?> map) {
            return (Map<String, Object>) map;
        }
        return null;
    }

    private Double getDouble(Map<String, Object> data, String key) {
        Object value = data.get(key);
        if (value == null)
            return null;
        if (value instanceof Number n)
            return n.doubleValue();
        try {
            return Double.parseDouble(String.valueOf(value));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private List<Integer> getIntList(Map<String, Object> data, String key) {
        Object value = data.get(key);
        if (!(value instanceof List<?> list)) {
            return List.of();
        }
        return list.stream()
                .map(item -> {
                    if (item instanceof Number n)
                        return n.intValue();
                    try {
                        return Integer.parseInt(String.valueOf(item));
                    } catch (NumberFormatException ex) {
                        return null;
                    }
                })
                .filter(Objects::nonNull)
                .toList();
    }

    private String getString(Map<String, Object> data, String key) {
        Object value = data.get(key);
        return value == null ? null : String.valueOf(value);
    }

    private ChatSession getOwnedSession(Long sessionId, Long customerId) {
        return chatSessionRepository.findByIdAndCustomerId(sessionId, customerId)
                .orElseThrow(() -> new ApiException("Không tìm thấy phiên chat", HttpStatus.NOT_FOUND));
    }

    private ChatMessage saveMessage(Long sessionId, String sender, String messageType, String content,
            Map<String, Object> structuredData, String modelName) {
        ChatMessage message = ChatMessage.builder()
                .sessionId(sessionId)
                .sender(sender)
                .messageType(messageType)
                .content(content)
                .structuredData(structuredData == null ? null : writeJson(structuredData))
                .modelName(modelName)
                .build();
        @SuppressWarnings("null")
        ChatMessage saved = chatMessageRepository.save(message);
        return Objects.requireNonNull(saved);
    }

    private ChatSessionResponse toSessionResponse(ChatSession session) {
        return ChatSessionResponse.builder()
                .id(session.getId())
                .customerId(session.getCustomerId())
                .channel(session.getChannel())
                .status(session.getStatus())
                .context(readJsonMap(session.getContextJson()))
                .lastIntent(session.getLastIntent())
                .createdAt(session.getCreatedAt())
                .updatedAt(session.getUpdatedAt())
                .endedAt(session.getEndedAt())
                .build();
    }

    private ChatMessageResponse toMessageResponse(ChatMessage message) {
        return ChatMessageResponse.builder()
                .id(message.getId())
                .sessionId(message.getSessionId())
                .sender(message.getSender())
                .messageType(message.getMessageType())
                .content(message.getContent())
                .structuredData(readJsonMap(message.getStructuredData()))
                .modelName(message.getModelName())
                .tokensInput(message.getTokensInput())
                .tokensOutput(message.getTokensOutput())
                .latencyMs(message.getLatencyMs())
                .createdAt(message.getCreatedAt())
                .build();
    }

    private Map<String, Object> readJsonMap(String json) {
        if (!StringUtils.hasText(json)) {
            return new HashMap<>();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<>() {
            });
        } catch (Exception ex) {
            log.warn("Cannot parse json map: {}", ex.getMessage());
            return new HashMap<>();
        }
    }

    private String writeJson(Map<String, Object> map) {
        try {
            return objectMapper.writeValueAsString(map == null ? Map.of() : map);
        } catch (Exception ex) {
            throw new ApiException("Không thể xử lý dữ liệu chat", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    private String buildAddressString(Address address) {
        if (address == null)
            return null;
        return String.join(", ",
                Optional.ofNullable(address.getAddressDetail()).orElse(""),
                Optional.ofNullable(address.getWardName()).orElse(""),
                Optional.ofNullable(address.getDistrictName()).orElse(""),
                Optional.ofNullable(address.getProvinceName()).orElse(""))
                .replaceAll(",\\s*,", ",")
                .replaceAll("^,\\s*|,\\s*$", "")
                .trim();
    }

    private boolean isHelperRaceConflict(ApiException ex) {
        if (ex == null) {
            return false;
        }
        if (HttpStatus.CONFLICT.equals(ex.getStatus())) {
            return true;
        }
        String message = ex.getMessage() == null ? "" : ex.getMessage().toLowerCase();
        return message.contains("không còn lịch trống")
                || message.contains("khong con lich trong")
                || message.contains("xung đột")
                || message.contains("xung dot");
    }

    private void safelyRollbackCreatedPost(Long postId, Long customerId) {
        if (postId == null || customerId == null) {
            return;
        }
        try {
            jobService.cancelJobPost(postId, customerId);
        } catch (Exception ex) {
            log.warn("Cannot rollback temporary post {} after confirm failure: {}", postId, ex.getMessage());
        }
    }

    private BigDecimal computeDistanceKm(Address a, Address b) {
        if (a == null || b == null || a.getLatitude() == null || a.getLongitude() == null
                || b.getLatitude() == null || b.getLongitude() == null) {
            return null;
        }
        double lat1 = Math.toRadians(a.getLatitude().doubleValue());
        double lon1 = Math.toRadians(a.getLongitude().doubleValue());
        double lat2 = Math.toRadians(b.getLatitude().doubleValue());
        double lon2 = Math.toRadians(b.getLongitude().doubleValue());
        double dLat = lat2 - lat1;
        double dLon = lon2 - lon1;
        double hav = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav));
        double km = 6371.0 * c;
        return BigDecimal.valueOf(km).setScale(2, RoundingMode.HALF_UP);
    }
}
