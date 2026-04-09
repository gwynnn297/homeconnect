-- ==========================================
-- V47__sync_checkin_columns_with_arrival_flow.sql
-- Description: Đồng bộ dữ liệu check-in giữa cặp cột legacy (arrived_at/arrival_proof_image)
--              và cặp cột execution flow (checked_in_at/checkin_photo_url)
-- Note: Có guard kiểm tra cột tồn tại để tránh fail khi chạy trên DB mới.
-- ==========================================

-- Legacy -> New execution columns (chỉ chạy khi đủ cột)
SET @sql = IF(
   (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'bookings'
      AND COLUMN_NAME IN ('checked_in_at', 'arrived_at', 'checkin_photo_url', 'arrival_proof_image')) = 4,
   'UPDATE bookings
    SET checked_in_at = COALESCE(checked_in_at, arrived_at),
       checkin_photo_url = COALESCE(checkin_photo_url, arrival_proof_image)
    WHERE (checked_in_at IS NULL AND arrived_at IS NOT NULL)
      OR (checkin_photo_url IS NULL AND arrival_proof_image IS NOT NULL)',
   'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- New execution columns -> Legacy (chỉ chạy khi đủ cột)
SET @sql = IF(
   (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'bookings'
      AND COLUMN_NAME IN ('arrived_at', 'checked_in_at', 'arrival_proof_image', 'checkin_photo_url')) = 4,
   'UPDATE bookings
    SET arrived_at = COALESCE(arrived_at, checked_in_at),
       arrival_proof_image = COALESCE(arrival_proof_image, checkin_photo_url)
    WHERE (arrived_at IS NULL AND checked_in_at IS NOT NULL)
      OR (arrival_proof_image IS NULL AND checkin_photo_url IS NOT NULL)',
   'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
