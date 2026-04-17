-- ==========================================
-- V51__init_withdraw_system.sql
-- Hệ thống Rút tiền Chuyên nghiệp & Audit Logs
-- ==========================================

-- 1. Tạo bảng yêu cầu rút tiền
CREATE TABLE withdraw_requests (
    request_id          INT AUTO_INCREMENT PRIMARY KEY,
    wallet_id           INT NOT NULL,
    bank_account_id     INT COMMENT 'ID tài khoản ngân hàng liên kết từ bảng user_bank_accounts',
    amount              DECIMAL(15,2) NOT NULL COMMENT 'Số tiền rút',
    
    -- Các cột lưu Snapshot thông tin ngân hàng tại thời điểm rút
    bank_name           VARCHAR(100) COMMENT 'Tên ngân hàng (Snapshot)',
    bank_account        VARCHAR(50) COMMENT 'Số tài khoản (Snapshot)',
    account_holder_name VARCHAR(100) COMMENT 'Tên chủ tài khoản (Snapshot)',
    
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                        COMMENT 'PENDING: Chờ duyệt, PROCESSING: Đang xử lý, COMPLETED: Thành công, REJECTED: Thất bại',
    
    external_id         VARCHAR(100) COMMENT 'Mã tham chiếu duy nhất từ xGate/Ngân hàng',
    admin_note          TEXT COMMENT 'Ghi chú của Admin',
    failure_reason      TEXT COMMENT 'Lý do lỗi chi tiết phục vụ đối soát',
    
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (wallet_id) REFERENCES wallets(wallet_id),
    FOREIGN KEY (bank_account_id) REFERENCES user_bank_accounts(bank_account_id),
    UNIQUE INDEX uq_withdraw_external_id (external_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
  COMMENT='Bảng yêu cầu rút tiền về ngân hàng của Helper/User';

-- 2. Tạo bảng Audit Log
CREATE TABLE withdraw_audit_logs (
    audit_id    INT AUTO_INCREMENT PRIMARY KEY,
    request_id  INT NOT NULL,
    action      VARCHAR(50) NOT NULL COMMENT 'APPROVE, REJECT, WEBHOOK_SUCCESS, FAIL, RECONCILE',
    actor       VARCHAR(100) NOT NULL COMMENT 'Email của Admin hoặc SYSTEM',
    note        TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES withdraw_requests(request_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
  COMMENT='Bảng lưu vết lịch sử tác động lên lệnh rút tiền';

CREATE INDEX idx_audit_request_id ON withdraw_audit_logs(request_id);
CREATE INDEX idx_withdraw_wallet_id ON withdraw_requests(wallet_id);
