-- V48: Thêm trường dữ liệu bổ sung (JSON) cho các loại dịch vụ đặc thù
-- Lưu trữ thông tin Trông trẻ (số bé, tuổi), Đi chợ (tổng tiền, danh sách), v.v.

ALTER TABLE job_posts
ADD COLUMN additional_data TEXT DEFAULT NULL COMMENT 'Dữ liệu chuyên biệt (JSON) cho từng loại dịch vụ';
