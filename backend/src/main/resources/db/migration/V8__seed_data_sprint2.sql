-- ==========================================
-- V8__seed_data_sprint2.sql
-- Description: Update schema for unit and seed data for Sprint 2
-- ==========================================

-- 1. Bổ sung cột unit vào bảng services (để khớp với Java Entity đã tạo)
ALTER TABLE services ADD COLUMN unit VARCHAR(20) AFTER base_price;

-- 2. Seed Service Categories (Danh mục)
-- Xóa trắng dữ liệu cũ để ID khởi tạo từ 1 (nếu cần thiết cho test)
DELETE FROM services;
DELETE FROM service_categories;

ALTER TABLE service_categories AUTO_INCREMENT = 1;

INSERT INTO service_categories (name, icon_url, is_active) VALUES 
('Vệ sinh & Dọn dẹp', 'https://cdn-icons-png.flaticon.com/512/995/995053.png', TRUE),
('Chăm sóc gia đình', 'https://cdn-icons-png.flaticon.com/512/3076/3076753.png', TRUE),
('Sửa chữa & Kỹ thuật', 'https://cdn-icons-png.flaticon.com/512/605/605175.png', TRUE),
('Đi chợ & Nấu ăn', 'https://cdn-icons-png.flaticon.com/512/3565/3565418.png', TRUE);

-- 3. Seed Services (Dịch vụ) - Phân loại theo Category
-- Lưu ý: IDs 1=Vệ sinh, 2=Chăm sóc, 3=Sửa chữa, 4=Nấu ăn
INSERT INTO services (category_id, name, description, icon_url, base_price, unit, is_active) VALUES 
(1, 'Dọn dẹp nhà cửa', 'Dọn vệ sinh cơ bản, quét dọn, lau chùi đồ đạc.', 'https://cdn-icons-png.flaticon.com/512/995/995053.png', 80000.00, 'PER_HOUR', TRUE),
(1, 'Tổng vệ sinh (Deep Clean)', 'Vệ sinh toàn diện, tẩy rửa vết bẩn cứng đầu.', 'https://img.icons8.com/color/96/vacuum-cleaner.png', 150000.00, 'PER_HOUR', TRUE),
(1, 'Dọn vườn', 'Cắt cỏ, dọn dẹp cành cây, làm sạch sân vườn.', 'https://cdn-icons-png.flaticon.com/512/1518/1518915.png', 180000.00, 'PER_HOUR', TRUE),
(2, 'Trông trẻ', 'Chăm sóc trẻ em, cho ăn, chơi cùng trẻ.', 'https://cdn-icons-png.flaticon.com/512/3069/3069153.png', 120000.00, 'PER_HOUR', TRUE),
(2, 'Chăm sóc người già', 'Hỗ trợ sinh hoạt cho người cao tuổi.', 'https://cdn-icons-png.flaticon.com/512/3069/3069181.png', 150000.00, 'PER_HOUR', TRUE),
(3, 'Sửa máy lạnh', 'Vệ sinh, nạp gas, sửa lỗi máy lạnh.', 'https://cdn-icons-png.flaticon.com/512/958/958417.png', 200000.00, 'PER_SERVICE', TRUE),
(3, 'Sửa điện nước', 'Xử lý các sự cố điện, đường ống nước hỏng.', 'https://cdn-icons-png.flaticon.com/512/2324/2324122.png', 100000.00, 'PER_SERVICE', TRUE),
(4, 'Nấu ăn gia đình', 'Đi chợ và nấu các món ăn theo yêu cầu.', 'https://cdn-icons-png.flaticon.com/512/3443/3443338.png', 150000.00, 'PER_HOUR', TRUE);

-- 4. Seed System Settings (Cấu hình)
DELETE FROM system_settings; -- Xóa cũ nếu đã có
INSERT INTO system_settings (setting_key, setting_value, description) VALUES 
('COMMISSION_RATE', '0.2', 'Tỷ lệ chiết khấu hệ thống (20%)'),
('MIN_BOOKING_HOURS', '2', 'Số giờ đặt tối thiểu cho mỗi lần dọn dẹp');
