-- V28: Tái cấu trúc schema để dùng ServiceCategory (Cha) làm đơn vị chính cho Công việc và Kỹ năng Thợ

-- 1. Cập nhật bảng job_posts
-- Thêm category_id (bắt buộc, Cha), giữ service_id là chi tiết tuỳ chọn
ALTER TABLE job_posts 
ADD category_id INT;

ALTER TABLE job_posts 
ADD CONSTRAINT fk_job_category FOREIGN KEY (category_id) REFERENCES service_categories(category_id);

-- 2. Dọn dẹp bảng services - xoá cột unit (không còn dùng)
ALTER TABLE services 
DROP unit;

-- 3. Tái cấu trúc bảng helper_services
-- Thêm category_id và xóa service_id để chuyển sang đăng ký theo Danh mục Cha
ALTER TABLE helper_services ADD category_id INT;

-- Thử xóa unique index cũ
ALTER TABLE helper_services DROP INDEX unique_helper_service;

-- QUAN TRỌNG: Phải xóa FOREIGN KEY trước khi drop cột trong MySQL
-- Tên ràng buộc là helper_services_ibfk_2 dựa theo log migration
ALTER TABLE helper_services DROP FOREIGN KEY helper_services_ibfk_2;

-- Xóa cột service_id an toàn
ALTER TABLE helper_services DROP service_id;

-- Thêm ràng buộc mới theo Danh mục
ALTER TABLE helper_services 
ADD CONSTRAINT fk_helper_service_category FOREIGN KEY (category_id) REFERENCES service_categories(category_id),
ADD UNIQUE KEY unique_helper_category (helper_id, category_id);
