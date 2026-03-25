-- ==========================================
-- V32__sync_booking_table_schema.sql
-- Description: Đồng bộ hóa cấu trúc bảng bookings với Entity
-- ==========================================

ALTER TABLE bookings 
    CHANGE COLUMN post_id job_post_id INT DEFAULT NULL,
    CHANGE COLUMN total_amount total_price DECIMAL(12,2) NOT NULL,
    ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
