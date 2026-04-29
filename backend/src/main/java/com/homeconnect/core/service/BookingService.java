package com.homeconnect.core.service;

import com.homeconnect.core.dto.request.DirectBookingRequest;
import com.homeconnect.core.dto.request.BookingReportRequest;
import com.homeconnect.core.dto.request.HelperDisputeResponseRequest;
import com.homeconnect.core.dto.request.admin.AdminResolveDisputeRequest;
import com.homeconnect.core.dto.response.BookingResponse;
import com.homeconnect.core.dto.response.JobApplicantResponse;
import com.homeconnect.core.dto.response.admin.AdminDisputeItemResponse;
import com.homeconnect.core.dto.response.admin.AdminDisputeListResponse;
import com.homeconnect.core.entity.*;
import com.homeconnect.core.enums.BookingStatus;
import com.homeconnect.core.enums.CustomerTier;
import com.homeconnect.core.enums.DisputeResolutionAction;
import com.homeconnect.core.enums.PaymentStatus;
import com.homeconnect.core.enums.ScheduleStatus;
import com.homeconnect.core.exception.ApiException;
import com.homeconnect.core.repository.*;
import com.homeconnect.core.util.ConflictEngine;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.math.BigDecimal;
import java.math.RoundingMode;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class BookingService {
    private static final List<BookingStatus> ACTIVE_BOOKING_STATUSES = List.of(
            BookingStatus.PENDING_ACCEPTANCE,
            BookingStatus.CONFIRMED,
            BookingStatus.ARRIVED,
            BookingStatus.IN_PROGRESS,
            BookingStatus.PENDING_COMPLETION);
    private static final List<BookingStatus> ADMIN_CANCEL_ALLOWED_STATUSES = List.of(
            BookingStatus.PENDING,
            BookingStatus.PENDING_ACCEPTANCE,
            BookingStatus.CONFIRMED);
    private static final List<BookingStatus> ADMIN_NO_SHOW_ALLOWED_STATUSES = List.of(
            BookingStatus.CONFIRMED,
            BookingStatus.ARRIVED);

    private final BookingRepository bookingRepository;
    private final AddressRepository addressRepository;
    private final HelperScheduleRepository helperScheduleRepository;
    private final WalletService walletService;
    private final NotificationService notificationService;
    private final JobPostRepository jobPostRepository;
    private final JobApplicationRepository jobApplicationRepository;
    private final UserRepository userRepository;
    private final HelperProfileRepository helperProfileRepository;
    private final ServiceCategoryRepository serviceCategoryRepository;
    private final HelperServiceRepository helperServiceRepository;
    private final ReviewRepository reviewRepository;
    private final UserViolationRepository userViolationRepository;
    private final ConflictEngine conflictEngine;
    private final AdminAuditLogService adminAuditLogService;
    private final LoyaltyService loyaltyService;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    /**
     * Xác nhận đơn hàng và cập nhật lịch của Helper sang BUSY
     */
    @Transactional
    public void confirmBooking(Long bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ApiException("Booking not found", HttpStatus.NOT_FOUND));

        if (booking.getStatus() != BookingStatus.PENDING) {
            throw new ApiException("Booking is already processed", HttpStatus.BAD_REQUEST);
        }

        // 1. Tìm slot rảnh tương ứng của Helper
        List<HelperSchedule> schedules = helperScheduleRepository.findByHelperIdAndWorkDateAndStatusIn(
                booking.getHelper().getId(),
                booking.getScheduledStartTime().toLocalDate(),
                List.of(ScheduleStatus.AVAILABLE));

        HelperSchedule targetSchedule = null;
        for (HelperSchedule schedule : schedules) {
            if (conflictEngine.isOverlap(
                    booking.getScheduledStartTime().toLocalTime(),
                    booking.getScheduledEndTime().toLocalTime(),
                    schedule.getStartTime(),
                    schedule.getEndTime())) {
                targetSchedule = schedule;
                break;
            }
        }

        if (targetSchedule == null) {
            throw new ApiException("Không tìm thấy lịch rảnh phù hợp.", HttpStatus.CONFLICT);
        }

        // 2b. Kiểm tra buffer di chuyển 30 phút với các slot BUSY khác trong ngày
        List<HelperSchedule> busySlotsOnDay = helperScheduleRepository.findByHelperIdAndWorkDateAndStatusIn(
                booking.getHelper().getId(),
                booking.getScheduledStartTime().toLocalDate(),
                List.of(ScheduleStatus.BUSY));

        for (HelperSchedule busySlot : busySlotsOnDay) {
            if (busySlot.getId().equals(targetSchedule.getId()))
                continue; // bỏ qua chính nó
            if (conflictEngine.checkConflictWithBuffer(
                    booking.getScheduledStartTime().toLocalTime(),
                    booking.getScheduledEndTime().toLocalTime(),
                    busySlot,
                    ConflictEngine.TRAVEL_BUFFER_MINUTES)) {
                throw new ApiException(
                        "Không thể xác nhận đơn hàng: Helper cần ít nhất 30 phút di chuyển giữa các đơn.",
                        HttpStatus.CONFLICT);
            }
        }

        // 3. Cập nhật trạng thái
        booking.setStatus(BookingStatus.CONFIRMED);
        targetSchedule.setStatus(ScheduleStatus.BUSY);
        targetSchedule.setBooking(booking);

        bookingRepository.save(booking);
        helperScheduleRepository.save(targetSchedule);
    }

    /**
     * Lấy danh sách thợ đã ứng tuyển cho một Job Post
     */
    @Transactional(readOnly = true)
    public List<JobApplicantResponse> getApplicants(Long jobId) {
        List<JobApplication> applications = jobApplicationRepository.findByPostId(jobId);
        return applications.stream().map(app -> {
            User helper = userRepository.findById(app.getHelperId()).orElse(null);
            // Sử dụng findByUser_Id thay vì findByUser và khai báo rõ kiểu để tránh lỗi
            // infer Object
            HelperProfile profile = helperProfileRepository.findByUser_Id(app.getHelperId()).orElse(null);

            return JobApplicantResponse.builder()
                    .applicationId(app.getApplicationId())
                    .helperId(app.getHelperId())
                    .fullName(helper != null ? helper.getFullName() : "N/A")
                    .avatarUrl(helper != null ? helper.getAvatarUrl() : null)
                    .rating(profile != null && profile.getRatingAverage() != null
                            ? profile.getRatingAverage().doubleValue()
                            : 0.0)
                    .reviewCount(profile != null && profile.getTotalReviews() != null ? profile.getTotalReviews() : 0)
                    .bio(profile != null ? profile.getBio() : "")
                    .status(app.getStatus())
                    .topReviews(reviewRepository.findByHelperIdAndIsVisibleTrueOrderByCreatedAtDesc(
                            app.getHelperId(), org.springframework.data.domain.PageRequest.of(0, 3))
                            .stream().map(Review::getComment).collect(Collectors.toList()))
                    .build();
        }).collect(Collectors.toList());
    }

    /**
     * Khách hàng chọn thợ (Select Applicant) -> Tạo Booking và kết thúc Job Post
     */
    @Transactional
    public BookingResponse selectApplicant(Long jobId, Long applicationId, Long customerId) {
        // 1. Validate JobPost và Quyền sở hữu
        JobPost jobPost = jobPostRepository.findById(jobId)
                .orElseThrow(() -> new ApiException("Không tìm thấy tin đăng", HttpStatus.NOT_FOUND));

        if (!jobPost.getCustomerId().equals(customerId)) {
            throw new ApiException("Bạn không có quyền quản lý tin đăng này", HttpStatus.FORBIDDEN);
        }

        if (!"PUBLISHED".equals(jobPost.getStatus())) {
            throw new ApiException("Tin đăng này đã được xử lý hoặc hết hạn", HttpStatus.BAD_REQUEST);
        }

        // 2. Validate JobApplication
        JobApplication application = jobApplicationRepository.findById(applicationId)
                .orElseThrow(() -> new ApiException("Không tìm thấy đơn ứng tuyển", HttpStatus.NOT_FOUND));

        if (!application.getPostId().equals(jobId)) {
            throw new ApiException("Đơn ứng tuyển này không thuộc về tin đăng hiện tại", HttpStatus.BAD_REQUEST);
        }

        // 3. Kiểm tra lịch của Helper tại thời điểm chốt
        LocalDateTime start = LocalDateTime.of(jobPost.getWorkDate(), jobPost.getStartTime());
        LocalDateTime end = start.plusHours(jobPost.getDurationHours());
        bookingRepository.findOverlappingBookingsForUpdate(application.getHelperId(), ACTIVE_BOOKING_STATUSES, start, end);
        long overlapCount = bookingRepository.countOverlappingBookings(application.getHelperId(),
                ACTIVE_BOOKING_STATUSES, start, end);
        if (overlapCount > 0) {
            throw new ApiException("Khung giờ đã được đặt", HttpStatus.CONFLICT);
        }

        List<HelperSchedule> schedules = helperScheduleRepository.findByHelperIdAndWorkDateAndStatusIn(
                application.getHelperId(), jobPost.getWorkDate(), List.of(ScheduleStatus.AVAILABLE));

        HelperSchedule targetSchedule = null;
        for (HelperSchedule s : schedules) {
            if (conflictEngine.isOverlap(start.toLocalTime(), end.toLocalTime(), s.getStartTime(), s.getEndTime())) {
                targetSchedule = s;
                break;
            }
        }

        if (targetSchedule == null) {
            throw new ApiException("Thợ này hiện tại không còn lịch trống cho khung giờ này.", HttpStatus.CONFLICT);
        }
        User customer = userRepository.findById(customerId).get();
        User helper = userRepository.findById(application.getHelperId()).get();

        Booking booking = Booking.builder()
                .customer(customer)
                .helper(helper)
                .category(jobPost.getCategory())
                .jobPostId(jobId)
                .address(jobPost.getAddress())
                .scheduledStartTime(start)
                .scheduledEndTime(end)
                .totalPrice(jobPost.getOfferPrice())
                .priceSnapshot(jobPost.getOfferPrice())
                .originalPrice(resolveOriginalPriceFromJobPost(jobPost))
                .discountRate(resolveDiscountRateFromJobPost(jobPost))
                .discountAmount(resolveDiscountAmountFromJobPost(jobPost))
                .finalPrice(jobPost.getOfferPrice())
                .tierAtBooking(resolveTierAtBookingFromJobPost(jobPost))
                .status(BookingStatus.CONFIRMED)
                .paymentStatus(PaymentStatus.HOLDING)
                .build();

        booking = bookingRepository.save(booking);

        // 5. Cập nhật trạng thái Job, Application và Schedule
        jobPost.setStatus("ASSIGNED");
        application.setStatus("ACCEPTED");
        targetSchedule.setStatus(ScheduleStatus.BUSY);
        targetSchedule.setBooking(booking);

        jobPostRepository.save(jobPost);
        jobApplicationRepository.save(application);
        helperScheduleRepository.save(targetSchedule);

        // 6. Từ chối các ứng viên khác
        List<JobApplication> others = jobApplicationRepository.findByPostId(jobId);
        for (JobApplication other : others) {
            if (!other.getApplicationId().equals(applicationId)) {
                other.setStatus("REJECTED");
                jobApplicationRepository.save(other);
            }
        }

        log.info("Job {} assigned to helper {}. Booking {} created.", jobId, helper.getId(), booking.getId());

        // 7. Thông báo cho các bên
        notificationService.createNotification(helper.getId(), "Chúc mừng! Bạn đã được chọn",
                "Bạn đã được chọn cho công việc: " + jobPost.getTitle(), "BOOKING_ACCEPTED");

        for (JobApplication other : others) {
            if (!other.getApplicationId().equals(applicationId)) {
                notificationService.createNotification(other.getHelperId(), "Rất tiếc!",
                        "Công việc " + jobPost.getTitle() + " đã có người khác nhận.", "BOOKING_REJECTED");
            }
        }

        return mapToBookingResponse(booking, customerId);
    }

    /**
     * Khách hàng đặt thợ trực tiếp (Direct Booking - PB-13)
     */
    @Transactional
    public BookingResponse createDirectBooking(DirectBookingRequest request, Long customerId) {
        // 1. Validate Helper và Category
        User helper = userRepository.findById(request.getHelperId())
                .orElseThrow(() -> new ApiException("Thợ không tồn tại", HttpStatus.NOT_FOUND));

        ServiceCategory category = serviceCategoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> new ApiException("Danh mục dịch vụ không tồn tại", HttpStatus.NOT_FOUND));

        User customer = userRepository.findById(customerId)
                .orElseThrow(() -> new ApiException("Khách hàng không tồn tại", HttpStatus.NOT_FOUND));

        // 2. Kiểm tra kỹ năng của thợ
        boolean hasSkill = helperServiceRepository.existsByHelper_IdAndCategory_CategoryId(request.getHelperId(),
                request.getCategoryId());
        if (!hasSkill) {
            throw new ApiException("Thợ này không cung cấp dịch vụ bạn yêu cầu", HttpStatus.BAD_REQUEST);
        }

        // 3. Kiểm tra lịch (AVAILABLE & No Conflict)
        LocalDateTime start = LocalDateTime.of(request.getWorkDate(), request.getStartTime());
        LocalDateTime end = start.plusHours(request.getDurationHours());
        bookingRepository.findOverlappingBookingsForUpdate(request.getHelperId(), ACTIVE_BOOKING_STATUSES, start, end);
        long overlapCount = bookingRepository.countOverlappingBookings(request.getHelperId(), ACTIVE_BOOKING_STATUSES,
                start, end);
        if (overlapCount > 0) {
            throw new ApiException("Khung giờ đã được đặt", HttpStatus.CONFLICT);
        }

        List<HelperSchedule> schedules = helperScheduleRepository.findByHelperIdAndWorkDateAndStatusIn(
                request.getHelperId(), request.getWorkDate(), List.of(ScheduleStatus.AVAILABLE));

        HelperSchedule targetSchedule = null;
        for (HelperSchedule s : schedules) {
            if (conflictEngine.isOverlap(start.toLocalTime(), end.toLocalTime(), s.getStartTime(), s.getEndTime())) {
                targetSchedule = s;
                break;
            }
        }

        if (targetSchedule == null) {
            throw new ApiException("Thợ không có lịch rảnh vào khung giờ này", HttpStatus.CONFLICT);
        }

        // 4. Resolve Address (Tạo mới địa chỉ cho khách)
        Address bookingAddress = Address.builder()
                .user(customer)
                .addressDetail(request.getAddressDetail())
                .latitude(java.math.BigDecimal.valueOf(request.getLatitude()))
                .longitude(java.math.BigDecimal.valueOf(request.getLongitude()))
                .type("OTHER")
                .build();
        bookingAddress = addressRepository.save(bookingAddress);
        BigDecimal originalPrice = category.getBasePrice().multiply(java.math.BigDecimal.valueOf(request.getDurationHours()));
        int monthlyCompletedCount = (int) loyaltyService.getMonthlyCompletedCount(customerId);
        CustomerTier tier = loyaltyService.resolveTierByCompletedCount(monthlyCompletedCount);
        BigDecimal discountRate = loyaltyService.resolveDiscountRate(tier);
        BigDecimal discountAmount = originalPrice.multiply(discountRate).setScale(2, RoundingMode.HALF_UP);
        BigDecimal finalPrice = originalPrice.subtract(discountAmount).setScale(2, RoundingMode.HALF_UP);

        Booking booking = Booking.builder()
                .customer(customer)
                .helper(helper)
                .category(category)
                .address(bookingAddress)
                .scheduledStartTime(start)
                .scheduledEndTime(end)
                .totalPrice(finalPrice)
                .priceSnapshot(finalPrice)
                .originalPrice(originalPrice)
                .discountRate(discountRate)
                .discountAmount(discountAmount)
                .finalPrice(finalPrice)
                .tierAtBooking(tier.name())
                .status(BookingStatus.PENDING_ACCEPTANCE)
                .paymentStatus(PaymentStatus.HOLDING)
                .timeoutAt(LocalDateTime.now().plusMinutes(15))
                .build();

        booking = bookingRepository.save(booking);

        // 5. Tạm khóa lịch thợ
        targetSchedule.setStatus(ScheduleStatus.PENDING_LOCK);
        targetSchedule.setBooking(booking);
        helperScheduleRepository.save(targetSchedule);

        log.info("Direct booking {} created. Waiting for helper {} to respond.", booking.getId(), helper.getId());

        // Trả về response với address đầy đủ (cho khách hàng - người vừa tạo)
        return mapToBookingResponse(booking, customerId);
    }

    /**
     * Thợ phản hồi yêu cầu đặt trực tiếp (Accept/Reject)
     */
    @Transactional
    public void respondToBooking(Long bookingId, Long helperId, boolean accept) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ApiException("Không tìm thấy đơn hàng", HttpStatus.NOT_FOUND));

        if (!booking.getHelper().getId().equals(helperId)) {
            throw new ApiException("Bạn không có quyền phản hồi đơn này", HttpStatus.FORBIDDEN);
        }

        if (booking.getStatus() != BookingStatus.PENDING_ACCEPTANCE) {
            throw new ApiException("Đơn hàng này không còn ở trạng thái chờ xác nhận", HttpStatus.BAD_REQUEST);
        }

        // Tìm lịch đang PENDING_LOCK
        HelperSchedule schedule = helperScheduleRepository.findByBooking(booking)
                .stream().findFirst()
                .orElseThrow(() -> new ApiException("Không tìm thấy lịch tương ứng", HttpStatus.NOT_FOUND));

        if (accept) {
            booking.setStatus(BookingStatus.CONFIRMED);
            booking.setTimeoutAt(null);
            schedule.setStatus(ScheduleStatus.BUSY);
            log.info("Helper {} accepted booking {}.", helperId, bookingId);
        } else {
            booking.setStatus(BookingStatus.CANCELLED);
            booking.setCancelSource("HELPER");
            booking.setCancelReason("Helper từ chối đơn direct booking");
            booking.setCancelledAt(LocalDateTime.now());
            schedule.setStatus(ScheduleStatus.AVAILABLE);
            schedule.setBooking(null);
            log.info("Helper {} rejected booking {}.", helperId, bookingId);
        }

        bookingRepository.save(booking);
        helperScheduleRepository.save(schedule);
    }

    /**
     * [BE-Exec-02] Khách hàng xác nhận thợ đã đến và bắt đầu công việc (Tú)
     * Tiền điều kiện: status = ARRIVED (sau khi Phúc làm Face ID check-in)
     */
    @Transactional
    public void confirmStart(Long bookingId, Long customerId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ApiException("Không tìm thấy đơn hàng", HttpStatus.NOT_FOUND));

        if (!booking.getCustomer().getId().equals(customerId)) {
            throw new ApiException("Bạn không có quyền xác nhận đơn này", HttpStatus.FORBIDDEN);
        }

        if (booking.getStatus() != BookingStatus.ARRIVED) {
            throw new ApiException(
                    "Đơn hàng phải ở trạng thái ARRIVED (Thợ đã xác thực khuôn mặt) mới có thể xác nhận bắt đầu",
                    HttpStatus.BAD_REQUEST);
        }

        booking.setStatus(BookingStatus.IN_PROGRESS);
        booking.setConfirmedStartAt(LocalDateTime.now());
        bookingRepository.save(booking);

        log.info("[BE-Exec-02] Customer {} confirmed start for booking {}. Status: IN_PROGRESS", customerId, bookingId);

        notificationService.createNotification(booking.getHelper().getId(),
                "Công việc đã bắt đầu!",
                "Khách hàng đã xác nhận. Bạn có thể bắt đầu làm việc ngay.", "WORK_STARTED");
    }

    /**
     * [BE-Exec-03] Thợ chụp ảnh hoàn thành -> WAITING_FOR_CONFIRMATION (Tú)
     * Ràng buộc: Không được check-out khi chưa làm đủ 80% thời gian cam kết mà
     * không có lý do
     */
    @Transactional
    public void checkOut(Long bookingId, String checkoutPhotoUrl, String checkoutReason, Long helperId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ApiException("Không tìm thấy đơn hàng", HttpStatus.NOT_FOUND));

        if (!booking.getHelper().getId().equals(helperId)) {
            throw new ApiException("Bạn không có quyền hoàn thành đơn này", HttpStatus.FORBIDDEN);
        }

        if (booking.getStatus() != BookingStatus.IN_PROGRESS) {
            throw new ApiException("Đơn hàng phải ở trạng thái IN_PROGRESS mới có thể check-out",
                    HttpStatus.BAD_REQUEST);
        }

        // [Conflict 1] Kiểm tra nếu thực tế làm < 80% thời gian đặt
        LocalDateTime startRef = booking.getConfirmedStartAt() != null
                ? booking.getConfirmedStartAt()
                : booking.getScheduledStartTime();

        long scheduledMinutes = java.time.Duration.between(
                booking.getScheduledStartTime(), booking.getScheduledEndTime()).toMinutes();
        long workedMinutes = java.time.Duration.between(startRef, LocalDateTime.now()).toMinutes();

        boolean isUndertime = workedMinutes < scheduledMinutes * 0.8;
        if (isUndertime) {
            if (checkoutReason == null || checkoutReason.trim().isEmpty()) {
                throw new ApiException(
                        "Bạn hoàn thành sớm hơn 80% thời gian dự kiến. Vui lòng cung cấp lý do (Làm xong sớm, Khách cho về...)",
                        HttpStatus.BAD_REQUEST);
            }
            // Gắn flag bất thường, log để Admin theo dõi
            booking.setIsFlagged(true);
            booking.setCheckoutReason(checkoutReason);
            log.warn("[PB-14][Conflict1] Helper {} checked out early. Reason: {}. Booking {} is FLAGGED.",
                    helperId, checkoutReason, bookingId);
        }

        booking.setStatus(BookingStatus.PENDING_COMPLETION); // WAITING_FOR_CONFIRMATION
        booking.setCheckoutPhotoUrl(checkoutPhotoUrl);
        booking.setCheckedOutAt(LocalDateTime.now());
        bookingRepository.save(booking);

        log.info("[BE-Exec-03] Helper {} checked out booking {}. Status: PENDING_COMPLETION", helperId, bookingId);

        String notifContent = isUndertime
                ? "Thợ đã báo hoàn thành sớm (Lý do: " + checkoutReason + "). Vui lòng kiểm tra kỹ trước khi xác nhận."
                : "Công việc đã xong. Vui lòng kiểm tra và bấm 'Xác nhận & Đánh giá'.";

        notificationService.createNotification(booking.getCustomer().getId(),
                "Thợ báo đã hoàn thành!", notifContent, "WORK_DONE_BY_HELPER");
    }

    /**
     * [BE-Exec-03b] Khách xác nhận hoàn thành -> COMPLETED (Tú)
     * Kịch bản: Thợ check-out xong, khách kiểm tra và bấm "Xác nhận & Đánh giá"
     * Conflict 2: Nếu khách im lặng 24h, scheduler sẽ tự động COMPLETED
     */
    @Transactional
    public void confirmComplete(Long bookingId, Long customerId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ApiException("Không tìm thấy đơn hàng", HttpStatus.NOT_FOUND));

        if (!booking.getCustomer().getId().equals(customerId)) {
            throw new ApiException("Bạn không có quyền xác nhận đơn này", HttpStatus.FORBIDDEN);
        }

        if (booking.getStatus() != BookingStatus.PENDING_COMPLETION) {
            throw new ApiException("Đơn hàng chưa được thợ báo hoàn thành", HttpStatus.BAD_REQUEST);
        }

        booking.setStatus(BookingStatus.COMPLETED);
        booking.setConfirmedDoneAt(LocalDateTime.now());
        bookingRepository.save(booking);
        loyaltyService.onBookingCompleted(bookingId);

        log.info("[BE-Exec-03b] Customer {} confirmed completion of booking {}. Status: COMPLETED", customerId,
                bookingId);

        notificationService.createNotification(booking.getHelper().getId(),
                "Khách đã xác nhận hoàn thành!",
                "Tuyệt vời! Khách hàng đã xác nhận. Lương sẽ được giải ngân sau 24h.", "WORK_COMPLETED");
    }

    private BookingResponse mapToBookingResponse(Booking b, Long viewerId) {
        String fullAddress = "";
        if (b.getAddress() != null) {
            // [PB-15] Privacy: Helper chỉ thấy Quận/Huyện khi đơn ở trạng thái
            // PENDING_ACCEPTANCE
            if (b.getHelper().getId().equals(viewerId) && b.getStatus() == BookingStatus.PENDING_ACCEPTANCE) {
                fullAddress = String.format("%s, %s, %s",
                        b.getAddress().getWardName(),
                        b.getAddress().getDistrictName(),
                        b.getAddress().getProvinceName());
            } else {
                fullAddress = String.format("%s, %s, %s, %s",
                        b.getAddress().getAddressDetail(),
                        b.getAddress().getWardName(),
                        b.getAddress().getDistrictName(),
                        b.getAddress().getProvinceName());
            }
        }

        String arrivalProofImage = resolveArrivalProofImage(b);

        return BookingResponse.builder()
                .bookingId(b.getId())
                .customerId(b.getCustomer().getId())
                .customerName(b.getCustomer().getFullName())
                .helperId(b.getHelper().getId())
                .helperName(b.getHelper().getFullName())
                .serviceName(b.getCategory() != null ? b.getCategory().getName() : "Dịch vụ")
                .scheduledStartTime(b.getScheduledStartTime())
                .scheduledEndTime(b.getScheduledEndTime())
                .arrivedAt(b.getArrivedAt())
                .arrivalProofImage(arrivalProofImage)
                .customerArrivalConfirmed(Boolean.TRUE.equals(b.getCustomerArrivalConfirmed()))
                .customerArrivalConfirmedAt(b.getCustomerArrivalConfirmedAt())
                .status(b.getStatus())
                .totalPrice(b.getTotalPrice())
                .originalPrice(b.getOriginalPrice())
                .discountRate(b.getDiscountRate())
                .discountAmount(b.getDiscountAmount())
                .finalPrice(b.getFinalPrice())
                .tierAtBooking(b.getTierAtBooking())
                .address(fullAddress)
                .paymentStatus(b.getPaymentStatus())
                .disputeReason(b.getDisputeReason())
                .evidenceUrl(b.getEvidenceUrl())
                .disputedAt(b.getDisputedAt())
                .disputeResolvedAt(b.getDisputeResolvedAt())
                .disputeResolutionAction(b.getDisputeResolutionAction())
                .build();
    }

    private Map<String, Object> parseAdditionalData(JobPost jobPost) {
        if (jobPost == null || jobPost.getAdditionalData() == null || jobPost.getAdditionalData().isBlank()) {
            return java.util.Collections.emptyMap();
        }
        try {
            return objectMapper.readValue(jobPost.getAdditionalData(), new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            return java.util.Collections.emptyMap();
        }
    }

    private BigDecimal resolveOriginalPriceFromJobPost(JobPost jobPost) {
        Map<String, Object> data = parseAdditionalData(jobPost);
        Object value = data.get("loyaltyOriginalPrice");
        if (value != null) {
            try {
                return new BigDecimal(value.toString()).setScale(2, RoundingMode.HALF_UP);
            } catch (Exception ignored) {
            }
        }
        return jobPost.getOfferPrice() == null ? BigDecimal.ZERO : jobPost.getOfferPrice();
    }

    private BigDecimal resolveDiscountRateFromJobPost(JobPost jobPost) {
        Map<String, Object> data = parseAdditionalData(jobPost);
        Object value = data.get("loyaltyDiscountRate");
        if (value != null) {
            try {
                return new BigDecimal(value.toString()).setScale(4, RoundingMode.HALF_UP);
            } catch (Exception ignored) {
            }
        }
        return BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP);
    }

    private BigDecimal resolveDiscountAmountFromJobPost(JobPost jobPost) {
        Map<String, Object> data = parseAdditionalData(jobPost);
        Object value = data.get("loyaltyDiscountAmount");
        if (value != null) {
            try {
                return new BigDecimal(value.toString()).setScale(2, RoundingMode.HALF_UP);
            } catch (Exception ignored) {
            }
        }
        return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    }

    private String resolveTierAtBookingFromJobPost(JobPost jobPost) {
        Map<String, Object> data = parseAdditionalData(jobPost);
        Object value = data.get("loyaltyTierAtBooking");
        if (value != null && !value.toString().isBlank()) {
            return value.toString();
        }
        return CustomerTier.BRONZE.name();
    }

    private String resolveArrivalProofImage(Booking booking) {
        if (booking.getArrivalProofImage() != null && !booking.getArrivalProofImage().isBlank()) {
            return booking.getArrivalProofImage();
        }
        if (booking.getCheckinPhotoUrl() != null && !booking.getCheckinPhotoUrl().isBlank()) {
            return booking.getCheckinPhotoUrl();
        }
        return null;
    }

    @Transactional
    public BookingResponse confirmArrivalByCustomer(Long bookingId, Long customerId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ApiException("Không tìm thấy đơn hàng", HttpStatus.NOT_FOUND));

        if (!booking.getCustomer().getId().equals(customerId)) {
            throw new ApiException("Bạn không có quyền xác nhận đơn hàng này", HttpStatus.FORBIDDEN);
        }

        if (booking.getStatus() != BookingStatus.ARRIVED && booking.getStatus() != BookingStatus.IN_PROGRESS) {
            throw new ApiException("Chỉ xác nhận khi helper đã check-in ARRIVED/IN_PROGRESS", HttpStatus.BAD_REQUEST);
        }

        if (resolveArrivalProofImage(booking) == null) {
            throw new ApiException("Đơn hàng chưa có ảnh chứng minh check-in", HttpStatus.BAD_REQUEST);
        }

        boolean changed = false;
        boolean newlyConfirmed = false;

        if (!Boolean.TRUE.equals(booking.getCustomerArrivalConfirmed())) {
            booking.setCustomerArrivalConfirmed(true);
            booking.setCustomerArrivalConfirmedAt(LocalDateTime.now());
            changed = true;
            newlyConfirmed = true;

        }

        // Khi khách xác minh helper đã đến đúng nhà, đơn chuyển sang ĐANG THỰC HIỆN.
        // Nhánh này cũng tự chữa dữ liệu cũ bị lệch: customerArrivalConfirmed=true
        // nhưng status vẫn ARRIVED.
        if (booking.getStatus() == BookingStatus.ARRIVED) {
            booking.setStatus(BookingStatus.IN_PROGRESS);
            changed = true;
        }

        if (changed) {
            bookingRepository.save(booking);
        }

        if (newlyConfirmed) {
            notificationService.createNotification(
                    booking.getHelper().getId(),
                    "Khách hàng đã xác nhận bạn đến đúng địa điểm",
                    "Đơn #" + booking.getId() + " đã được khách xác nhận. Bạn có thể bắt đầu công việc.",
                    "ARRIVAL_CONFIRMED");
        }

        return mapToBookingResponse(booking, customerId);
    }

    @Transactional(readOnly = true)
    public BookingResponse getBookingDetail(Long bookingId, Long userId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ApiException("Không tìm thấy đơn hàng", HttpStatus.NOT_FOUND));

        if (!booking.getCustomer().getId().equals(userId) && !booking.getHelper().getId().equals(userId)) {
            throw new ApiException("Bạn không có quyền xem thông tin đơn hàng này", HttpStatus.FORBIDDEN);
        }

        return mapToBookingResponse(booking, userId);
    }

    @Transactional
    public void cancelBooking(Long bookingId, Long customerId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy đơn hàng"));

        if (!booking.getCustomer().getId().equals(customerId)) {
            throw new RuntimeException("Bạn không có quyền hủy đơn hàng này");
        }

        if (booking.getStatus() == BookingStatus.COMPLETED || booking.getStatus() == BookingStatus.CANCELLED
            || booking.getStatus() == BookingStatus.DISPUTED || booking.getStatus() == BookingStatus.RESOLVED) {
            throw new RuntimeException("Đơn hàng đã hoàn thành hoặc đã bị hủy trước đó");
        }

        applyWalletRefundOnCancel(booking);

        booking.setStatus(BookingStatus.CANCELLED);
        booking.setCancelSource("CUSTOMER");
        booking.setCancelReason("Khách hàng chủ động hủy đơn");
        booking.setCancelledAt(LocalDateTime.now());
        bookingRepository.save(booking);

        long diffInMinutes = java.time.Duration.between(LocalDateTime.now(), booking.getScheduledStartTime()).toMinutes();
        if (diffInMinutes < 120) {
            UserViolation violation = UserViolation.builder()
                    .user(booking.getCustomer())
                    .bookingId(bookingId)
                    .violationType("CUSTOMER_LATE_CANCEL")
                    .severity("MEDIUM")
                    .penaltyAmount(booking.getPenaltyAmount())
                    .note("Khách hàng hủy sát giờ")
                    .build();
            userViolationRepository.save(violation);
        }
    }

    /**
     * Hoàn tiền hold / phạt theo cùng quy tắc hủy của khách (sát giờ vs sớm).
     */
    private void applyWalletRefundOnCancel(Booking booking) {
        Long customerId = booking.getCustomer().getId();
        Long bookingId = booking.getId();
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime startTime = booking.getScheduledStartTime();

        if (booking.getPaymentStatus() == PaymentStatus.HOLDING) {
            long diffInMinutes = java.time.Duration.between(now, startTime).toMinutes();

            if (diffInMinutes < 120) {
                BigDecimal penalty = booking.getTotalPrice().multiply(BigDecimal.valueOf(0.3));
                BigDecimal refund = booking.getTotalPrice().subtract(penalty);
                booking.setPenaltyAmount(penalty);
                booking.setRefundAmount(refund);

                walletService.deductPenalty(customerId, penalty, bookingId, "Hủy đơn sát giờ (< 2h)");
                walletService.compensateCustomer(booking.getHelper().getId(), penalty, bookingId);
                walletService.refundHold(customerId, refund, bookingId, "Hoàn lại 70% sau phí hủy đơn");
            } else {
                booking.setPenaltyAmount(BigDecimal.ZERO);
                booking.setRefundAmount(booking.getTotalPrice());
                walletService.refundHold(customerId, booking.getTotalPrice(), bookingId, "Hủy đơn sớm (> 2h)");
            }
        }
    }

    /**
     * Admin hủy đơn — áp dụng cùng luật hoàn/hold như khách hủy; bắt buộc ghi lý
     * do.
     */
    @Transactional
    public void cancelBookingByAdmin(Long bookingId, String reason, String adminEmail) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ApiException("Không tìm thấy đơn hàng", HttpStatus.NOT_FOUND));
        Long adminUserId = adminAuditLogService.resolveActorIdByEmail(adminEmail);

        if (booking.getStatus() == BookingStatus.COMPLETED || booking.getStatus() == BookingStatus.CANCELLED
            || booking.getStatus() == BookingStatus.DISPUTED || booking.getStatus() == BookingStatus.RESOLVED) {
            throw new ApiException("Đơn hàng đã hoàn thành hoặc đã hủy trước đó", HttpStatus.BAD_REQUEST);
        }
        if (!ADMIN_CANCEL_ALLOWED_STATUSES.contains(booking.getStatus())) {
            adminAuditLogService.log(
                    adminUserId,
                    adminEmail,
                    "ADMIN_BOOKING_CANCEL",
                    "BOOKING",
                    bookingId,
                    "BLOCKED",
                    "Từ chối hủy booking do trạng thái không hợp lệ",
                    "{\"bookingStatus\":\"" + booking.getStatus().name() + "\"}");
            throw new ApiException(
                    "Booking đang ở trạng thái " + booking.getStatus()
                            + ", admin không được hủy trực tiếp. Hãy dùng luồng xử lý vận hành chuyên biệt.",
                    HttpStatus.BAD_REQUEST);
        }

        applyWalletRefundOnCancel(booking);

        booking.setStatus(BookingStatus.CANCELLED);
        booking.setCancelSource("ADMIN");
        booking.setCancelReason(reason);
        booking.setCancelledAt(LocalDateTime.now());
        booking.setCancelledByAdminId(adminUserId);
        bookingRepository.save(booking);

        String msg = "Đơn #" + bookingId + " đã bị hủy bởi quản trị viên. Lý do: " + reason;
        notificationService.createNotification(booking.getCustomer().getId(), "Đơn hàng bị hủy (Admin)", msg,
                "BOOKING_ADMIN_CANCEL");
        notificationService.createNotification(booking.getHelper().getId(), "Đơn hàng bị hủy (Admin)", msg,
                "BOOKING_ADMIN_CANCEL");

        log.info("Admin {} đã hủy booking {}. Lý do: {}", adminEmail, bookingId, reason);
        adminAuditLogService.log(
                adminUserId,
                adminEmail,
                "ADMIN_BOOKING_CANCEL",
                "BOOKING",
                bookingId,
                "SUCCESS",
                reason,
                "{\"status\":\"CANCELLED\"}");
    }

    /**
     * Gỡ cờ bất thường (checkout sớm) sau khi admin đã xem xét.
     */
    @Transactional
    public void clearBookingFlagByAdmin(Long bookingId, String adminEmail) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ApiException("Không tìm thấy đơn hàng", HttpStatus.NOT_FOUND));
        Long adminUserId = adminAuditLogService.resolveActorIdByEmail(adminEmail);

        if (!Boolean.TRUE.equals(booking.getIsFlagged())) {
            throw new ApiException("Đơn hàng không có cờ cảnh báo", HttpStatus.BAD_REQUEST);
        }

        booking.setIsFlagged(false);
        bookingRepository.save(booking);
        log.info("Admin {} đã gỡ cờ bất thường cho booking {}", adminEmail, bookingId);
        adminAuditLogService.log(
                adminUserId,
                adminEmail,
                "ADMIN_BOOKING_UNFLAG",
                "BOOKING",
                bookingId,
                "SUCCESS",
                "Admin đã gỡ cờ cảnh báo",
                null);
    }

    @Transactional
    public void handleHelperNoShow(Long bookingId, String reason) {
        handleHelperNoShow(bookingId, reason, "system@homeconnect.local");
    }

    @Transactional
    public void handleHelperNoShow(Long bookingId, String reason, String adminEmail) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ApiException("Không tìm thấy đơn hàng", HttpStatus.NOT_FOUND));
        Long adminUserId = adminAuditLogService.resolveActorIdByEmail(adminEmail);

        if (booking.getStatus() == BookingStatus.CANCELLED || booking.getStatus() == BookingStatus.COMPLETED
            || booking.getStatus() == BookingStatus.DISPUTED || booking.getStatus() == BookingStatus.RESOLVED) {
            throw new ApiException("Không thể xử lý no-show với đơn đã hoàn tất/hủy", HttpStatus.BAD_REQUEST);
        }
        if (!ADMIN_NO_SHOW_ALLOWED_STATUSES.contains(booking.getStatus())) {
            adminAuditLogService.log(
                    adminUserId,
                    adminEmail,
                    "ADMIN_BOOKING_HELPER_NO_SHOW",
                    "BOOKING",
                    bookingId,
                    "BLOCKED",
                    "Từ chối xử lý helper no-show do trạng thái không hợp lệ",
                    "{\"bookingStatus\":\"" + booking.getStatus().name() + "\"}");
            throw new ApiException(
                    "Chỉ xử lý helper no-show khi booking ở trạng thái CONFIRMED hoặc ARRIVED.",
                    HttpStatus.BAD_REQUEST);
        }

        BigDecimal penalty = booking.getTotalPrice().multiply(BigDecimal.valueOf(0.3));
        if (booking.getPaymentStatus() == PaymentStatus.HOLDING) {
            walletService.refundHold(booking.getCustomer().getId(), booking.getTotalPrice(), bookingId,
                    "Helper no-show, hoàn tiền 100%");
            walletService.deductPenalty(booking.getHelper().getId(), penalty, bookingId, "Helper no-show");
        }

        booking.setStatus(BookingStatus.CANCELLED);
        booking.setCancelSource("ADMIN");
        booking.setNoShowActor("HELPER");
        booking.setCancelReason(reason != null ? reason : "Helper không đến đúng hẹn");
        booking.setCancelledAt(LocalDateTime.now());
        booking.setCancelledByAdminId(adminUserId);
        booking.setPenaltyAmount(penalty);
        booking.setRefundAmount(booking.getTotalPrice());
        bookingRepository.save(booking);

        if (!reviewRepository.existsByBookingId(bookingId)) {
            reviewRepository.save(Review.builder()
                    .booking(booking)
                    .customer(booking.getCustomer())
                    .helper(booking.getHelper())
                    .rating(1)
                    .comment("System-generated: Helper không đến đúng hẹn (no-show)")
                    .tags("SYSTEM_GENERATED,HELPER_NO_SHOW")
                    .isVisible(true)
                    .build());
        }

        userViolationRepository.save(UserViolation.builder()
                .user(booking.getHelper())
                .bookingId(bookingId)
                .violationType("HELPER_NO_SHOW")
                .severity("HIGH")
                .penaltyAmount(penalty)
                .note(booking.getCancelReason())
                .build());
        adminAuditLogService.log(
                adminUserId,
                adminEmail,
                "ADMIN_BOOKING_HELPER_NO_SHOW",
                "BOOKING",
                bookingId,
                "SUCCESS",
                booking.getCancelReason(),
                "{\"status\":\"CANCELLED\"}");
    }

    @Transactional
    public void handleCustomerNoShow(Long bookingId, double payoutRatio, String reason) {
        handleCustomerNoShow(bookingId, payoutRatio, reason, "system@homeconnect.local");
    }

    @Transactional
    public void handleCustomerNoShow(Long bookingId, double payoutRatio, String reason, String adminEmail) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ApiException("Không tìm thấy đơn hàng", HttpStatus.NOT_FOUND));
        Long adminUserId = adminAuditLogService.resolveActorIdByEmail(adminEmail);

        if (booking.getStatus() == BookingStatus.CANCELLED || booking.getStatus() == BookingStatus.COMPLETED
            || booking.getStatus() == BookingStatus.DISPUTED || booking.getStatus() == BookingStatus.RESOLVED) {
            throw new ApiException("Không thể xử lý no-show với đơn đã hoàn tất/hủy", HttpStatus.BAD_REQUEST);
        }
        if (!ADMIN_NO_SHOW_ALLOWED_STATUSES.contains(booking.getStatus())) {
            adminAuditLogService.log(
                    adminUserId,
                    adminEmail,
                    "ADMIN_BOOKING_CUSTOMER_NO_SHOW",
                    "BOOKING",
                    bookingId,
                    "BLOCKED",
                    "Từ chối xử lý customer no-show do trạng thái không hợp lệ",
                    "{\"bookingStatus\":\"" + booking.getStatus().name() + "\"}");
            throw new ApiException(
                    "Chỉ xử lý customer no-show khi booking ở trạng thái CONFIRMED hoặc ARRIVED.",
                    HttpStatus.BAD_REQUEST);
        }
        BigDecimal ratio = BigDecimal.valueOf(payoutRatio);
        if (ratio.compareTo(BigDecimal.valueOf(0.3)) < 0 || ratio.compareTo(BigDecimal.valueOf(0.5)) > 0) {
            throw new ApiException("Tỷ lệ thanh toán một phần phải nằm trong khoảng 0.3 - 0.5", HttpStatus.BAD_REQUEST);
        }

        BigDecimal partialPay = booking.getTotalPrice().multiply(ratio);
        BigDecimal refund = booking.getTotalPrice().subtract(partialPay);

        if (booking.getPaymentStatus() == PaymentStatus.HOLDING) {
            walletService.compensateCustomer(booking.getHelper().getId(), partialPay, bookingId);
            walletService.refundHold(booking.getCustomer().getId(), refund, bookingId,
                    "Customer no-show, hoàn phần còn lại");
        }

        booking.setStatus(BookingStatus.CANCELLED);
        booking.setCancelSource("ADMIN");
        booking.setNoShowActor("CUSTOMER");
        booking.setCancelReason(reason != null ? reason : "Khách hàng không có mặt");
        booking.setCancelledAt(LocalDateTime.now());
        booking.setCancelledByAdminId(adminUserId);
        booking.setPenaltyAmount(partialPay);
        booking.setRefundAmount(refund);
        bookingRepository.save(booking);

        userViolationRepository.save(UserViolation.builder()
                .user(booking.getCustomer())
                .bookingId(bookingId)
                .violationType("CUSTOMER_NO_SHOW")
                .severity("MEDIUM")
                .penaltyAmount(partialPay)
                .note(booking.getCancelReason())
                .build());
        adminAuditLogService.log(
                adminUserId,
                adminEmail,
                "ADMIN_BOOKING_CUSTOMER_NO_SHOW",
                "BOOKING",
                bookingId,
                "SUCCESS",
                booking.getCancelReason(),
                "{\"status\":\"CANCELLED\",\"payoutRatio\":" + payoutRatio + "}");
    }

    @Transactional
    public BookingResponse reportBooking(Long bookingId, Long customerId, BookingReportRequest request) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ApiException("Không tìm thấy đơn hàng", HttpStatus.NOT_FOUND));

        if (!booking.getCustomer().getId().equals(customerId)) {
            throw new ApiException("Bạn không có quyền khiếu nại đơn này", HttpStatus.FORBIDDEN);
        }
        if (booking.getStatus() != BookingStatus.COMPLETED) {
            throw new ApiException("Chỉ có thể khiếu nại đơn ở trạng thái COMPLETED", HttpStatus.BAD_REQUEST);
        }
        if (booking.getPaymentStatus() != PaymentStatus.HOLDING) {
            throw new ApiException("Đơn đã giải ngân/hoàn tiền, không thể mở khiếu nại", HttpStatus.BAD_REQUEST);
        }

        booking.setStatus(BookingStatus.DISPUTED);
        booking.setDisputeReason(request.getReason().trim());
        booking.setEvidenceUrl(request.getEvidenceUrl() != null ? request.getEvidenceUrl().trim() : null);
        booking.setDisputedAt(LocalDateTime.now());
        booking.setDisputeResolvedAt(null);
        booking.setDisputeResolutionAction(null);
        booking.setDisputeResolvedByAdminId(null);
        booking.setHelperDisputeMessage(null);
        booking.setHelperDisputeEvidenceUrl(null);
        booking.setHelperDisputeAt(null);
        booking.setDisputeRefundRatio(null);
        booking.setDisputeRefundAmount(null);
        bookingRepository.save(booking);

        Long jobPostId = booking.getJobPostId() != null ? booking.getJobPostId() : booking.getId();
        notificationService.createNotification(
            booking.getHelper().getId(),
            "Booking đang bị khiếu nại",
            "Job #" + jobPostId + " (Booking #" + booking.getId() + ") đã bị khiếu nại. Hệ thống đang chờ admin xử lý.",
            "DISPUTE_OPENED");

        return mapToBookingResponse(booking, customerId);
    }

    @Transactional
    public void submitDisputeResponse(Long bookingId, Long helperId, HelperDisputeResponseRequest request) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ApiException("Không tìm thấy đơn hàng", HttpStatus.NOT_FOUND));

        if (!booking.getHelper().getId().equals(helperId)) {
            throw new ApiException("Bạn không có quyền giải trình đơn này", HttpStatus.FORBIDDEN);
        }
        if (booking.getStatus() != BookingStatus.DISPUTED) {
            throw new ApiException("Đơn hàng không ở trạng thái DISPUTED", HttpStatus.BAD_REQUEST);
        }
        if (booking.getHelperDisputeAt() != null) {
            throw new ApiException("Giải trình đã được gửi trước đó", HttpStatus.BAD_REQUEST);
        }
        if (booking.getDisputedAt() != null) {
            Duration elapsed = Duration.between(booking.getDisputedAt(), LocalDateTime.now());
            if (elapsed.compareTo(Duration.ofHours(24)) > 0) {
                throw new ApiException("Đã quá hạn 24h để gửi giải trình", HttpStatus.BAD_REQUEST);
            }
        }

        booking.setHelperDisputeMessage(request.getMessage().trim());
        booking.setHelperDisputeEvidenceUrl(request.getEvidenceUrl() != null ? request.getEvidenceUrl().trim() : null);
        booking.setHelperDisputeAt(LocalDateTime.now());
        bookingRepository.save(booking);

        Long jobPostId = booking.getJobPostId() != null ? booking.getJobPostId() : booking.getId();
        notificationService.createNotification(
            booking.getCustomer().getId(),
            "Helper đã phản hồi khiếu nại",
            "Job #" + jobPostId + " (Booking #" + booking.getId() + ") đã có giải trình từ helper. Admin sẽ sớm xử lý.",
            "DISPUTE_RESPONSE");
    }

    @Transactional(readOnly = true)
    public AdminDisputeListResponse getDisputes(Pageable pageable) {
        Page<Booking> page = bookingRepository.findByStatusOrderByDisputedAtDesc(BookingStatus.DISPUTED, pageable);
        List<AdminDisputeItemResponse> items = page.getContent().stream()
                .map(this::mapToAdminDisputeItem)
                .toList();

        return AdminDisputeListResponse.builder()
                .disputes(items)
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .currentPage(page.getNumber())
                .pageSize(page.getSize())
                .message("Danh sách booking đang tranh chấp")
                .build();
    }

    @Transactional
    public void resolveDispute(Long bookingId, AdminResolveDisputeRequest request, String adminEmail) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ApiException("Không tìm thấy đơn hàng", HttpStatus.NOT_FOUND));

        if (booking.getStatus() != BookingStatus.DISPUTED) {
            throw new ApiException("Đơn hàng không ở trạng thái DISPUTED", HttpStatus.BAD_REQUEST);
        }
        if (booking.getPaymentStatus() != PaymentStatus.HOLDING) {
            throw new ApiException("Đơn hàng không còn tiền hold để xử lý tranh chấp", HttpStatus.BAD_REQUEST);
        }

        DisputeResolutionAction action = request.getAction();
        Long adminId = adminAuditLogService.resolveActorIdByEmail(adminEmail);
        String adminNote = request.getAdminNote() != null ? request.getAdminNote().trim() : null;

        if (action == DisputeResolutionAction.REFUND_CUSTOMER) {
            BigDecimal refundRatio = request.getRefundRatio() != null
                ? request.getRefundRatio()
                : BigDecimal.ONE;

            if (refundRatio.compareTo(BigDecimal.ZERO) <= 0 || refundRatio.compareTo(BigDecimal.ONE) > 0) {
            throw new ApiException("Tỷ lệ hoàn tiền không hợp lệ", HttpStatus.BAD_REQUEST);
            }

                BigDecimal refundAmount = walletService.resolveDisputeSplit(booking, refundRatio);
            booking.setPaymentStatus(refundRatio.compareTo(BigDecimal.ONE) == 0
                ? PaymentStatus.REFUNDED
                : PaymentStatus.RELEASED);
            booking.setDisputeRefundRatio(refundRatio);
            booking.setDisputeRefundAmount(refundAmount);

                String ratioPercent = refundRatio.multiply(BigDecimal.valueOf(100))
                    .setScale(0, java.math.RoundingMode.HALF_UP) + "%";
                String reasonSuffix = (adminNote != null && !adminNote.isBlank())
                    ? " Lý do: " + adminNote
                    : "";

                notificationService.createNotification(
                    booking.getCustomer().getId(),
                    "Khiếu nại đã được chấp nhận",
                    "Đơn #" + booking.getId() + " đã được hoàn " + ratioPercent + " tiền về ví khả dụng của bạn." + reasonSuffix,
                    "DISPUTE_REFUND");
                Long jobPostId = booking.getJobPostId() != null ? booking.getJobPostId() : booking.getId();
                notificationService.createNotification(
                    booking.getHelper().getId(),
                    "Khiếu nại booking đã được xử lý",
                    "Job #" + jobPostId + " (Booking #" + booking.getId() + ") được admin xử lý theo hướng hoàn " + ratioPercent + " tiền cho khách." + reasonSuffix,
                    "DISPUTE_REFUND");
        } else if (action == DisputeResolutionAction.REJECT_REPORT) {
            walletService.releaseSalary(booking);
            booking.setPaymentStatus(PaymentStatus.RELEASED);
            booking.setDisputeRefundRatio(BigDecimal.ZERO);
            booking.setDisputeRefundAmount(BigDecimal.ZERO);

                String reasonSuffix = (adminNote != null && !adminNote.isBlank())
                    ? " Lý do: " + adminNote
                    : "";

                notificationService.createNotification(
                    booking.getCustomer().getId(),
                    "Khiếu nại không được chấp nhận",
                    "Đơn #" + booking.getId() + " đã được admin kết luận thanh toán cho thợ." + reasonSuffix,
                    "DISPUTE_REJECT");
                Long jobPostId = booking.getJobPostId() != null ? booking.getJobPostId() : booking.getId();
                notificationService.createNotification(
                    booking.getHelper().getId(),
                    "Khiếu nại booking đã được xử lý",
                    "Job #" + jobPostId + " (Booking #" + booking.getId() + ") được admin kết luận thanh toán cho bạn." + reasonSuffix,
                    "DISPUTE_REJECT");
        } else {
            throw new ApiException("Action xử lý tranh chấp không hợp lệ", HttpStatus.BAD_REQUEST);
        }

        booking.setStatus(BookingStatus.RESOLVED);
        booking.setDisputeResolvedAt(LocalDateTime.now());
        booking.setDisputeResolutionAction(action.name());
        booking.setDisputeResolvedByAdminId(adminId);
        booking.setDisputeAdminNote(adminNote != null && adminNote.isBlank() ? null : adminNote);
        bookingRepository.save(booking);
    }

    private AdminDisputeItemResponse mapToAdminDisputeItem(Booking booking) {
        return AdminDisputeItemResponse.builder()
                .bookingId(booking.getId())
                .customerId(booking.getCustomer().getId())
                .customerName(booking.getCustomer().getFullName())
                .helperId(booking.getHelper().getId())
                .helperName(booking.getHelper().getFullName())
                .status(booking.getStatus())
                .paymentStatus(booking.getPaymentStatus())
                .totalPrice(booking.getTotalPrice())
                .disputeReason(booking.getDisputeReason())
                .evidenceUrl(booking.getEvidenceUrl())
                .disputedAt(booking.getDisputedAt())
                .helperDisputeMessage(booking.getHelperDisputeMessage())
                .helperDisputeEvidenceUrl(booking.getHelperDisputeEvidenceUrl())
                .helperDisputeAt(booking.getHelperDisputeAt())
                .scheduledStartTime(booking.getScheduledStartTime())
                .build();
    }
}
