-- ==========================================
-- V49__add_cccd_number_to_helper_profiles.sql
-- Description: Them cot cccd_number + unique constraint de chan trung lap CCCD
-- ==========================================

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'helper_profiles'
       AND COLUMN_NAME = 'cccd_number') = 0,
    'ALTER TABLE helper_profiles ADD COLUMN cccd_number VARCHAR(12) NULL AFTER identity_number',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Backfill tu identity_number cho du lieu cu neu hop le 12 chu so
UPDATE helper_profiles
SET cccd_number = identity_number
WHERE cccd_number IS NULL
  AND identity_number REGEXP '^[0-9]{12}$';

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'helper_profiles'
       AND INDEX_NAME = 'uq_helper_profiles_cccd_number') = 0,
    'ALTER TABLE helper_profiles ADD CONSTRAINT uq_helper_profiles_cccd_number UNIQUE (cccd_number)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
