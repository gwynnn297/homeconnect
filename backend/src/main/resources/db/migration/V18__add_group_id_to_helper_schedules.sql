-- V18__add_group_id_to_helper_schedules.sql
-- Thêm cột group_id để quản lý lịch đăng ký theo lô (Committed Schedules)

ALTER TABLE helper_schedules
    ADD COLUMN group_id VARCHAR(50) DEFAULT NULL COMMENT 'ID định danh đợt đăng ký hàng loạt' AFTER schedule_id;

-- Index để tìm kiếm nhanh theo nhóm
CREATE INDEX idx_schedule_group ON helper_schedules(group_id);
