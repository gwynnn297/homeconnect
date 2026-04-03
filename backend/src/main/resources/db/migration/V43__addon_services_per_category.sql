-- Dịch vụ con bổ sung (add-on) theo từng danh mục cha — tên unique toàn bảng services.
-- Không xóa seed V37; chỉ INSERT thêm.

INSERT INTO services (category_id, name, description, base_price, is_active, created_at, updated_at) VALUES
-- 1. Vệ sinh & Dọn dẹp
(1, 'Giặt quần áo', 'Giặt và xử lý sơ bộ quần áo theo hướng dẫn gia chủ', 40000.00, 1, NOW(), NOW()),
(1, 'Rửa chén bát', 'Rửa và xếp chén đĩa sau bữa ăn', 30000.00, 1, NOW(), NOW()),
(1, 'Hỗ trợ nấu ăn đơn giản', 'Nấu món đơn giản kèm theo phiên dọn dẹp', 50000.00, 1, NOW(), NOW()),

-- 2. Nấu ăn
(2, 'Dọn bếp sau nấu', 'Lau dọn mặt bếp, bồn rửa sau khi nấu', 35000.00, 1, NOW(), NOW()),
(2, 'Giặt khăn bếp', 'Giặt khăn lau, tạp dề bếp', 25000.00, 1, NOW(), NOW()),

-- 3. Đi chợ
(3, 'Sơ chế thực phẩm', 'Rửa, sơ chế rau củ thịt cá sau khi mua về', 30000.00, 1, NOW(), NOW()),
(3, 'Sắp xếp tủ lạnh', 'Phân loại và xếp thực phẩm vào tủ lạnh', 20000.00, 1, NOW(), NOW()),

-- 4. Vệ sinh văn phòng
(4, 'Dọn pantry văn phòng', 'Lau dọn khu pantry, bàn ăn nhẹ', 40000.00, 1, NOW(), NOW()),
(4, 'Đổ rác văn phòng', 'Thu gom và đổ rác theo quy định khu vực', 15000.00, 1, NOW(), NOW()),

-- 5. Trông trẻ
(5, 'Cho bé ăn uống', 'Hỗ trợ bữa phụ / ăn nhẹ đã chuẩn bị sẵn', 35000.00, 1, NOW(), NOW()),
(5, 'Dọn dẹp đồ chơi', 'Thu dọn và sắp xếp đồ chơi, góc chơi', 25000.00, 1, NOW(), NOW()),

-- 6. Làm vườn
(6, 'Thu gom lá vườn', 'Quét, gom lá và để gọn khu vực quy định', 30000.00, 1, NOW(), NOW()),
(6, 'Tưới cây bổ sung', 'Tưới thêm các chậu/luống theo hướng dẫn', 20000.00, 1, NOW(), NOW()),

-- 7. Sơn sửa
(7, 'Hỗ trợ nhiều hạng mục sửa', 'Phụ trợ khi có nhiều điểm cần xử lý trong cùng buổi', 40000.00, 1, NOW(), NOW()),
(7, 'Đi mua vật tư phụ', 'Hỗ trợ mua bulong, phích cắm… (chi phí vật tư thực tế khách thanh toán/rõ hóa đơn)', 50000.00, 1, NOW(), NOW());
