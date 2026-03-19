-- V25: Make user_id nullable in security_tokens to support anonymous tokens (Captcha)
ALTER TABLE security_tokens MODIFY user_id INT NULL COMMENT 'ID người dùng (NULL nếu là token vô danh như Captcha)';
