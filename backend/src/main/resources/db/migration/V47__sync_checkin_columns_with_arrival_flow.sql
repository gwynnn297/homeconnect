-- ==========================================
-- V47__sync_checkin_columns_with_arrival_flow.sql
-- Description: Đồng bộ dữ liệu check-in giữa cặp cột legacy (arrived_at/arrival_proof_image)
--              và cặp cột execution flow (checked_in_at/checkin_photo_url)
-- ==========================================

-- Legacy -> New execution columns
UPDATE bookings
SET checked_in_at = COALESCE(checked_in_at, arrived_at),
    checkin_photo_url = COALESCE(checkin_photo_url, arrival_proof_image)
WHERE (checked_in_at IS NULL AND arrived_at IS NOT NULL)
   OR (checkin_photo_url IS NULL AND arrival_proof_image IS NOT NULL);

-- New execution columns -> Legacy (đảm bảo tương thích ngược)
UPDATE bookings
SET arrived_at = COALESCE(arrived_at, checked_in_at),
    arrival_proof_image = COALESCE(arrival_proof_image, checkin_photo_url)
WHERE (arrived_at IS NULL AND checked_in_at IS NOT NULL)
   OR (arrival_proof_image IS NULL AND checkin_photo_url IS NOT NULL);
