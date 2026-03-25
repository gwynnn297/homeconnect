-- ==========================================
-- V39__fix_helper_profile_defaults.sql
-- Description: Cập nhật giá trị mặc định cho các cột is_online, rating_average, total_reviews
-- để tránh lỗi so sánh với NULL trong logic Matching.
-- ==========================================

-- 1. Cập nhật các bản ghi hiện tại đang bị NULL
UPDATE helper_profiles SET is_online = FALSE WHERE is_online IS NULL;
UPDATE helper_profiles SET rating_average = 0.00 WHERE rating_average IS NULL;
UPDATE helper_profiles SET total_reviews = 0 WHERE total_reviews IS NULL;

-- 2. Đặt giá trị mặc định cho Database
ALTER TABLE helper_profiles MODIFY COLUMN is_online BOOLEAN DEFAULT FALSE;
ALTER TABLE helper_profiles MODIFY COLUMN rating_average DECIMAL(3,2) DEFAULT 0.00;
ALTER TABLE helper_profiles MODIFY COLUMN total_reviews INT DEFAULT 0;
