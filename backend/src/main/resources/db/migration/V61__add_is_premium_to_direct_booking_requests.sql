-- V61: Thêm trường is_premium vào bảng direct_booking_requests
ALTER TABLE direct_booking_requests
    ADD COLUMN is_premium BOOLEAN DEFAULT FALSE COMMENT 'Dịch vụ cao cấp';
