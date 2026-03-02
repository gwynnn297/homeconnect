-- V11__seed_wards_data.sql
-- Description: Nạp dữ liệu Phường/Xã cho các Quận trung tâm (Đặc biệt là Đà Nẵng)

-- 1. Quận Hải Châu, Đà Nẵng (ID Distrito thường nằm sau các Tỉnh, ta sẽ dùng subquery cho an toàn)
-- Tuy nhiên để đơn giản cho dev test, ta có thể lấy theo ID nếu biết chắc.
-- Dựa trên V6, Quận Hải Châu là bản ghi thứ 3 của Đà Nẵng (ID 43). 

-- Phường cho Quận Hải Châu, Đà Nẵng (Giả sử ID là 168 như user đề cập hoặc tìm theo tên)
SET @hai_chau_id = (SELECT location_id FROM locations WHERE name = 'Quận Hải Châu' AND parent_id = 43 LIMIT 1);

INSERT INTO locations (name, parent_id, type) VALUES 
('Phường Hải Châu I', @hai_chau_id, 'WARD'),
('Phường Hải Châu II', @hai_chau_id, 'WARD'),
('Phường Phước Ninh', @hai_chau_id, 'WARD'),
('Phường Hòa Thuận Đông', @hai_chau_id, 'WARD'),
('Phường Hòa Thuận Tây', @hai_chau_id, 'WARD'),
('Phường Hòa Cường Bắc', @hai_chau_id, 'WARD'),
('Phường Hòa Cường Nam', @hai_chau_id, 'WARD'),
('Phường Bình Thuận', @hai_chau_id, 'WARD'),
('Phường Bình Hiên', @hai_chau_id, 'WARD'),
('Phường Nam Dương', @hai_chau_id, 'WARD'),
('Phường Thạch Thang', @hai_chau_id, 'WARD'),
('Phường Thanh Bình', @hai_chau_id, 'WARD'),
('Phường Thuận Phước', @hai_chau_id, 'WARD');

-- Phường cho Quận Thanh Khê, Đà Nẵng
SET @thanh_khe_id = (SELECT location_id FROM locations WHERE name = 'Quận Thanh Khê' AND parent_id = 43 LIMIT 1);

INSERT INTO locations (name, parent_id, type) VALUES 
('Phường Thạc Gián', @thanh_khe_id, 'WARD'),
('Phường Chính Gián', @thanh_khe_id, 'WARD'),
('Phường Vĩnh Trung', @thanh_khe_id, 'WARD'),
('Phường Tân Chính', @thanh_khe_id, 'WARD'),
('Phường Xuân Hà', @thanh_khe_id, 'WARD'),
('Phường Tam Thuận', @thanh_khe_id, 'WARD'),
('Phường Thanh Khê Đông', @thanh_khe_id, 'WARD'),
('Phường Thanh Khê Tây', @thanh_khe_id, 'WARD'),
('Phường Hòa Khê', @thanh_khe_id, 'WARD'),
('Phường An Khê', @thanh_khe_id, 'WARD');
