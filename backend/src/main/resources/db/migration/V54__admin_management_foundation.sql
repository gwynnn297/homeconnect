-- ==========================================
-- V54__admin_management_foundation.sql
-- Description: Nền tảng quản trị nâng cao (user lock audit, booking ops, moderation)
-- ==========================================

-- 1) users: thêm metadata lock/unlock để truy vết ai thao tác
ALTER TABLE users
    ADD COLUMN banned_at TIMESTAMP NULL,
    ADD COLUMN banned_by BIGINT NULL,
    ADD COLUMN ban_reason TEXT NULL,
    ADD COLUMN unbanned_at TIMESTAMP NULL,
    ADD COLUMN unbanned_by BIGINT NULL,
    ADD COLUMN unban_reason TEXT NULL;

CREATE INDEX idx_users_banned_by ON users (banned_by);
CREATE INDEX idx_users_unbanned_by ON users (unbanned_by);

-- 2) bookings: thêm cột phục vụ vận hành/admin edge-cases
ALTER TABLE bookings
    ADD COLUMN cancel_source VARCHAR(30) NULL COMMENT 'CUSTOMER, HELPER, ADMIN, SYSTEM',
    ADD COLUMN cancel_reason TEXT NULL,
    ADD COLUMN cancelled_by_admin_id BIGINT NULL,
    ADD COLUMN cancelled_at TIMESTAMP NULL,
    ADD COLUMN price_snapshot DECIMAL(12,2) NULL COMMENT 'Giá chốt lúc booking',
    ADD COLUMN no_show_actor VARCHAR(20) NULL COMMENT 'CUSTOMER, HELPER',
    ADD COLUMN timeout_at TIMESTAMP NULL,
    ADD COLUMN penalty_amount DECIMAL(12,2) NULL,
    ADD COLUMN refund_amount DECIMAL(12,2) NULL;

CREATE INDEX idx_bookings_cancel_source ON bookings (cancel_source);
CREATE INDEX idx_bookings_cancelled_by_admin_id ON bookings (cancelled_by_admin_id);
CREATE INDEX idx_bookings_timeout_at ON bookings (timeout_at);

-- backfill snapshot cho dữ liệu cũ
UPDATE bookings
SET price_snapshot = total_price
WHERE price_snapshot IS NULL;

-- 3) job_posts: thêm cột moderation để admin theo dõi kiểm duyệt
ALTER TABLE job_posts
    ADD COLUMN moderation_status VARCHAR(30) NULL COMMENT 'PENDING, APPROVED, REJECTED, BLOCKED',
    ADD COLUMN moderation_reason TEXT NULL,
    ADD COLUMN moderation_flags VARCHAR(500) NULL COMMENT 'contact_detected, spam, toxic,...',
    ADD COLUMN moderated_by BIGINT NULL,
    ADD COLUMN moderated_at TIMESTAMP NULL,
    ADD COLUMN last_validated_at TIMESTAMP NULL,
    ADD COLUMN edit_revision INT NOT NULL DEFAULT 0;

CREATE INDEX idx_job_posts_moderation_status ON job_posts (moderation_status);
CREATE INDEX idx_job_posts_moderated_by ON job_posts (moderated_by);
CREATE INDEX idx_job_posts_last_validated_at ON job_posts (last_validated_at);

-- 4) audit log tổng quát cho thao tác admin
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    audit_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    actor_id BIGINT NOT NULL,
    actor_email VARCHAR(255) NOT NULL,
    actor_role VARCHAR(30) NOT NULL,
    target_type VARCHAR(50) NOT NULL COMMENT 'USER, BOOKING, JOB_POST, SYSTEM',
    target_id BIGINT NULL,
    result VARCHAR(20) NOT NULL COMMENT 'SUCCESS, FAILED, BLOCKED',
    reason TEXT NULL,
    trace_id VARCHAR(100) NULL,
    metadata_json JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Nhật ký truy vết hành động admin';

CREATE INDEX idx_admin_audit_actor_id ON admin_audit_logs (actor_id);
CREATE INDEX idx_admin_audit_target ON admin_audit_logs (target_type, target_id);
CREATE INDEX idx_admin_audit_event_type ON admin_audit_logs (event_type);
CREATE INDEX idx_admin_audit_created_at ON admin_audit_logs (created_at);

-- 5) vi phạm vận hành để xử lý helper/customer hủy sát giờ, no-show, v.v.
CREATE TABLE IF NOT EXISTS user_violations (
    violation_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    booking_id BIGINT NULL,
    violation_type VARCHAR(50) NOT NULL COMMENT 'HELPER_LATE_CANCEL, CUSTOMER_LATE_CANCEL, HELPER_NO_SHOW, CUSTOMER_NO_SHOW',
    severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    penalty_amount DECIMAL(12,2) NULL,
    note TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_violations_user_id (user_id),
    INDEX idx_user_violations_booking_id (booking_id),
    INDEX idx_user_violations_violation_type (violation_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Lưu lịch sử vi phạm của user phục vụ admin và chấm điểm rủi ro';

-- 6) lịch sử chỉnh sửa tin đăng để chống lách kiểm duyệt
CREATE TABLE IF NOT EXISTS job_post_edit_logs (
    edit_log_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    post_id BIGINT NOT NULL,
    edited_by BIGINT NOT NULL,
    revision_no INT NOT NULL,
    old_title VARCHAR(255) NULL,
    new_title VARCHAR(255) NULL,
    old_description TEXT NULL,
    new_description TEXT NULL,
    old_additional_data TEXT NULL,
    new_additional_data TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_job_post_edit_logs_post_id (post_id),
    INDEX idx_job_post_edit_logs_edited_by (edited_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Lưu version chỉnh sửa tin đăng phục vụ audit/moderation';
