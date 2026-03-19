-- V24: Add pricing to categories and re-seed all service/category data
-- This migration synchronizes the Category-Service hierarchy and adds base pricing at the category level.

-- 1. Update Schema
ALTER TABLE service_categories 
ADD COLUMN base_price DECIMAL(15, 2),
ADD COLUMN unit VARCHAR(20);

-- 2. Cleanup existing data to ensure clean hierarchy
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE helper_services;
TRUNCATE TABLE services;
TRUNCATE TABLE service_categories;
SET FOREIGN_KEY_CHECKS = 1;

-- 3. Seed Parent Categories (ServiceCategory)
INSERT INTO service_categories (category_id, name, description, base_price, unit, is_active) VALUES
(1, 'Dọn dẹp nhà cửa',    'Dịch vụ dọn dẹp vệ sinh nhà cửa định kỳ hoặc theo giờ.', 80000.00,  'PER_HOUR', TRUE),
(2, 'Ăn uống & Đi chợ',   'Dịch vụ nấu ăn gia đình và đi chợ hộ.',                 100000.00, 'PER_HOUR', TRUE),
(3, 'Vệ sinh Chuyên dụng', 'Vệ sinh văn phòng, sofa, đệm, rèm chuyên sâu.',         120000.00, 'PER_HOUR', TRUE),
(4, 'Trông trẻ & Chăm sóc', 'Dịch vụ trông trẻ nhỏ và hỗ trợ chăm sóc người già.', 120000.00, 'PER_HOUR', TRUE),
(5, 'Sửa chữa & Sân vườn', 'Sơn sửa nhà cửa, điện nước và chăm sóc sân vườn.',     150000.00, 'PER_HOUR', TRUE);

-- 4. Seed Child Services (Service) linked to Categories
INSERT INTO services (name, description, base_price, unit, category_id, is_active) VALUES
-- Category 1: Dọn dẹp nhà cửa
('Dọn dẹp',        'Dọn vệ sinh nhà cửa, quét dọn, lau chùi đồ đạc.',           80000.00,  'PER_HOUR',    1, TRUE),

-- Category 2: Ăn uống & Đi chợ
('Nấu ăn',         'Nấu các bữa ăn theo yêu cầu của gia đình.',                  100000.00, 'PER_HOUR',    2, TRUE),
('Đi chợ',         'Mua sắm thực phẩm, hàng hóa theo danh sách của gia đình.',   80000.00,  'PER_SERVICE', 2, TRUE),

-- Category 3: Vệ sinh Chuyên dụng
('Vệ sinh văn Phòng', 'Vệ sinh, lau dọn văn phòng, không gian làm việc.',        90000.00,  'PER_HOUR',    3, TRUE),

-- Category 4: Trông trẻ & Chăm sóc
('Trông trẻ',      'Chăm sóc trẻ nhỏ, cho ăn, vui chơi cùng trẻ.',              120000.00, 'PER_HOUR',    4, TRUE),

-- Category 5: Sửa chữa & Sân vườn
('Làm vườn',       'Cắt cỏ, tỉa cây, chăm sóc cây cảnh và sân vườn.',           150000.00, 'PER_HOUR',    5, TRUE),
('Sơn sửa',        'Sơn tường, sửa chữa nhỏ trong nhà theo yêu cầu.',            200000.00, 'PER_SERVICE', 5, TRUE);
