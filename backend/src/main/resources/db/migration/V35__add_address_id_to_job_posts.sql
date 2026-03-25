-- ==========================================
-- V38__add_address_id_to_job_posts.sql
-- Description: Thêm cột address_id vào bảng job_posts để tham chiếu địa chỉ đã lưu
-- ==========================================

ALTER TABLE job_posts 
ADD COLUMN address_id INT NULL;

-- Xóa các cột địa chỉ cũ vì đã dùng address_id
ALTER TABLE job_posts
DROP COLUMN address_detail,
DROP COLUMN latitude,
DROP COLUMN longitude;
