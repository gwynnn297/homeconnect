-- V15__refactor_location_and_address.sql
-- Refactor location structure: Flatten addresses and remove locations table
-- Note: Explicitly dropping foreign keys by name for maximum compatibility

SET FOREIGN_KEY_CHECKS = 0;

-- =====================================
-- 1. CẬP NHẬT BẢNG addresses
-- =====================================

-- Thêm các cột text mới
ALTER TABLE addresses
    ADD COLUMN ward_name VARCHAR(255) AFTER address_detail,
    ADD COLUMN district_name VARCHAR(255) AFTER ward_name,
    ADD COLUMN province_name VARCHAR(255) AFTER district_name;

-- Chuẩn hóa tọa độ
UPDATE addresses SET latitude = 0 WHERE latitude IS NULL;
UPDATE addresses SET longitude = 0 WHERE longitude IS NULL;

ALTER TABLE addresses
    MODIFY latitude DECIMAL(10,7) NOT NULL,
    MODIFY longitude DECIMAL(10,7) NOT NULL;

-- Xóa các Foreign Key liên quan đến locations (ward_id, district_id, province_id)
-- addresses_ibfk_2 -> ward_id, ibfk_3 -> district_id, ibfk_4 -> province_id
ALTER TABLE addresses DROP FOREIGN KEY addresses_ibfk_2;
ALTER TABLE addresses DROP FOREIGN KEY addresses_ibfk_3;
ALTER TABLE addresses DROP FOREIGN KEY addresses_ibfk_4;

-- Xóa các cột ID cũ
ALTER TABLE addresses DROP COLUMN ward_id;
ALTER TABLE addresses DROP COLUMN district_id;
ALTER TABLE addresses DROP COLUMN province_id;

-- Tạo Index tìm kiếm theo tọa độ
CREATE INDEX idx_address_lat_lng ON addresses(latitude, longitude);

-- =====================================
-- 2. CẬP NHẬT BẢNG helper_profiles
-- =====================================

ALTER TABLE helper_profiles ADD COLUMN hometown_name VARCHAR(255) AFTER experience_years;

-- Xóa Foreign Key liên quan đến hometown_id (ibfk_2)
ALTER TABLE helper_profiles DROP FOREIGN KEY helper_profiles_ibfk_2;
ALTER TABLE helper_profiles DROP COLUMN hometown_id;

-- =====================================
-- 3. CẬP NHẬT BẢNG helper_working_districts
-- =====================================

ALTER TABLE helper_working_districts
    ADD COLUMN district_name VARCHAR(255) NOT NULL AFTER helper_id,
    ADD COLUMN district_code VARCHAR(50) NOT NULL AFTER district_name;

-- Xóa Foreign Key liên quan đến location_id (ibfk_2)
ALTER TABLE helper_working_districts DROP FOREIGN KEY helper_working_districts_ibfk_2;

-- Xóa index cũ trước khi xóa cột
ALTER TABLE helper_working_districts DROP INDEX unique_helper_location;
ALTER TABLE helper_working_districts DROP COLUMN location_id;

-- Tạo Ràng buộc duy nhất mới
CREATE UNIQUE INDEX unique_helper_district ON helper_working_districts(helper_id, district_code);

-- =====================================
-- 4. DỌN DẸP BẢNG CŨ
-- =====================================

DROP TABLE IF EXISTS locations;

SET FOREIGN_KEY_CHECKS = 1;