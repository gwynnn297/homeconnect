-- ==========================================
-- V39__add_expired_at_to_bookings.sql
-- Description: Thêm cột expired_at để quản lý thời gian hết hạn của Direct Booking
-- ==========================================

ALTER TABLE bookings ADD COLUMN expired_at TIMESTAMP NULL COMMENT 'Thời điểm hết hạn của yêu cầu đặt việc trực tiếp';
