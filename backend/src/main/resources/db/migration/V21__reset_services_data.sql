-- V21__reset_services_data.sql
-- Xóa toàn bộ dữ liệu services cũ và seed lại 7 dịch vụ mới

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE helper_services;
TRUNCATE TABLE services;

ALTER TABLE services AUTO_INCREMENT = 1;

SET FOREIGN_KEY_CHECKS = 1;

-- Seed 7 dịch vụ mới theo UI
INSERT INTO services (name, description, base_price, unit, is_active) VALUES
('Dọn dẹp',        'Dọn vệ sinh nhà cửa, quét dọn, lau chùi đồ đạc.',           80000.00,  'PER_HOUR',    TRUE),
('Nấu ăn',         'Nấu các bữa ăn theo yêu cầu của gia đình.',                  100000.00, 'PER_HOUR',    TRUE),
('Vệ sinh văn Phòng', 'Vệ sinh, lau dọn văn phòng, không gian làm việc.',        90000.00,  'PER_HOUR',    TRUE),
('Trông trẻ',      'Chăm sóc trẻ nhỏ, cho ăn, vui chơi cùng trẻ.',              120000.00, 'PER_HOUR',    TRUE),
('Đi chợ',         'Mua sắm thực phẩm, hàng hóa theo danh sách của gia đình.',   80000.00,  'PER_SERVICE', TRUE),
('Làm vườn',       'Cắt cỏ, tỉa cây, chăm sóc cây cảnh và sân vườn.',           150000.00, 'PER_HOUR',    TRUE),
('Sơn sửa',        'Sơn tường, sửa chữa nhỏ trong nhà theo yêu cầu.',            200000.00, 'PER_SERVICE', TRUE);
