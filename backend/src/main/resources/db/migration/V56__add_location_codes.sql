-- V54: Add location codes for strict regional gating
ALTER TABLE addresses 
ADD COLUMN province_code VARCHAR(10),
ADD COLUMN district_code VARCHAR(10),
ADD COLUMN ward_code VARCHAR(10);

ALTER TABLE helper_working_districts
ADD COLUMN province_code VARCHAR(10);

-- Add indices to speed up regional lookups
CREATE INDEX idx_address_province_code ON addresses(province_code);
CREATE INDEX idx_working_district_province_code ON helper_working_districts(province_code);
