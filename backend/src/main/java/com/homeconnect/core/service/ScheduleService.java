package com.homeconnect.core.service;

import com.homeconnect.core.dto.request.schedule.ScheduleRegisterRequest;
import com.homeconnect.core.dto.request.schedule.ScheduleSlotRequest;
import com.homeconnect.core.dto.request.schedule.ScheduleUpdateDayRequest;
import com.homeconnect.core.dto.response.schedule.RegisterScheduleSummaryResponse;
import com.homeconnect.core.dto.response.schedule.ScheduleResponse;
import com.homeconnect.core.entity.HelperProfile;
import com.homeconnect.core.entity.HelperSchedule;
import com.homeconnect.core.entity.User;
import com.homeconnect.core.enums.KycStatus;
import com.homeconnect.core.enums.ScheduleStatus;
import com.homeconnect.core.enums.UserRole;
import com.homeconnect.core.enums.UserStatus;
import com.homeconnect.core.exception.ApiException;
import com.homeconnect.core.repository.HelperProfileRepository;
import com.homeconnect.core.repository.UserRepository;
import com.homeconnect.core.util.ConflictEngine;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.homeconnect.core.repository.HelperScheduleRepository;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.stream.Collectors;
import com.homeconnect.core.enums.BookingStatus;

@Service
@RequiredArgsConstructor
@Slf4j
public class ScheduleService {

    private final HelperScheduleRepository helperScheduleRepository;
    private final HelperProfileRepository helperProfileRepository;
    private final UserRepository userRepository;
    private final ConflictEngine conflictEngine;

    /**
     * Đăng ký lịch làm việc hàng loạt (Periodic Register)
     * Rule: [BE-Sched-01], [BE-Sched-02]
     */
    @Transactional
    public RegisterScheduleSummaryResponse registerSchedule(Long helperId, ScheduleRegisterRequest request) {
        User helper = userRepository.findById(helperId)
                .orElseThrow(() -> new ApiException("Helper not found", HttpStatus.NOT_FOUND));

        if (helper.getRole() == UserRole.HELPER) {
            if (helper.getStatus() != UserStatus.ACTIVE) {
                throw new ApiException("Tài khoản của bạn chưa được phê duyệt. Vui lòng chờ quản trị viên kích hoạt để đăng ký lịch làm việc.", HttpStatus.FORBIDDEN);
            }
            
            HelperProfile profile = helperProfileRepository.findByUser_Id(helperId)
                    .orElseThrow(() -> new ApiException("Không tìm thấy hồ sơ Helper.", HttpStatus.NOT_FOUND));
            
            if (profile.getKycStatus() != KycStatus.VERIFIED) {
                throw new ApiException("Hồ sơ định danh (KYC) của bạn chưa được xác thực. Vui lòng hoàn tất xác thực danh tính để đăng ký lịch làm việc.", HttpStatus.FORBIDDEN);
            }
        }

        // 0. Ràng buộc ngày/giờ
        validateRegisterDateTimeConstraints(request);

        // 0b. Kiểm tra trùng lặp trong chính Request
        validateRequestSlots(request.getSlots());

        for (ScheduleSlotRequest slot : request.getSlots()) {
            if (java.time.Duration.between(slot.getStartTime(), slot.getEndTime()).toHours() < 2) {
                throw new ApiException("Mỗi khung giờ rảnh phải có độ dài tối thiểu 2 giờ", HttpStatus.BAD_REQUEST);
            }
        }

        int createdCount = 0;
        String groupId = generateGroupId(); // Tạo groupId cho lô này

        LocalDate currentDate = request.getStartDate();
        while (!currentDate.isAfter(request.getEndDate())) {
            if (request.getDaysOfWeek().contains(currentDate.getDayOfWeek().getValue() + 1)) {
                
                for (ScheduleSlotRequest slot : request.getSlots()) {
                    // 1. Kiểm tra Conflict với BUSY (Đơn hàng)
                    List<HelperSchedule> busySchedules = helperScheduleRepository.findByHelperIdAndWorkDateAndStatusIn(
                            helperId, currentDate, List.of(ScheduleStatus.BUSY));
                    
                    for (HelperSchedule busy : busySchedules) {
                        if (conflictEngine.checkConflict(slot.getStartTime(), slot.getEndTime(), busy)) {
                            throw new ApiException("Xung đột với đơn hàng đang nhận vào ngày " + currentDate + " (" + slot.getStartTime() + " - " + slot.getEndTime() + ")", HttpStatus.CONFLICT);
                        }
                    }

                    // 2. Kiểm tra chồng chéo với AVAILABLE/CANCELLED (có buffer di chuyển 30 phút)
                    List<HelperSchedule> existingSchedules = helperScheduleRepository.findByHelperIdAndWorkDateAndStatusIn(
                            helperId, currentDate, List.of(ScheduleStatus.AVAILABLE, ScheduleStatus.CANCELLED));

                    for (HelperSchedule existing : existingSchedules) {
                        if (conflictEngine.checkConflictWithBuffer(
                                slot.getStartTime(), slot.getEndTime(), existing,
                                ConflictEngine.TRAVEL_BUFFER_MINUTES)) {
                            throw new ApiException(
                                "Xung đột với lịch đã đăng ký vào ngày " + currentDate
                                + " (" + slot.getStartTime() + " - " + slot.getEndTime() + ")."
                                + " Cần cách ít nhất 30 phút giữa các ca. Vui lòng dùng lệnh Cập nhật nếu muốn thay đổi.",
                                HttpStatus.CONFLICT);
                        }
                    }

                    // 3. Lưu slot mới
                    HelperSchedule schedule = HelperSchedule.builder()
                            .helper(helper)
                            .workDate(currentDate)
                            .startTime(slot.getStartTime())
                            .endTime(slot.getEndTime())
                            .status(ScheduleStatus.AVAILABLE)
                            .groupId(groupId)
                            .build();
                    helperScheduleRepository.save(schedule);
                    createdCount++;
                }
            }
            currentDate = currentDate.plusDays(1);
        }

        return RegisterScheduleSummaryResponse.builder()
                .created(createdCount)
                .message("Đã đăng ký thành công " + createdCount + " slot lịch làm việc.")
                .build();
    }

    /**
     * Cập nhật lịch làm việc (Xóa cũ nạp mới)
     * Thao tác: Xóa các ca AVAILABLE/CANCELLED đang có trong khoảng ngày -> Ghi đè bằng lịch mới
     */

    /**
     * Cập nhật lịch cho đúng 1 ngày
     * Logic: Xóa cũ -> Tạo mới với groupId mới (Tách nhóm)
     */
    @Transactional
    public RegisterScheduleSummaryResponse updateDaySchedule(Long helperId, ScheduleUpdateDayRequest request) {
        // 0. Ràng buộc ngày/giờ
        validateDayDateTimeConstraints(request.getDate(), request.getSlots());

        // 1. Validate internal overlap
        validateRequestSlots(request.getSlots());

        // 2. Validate against BUSY
        List<HelperSchedule> busySchedules = helperScheduleRepository.findByHelperIdAndWorkDateAndStatusIn(
                helperId, request.getDate(), List.of(ScheduleStatus.BUSY));
        for (ScheduleSlotRequest slot : request.getSlots()) {
            for (HelperSchedule busy : busySchedules) {
                if (conflictEngine.checkConflict(slot.getStartTime(), slot.getEndTime(), busy)) {
                    throw new ApiException("Xung đột với đơn hàng đang nhận vào ngày " + request.getDate(), HttpStatus.CONFLICT);
                }
            }
        }

        // 3. Xóa AVAILABLE/CANCELLED của ngày đó
        helperScheduleRepository.deleteByHelperIdAndWorkDateAndStatusIn(
                helperId, request.getDate(), List.of(ScheduleStatus.AVAILABLE, ScheduleStatus.CANCELLED));

        // 4. Tạo mới với groupId mới
        String newGroupId = generateGroupId();
        User helper = userRepository.findById(helperId).orElseThrow();
        
        for (ScheduleSlotRequest slot : request.getSlots()) {
            HelperSchedule schedule = HelperSchedule.builder()
                    .helper(helper)
                    .workDate(request.getDate())
                    .startTime(slot.getStartTime())
                    .endTime(slot.getEndTime())
                    .status(ScheduleStatus.AVAILABLE)
                    .groupId(newGroupId)
                    .build();
            helperScheduleRepository.save(schedule);
        }

        return RegisterScheduleSummaryResponse.builder()
                .created(request.getSlots().size())
                .message("Đã cập nhật lịch cho ngày " + request.getDate() + ". (Đã tách khỏi chuỗi cũ nếu có)")
                .build();
    }

    /**
     * Cập nhật theo chuỗi (Sync Group)
     * Logic: Tìm groupId -> Xóa hết AVAILABLE/CANCELLED trong group -> Tạo lại bộ slots mới cho tất cả các ngày cũ
     */
    @Transactional
    public RegisterScheduleSummaryResponse updateGroupSchedule(Long helperId, Long slotId, List<ScheduleSlotRequest> newSlots) {
        HelperSchedule baseSlot = helperScheduleRepository.findById(slotId)
                .orElseThrow(() -> new ApiException("Slot không tồn tại", HttpStatus.NOT_FOUND));
        
        if (!baseSlot.getHelper().getId().equals(helperId)) {
            throw new ApiException("Không có quyền", HttpStatus.FORBIDDEN);
        }

        String groupId = baseSlot.getGroupId();
        if (groupId == null) {
            return updateDaySchedule(helperId, ScheduleUpdateDayRequest.builder()
                    .date(baseSlot.getWorkDate())
                    .slots(newSlots)
                    .build());
        }

        validateRequestSlots(newSlots);

        // 0b. Validate endTime > startTime cho từng slot
        for (ScheduleSlotRequest slot : newSlots) {
            if (!slot.getEndTime().isAfter(slot.getStartTime())) {
                throw new ApiException("Giờ kết thúc (" + slot.getEndTime() + ") phải sau giờ bắt đầu (" + slot.getStartTime() + ").", HttpStatus.BAD_REQUEST);
            }
        }

        // 1. Lấy tất cả các ngày trong group
        List<HelperSchedule> groupSchedules = helperScheduleRepository.findByGroupId(groupId);
        LocalDate today = LocalDate.now();
        LocalTime now = LocalTime.now();

        List<LocalDate> distinctDates = groupSchedules.stream()
                .filter(s -> s.getWorkDate().getDayOfWeek().getValue() == baseSlot.getWorkDate().getDayOfWeek().getValue())
                .map(HelperSchedule::getWorkDate)
                .distinct()
                .filter(date -> !date.isBefore(today))
                .collect(Collectors.toList());

        if (distinctDates.isEmpty()) {
            throw new ApiException("Tất cả các ngày trong chuỗi đã ở quá khứ, không thể cập nhật.", HttpStatus.BAD_REQUEST);
        }

        // 1b. Nếu có ngày hôm nay trong chuỗi, kiểm tra startTime > giờ hiện tại
        if (distinctDates.contains(today)) {
            for (ScheduleSlotRequest slot : newSlots) {
                if (!slot.getStartTime().isAfter(now)) {
                    throw new ApiException("Không thể đăng ký khung giờ đã qua trong ngày hôm nay. Khung giờ " + slot.getStartTime() + " - " + slot.getEndTime() + " không hợp lệ.", HttpStatus.BAD_REQUEST);
                }
            }
        }

        // 2. Kiểm tra conflict với BUSY trên TOÀN BỘ chuỗi
        for (LocalDate date : distinctDates) {
            List<HelperSchedule> busyOnDate = helperScheduleRepository.findByHelperIdAndWorkDateAndStatusIn(
                    helperId, date, List.of(ScheduleStatus.BUSY));
            for (ScheduleSlotRequest slot : newSlots) {
                for (HelperSchedule busy : busyOnDate) {
                    if (conflictEngine.checkConflict(slot.getStartTime(), slot.getEndTime(), busy)) {
                        throw new ApiException("Xung đột với đơn hàng vào ngày " + date, HttpStatus.CONFLICT);
                    }
                }
            }
        }

        // 3. Xóa toàn bộ AVAILABLE/CANCELLED trong group cho đúng "thứ" đó
        helperScheduleRepository.deleteByGroupIdAndWorkDateInAndStatusIn(
                groupId, distinctDates, List.of(ScheduleStatus.AVAILABLE, ScheduleStatus.CANCELLED));

        // 4. Tạo lại chuỗi mới với groupId mới
        String newGroupId = generateGroupId();
        User helper = baseSlot.getHelper();
        int count = 0;

        for (LocalDate date : distinctDates) {
            for (ScheduleSlotRequest slot : newSlots) {
                HelperSchedule schedule = HelperSchedule.builder()
                        .helper(helper)
                        .workDate(date)
                        .startTime(slot.getStartTime())
                        .endTime(slot.getEndTime())
                        .status(ScheduleStatus.AVAILABLE)
                        .groupId(newGroupId)
                        .build();
                helperScheduleRepository.save(schedule);
                count++;
            }
        }

        return RegisterScheduleSummaryResponse.builder()
                .created(count)
                .message("Đã cập nhật đồng bộ toàn bộ chuỗi lịch (" + distinctDates.size() + " ngày).")
                .build();
    }

    private void validateRequestSlots(List<ScheduleSlotRequest> slots) {
        for (int i = 0; i < slots.size(); i++) {
            ScheduleSlotRequest s1 = slots.get(i);
            for (int j = i + 1; j < slots.size(); j++) {
                ScheduleSlotRequest s2 = slots.get(j);
                if (conflictEngine.isOverlap(s1.getStartTime(), s1.getEndTime(), s2.getStartTime(), s2.getEndTime())) {
                    throw new ApiException("Các khung giờ trong một yêu cầu không được đè lên nhau (" + s1.getStartTime() + " - " + s1.getEndTime() + " và " + s2.getStartTime() + " - " + s2.getEndTime() + ")", HttpStatus.BAD_REQUEST);
                }
            }
        }
    }

    // ==================== VALIDATION CONSTRAINTS ====================

    /**
     * Ràng buộc cho API Đăng ký lịch hàng loạt (Register)
     */
    private void validateRegisterDateTimeConstraints(ScheduleRegisterRequest request) {
        LocalDate today = LocalDate.now();
        LocalTime now = LocalTime.now();

        // 1. startDate không được ở quá khứ
        if (request.getStartDate().isBefore(today)) {
            throw new ApiException("Ngày bắt đầu không được ở quá khứ.", HttpStatus.BAD_REQUEST);
        }

        // 2. endDate phải >= startDate
        if (request.getEndDate().isBefore(request.getStartDate())) {
            throw new ApiException("Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.", HttpStatus.BAD_REQUEST);
        }

        // 3. daysOfWeek phải từ 2 đến 8
        for (Integer day : request.getDaysOfWeek()) {
            if (day < 2 || day > 8) {
                throw new ApiException("Ngày trong tuần phải từ 2 (Thứ 2) đến 8 (Chủ nhật). Giá trị không hợp lệ: " + day, HttpStatus.BAD_REQUEST);
            }
        }

        // 4. Validate từng slot
        for (ScheduleSlotRequest slot : request.getSlots()) {
            // endTime phải sau startTime
            if (!slot.getEndTime().isAfter(slot.getStartTime())) {
                throw new ApiException("Giờ kết thúc (" + slot.getEndTime() + ") phải sau giờ bắt đầu (" + slot.getStartTime() + ").", HttpStatus.BAD_REQUEST);
            }
        }

        // 5. Nếu startDate = hôm nay, các slot phải có startTime > giờ hiện tại
        if (request.getStartDate().isEqual(today)
                && request.getDaysOfWeek().contains(today.getDayOfWeek().getValue() + 1)) {
            for (ScheduleSlotRequest slot : request.getSlots()) {
                if (!slot.getStartTime().isAfter(now)) {
                    throw new ApiException("Không thể đăng ký khung giờ đã qua trong ngày hôm nay. Khung giờ " + slot.getStartTime() + " - " + slot.getEndTime() + " không hợp lệ.", HttpStatus.BAD_REQUEST);
                }
            }
        }
    }

    /**
     * Ràng buộc cho API Cập nhật 1 ngày và Cập nhật nhóm
     */
    private void validateDayDateTimeConstraints(LocalDate date, List<ScheduleSlotRequest> slots) {
        LocalDate today = LocalDate.now();
        LocalTime now = LocalTime.now();

        // 1. Ngày không được ở quá khứ
        if (date.isBefore(today)) {
            throw new ApiException("Không thể cập nhật lịch cho ngày đã qua (" + date + ").", HttpStatus.BAD_REQUEST);
        }

        // 2. Validate từng slot
        for (ScheduleSlotRequest slot : slots) {
            // endTime phải sau startTime
            if (!slot.getEndTime().isAfter(slot.getStartTime())) {
                throw new ApiException("Giờ kết thúc (" + slot.getEndTime() + ") phải sau giờ bắt đầu (" + slot.getStartTime() + ").", HttpStatus.BAD_REQUEST);
            }

            // Nếu là hôm nay, startTime phải sau giờ hiện tại
            if (date.isEqual(today) && !slot.getStartTime().isAfter(now)) {
                throw new ApiException("Không thể đăng ký khung giờ đã qua trong ngày hôm nay. Khung giờ " + slot.getStartTime() + " - " + slot.getEndTime() + " không hợp lệ.", HttpStatus.BAD_REQUEST);
            }
        }
    }


    @Transactional
    public void bulkCancelSchedule(Long helperId, Long id, String reason) {
        HelperSchedule baseSchedule = helperScheduleRepository.findById(id)
                .orElseThrow(() -> new ApiException("Schedule slot not found", HttpStatus.NOT_FOUND));

        if (!baseSchedule.getHelper().getId().equals(helperId)) {
            throw new ApiException("Bạn không có quyền thao tác trên lịch này.", HttpStatus.FORBIDDEN);
        }

        String groupId = baseSchedule.getGroupId();
        if (groupId == null) {
            cancelSchedule(helperId, id, reason);
            return;
        }

        List<HelperSchedule> groupSchedules = helperScheduleRepository.findByGroupId(groupId);
        List<HelperSchedule> toCancel = groupSchedules.stream()
                .filter(s -> !s.getWorkDate().isBefore(baseSchedule.getWorkDate()))
                .filter(s -> s.getStartTime().equals(baseSchedule.getStartTime()) && s.getEndTime().equals(baseSchedule.getEndTime()))
                .filter(s -> s.getWorkDate().getDayOfWeek() == baseSchedule.getWorkDate().getDayOfWeek())
                .filter(s -> s.getStatus() == ScheduleStatus.AVAILABLE || s.getStatus() == ScheduleStatus.BUSY)
                .collect(Collectors.toList());

        for (HelperSchedule s : toCancel) {
            if (s.getStatus() == ScheduleStatus.BUSY && s.getBooking() != null) {
                // Xử lý hủy Booking nếu ca đang BUSY
                s.getBooking().setStatus(BookingStatus.CANCELLED);
                // Ở đây có thể thêm logic trừ tiền/phạt vào ví Helper
            }
            s.setStatus(ScheduleStatus.CANCELLED);
            s.setCancelReason(reason + " (Bulk Cancel)");
            helperScheduleRepository.save(s);
        }
    }


    public List<ScheduleResponse> getMonthlySchedule(Long helperId, int month, int year) {
        LocalDate startOfMonth = LocalDate.of(year, month, 1);
        LocalDate endOfMonth = startOfMonth.withDayOfMonth(startOfMonth.lengthOfMonth());

        return helperScheduleRepository.findByHelperIdAndWorkDateBetween(helperId, startOfMonth, endOfMonth)
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public List<ScheduleResponse> getAllSchedules(Long helperId) {
        return helperScheduleRepository.findByHelperIdOrderByWorkDateAscStartTimeAsc(helperId)
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public ScheduleResponse getScheduleDetail(Long id) {
        return helperScheduleRepository.findById(id)
                .map(this::mapToResponse)
                .orElseThrow(() -> new ApiException("Schedule slot not found", HttpStatus.NOT_FOUND));
    }

    @Transactional
    public void deleteSchedule(Long helperId, Long id) {
        HelperSchedule schedule = helperScheduleRepository.findById(id)
                .orElseThrow(() -> new ApiException("Schedule slot not found", HttpStatus.NOT_FOUND));

        if (!schedule.getHelper().getId().equals(helperId)) {
            throw new ApiException("Bạn không có quyền xóa lịch của người khác.", HttpStatus.FORBIDDEN);
        }

        if (schedule.getStatus() == ScheduleStatus.BUSY) {
            throw new ApiException("Không thể xóa ca làm việc đã có đơn hàng. Vui lòng thực hiện Hủy ca.", HttpStatus.BAD_REQUEST);
        }

        helperScheduleRepository.delete(schedule);
    }

  

    @Transactional
    public void cancelSchedule(Long helperId, Long id, String reason) {
        HelperSchedule schedule = helperScheduleRepository.findById(id)
                .orElseThrow(() -> new ApiException("Schedule slot not found", HttpStatus.NOT_FOUND));

        if (!schedule.getHelper().getId().equals(helperId)) {
            throw new ApiException("Bạn không có quyền hủy lịch của người khác.", HttpStatus.FORBIDDEN);
        }

        if (schedule.getStatus() == ScheduleStatus.BUSY) {
            throw new ApiException("Không thể hủy ca làm việc đã có đơn hàng.", HttpStatus.BAD_REQUEST);
        }

        LocalDate startOfMonth = schedule.getWorkDate().withDayOfMonth(1);
        LocalDate endOfMonth = schedule.getWorkDate().withDayOfMonth(schedule.getWorkDate().lengthOfMonth());
        long cancelledCount = helperScheduleRepository.countByHelperIdAndStatusAndWorkDateBetween(
                helperId, ScheduleStatus.CANCELLED, startOfMonth, endOfMonth);

        if (cancelledCount >= 3) {
            throw new ApiException("Bạn đã vượt quá giới hạn 3 ca nghỉ trong tháng này.", HttpStatus.BAD_REQUEST);
        }

        schedule.setStatus(ScheduleStatus.CANCELLED);
        schedule.setCancelReason(reason);
        helperScheduleRepository.save(schedule);
    }


    private ScheduleResponse mapToResponse(HelperSchedule schedule) {
        return ScheduleResponse.builder()
                .id(schedule.getId())
                .workDate(schedule.getWorkDate())
                .startTime(schedule.getStartTime())
                .endTime(schedule.getEndTime())
                .status(schedule.getStatus())
                .cancelReason(schedule.getCancelReason())
                .bookingId(schedule.getBooking() != null ? schedule.getBooking().getId() : null)
                .dayOfWeek(schedule.getWorkDate().getDayOfWeek().getValue() + 1)
                .build();
    }

    private String generateGroupId() {
        String chars = "ABCDEFGHIJKLMNWXYZ";
        StringBuilder sb = new StringBuilder("GRP-");
        java.util.Random rnd = new java.util.Random();
        for (int i = 0; i < 4; i++) {
            sb.append(chars.charAt(rnd.nextInt(chars.length())));
        }
        return sb.toString();
    }
}
