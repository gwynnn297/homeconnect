-- Add day_of_week column to helper_schedules
ALTER TABLE helper_schedules ADD COLUMN day_of_week INT;

-- Populate day_of_week from work_date
-- Monday = 1, Sunday = 7 (ISO-8601 standard used by Java's LocalDate)
-- MySQL DAYOFWEEK returns 1=Sunday, 2=Monday... 7=Saturday
-- We want to map it to 1=Monday, ..., 7=Sunday
-- Formula: (DAYOFWEEK(work_date) + 5) % 7 + 1
UPDATE helper_schedules SET day_of_week = (DAYOFWEEK(work_date) + 5) % 7 + 1;

-- If H2 database is used for tests, the syntax might differ, but for MySQL/standard SQL:
-- MySQL: UPDATE helper_schedules SET day_of_week = (DAYOFWEEK(work_date) + 5) % 7 + 1;
-- PostgreSQL: UPDATE helper_schedules SET day_of_week = extract(isodow from work_date);
