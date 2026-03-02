-- V9__add_timestamps_to_services.sql
-- Description: Bổ sung cột created_at và updated_at vào bảng services để đồng bộ với Java Entity

ALTER TABLE services 
ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời gian tạo',
ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Thời gian cập nhật';
