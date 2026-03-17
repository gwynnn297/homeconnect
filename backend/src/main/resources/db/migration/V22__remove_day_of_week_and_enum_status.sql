-- V22: Remove redundant day_of_week column and change status to MySQL ENUM

-- 1. Drop redundant day_of_week column (can be derived from work_date via DAYOFWEEK / ISO-8601)
ALTER TABLE helper_schedules DROP COLUMN day_of_week;

-- 2. Change status from VARCHAR(20) to ENUM for DB-level type safety
--    Values must match ScheduleStatus enum: AVAILABLE, BUSY, CANCELLED
ALTER TABLE helper_schedules
    MODIFY COLUMN status ENUM('AVAILABLE', 'BUSY', 'CANCELLED') NOT NULL DEFAULT 'AVAILABLE';
