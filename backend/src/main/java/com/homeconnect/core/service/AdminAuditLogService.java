package com.homeconnect.core.service;

import com.homeconnect.core.entity.AdminAuditLog;
import com.homeconnect.core.entity.User;
import com.homeconnect.core.repository.AdminAuditLogRepository;
import com.homeconnect.core.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminAuditLogService {

    private final AdminAuditLogRepository adminAuditLogRepository;
    private final UserRepository userRepository;

    public void log(Long actorId, String actorEmail, String eventType, String targetType, Long targetId, String result,
            String reason, String metadataJson) {
        String actorRole = "ADMIN";
        if (actorId != null) {
            actorRole = userRepository.findById(actorId)
                    .map(user -> user.getRole().name())
                    .orElse("ADMIN");
        }

        AdminAuditLog entry = AdminAuditLog.builder()
                .eventType(eventType)
                .actorId(actorId != null ? actorId : -1L)
                .actorEmail(actorEmail != null ? actorEmail : "unknown")
                .actorRole(actorRole)
                .targetType(targetType)
                .targetId(targetId)
                .result(result)
                .reason(reason)
                .metadataJson(metadataJson)
                .build();
        adminAuditLogRepository.save(entry);
        log.debug("Audit logged: event={}, actor={}, target={}#{}", eventType, actorEmail, targetType, targetId);
    }

    public Long resolveActorIdByEmail(String email) {
        if (email == null || email.isBlank()) {
            return null;
        }
        return userRepository.findByEmail(email).map(User::getId).orElse(null);
    }
}
