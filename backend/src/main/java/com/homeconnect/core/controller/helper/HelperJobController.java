package com.homeconnect.core.controller.helper;

import com.homeconnect.core.dto.response.ApiResponse;
import com.homeconnect.core.dto.response.JobApplicationStatusResponse;
import com.homeconnect.core.dto.response.JobPostResponse;
import com.homeconnect.core.service.JobService;
import com.homeconnect.core.util.SecurityUtil;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/v1/helper/jobs")
@RequiredArgsConstructor
@Tag(name = "Helper Job API", description = "API dành cho Helper: Xem việc làm và ứng tuyển")
public class HelperJobController {

    private final JobService jobService;
    private final SecurityUtil securityUtil;

    @Operation(summary = "Lấy toàn bộ bài đăng việc làm", description = "Lấy tất cả các công việc đang mở, không lọc theo kỹ năng hay khu vực. Đã tự động lọc bỏ các đơn đã hết hạn hoặc đã ứng tuyển.")
    @GetMapping("/all")
    @PreAuthorize("hasRole('HELPER')")
    public ResponseEntity<ApiResponse<List<JobPostResponse>>> getAllJobs(Authentication authentication) {
        Long helperId = securityUtil.getCurrentUserId(authentication);
        log.info("Helper {} fetching all published jobs", helperId);
        List<JobPostResponse> response = jobService.getAllPublishedJobs(helperId);
        return ResponseEntity.ok(ApiResponse.<List<JobPostResponse>>builder()
                .message("Lấy danh sách việc làm thành công")
                .data(response)
                .build());
    }

    @Operation(summary = "Xem danh sách việc làm phù hợp", description = "Lấy danh sách các công việc đang mở, phù hợp với kỹ năng và khu vực thợ đã đăng ký (so khớp theo tên quận).")
    @GetMapping("")
    @PreAuthorize("hasRole('HELPER')")
    public ResponseEntity<ApiResponse<List<JobPostResponse>>> getJobFeed(Authentication authentication) {
        Long helperId = securityUtil.getCurrentUserId(authentication);
        log.info("Helper {} fetching job feed", helperId);

        List<JobPostResponse> response = jobService.getHelperJobFeed(helperId);

        return ResponseEntity.ok(ApiResponse.<List<JobPostResponse>>builder()
                .message("Lấy danh sách việc làm thành công")
                .data(response)
                .build());
    }

    @Operation(summary = "Ứng tuyển công việc", description = "Gửi yêu cầu ứng tuyển vào một công việc. Hệ thống kiểm tra trùng lịch và lịch rảnh tự động.")
    @PostMapping("/{id}/apply")
    @PreAuthorize("hasRole('HELPER')")
    public ResponseEntity<ApiResponse<Void>> applyForJob(@PathVariable("id") Long id, Authentication authentication) {
        Long helperId = securityUtil.getCurrentUserId(authentication);
        log.info("Helper {} applying for job {}", helperId, id);

        jobService.applyForJob(id, helperId);

        return ResponseEntity.ok(ApiResponse.<Void>builder()
                .message("Ứng tuyển thành công! Vui lòng chờ khách hàng phản hồi.")
                .build());
    }

    @Operation(summary = "Lấy trạng thái ứng tuyển", description = "Kiểm tra xem thợ đã ứng tuyển hoặc được mời cho công việc này chưa.")
    @GetMapping("/{id}/application-status")
    @PreAuthorize("hasRole('HELPER')")
    public ResponseEntity<ApiResponse<JobApplicationStatusResponse>> getApplicationStatus(
            @PathVariable("id") Long id, Authentication authentication) {
        Long helperId = securityUtil.getCurrentUserId(authentication);
        log.info("Helper {} checking application status for job {}", helperId, id);

        JobApplicationStatusResponse response = jobService.getApplicationStatus(id, helperId);

        return ResponseEntity.ok(ApiResponse.<JobApplicationStatusResponse>builder()
                .message("Lấy trạng thái ứng tuyển thành công")
                .data(response)
                .build());
    }

    @Operation(summary = "Lấy danh sách việc làm theo trạng thái", description = "Lấy danh sách việc làm dựa trên tab: NEW (mới), PENDING (đang chờ), CONFIRMED (đã xác nhận/đang làm).")
    @GetMapping("/by-tab")
    @PreAuthorize("hasRole('HELPER')")
    public ResponseEntity<ApiResponse<List<JobPostResponse>>> getJobsByTab(
            @RequestParam(value = "tab", defaultValue = "NEW") String tab,
            Authentication authentication) {
        Long helperId = securityUtil.getCurrentUserId(authentication);
        log.info("Helper {} fetching jobs for tab {}", helperId, tab);

        List<JobPostResponse> response = jobService.getHelperJobsByTab(helperId, tab);

        return ResponseEntity.ok(ApiResponse.<List<JobPostResponse>>builder()
                .message("Lấy danh sách việc làm thành công")
                .data(response)
                .build());
    }
}
