-- V62: Thêm trường has_pets và bring_tools vào bảng direct_booking_requests
ALTER TABLE direct_booking_requests
    ADD COLUMN has_pets BOOLEAN DEFAULT FALSE COMMENT 'Nhà có thú cưng',
    ADD COLUMN bring_tools BOOLEAN DEFAULT FALSE COMMENT 'Thợ mang theo dụng cụ',
    DROP COLUMN additional_data;
