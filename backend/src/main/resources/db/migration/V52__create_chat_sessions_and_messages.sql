-- ==========================================
-- V52__create_chat_sessions_and_messages.sql
-- Tạo bảng lưu phiên chat và lịch sử tin nhắn chatbot
-- ==========================================

CREATE TABLE chat_sessions (
    id CHAR(36) PRIMARY KEY COMMENT 'UUID của phiên chat',
    customer_id INT NOT NULL COMMENT 'User ID của khách hàng',
    channel VARCHAR(20) NOT NULL DEFAULT 'web' COMMENT 'Kênh chat: web, mobile',
    status VARCHAR(20) NOT NULL DEFAULT 'active' COMMENT 'Trạng thái phiên: active, closed, handover',
    context_json JSON NULL COMMENT 'Ngữ cảnh parse hiện tại (category/date/time/duration/address/...)',
    last_intent VARCHAR(100) NULL COMMENT 'Intent gần nhất của chatbot',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    ended_at TIMESTAMP NULL,
    CONSTRAINT fk_chat_sessions_customer
        FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_chat_sessions_customer_id (customer_id),
    INDEX idx_chat_sessions_status (status),
    INDEX idx_chat_sessions_channel (channel),
    INDEX idx_chat_sessions_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Phiên hội thoại chatbot';


CREATE TABLE chat_messages (
    id CHAR(36) PRIMARY KEY COMMENT 'UUID của tin nhắn',
    session_id CHAR(36) NOT NULL COMMENT 'UUID phiên chat',
    sender VARCHAR(20) NOT NULL COMMENT 'Nguồn gửi: customer, assistant, system',
    message_type VARCHAR(40) NOT NULL DEFAULT 'text' COMMENT 'Loại tin nhắn: text, quick_reply, helper_list, payment_redirect, booking_confirm',
    content TEXT NULL COMMENT 'Nội dung hiển thị chính của tin nhắn',
    structured_data JSON NULL COMMENT 'Payload cấu trúc: parse result, helper list, pricing, missing fields...',
    model_name VARCHAR(100) NULL COMMENT 'Model AI đã dùng cho phản hồi (nếu có)',
    tokens_input INT NULL COMMENT 'Số token input gửi tới model',
    tokens_output INT NULL COMMENT 'Số token output trả về từ model',
    latency_ms INT NULL COMMENT 'Độ trễ xử lý tin nhắn (milliseconds)',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_chat_messages_session
        FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
    INDEX idx_chat_messages_session_id (session_id),
    INDEX idx_chat_messages_sender (sender),
    INDEX idx_chat_messages_type (message_type),
    INDEX idx_chat_messages_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Lịch sử tin nhắn theo phiên chatbot';
