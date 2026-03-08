-- V7__seed_districts_data.sql
-- Nạp dữ liệu Quận/Huyện cho tất cả 63 tỉnh thành
-- parent_id tương ứng với location_id của Tỉnh trong V3

-- 1. Hà Nội (ID: 29)
INSERT INTO locations (name, parent_id, type) VALUES 
('Quận Ba Đình', 29, 'DISTRICT'), ('Quận Hoàn Kiếm', 29, 'DISTRICT'), ('Quận Tây Hồ', 29, 'DISTRICT'), 
('Quận Long Biên', 29, 'DISTRICT'), ('Quận Cầu Giấy', 29, 'DISTRICT'), ('Quận Đống Đa', 29, 'DISTRICT'), 
('Quận Hai Bà Trưng', 29, 'DISTRICT'), ('Quận Hoàng Mai', 29, 'DISTRICT'), ('Quận Thanh Xuân', 29, 'DISTRICT'), 
('Huyện Sóc Sơn', 29, 'DISTRICT'), ('Huyện Đông Anh', 29, 'DISTRICT'), ('Huyện Gia Lâm', 29, 'DISTRICT'), 
('Quận Nam Từ Liêm', 29, 'DISTRICT'), ('Huyện Thanh Trì', 29, 'DISTRICT'), ('Quận Bắc Từ Liêm', 29, 'DISTRICT'), 
('Huyện Mê Linh', 29, 'DISTRICT'), ('Quận Hà Đông', 29, 'DISTRICT'), ('Thị xã Sơn Tây', 29, 'DISTRICT'), 
('Huyện Ba Vì', 29, 'DISTRICT'), ('Huyện Phúc Thọ', 29, 'DISTRICT'), ('Huyện Đan Phượng', 29, 'DISTRICT'), 
('Huyện Hoài Đức', 29, 'DISTRICT'), ('Huyện Quốc Oai', 29, 'DISTRICT'), ('Huyện Thạch Thất', 29, 'DISTRICT'), 
('Huyện Chương Mỹ', 29, 'DISTRICT'), ('Huyện Thanh Oai', 29, 'DISTRICT'), ('Huyện Thường Tín', 29, 'DISTRICT'), 
('Huyện Phú Xuyên', 29, 'DISTRICT'), ('Huyện Ứng Hòa', 29, 'DISTRICT'), ('Huyện Mỹ Đức', 29, 'DISTRICT');

-- 2. TP. Hồ Chí Minh (ID: 41)
INSERT INTO locations (name, parent_id, type) VALUES 
('Quận 1', 41, 'DISTRICT'), ('Quận 3', 41, 'DISTRICT'), ('Quận 4', 41, 'DISTRICT'), 
('Quận 5', 41, 'DISTRICT'), ('Quận 6', 41, 'DISTRICT'), ('Quận 7', 41, 'DISTRICT'), 
('Quận 8', 41, 'DISTRICT'), ('Quận 10', 41, 'DISTRICT'), ('Quận 11', 41, 'DISTRICT'), 
('Quận 12', 41, 'DISTRICT'), ('Quận Bình Tân', 41, 'DISTRICT'), ('Quận Bình Thạnh', 41, 'DISTRICT'), 
('Quận Gò Vấp', 41, 'DISTRICT'), ('Quận Phú Nhuận', 41, 'DISTRICT'), ('Quận Tân Bình', 41, 'DISTRICT'), 
('Quận Tân Phú', 41, 'DISTRICT'), ('Thành phố Thủ Đức', 41, 'DISTRICT'), ('Huyện Bình Chánh', 41, 'DISTRICT'), 
('Huyện Cần Giờ', 41, 'DISTRICT'), ('Huyện Củ Chi', 41, 'DISTRICT'), ('Huyện Hóc Môn', 41, 'DISTRICT'), 
('Huyện Nhà Bè', 41, 'DISTRICT');

-- 3. Hải Phòng (ID: 15)
INSERT INTO locations (name, parent_id, type) VALUES 
('Quận Hồng Bàng', 15, 'DISTRICT'), ('Quận Ngô Quyền', 15, 'DISTRICT'), ('Quận Lê Chân', 15, 'DISTRICT'), 
('Quận Hải An', 15, 'DISTRICT'), ('Quận Kiến An', 15, 'DISTRICT'), ('Quận Đồ Sơn', 15, 'DISTRICT'), 
('Quận Dương Kinh', 15, 'DISTRICT'), ('Huyện Thuỷ Nguyên', 15, 'DISTRICT'), ('Huyện An Dương', 15, 'DISTRICT');

-- 4. Đà Nẵng (ID: 43)
INSERT INTO locations (name, parent_id, type) VALUES 
('Quận Liên Chiểu', 43, 'DISTRICT'), ('Quận Thanh Khê', 43, 'DISTRICT'), ('Quận Hải Châu', 43, 'DISTRICT'), 
('Quận Sơn Trà', 43, 'DISTRICT'), ('Quận Ngũ Hành Sơn', 43, 'DISTRICT'), ('Quận Cẩm Lệ', 43, 'DISTRICT'), 
('Huyện Hòa Vang', 43, 'DISTRICT');

-- 5. Cần Thơ (ID: 65)
INSERT INTO locations (name, parent_id, type) VALUES 
('Quận Ninh Kiều', 65, 'DISTRICT'), ('Quận Bình Thuỷ', 65, 'DISTRICT'), ('Quận Cái Răng', 65, 'DISTRICT'), 
('Quận Ô Môn', 65, 'DISTRICT'), ('Quận Thốt Nốt', 65, 'DISTRICT'), ('Huyện Vĩnh Thạnh', 65, 'DISTRICT'), 
('Huyện Cờ Đỏ', 65, 'DISTRICT'), ('Huyện Phong Điền', 65, 'DISTRICT'), ('Huyện Thới Lai', 65, 'DISTRICT');

-- Các tỉnh thành khác (Chọn các Quận/Huyện/Thành phố/Thị xã trung tâm)

-- 6. Hà Giang (ID: 23)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Hà Giang', 23, 'DISTRICT'), ('Huyện Đồng Văn', 23, 'DISTRICT'), ('Huyện Mèo Vạc', 23, 'DISTRICT');
-- 7. Cao Bằng (ID: 11)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Cao Bằng', 11, 'DISTRICT'), ('Huyện Trùng Khánh', 11, 'DISTRICT'), ('Huyện Quảng Hòa', 11, 'DISTRICT');
-- 8. Lào Cai (ID: 24)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Lào Cai', 24, 'DISTRICT'), ('Thị xã Sa Pa', 24, 'DISTRICT'), ('Huyện Bắc Hà', 24, 'DISTRICT');
-- 9. Lai Châu (ID: 25)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Lai Châu', 25, 'DISTRICT'), ('Huyện Mường Tè', 25, 'DISTRICT'), ('Huyện Phong Thổ', 25, 'DISTRICT');
-- 10. Sơn La (ID: 26)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Sơn La', 26, 'DISTRICT'), ('Huyện Mộc Châu', 26, 'DISTRICT'), ('Huyện Quỳnh Nhai', 26, 'DISTRICT');
-- 11. Điện Biên (ID: 27)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Điện Biên Phủ', 27, 'DISTRICT'), ('Thị xã Mường Lay', 27, 'DISTRICT'), ('Huyện Điện Biên Đông', 27, 'DISTRICT');
-- 12. Yên Bái (ID: 21)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Yên Bái', 21, 'DISTRICT'), ('Thị xã Nghĩa Lộ', 21, 'DISTRICT'), ('Huyện Mù Cang Chải', 21, 'DISTRICT');
-- 13. Tuyên Quang (ID: 22)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Tuyên Quang', 22, 'DISTRICT'), ('Huyện Chiêm Hóa', 22, 'DISTRICT'), ('Huyện Na Hang', 22, 'DISTRICT');
-- 14. Lạng Sơn (ID: 12)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Lạng Sơn', 12, 'DISTRICT'), ('Huyện Cao Lộc', 12, 'DISTRICT'), ('Huyện Lộc Bình', 12, 'DISTRICT');
-- 15. Bắc Kạn (ID: 97)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Bắc Kạn', 97, 'DISTRICT'), ('Huyện Ba Bể', 97, 'DISTRICT'), ('Huyện Chợ Đồn', 97, 'DISTRICT');
-- 16. Thái Nguyên (ID: 20)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Thái Nguyên', 20, 'DISTRICT'), ('Thành phố Sông Công', 20, 'DISTRICT'), ('Thành phố Phổ Yên', 20, 'DISTRICT');
-- 17. Phú Thọ (ID: 19)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Việt Trì', 19, 'DISTRICT'), ('Thị xã Phú Thọ', 19, 'DISTRICT'), ('Huyện Thanh Sơn', 19, 'DISTRICT');
-- 18. Vĩnh Phúc (ID: 88)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Vĩnh Yên', 88, 'DISTRICT'), ('Thành phố Phúc Yên', 88, 'DISTRICT'), ('Huyện Bình Xuyên', 88, 'DISTRICT');
-- 19. Bắc Ninh (ID: 99)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Bắc Ninh', 99, 'DISTRICT'), ('Thành phố Từ Sơn', 99, 'DISTRICT'), ('Thị xã Quế Võ', 99, 'DISTRICT');
-- 20. Bắc Giang (ID: 98)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Bắc Giang', 98, 'DISTRICT'), ('Thị xã Việt Yên', 98, 'DISTRICT'), ('Huyện Lục Ngạn', 98, 'DISTRICT');
-- 21. Quảng Ninh (ID: 14)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Hạ Long', 14, 'DISTRICT'), ('Thành phố Móng Cái', 14, 'DISTRICT'), ('Thành phố Uông Bí', 14, 'DISTRICT'), ('Thành phố Cẩm Phả', 14, 'DISTRICT');
-- 22. Hòa Bình (ID: 28)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Hòa Bình', 28, 'DISTRICT'), ('Huyện Mai Châu', 28, 'DISTRICT'), ('Huyện Lương Sơn', 28, 'DISTRICT');
-- 23. Hưng Yên (ID: 89)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Hưng Yên', 89, 'DISTRICT'), ('Thị xã Mỹ Hào', 89, 'DISTRICT'), ('Huyện Văn Lâm', 89, 'DISTRICT');
-- 24. Hải Dương (ID: 34)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Hải Dương', 34, 'DISTRICT'), ('Thành phố Chí Linh', 34, 'DISTRICT'), ('Thị xã Kinh Môn', 34, 'DISTRICT');
-- 25. Thái Bình (ID: 17)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Thái Bình', 17, 'DISTRICT'), ('Huyện Tiền Hải', 17, 'DISTRICT'), ('Huyện Kiến Xương', 17, 'DISTRICT');
-- 26. Hà Nam (ID: 90)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Phủ Lý', 90, 'DISTRICT'), ('Thị xã Duy Tiên', 90, 'DISTRICT'), ('Huyện Kim Bảng', 90, 'DISTRICT');
-- 27. Nam Định (ID: 18)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Nam Định', 18, 'DISTRICT'), ('Huyện Giao Thủy', 18, 'DISTRICT'), ('Huyện Hải Hậu', 18, 'DISTRICT');
-- 28. Ninh Bình (ID: 35)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Ninh Bình', 35, 'DISTRICT'), ('Thành phố Tam Điệp', 35, 'DISTRICT'), ('Huyện Hoa Lư', 35, 'DISTRICT');
-- 29. Thanh Hóa (ID: 36)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Thanh Hóa', 36, 'DISTRICT'), ('Thành phố Sầm Sơn', 36, 'DISTRICT'), ('Thị xã Bỉm Sơn', 36, 'DISTRICT'), ('Thị xã Nghi Sơn', 36, 'DISTRICT');
-- 30. Nghệ An (ID: 37)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Vinh', 37, 'DISTRICT'), ('Thị xã Cửa Lò', 37, 'DISTRICT'), ('Thị xã Thái Hòa', 37, 'DISTRICT'), ('Huyện Quỳnh Lưu', 37, 'DISTRICT');
-- 31. Hà Tĩnh (ID: 38)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Hà Tĩnh', 38, 'DISTRICT'), ('Thị xã Hồng Lĩnh', 38, 'DISTRICT'), ('Thị xã Kỳ Anh', 38, 'DISTRICT');
-- 32. Quảng Bình (ID: 73)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Đồng Hới', 73, 'DISTRICT'), ('Thị xã Ba Đồn', 73, 'DISTRICT'), ('Huyện Lệ Thủy', 73, 'DISTRICT');
-- 33. Quảng Trị (ID: 74)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Đông Hà', 74, 'DISTRICT'), ('Thị xã Quảng Trị', 74, 'DISTRICT'), ('Huyện Vĩnh Linh', 74, 'DISTRICT');
-- 34. Thừa Thiên Huế (ID: 75)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Huế', 75, 'DISTRICT'), ('Thị xã Hương Thủy', 75, 'DISTRICT'), ('Thị xã Hương Trà', 75, 'DISTRICT'), ('Huyện Phú Lộc', 75, 'DISTRICT');
-- 35. Quảng Nam (ID: 92)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Tam Kỳ', 92, 'DISTRICT'), ('Thành phố Hội An', 92, 'DISTRICT'), ('Thị xã Điện Bàn', 92, 'DISTRICT');
-- 36. Quảng Ngãi (ID: 76)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Quảng Ngãi', 76, 'DISTRICT'), ('Thị xã Đức Phổ', 76, 'DISTRICT'), ('Huyện Lý Sơn', 76, 'DISTRICT');
-- 37. Bình Định (ID: 77)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Quy Nhơn', 77, 'DISTRICT'), ('Thị xã An Nhơn', 77, 'DISTRICT'), ('Thị xã Hoài Nhơn', 77, 'DISTRICT');
-- 38. Phú Yên (ID: 78)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Tuy Hòa', 78, 'DISTRICT'), ('Thị xã Sông Cầu', 78, 'DISTRICT'), ('Thị xã Đông Hòa', 78, 'DISTRICT');
-- 39. Khánh Hòa (ID: 79)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Nha Trang', 79, 'DISTRICT'), ('Thành phố Cam Ranh', 79, 'DISTRICT'), ('Thị xã Ninh Hòa', 79, 'DISTRICT');
-- 40. Ninh Thuận (ID: 85)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Phan Rang - Tháp Chàm', 85, 'DISTRICT'), ('Huyện Ninh Hải', 85, 'DISTRICT'), ('Huyện Ninh Phước', 85, 'DISTRICT');
-- 41. Bình Thuận (ID: 86)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Phan Thiết', 86, 'DISTRICT'), ('Thị xã La Gi', 86, 'DISTRICT'), ('Huyện Phú Quý', 86, 'DISTRICT');
-- 42. Kon Tum (ID: 82)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Kon Tum', 82, 'DISTRICT'), ('Huyện Đắk Glei', 82, 'DISTRICT'), ('Huyện Ngọc Hồi', 82, 'DISTRICT');
-- 43. Gia Lai (ID: 81)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Pleiku', 81, 'DISTRICT'), ('Thị xã An Khê', 81, 'DISTRICT'), ('Thị xã Ayun Pa', 81, 'DISTRICT');
-- 44. Đắk Lắk (ID: 47)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Buôn Ma Thuột', 47, 'DISTRICT'), ('Thị xã Buôn Hồ', 47, 'DISTRICT'), ('Huyện Krông Pắc', 47, 'DISTRICT');
-- 45. Đắk Nông (ID: 48)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Gia Nghĩa', 48, 'DISTRICT'), ('Huyện Đắk Mil', 48, 'DISTRICT'), ('Huyện Cư Jút', 48, 'DISTRICT');
-- 46. Lâm Đồng (ID: 49)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Đà Lạt', 49, 'DISTRICT'), ('Thành phố Bảo Lộc', 49, 'DISTRICT'), ('Huyện Đức Trọng', 49, 'DISTRICT');
-- 47. Bình Phước (ID: 93)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Đồng Xoài', 93, 'DISTRICT'), ('Thị xã Bình Long', 93, 'DISTRICT'), ('Thị xã Phước Long', 93, 'DISTRICT'), ('Thị xã Chơn Thành', 93, 'DISTRICT');
-- 48. Tây Ninh (ID: 70)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Tây Ninh', 70, 'DISTRICT'), ('Thị xã Hòa Thành', 70, 'DISTRICT'), ('Thị xã Trảng Bàng', 70, 'DISTRICT');
-- 49. Bình Dương (ID: 61)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Thủ Dầu Một', 61, 'DISTRICT'), ('Thành phố Thuận An', 61, 'DISTRICT'), ('Thành phố Dĩ An', 61, 'DISTRICT'), ('Thành phố Tân Uyên', 61, 'DISTRICT'), ('Thị xã Bến Cát', 61, 'DISTRICT');
-- 50. Đồng Nai (ID: 39)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Biên Hòa', 39, 'DISTRICT'), ('Thành phố Long Khánh', 39, 'DISTRICT'), ('Huyện Long Thành', 39, 'DISTRICT'), ('Huyện Nhơn Trạch', 39, 'DISTRICT');
-- 51. Bà Rịa - Vũng Tàu (ID: 72)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Vũng Tàu', 72, 'DISTRICT'), ('Thành phố Bà Rịa', 72, 'DISTRICT'), ('Thị xã Phú Mỹ', 72, 'DISTRICT'), ('Huyện Côn Đảo', 72, 'DISTRICT');
-- 52. Long An (ID: 62)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Tân An', 62, 'DISTRICT'), ('Thị xã Kiến Tường', 62, 'DISTRICT'), ('Huyện Đức Hòa', 62, 'DISTRICT'), ('Huyện Bến Lức', 62, 'DISTRICT');
-- 53. Tiền Giang (ID: 63)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Mỹ Tho', 63, 'DISTRICT'), ('Thị xã Gò Công', 63, 'DISTRICT'), ('Thị xã Cai Lậy', 63, 'DISTRICT');
-- 54. Bến Tre (ID: 71)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Bến Tre', 71, 'DISTRICT'), ('Huyện Châu Thành', 71, 'DISTRICT'), ('Huyện Chợ Lách', 71, 'DISTRICT');
-- 55. Trà Vinh (ID: 84)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Trà Vinh', 84, 'DISTRICT'), ('Thị xã Duyên Hải', 84, 'DISTRICT'), ('Huyện Càng Long', 84, 'DISTRICT');
-- 56. Vĩnh Long (ID: 64)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Vĩnh Long', 64, 'DISTRICT'), ('Thị xã Bình Minh', 64, 'DISTRICT'), ('Huyện Long Hồ', 64, 'DISTRICT');
-- 57. Đồng Tháp (ID: 66)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Cao Lãnh', 66, 'DISTRICT'), ('Thành phố Sa Đéc', 66, 'DISTRICT'), ('Thành phố Hồng Ngự', 66, 'DISTRICT');
-- 58. An Giang (ID: 67)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Long Xuyên', 67, 'DISTRICT'), ('Thành phố Châu Đốc', 67, 'DISTRICT'), ('Thị xã Tân Châu', 67, 'DISTRICT'), ('Thị xã Tịnh Biên', 67, 'DISTRICT');
-- 59. Kiên Giang (ID: 68)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Rạch Giá', 68, 'DISTRICT'), ('Thành phố Hà Tiên', 68, 'DISTRICT'), ('Thành phố Phú Quốc', 68, 'DISTRICT');
-- 60. Hậu Giang (ID: 95)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Vị Thanh', 95, 'DISTRICT'), ('Thành phố Ngã Bảy', 95, 'DISTRICT'), ('Thị xã Long Mỹ', 95, 'DISTRICT');
-- 61. Sóc Trăng (ID: 83)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Sóc Trăng', 83, 'DISTRICT'), ('Thị xã Vĩnh Châu', 83, 'DISTRICT'), ('Thị xã Ngã Năm', 83, 'DISTRICT');
-- 62. Bạc Liêu (ID: 94)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Bạc Liêu', 94, 'DISTRICT'), ('Thị xã Giá Rai', 94, 'DISTRICT'), ('Huyện Hòa Bình', 94, 'DISTRICT');
-- 63. Cà Mau (ID: 69)
INSERT INTO locations (name, parent_id, type) VALUES ('Thành phố Cà Mau', 69, 'DISTRICT'), ('Huyện Cái Nước', 69, 'DISTRICT'), ('Huyện Đầm Dơi', 69, 'DISTRICT');
