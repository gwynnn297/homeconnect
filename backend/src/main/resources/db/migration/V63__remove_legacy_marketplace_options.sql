-- V63: Xoá các trường legacy (is_premium, has_pets, bring_tools) khỏi bảng job_posts và direct_booking_requests
-- Theo yêu cầu bỏ các tùy chọn thêm và điều chỉnh lại giao diện

-- 1. Bảng job_posts
ALTER TABLE job_posts
    DROP COLUMN is_premium,
    DROP COLUMN has_pets,
    DROP COLUMN bring_tools;

-- 2. Bảng direct_booking_requests
ALTER TABLE direct_booking_requests
    DROP COLUMN is_premium,
    DROP COLUMN has_pets,
    DROP COLUMN bring_tools;
