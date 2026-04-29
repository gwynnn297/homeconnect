-- ==========================================
-- V59__add_loyalty_fields_for_users_and_bookings.sql
-- Description: Them snapshot tai chinh loyalty cho bookings (idempotent)
-- ==========================================

-- 1) Add columns (idempotent cho MySQL cu)
SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'bookings'
        AND COLUMN_NAME = 'original_price'
    ),
    'SELECT ''original_price exists''',
    'ALTER TABLE bookings ADD COLUMN original_price DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT ''Gia goc truoc khi ap dung loyalty'''
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'bookings'
        AND COLUMN_NAME = 'discount_rate'
    ),
    'SELECT ''discount_rate exists''',
    'ALTER TABLE bookings ADD COLUMN discount_rate DECIMAL(5,4) NOT NULL DEFAULT 0.0000 COMMENT ''Ty le giam loyalty: 0.0000/0.0500/0.1000'''
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'bookings'
        AND COLUMN_NAME = 'discount_amount'
    ),
    'SELECT ''discount_amount exists''',
    'ALTER TABLE bookings ADD COLUMN discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT ''So tien giam loyalty'''
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'bookings'
        AND COLUMN_NAME = 'final_price'
    ),
    'SELECT ''final_price exists''',
    'ALTER TABLE bookings ADD COLUMN final_price DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT ''Gia cuoi cung customer thuc tra'''
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'bookings'
        AND COLUMN_NAME = 'tier_at_booking'
    ),
    'SELECT ''tier_at_booking exists''',
    'ALTER TABLE bookings ADD COLUMN tier_at_booking VARCHAR(20) NOT NULL DEFAULT ''BRONZE'' COMMENT ''Hang loyalty tai thoi diem tao booking'''
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'bookings'
        AND COLUMN_NAME = 'loyalty_processed'
    ),
    'SELECT ''loyalty_processed exists''',
    'ALTER TABLE bookings ADD COLUMN loyalty_processed BOOLEAN NOT NULL DEFAULT FALSE COMMENT ''Da cong loyalty count cho booking COMPLETED hay chua'''
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) Create indexes (idempotent cho MySQL cu)
SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'bookings'
        AND INDEX_NAME = 'idx_bookings_loyalty_processed'
    ),
    'SELECT ''idx_bookings_loyalty_processed exists''',
    'CREATE INDEX idx_bookings_loyalty_processed ON bookings (loyalty_processed)'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'bookings'
        AND INDEX_NAME = 'idx_bookings_customer_status'
    ),
    'SELECT ''idx_bookings_customer_status exists''',
    'CREATE INDEX idx_bookings_customer_status ON bookings (customer_id, status)'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3) Backfill idempotent
UPDATE bookings
SET original_price   = COALESCE(NULLIF(original_price, 0.00), total_price),
    final_price      = COALESCE(NULLIF(final_price, 0.00), total_price),
    discount_rate    = COALESCE(discount_rate, 0.0000),
    discount_amount  = COALESCE(discount_amount, 0.00),
    tier_at_booking  = COALESCE(NULLIF(tier_at_booking, ''), 'BRONZE'),
    loyalty_processed = COALESCE(loyalty_processed, FALSE)
WHERE original_price IS NULL OR original_price = 0.00
   OR final_price IS NULL OR final_price = 0.00
   OR discount_rate IS NULL
   OR discount_amount IS NULL
   OR tier_at_booking IS NULL OR tier_at_booking = ''
   OR loyalty_processed IS NULL;