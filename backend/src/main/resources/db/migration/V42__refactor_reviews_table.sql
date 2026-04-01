-- ==========================================
-- V43__refactor_reviews_table.sql
-- Description: Nâng cấp bảng reviews hỗ trợ tags, ảnh bằng chứng và thời gian cập nhật (PB-24)
-- ==========================================

ALTER TABLE reviews
    ADD COLUMN tags               VARCHAR(500) NULL COMMENT 'Các tiêu chí nhanh (VD: Đúng giờ, Sạch sẽ)',
    ADD COLUMN evidence_photo_url VARCHAR(500) NULL COMMENT 'Ảnh bằng chứng khách chụp lại',
    ADD COLUMN updated_at         TIMESTAMP    NULL COMMENT 'Thời điểm chỉnh sửa review (giới hạn 24h)';
