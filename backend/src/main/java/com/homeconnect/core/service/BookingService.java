package com.homeconnect.core.service;

import com.homeconnect.core.dto.request.DirectBookingRequest;
import com.homeconnect.core.dto.response.BookingResponse;
import com.homeconnect.core.dto.response.JobApplicantResponse;
import com.homeconnect.core.entity.*;
import com.homeconnect.core.enums.BookingStatus;
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
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Propagation;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class BookingService {

    private final BookingRepository bookingRepository;
    private final AddressRepository addressRepository;
    private final HelperScheduleRepository helperScheduleRepository;
    private final JobPostRepository jobPostRepository;
    private final JobApplicationRepository jobApplicationRepository;
    private final UserRepository userRepository;
    private final HelperProfileRepository helperProfileRepository;
    private final ServiceCategoryRepository serviceCategoryRepository;
    private final HelperServiceRepository helperServiceRepository;
    private final ReviewRepository reviewRepository;
    private final ConflictEngine conflictEngine;
    private final NotificationService notificationService;


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
        Booking booking = Booking.builder()
                .customer(customer)
                .helper(helper)
                .category(category)
                .address(bookingAddress)
                .scheduledStartTime(start)
                .scheduledEndTime(end)
                .totalPrice(category.getBasePrice().multiply(java.math.BigDecimal.valueOf(request.getDurationHours())))
                .status(BookingStatus.PENDING_ACCEPTANCE)
                .paymentStatus(PaymentStatus.HOLDING)
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
            schedule.setStatus(ScheduleStatus.BUSY);
            log.info("Helper {} accepted booking {}.", helperId, bookingId);
        } else {
            booking.setStatus(BookingStatus.CANCELLED);
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
            throw new ApiException("Đơn hàng phải ở trạng thái ARRIVED (Thợ đã xác thực khuôn mặt) mới có thể xác nhận bắt đầu", HttpStatus.BAD_REQUEST);
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
     * Ràng buộc: Không được check-out khi chưa làm đủ 80% thời gian cam kết mà không có lý do
     */
    @Transactional
    public void checkOut(Long bookingId, String checkoutPhotoUrl, String checkoutReason, Long helperId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ApiException("Không tìm thấy đơn hàng", HttpStatus.NOT_FOUND));

        if (!booking.getHelper().getId().equals(helperId)) {
            throw new ApiException("Bạn không có quyền hoàn thành đơn này", HttpStatus.FORBIDDEN);
        }

        if (booking.getStatus() != BookingStatus.IN_PROGRESS) {
            throw new ApiException("Đơn hàng phải ở trạng thái IN_PROGRESS mới có thể check-out", HttpStatus.BAD_REQUEST);
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
                throw new ApiException("Bạn hoàn thành sớm hơn 80% thời gian dự kiến. Vui lòng cung cấp lý do (Làm xong sớm, Khách cho về...)", HttpStatus.BAD_REQUEST);
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

        log.info("[BE-Exec-03b] Customer {} confirmed completion of booking {}. Status: COMPLETED", customerId, bookingId);

        notificationService.createNotification(booking.getHelper().getId(),
                "Khách đã xác nhận hoàn thành!",
                "Tuyệt vời! Khách hàng đã xác nhận. Lương sẽ được giải ngân sau 24h.", "WORK_COMPLETED");
    }

    private BookingResponse mapToBookingResponse(Booking b, Long viewerId) {
        String fullAddress = "";
        if (b.getAddress() != null) {
            // [PB-15] Privacy: Helper chỉ thấy Quận/Huyện khi đơn ở trạng thái PENDING_ACCEPTANCE
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
                .arrivalProofImage(b.getArrivalProofImage())
                .customerArrivalConfirmed(Boolean.TRUE.equals(b.getCustomerArrivalConfirmed()))
                .customerArrivalConfirmedAt(b.getCustomerArrivalConfirmedAt())
                .status(b.getStatus())
                .totalPrice(b.getTotalPrice())
                .address(fullAddress)
                .paymentStatus(b.getPaymentStatus())
                .build();
    }

    @Transactional
    public BookingResponse confirmArrivalByCustomer(Long bookingId, Long customerId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ApiException("Không tìm thấy đơn hàng", HttpStatus.NOT_FOUND));

        if (!booking.getCustomer().getId().equals(customerId)) {
            throw new ApiException("Bạn không có quyền xác nhận đơn hàng này", HttpStatus.FORBIDDEN);
        }

        if (booking.getStatus() != BookingStatus.ARRIVED) {
            throw new ApiException("Chỉ xác nhận khi helper đã check-in ARRIVED", HttpStatus.BAD_REQUEST);
        }

        if (booking.getArrivalProofImage() == null || booking.getArrivalProofImage().isBlank()) {
            throw new ApiException("Đơn hàng chưa có ảnh chứng minh check-in", HttpStatus.BAD_REQUEST);
        }

        if (!Boolean.TRUE.equals(booking.getCustomerArrivalConfirmed())) {
            booking.setCustomerArrivalConfirmed(true);
            booking.setCustomerArrivalConfirmedAt(LocalDateTime.now());

            // Khi khách xác minh helper đã đến đúng nhà, đơn chuyển sang ĐANG THỰC HIỆN.
            if (booking.getStatus() == BookingStatus.ARRIVED) {
                booking.setStatus(BookingStatus.IN_PROGRESS);
            }

            bookingRepository.save(booking);

            notificationService.createNotification(
                    booking.getHelper().getId(),
                    "Khách hàng đã xác nhận bạn đến đúng địa điểm",
                    "Đơn #" + booking.getId() + " đã được khách xác nhận. Bạn có thể bắt đầu công việc.",
                    "ARRIVAL_CONFIRMED");
        }

        return mapToBookingResponse(booking, customerId);
    }

    public BookingResponse getBookingDetail(Long bookingId, Long userId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ApiException("Không tìm thấy đơn hàng", HttpStatus.NOT_FOUND));

        if (!booking.getCustomer().getId().equals(userId) && !booking.getHelper().getId().equals(userId)) {
            throw new ApiException("Bạn không có quyền xem thông tin đơn hàng này", HttpStatus.FORBIDDEN);
        }

        return mapToBookingResponse(booking, userId);
    }
}
