-- beforeMigrate__ensure_arrival_columns.sql
-- Ensure arrival/customer confirmation columns exist before versioned migrations run.
-- This protects fresh databases where legacy columns may be missing before V47 executes.

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'bookings'
       AND COLUMN_NAME = 'arrived_at') = 0,
    'ALTER TABLE bookings ADD COLUMN arrived_at TIMESTAMP NULL DEFAULT NULL AFTER scheduled_end_time',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'bookings'
       AND COLUMN_NAME = 'arrival_proof_image') = 0,
    'ALTER TABLE bookings ADD COLUMN arrival_proof_image LONGTEXT NULL AFTER arrived_at',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'bookings'
       AND COLUMN_NAME = 'customer_arrival_confirmed') = 0,
    'ALTER TABLE bookings ADD COLUMN customer_arrival_confirmed TINYINT(1) NOT NULL DEFAULT 0 AFTER arrival_proof_image',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'bookings'
       AND COLUMN_NAME = 'customer_arrival_confirmed_at') = 0,
    'ALTER TABLE bookings ADD COLUMN customer_arrival_confirmed_at TIMESTAMP NULL DEFAULT NULL AFTER customer_arrival_confirmed',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
