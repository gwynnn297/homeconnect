-- ==========================================
-- V49__create_user_bank_accounts.sql
-- Bảng lưu trữ thông tin ngân hàng của User/Helper
-- ==========================================

CREATE TABLE user_bank_accounts (
    bank_account_id     INT AUTO_INCREMENT PRIMARY KEY,
    user_id             INT NOT NULL,
    bank_name           VARCHAR(100) NOT NULL COMMENT 'Tên ngân hàng (VD: MBBank, VCB)',
    bank_code           VARCHAR(20) NOT NULL COMMENT 'Mã ngân hàng dùng cho xGate',
    account_number      VARCHAR(50) NOT NULL COMMENT 'Số tài khoản',
    account_holder_name VARCHAR(100) NOT NULL COMMENT 'Tên chủ tài khoản',
    qr_code_url         TEXT COMMENT 'URL ảnh mã QR ngân hàng của User',
    is_default          BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
  COMMENT='Bảng liên kết ngân hàng của người dùng';
