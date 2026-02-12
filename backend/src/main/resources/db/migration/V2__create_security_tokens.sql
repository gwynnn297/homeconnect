-- V2__create_security_tokens.sql
-- Bảng lưu trữ OTP và Token phục vụ Reset Password/Verify Email
CREATE TABLE security_tokens (
    token_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL COMMENT 'ID người dùng',
    token_value VARCHAR(255) NOT NULL COMMENT 'Giá trị OTP hoặc Reset Token',
    token_type VARCHAR(50) NOT NULL COMMENT 'Loại: REGISTER_OTP, FORGOT_PASSWORD_OTP, RESET_PASSWORD_TOKEN',
    expiry_date TIMESTAMP NOT NULL COMMENT 'Thời gian hết hạn',
    is_used BOOLEAN DEFAULT FALSE COMMENT 'Đã sử dụng chưa',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_token (user_id, token_value),
    INDEX idx_token_type (token_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng lưu trữ token bảo mật';
