-- V5__refactor_helper_statuses_and_dob.sql
-- Thêm ngày sinh vào hồ sơ Helper và cập nhật các trạng thái đăng ký

-- 1. Thêm cột date_of_birth vào bảng helper_profiles
ALTER TABLE helper_profiles
ADD COLUMN date_of_birth DATE AFTER hometown_id;

-- 2. Cập nhật comment cho cột status trong bảng users để mô tả quy trình mới
ALTER TABLE users 
MODIFY COLUMN status VARCHAR(20) DEFAULT 'PENDING_OTP' 
COMMENT 'Trạng thái: PENDING_OTP, DRAFT, PROFILE_COMPLETED, PENDING_REVIEW, ACTIVE, BLOCKED, REJECTED';

-- 3. Đảm bảo identity_number có độ dài và comment chính xác (nếu V4 chưa chạy hoặc cần đồng bộ)
-- Lưu ý: Mình dùng tên identity_number theo schema hiện tại để tránh lỗi Foreign Key nếu bạn chưa chạy đổi tên
ALTER TABLE helper_profiles 
MODIFY COLUMN identity_number VARCHAR(20) COMMENT 'Số CCCD (12 số) hoặc CMND (9 số)';
