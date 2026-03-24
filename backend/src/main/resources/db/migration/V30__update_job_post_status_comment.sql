-- V30: Cập nhật comment cho cột status trong bảng job_posts để liệt kê các giá trị hợp lệ
ALTER TABLE job_posts MODIFY COLUMN status VARCHAR(20) DEFAULT 'PUBLISHED' COMMENT 'Trạng thái: PUBLISHED, ASSIGNED, COMPLETED, CANCELLED, EXPIRED';
