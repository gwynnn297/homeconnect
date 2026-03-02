-- V10__fix_address_schema_and_reset_services.sql
-- Description: Bổ sung cột updated_at cho bảng addresses và reset bảng services về ID 1

-- 1. Bổ sung cột cho bảng addresses
ALTER TABLE addresses 
ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Thời gian cập nhật';

-- 2. Reset bảng services để ID bắt đầu từ 1 (Phục vụ luồng đăng ký Helper)
SET FOREIGN_KEY_CHECKS = 0;

-- Xóa dữ liệu ở các bảng liên quan đến services
TRUNCATE TABLE helper_services;
TRUNCATE TABLE services;

-- Reset giá trị AUTO_INCREMENT
ALTER TABLE services AUTO_INCREMENT = 1;

-- Seed lại dữ liệu services (Copy từ V8 nhưng đảm bảo sạch sẽ)
INSERT INTO services (category_id, name, description, icon_url, base_price, unit, is_active) VALUES 
(1, 'Dọn dẹp nhà cửa', 'Dọn vệ sinh cơ bản, quét dọn, lau chùi đồ đạc.', 'https://cdn-icons-png.flaticon.com/512/995/995053.png', 80000.00, 'PER_HOUR', TRUE),
(1, 'Tổng vệ sinh (Deep Clean)', 'Vệ sinh toàn diện, tẩy rửa vết bẩn cứng đầu.', 'https://img.icons8.com/color/96/vacuum-cleaner.png', 150000.00, 'PER_HOUR', TRUE),
(1, 'Dọn vườn', 'Cắt cỏ, dọn dẹp cành cây, làm sạch sân vườn.', 'https://cdn-icons-png.flaticon.com/512/1518/1518915.png', 180000.00, 'PER_HOUR', TRUE),
(2, 'Trông trẻ', 'Chăm sóc trẻ em, cho ăn, chơi cùng trẻ.', 'https://cdn-icons-png.flaticon.com/512/3069/3069153.png', 120000.00, 'PER_HOUR', TRUE),
(2, 'Chăm sóc người già', 'Hỗ trợ sinh hoạt cho người cao tuổi.', 'https://cdn-icons-png.flaticon.com/512/3069/3069181.png', 150000.00, 'PER_HOUR', TRUE),
(3, 'Sửa máy lạnh', 'Vệ sinh, nạp gas, sửa lỗi máy lạnh.', 'https://cdn-icons-png.flaticon.com/512/958/958417.png', 200000.00, 'PER_SERVICE', TRUE),
(3, 'Sửa điện nước', 'Xử lý các sự cố điện, đường ống nước hỏng.', 'https://cdn-icons-png.flaticon.com/512/2324/2324122.png', 100000.00, 'PER_SERVICE', TRUE),
(4, 'Nấu ăn gia đình', 'Đi chợ và nấu các món ăn theo yêu cầu.', 'https://cdn-icons-png.flaticon.com/512/3443/3443338.png', 150000.00, 'PER_HOUR', TRUE);

SET FOREIGN_KEY_CHECKS = 1;
