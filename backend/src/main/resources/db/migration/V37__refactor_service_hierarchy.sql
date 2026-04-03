-- ==========================================
-- V37__refactor_service_hierarchy.sql
-- Description: Tách biệt hoàn toàn Danh mục Cha (Groups) và Dịch vụ Con (Details)
-- Bao gồm đầy đủ các dịch vụ con cho 7 danh mục cha bạn cung cấp.
-- ==========================================

SET FOREIGN_KEY_CHECKS = 0;
DELETE FROM services;
DELETE FROM service_categories;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. DANH MỤC CHA (Dựa trên ảnh của bạn)
INSERT INTO service_categories (category_id, name, description, base_price, unit, is_active, ui_config, created_at, updated_at)
VALUES 
(1, 'Vệ sinh & Dọn dẹp', 'Dịch vụ dọn dẹp vệ sinh nhà cửa cơ bản', 80000.00, 'PER_HOUR', 1, 
 '{"show_work_size": true, "work_size_label": "Diện tích", "work_size_unit": "m2", "show_pets": true, "show_tools": true, "show_premium": true}', NOW(), NOW()),

(2, 'Nấu ăn', 'Dịch vụ nấu các bữa ăn gia đình tại nhà', 100000.00, 'PER_HOUR', 1, 
 '{"show_work_size": true, "work_size_label": "Số người ăn", "work_size_unit": "người", "show_pets": true, "show_tools": false, "show_premium": false}', NOW(), NOW()),

(3, 'Đi chợ', 'Dịch vụ mua hộ thực phẩm và hàng hóa', 80000.00, 'PER_HOUR', 1, 
 '{"show_work_size": false, "show_pets": false, "show_tools": false, "show_premium": false}', NOW(), NOW()),

(4, 'Vệ sinh văn Phòng', 'Dịch vụ vệ sinh không gian làm việc, công ty', 90000.00, 'PER_HOUR', 1, 
 '{"show_work_size": true, "work_size_label": "Diện tích", "work_size_unit": "m2", "show_pets": false, "show_tools": true, "show_premium": true}', NOW(), NOW()),

(5, 'Trông trẻ', 'Dịch vụ chăm sóc và trông giữ trẻ nhỏ', 120000.00, 'PER_HOUR', 1, 
 '{"show_work_size": true, "work_size_label": "Số lượng trẻ", "work_size_unit": "bé", "show_pets": true, "show_tools": false, "show_premium": true}', NOW(), NOW()),

(6, 'Làm vườn', 'Dịch vụ chăm sóc cây cảnh, sân vườn và tỉa cây', 150000.00, 'PER_HOUR', 1, 
 '{"show_work_size": true, "work_size_label": "Diện tích vườn", "work_size_unit": "m2", "show_pets": false, "show_tools": true, "show_premium": false}', NOW(), NOW()),

(7, 'Sơn sửa', 'Dịch vụ sửa chữa nhỏ và tân trang nhà cửa', 200000.00, 'PER_HOUR', 1, 
 '{"show_work_size": false, "show_pets": false, "show_tools": true, "show_premium": false}', NOW(), NOW());

-- 2. DỊCH VỤ CON (Đầy đủ cho từng mục cha)
INSERT INTO services (category_id, name, description, base_price, is_active, created_at, updated_at)
VALUES
-- Con của 1. Dọn dẹp
(1, 'Hút bụi & Lau sàn', 'Làm sạch sàn nhà chuyên sâu bằng máy và nước lau sàn', 0.00, 1, NOW(), NOW()),
(1, 'Vệ sinh cửa kính', 'Lau chùi cửa kính bám bụi lâu ngày', 20000.00, 1, NOW(), NOW()),
(1, 'Dọn dẹp bếp & WC', 'Vệ sinh kỹ khu vực nấu nướng và nhà tắm', 0.00, 1, NOW(), NOW()),

-- Con của 2. Nấu ăn
(2, 'Nấu cơm truyền thống', 'Thực hiện các món ăn hằng ngày của gia đình', 0.00, 1, NOW(), NOW()),
(2, 'Sơ chế rau củ/thịt cá', 'Rửa sạch, thái và tẩm ướp sẵn cho gia chủ tự nấu', 0.00, 1, NOW(), NOW()),
(2, 'Dọn dẹp bàn ăn sau tiệc', 'Hỗ trợ dọn rửa sau các buổi liên hoan', 50000.00, 1, NOW(), NOW()),

-- Con của 3. Đi chợ
(3, 'Đi chợ truyền thống', 'Lựa chọn thực phẩm tươi ngon tại các chợ gần nhà', 0.00, 1, NOW(), NOW()),
(3, 'Mua sắm tại Siêu thị', 'Mua các mặt hàng tại siêu thị hoặc cửa hàng tiện lợi', 10000.00, 1, NOW(), NOW()),

-- Con của 4. Vệ sinh văn Phòng
(4, 'Lau dọn bàn ghế & Máy tính', 'Lau sạch bụi bẩn trên thiết bị văn phòng', 0.00, 1, NOW(), NOW()),
(4, 'Làm sạch thảm & Rèm văn phòng', 'Hút bụi và khử mùi thảm, rèm', 100000.00, 1, NOW(), NOW()),

-- Con của 5. Trông trẻ
(5, 'Trông giữ trẻ tại nhà', 'Đảm bảo an toàn, cho trẻ ăn và vệ sinh cho trẻ', 0.00, 1, NOW(), NOW()),
(5, 'Kèm trẻ ôn bài/học bài', 'Hỗ trợ hướng dẫn trẻ tự học hoặc làm bài tập', 0.00, 1, NOW(), NOW()),
(5, 'Tắm cho em bé', 'Dịch vụ tắm gội nhẹ nhàng, an toàn cho trẻ sơ sinh/nhỏ', 30000.00, 1, NOW(), NOW()),

-- Con của 6. Làm vườn
(6, 'Cắt cỏ sân vườn', 'Sử dụng máy cắt cỏ chuyên dụng làm phẳng mặt cỏ', 0.00, 1, NOW(), NOW()),
(6, 'Tỉa cành & Chăm cây cảnh', 'Cắt tỉa tạo dáng cây và bón phân định kỳ', 30000.00, 1, NOW(), NOW()),
(6, 'Vệ sinh ao cá/Hồ cảnh', 'Lọc nước, vệ sinh thành hồ chuyên sâu', 50000.00, 1, NOW(), NOW()),

-- Con của 7. Sơn sửa
(7, 'Sơn lại mảng tường cũ', 'Lăn sơn mới cho các khu vực bị bong tróc', 0.00, 1, NOW(), NOW()),
(7, 'Sửa ổ điện/Vòi nước', 'Thay mới hoặc sửa các lỗi hư hỏng vặt', 10000.00, 1, NOW(), NOW()),
(7, 'Lắp đặt vật dụng cơ bản', 'Lắp rèm, khoan kệ, treo tranh...', 20000.00, 1, NOW(), NOW());