-- V29: Chuyển cột service_id trong job_posts sang VARCHAR để hỗ trợ nhiều ID (ví dụ: "6,7")
-- Dùng SQL động để xóa khóa ngoại an toàn bất kể tên tự động đặt

SET @constraint_name := (
    SELECT CONSTRAINT_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_NAME = 'job_posts'
      AND COLUMN_NAME = 'service_id'
      AND TABLE_SCHEMA = DATABASE()
    LIMIT 1
);

SET @sql := IF(@constraint_name IS NOT NULL,
               CONCAT('ALTER TABLE job_posts DROP FOREIGN KEY ', @constraint_name),
               'SELECT "Không tìm thấy ràng buộc FK, bỏ qua bước xóa"');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Chuyển cột sang VARCHAR(255) để lưu được nhiều ID dạng chuỗi "6,7"
ALTER TABLE job_posts MODIFY COLUMN service_id VARCHAR(255);

-- 3. Cập nhật comment của bảng cho rõ ràng
ALTER TABLE job_posts COMMENT = 'Job Posts with multi-service support (service_id stores comma-separated strings)';
