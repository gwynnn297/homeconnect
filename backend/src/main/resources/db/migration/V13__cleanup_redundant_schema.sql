-- V13__cleanup_redundant_schema.sql
-- Description: Dọn dẹp các trường thừa trong helper_profiles, users, addresses và xóa bảng roles

-- 1. Dọn dẹp HelperProfile (Các trường này đã được chuyển sang bảng addresses hoặc thông tin có sẵn ở bảng users)
ALTER TABLE helper_profiles DROP FOREIGN KEY helper_profiles_ibfk_3;
ALTER TABLE helper_profiles DROP COLUMN current_city_id;
ALTER TABLE helper_profiles DROP COLUMN address_detail;
ALTER TABLE helper_profiles DROP COLUMN date_of_birth;

-- 2. Cập nhật User (Chuyển ngày sinh sang bảng core User)
ALTER TABLE users ADD COLUMN date_of_birth DATE AFTER gender;

-- Xóa các trường thừa trong users
ALTER TABLE users DROP COLUMN is_verified;

-- Xóa liên kết role cũ (Sử dụng Enum trong Java thay vì bảng roles)
ALTER TABLE users DROP FOREIGN KEY fk_user_role;
ALTER TABLE users DROP COLUMN role_id;

-- 3. Dọn dẹp Address (Xóa thông tin liên hệ thừa đã có trong User)
ALTER TABLE addresses DROP COLUMN contact_name;
ALTER TABLE addresses DROP COLUMN contact_phone;

-- 4. Xóa bảng roles không còn sử dụng
DROP TABLE roles;
