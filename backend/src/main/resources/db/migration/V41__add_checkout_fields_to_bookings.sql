-- ==========================================
-- V41__add_checkout_fields_to_bookings.sql
-- Description: Fields hỗ trợ luồng thực thi PB-14
-- ==========================================

ALTER TABLE bookings
    ADD COLUMN checkin_photo_url  VARCHAR(500) NULL COMMENT 'Ảnh trước khi làm (Helper chụp lúc check-in - Phúc)',
    ADD COLUMN checked_in_at      TIMESTAMP   NULL COMMENT 'Thời điểm Helper check-in (Phúc)',
    ADD COLUMN confirmed_done_at  TIMESTAMP   NULL COMMENT 'Thời điểm Khách xác nhận hoàn thành (Tú)',
    ADD COLUMN checkout_reason    VARCHAR(500) NULL COMMENT 'Lý do hoàn thành (bắt buộc nếu làm < 80% thời gian)',
    ADD COLUMN is_flagged         BOOLEAN DEFAULT FALSE COMMENT 'Đánh dấu job bất thường (check-out sai vị trí, thiếu thời gian...)';
