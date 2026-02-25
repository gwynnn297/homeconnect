package com.homeconnect.core.service;

import com.homeconnect.core.dto.request.RegistrationDraft;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.concurrent.ConcurrentHashMap;

/**
 * Service quản lý bộ nhớ đệm cho quá trình đăng ký Helper
 */
@Service
@Slf4j
public class RegistrationCacheService {

    private final ConcurrentHashMap<String, RegistrationDraft> draftCache = new ConcurrentHashMap<>();

    public void saveDraft(String email, RegistrationDraft draft) {
        draftCache.put(email.toLowerCase(), draft);
        log.info("💾 Đã lưu registration draft cho email: {}", email);
    }

    public RegistrationDraft getDraft(String email) {
        return draftCache.get(email.toLowerCase());
    }

    public void removeDraft(String email) {
        draftCache.remove(email.toLowerCase());
        log.info("🗑️ Đã xóa registration draft cho email: {}", email);
    }
}
