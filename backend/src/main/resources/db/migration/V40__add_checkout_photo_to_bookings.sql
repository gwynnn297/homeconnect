-- ==========================================
-- V41__add_checkout_photo_to_bookings.sql
-- Description: Thêm ảnh check-out và thời gian thực hiện (Phần của Tú - BE-Exec-03)
-- ==========================================

ALTER TABLE bookings
    ADD COLUMN checkout_photo_url VARCHAR(500) NULL COMMENT 'URL ảnh sau khi hoàn thành công việc (Helper chụp)',
    ADD COLUMN checked_out_at     TIMESTAMP   NULL COMMENT 'Thời điểm Helper báo hoàn thành',
    ADD COLUMN confirmed_start_at TIMESTAMP   NULL COMMENT 'Thời điểm Khách xác nhận bắt đầu';
