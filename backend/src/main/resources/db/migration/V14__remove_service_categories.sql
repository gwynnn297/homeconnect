-- V14: Remove Service Categories and flatten Services structure

-- Tắt kiểm tra khóa ngoại để thực hiện thay đổi cấu trúc dễ dàng hơn
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Xóa khóa ngoại trong bảng services liên kết tới service_categories
-- Tên khóa ngoại chính xác từ V7 là fk_service_category
ALTER TABLE services DROP FOREIGN KEY fk_service_category;

-- 2. Xóa cột category_id trong bảng services
ALTER TABLE services DROP COLUMN category_id;

-- 3. Xóa bảng service_categories
DROP TABLE IF EXISTS service_categories;

-- Bật lại kiểm tra khóa ngoại
SET FOREIGN_KEY_CHECKS = 1;
