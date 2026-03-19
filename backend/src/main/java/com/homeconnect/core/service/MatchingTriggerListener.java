package com.homeconnect.core.service;

import com.homeconnect.core.event.JobPostCreatedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Slf4j
@Component
@RequiredArgsConstructor
public class MatchingTriggerListener {

    private final MatchingService matchingService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onJobPostCreated(JobPostCreatedEvent event) {
        log.info("Nhận sự kiện tạo Job Post sau commit, bắt đầu matching cho postId={}", event.postId());
        matchingService.findAndInviteHelpers(event.postId());
    }
}
