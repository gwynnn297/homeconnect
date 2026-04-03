-- V44__update_sub_services.sql

-- 1. Xóa các dịch vụ cũ trong Category 4 (đã thêm ở V43 nhưng nay không dùng nữa theo yêu cầu)
DELETE FROM services WHERE category_id = 4 AND name IN ('Dọn pantry văn phòng', 'Đổ rác văn phòng');

-- 2. Thêm các dịch vụ mới cho Category 4 (Vệ sinh văn phòng)
INSERT INTO services (category_id, name, description, base_price, is_active, created_at, updated_at) VALUES
(4, 'lau kính bên ngoài', 'vệ sinh phía bên ngoài tòa nhà giới hạn chiều cao tối đa là 3m5 và phải có nới đứng án toàn để thực hiện', 40000.00, 1, NOW(), NOW()),
(4, 'làm sạch vết bẩn chuyên sâu', 'làm sạch vế bẩn chuyên sâu ,tẩy xi măng sơn,keo dính trên nội thất', 15000.00, 1, NOW(), NOW());

-- 3. Xóa dịch vụ con cho Vệ sinh dọn dẹp (Category 1) theo yêu cầu
DELETE FROM services WHERE category_id = 1 AND name = 'Rửa chén bát';

-- 4. Xóa dịch vụ con cho Làm vườn (Category 6) theo yêu cầu
DELETE FROM services WHERE category_id = 6 AND name = 'Thu gom lá vườn';
