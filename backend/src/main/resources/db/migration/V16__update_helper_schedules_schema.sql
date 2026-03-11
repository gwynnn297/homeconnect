-- 1. Cập nhật cấu trúc bảng helper_schedules
ALTER TABLE helper_schedules
    ADD COLUMN status VARCHAR(20) DEFAULT 'AVAILABLE' COMMENT 'AVAILABLE, BUSY, CANCELLED',
    ADD COLUMN booking_id INT NULL COMMENT 'Link tới đơn hàng nếu status=BUSY',
    ADD COLUMN cancel_reason TEXT NULL COMMENT 'Lý do nghỉ',
    ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    DROP COLUMN is_active; -- Thay thế bằng status

-- 2. Thêm khóa ngoại cho booking_id
ALTER TABLE helper_schedules 
    ADD CONSTRAINT fk_schedule_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id);

-- 3. Các Index tối ưu truy vấn
CREATE INDEX idx_helper_date ON helper_schedules(helper_id, work_date);
CREATE INDEX idx_schedule_status ON helper_schedules(status);
CREATE INDEX idx_schedule_search ON helper_schedules(work_date, start_time, end_time);

-- 4. Ràng buộc duy nhất tránh trùng lặp lịch cho cùng 1 Helper
ALTER TABLE helper_schedules 
    ADD CONSTRAINT unique_helper_slot UNIQUE (helper_id, work_date, start_time, end_time);
