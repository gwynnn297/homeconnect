-- ==========================================
-- V53__migrate_chat_ids_to_bigint.sql
-- Chuyển chat_sessions.id và chat_messages.session_id
-- từ UUID (CHAR) sang BIGINT AUTO_INCREMENT
-- ==========================================

-- 1) Tạm bỏ FK cũ để migrate khóa chính/khóa ngoại
ALTER TABLE chat_messages DROP FOREIGN KEY fk_chat_messages_session;

-- 2) chat_sessions: đổi id cũ sang legacy_id và tạo id mới dạng số
ALTER TABLE chat_sessions
    DROP PRIMARY KEY,
    CHANGE COLUMN id legacy_id CHAR(36) NOT NULL;

ALTER TABLE chat_sessions
    ADD COLUMN id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST,
    ADD UNIQUE KEY uk_chat_sessions_legacy_id (legacy_id);

-- 3) chat_messages: đổi id/session_id cũ sang legacy_* và tạo cột số mới
ALTER TABLE chat_messages
    DROP PRIMARY KEY,
    CHANGE COLUMN id legacy_id CHAR(36) NOT NULL,
    CHANGE COLUMN session_id legacy_session_id CHAR(36) NOT NULL;

ALTER TABLE chat_messages
    ADD COLUMN id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST,
    ADD COLUMN session_id BIGINT NULL AFTER legacy_session_id,
    ADD INDEX idx_chat_messages_session_id_new (session_id);

-- 4) Map dữ liệu session_id mới từ legacy_session_id
UPDATE chat_messages cm
JOIN chat_sessions cs ON cs.legacy_id = cm.legacy_session_id
SET cm.session_id = cs.id;

-- 5) Bắt buộc NOT NULL + tạo lại FK mới
ALTER TABLE chat_messages
    MODIFY COLUMN session_id BIGINT NOT NULL;

ALTER TABLE chat_messages
    ADD CONSTRAINT fk_chat_messages_session
        FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE;

-- 6) Dọn cột legacy nếu không cần giữ lại
ALTER TABLE chat_messages
    DROP COLUMN legacy_id,
    DROP COLUMN legacy_session_id;

ALTER TABLE chat_sessions
    DROP COLUMN legacy_id;

-- 7) Dọn index tạm
ALTER TABLE chat_messages
    DROP INDEX idx_chat_messages_session_id_new;
