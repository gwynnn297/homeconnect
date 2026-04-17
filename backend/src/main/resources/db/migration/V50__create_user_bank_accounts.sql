-- ==========================================
-- V50__update_user_bank_accounts_schema.sql
-- Nâng cấp bảng user_bank_accounts từ V7 lên cấu trúc mới
-- Đảm bảo chỉ có đúng 10 trường dữ liệu như yêu cầu
-- ==========================================

ALTER TABLE user_bank_accounts
    -- 1. Thêm các trường mới
    ADD COLUMN bank_code           VARCHAR(20) NOT NULL COMMENT 'Mã ngân hàng dùng cho xGate' AFTER bank_name,
    ADD COLUMN qr_code_url         TEXT COMMENT 'URL ảnh mã QR ngân hàng của User' AFTER account_holder_name,
    ADD COLUMN is_default          BOOLEAN DEFAULT FALSE AFTER qr_code_url,
    ADD COLUMN updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at,
    
    -- 2. Xóa trường không nằm trong danh sách yêu cầu
    DROP COLUMN is_verified;
