-- ==========================================
-- V38__refactor_booking_service_to_category.sql
-- Description: Đổi tên cột và chuẩn hóa relationship sang ServiceCategory
--              Hỗ trợ cả trường hợp đã chạy V38 cũ (tên 'categories')
-- ==========================================

-- 1. Xóa khóa ngoại (FK) cũ (trỏ từ service_id)
SET @fk_name := (
    SELECT CONSTRAINT_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_NAME = 'bookings'
      AND COLUMN_NAME IN ('service_id', 'categories')
      AND TABLE_SCHEMA = DATABASE()
      AND REFERENCED_TABLE_NAME IS NOT NULL
    LIMIT 1
);

SET @drop_fk := IF(
    @fk_name IS NOT NULL,
    CONCAT('ALTER TABLE bookings DROP FOREIGN KEY ', @fk_name),
    'SELECT "Không tìm thấy FK cũ, bỏ qua"'
);
PREPARE stmt FROM @drop_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Tự động xác định cột cũ (service_id hoặc categories) để đổi sang category_id
SET @old_col := (
    SELECT COLUMN_NAME 
    FROM information_schema.COLUMNS 
    WHERE TABLE_NAME = 'bookings' 
      AND COLUMN_NAME IN ('service_id', 'categories')
      AND TABLE_SCHEMA = DATABASE()
    LIMIT 1
);

SET @sql_rename := IF(
    @old_col IS NOT NULL AND @old_col != 'category_id',
    CONCAT('ALTER TABLE bookings CHANGE COLUMN ', @old_col, ' category_id INT NOT NULL'),
    'SELECT "Cột đã được đổi tên hoặc không tồn tại"'
);
PREPARE stmt_ren FROM @sql_rename;
EXECUTE stmt_ren;
DEALLOCATE PREPARE stmt_ren;

-- 3. Thêm khóa ngoại (FK) mới
ALTER TABLE bookings
    ADD CONSTRAINT fk_booking_category
    FOREIGN KEY (category_id) REFERENCES service_categories(category_id);

-- 4. Cập nhật comment
ALTER TABLE bookings COMMENT = 'Bookings - category_id linked to service_categories';
