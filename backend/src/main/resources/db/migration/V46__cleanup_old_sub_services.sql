-- V46__cleanup_old_sub_services.sql
-- Xóa các dịch vụ con cũ không còn sử dụng cho 7 danh mục cha

DELETE FROM services WHERE category_id = 1 AND name IN ('Hút bụi & Lau sàn', 'Vệ sinh cửa kính', 'Dọn dẹp bếp & WC');
DELETE FROM services WHERE category_id = 2 AND name IN ('Nấu cơm truyền thống', 'Sơ chế rau củ/thịt cá', 'Dọn dẹp bàn ăn sau tiệc');
DELETE FROM services WHERE category_id = 3 AND name IN ('Đi chợ truyền thống', 'Mua sắm tại Siêu thị');
DELETE FROM services WHERE category_id = 4 AND name IN ('Lau dọn bàn ghế & Máy tính', 'Làm sạch thảm & Rèm văn phòng');
DELETE FROM services WHERE category_id = 5 AND name IN ('Trông giữ trẻ tại nhà', 'Kèm trẻ ôn bài/học bài', 'Tắm cho em bé');
DELETE FROM services WHERE category_id = 6 AND name IN ('Cắt cỏ sân vườn', 'Tỉa cành & Chăm cây cảnh', 'Vệ sinh ao cá/Hồ cảnh');
DELETE FROM services WHERE category_id = 7 AND name IN ('Sơn lại mảng tường cũ', 'Sửa ổ điện/Vòi nước', 'Lắp đặt vật dụng cơ bản');

