-- ==========================================
-- V55__add_booking_dispute_fields.sql
-- Description: Thêm trường phục vụ luồng khiếu nại booking (PB-30)
-- ==========================================

ALTER TABLE bookings
    ADD COLUMN dispute_reason TEXT NULL,
    ADD COLUMN evidence_url VARCHAR(1000) NULL,
    ADD COLUMN disputed_at TIMESTAMP NULL,
    ADD COLUMN dispute_resolved_at TIMESTAMP NULL,
    ADD COLUMN dispute_resolution_action VARCHAR(30) NULL,
    ADD COLUMN dispute_resolved_by_admin_id BIGINT NULL;

CREATE INDEX idx_bookings_disputed_at ON bookings (disputed_at);
CREATE INDEX idx_bookings_dispute_resolved_at ON bookings (dispute_resolved_at);
CREATE INDEX idx_bookings_dispute_resolved_by_admin_id ON bookings (dispute_resolved_by_admin_id);
