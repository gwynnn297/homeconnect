-- V26: Thêm các khung ảnh khuôn mặt (Phải, Trái) vào hồ sơ Helper để tăng tính bảo mật xác thực
ALTER TABLE helper_profiles 
ADD COLUMN face_right_url TEXT COMMENT 'Ảnh mặt bên phải' AFTER selfie_url,
ADD COLUMN face_left_url TEXT COMMENT 'Ảnh mặt bên trái' AFTER face_right_url;
