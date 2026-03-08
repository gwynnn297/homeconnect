-- V12__add_timestamps_to_service_categories.sql
-- Description: Bổ sung cột created_at và updated_at vào bảng service_categories để đồng bộ với Java Entity

ALTER TABLE service_categories
ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời gian tạo',
ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Thời gian cập nhật';
