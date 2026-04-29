-- ==========================================
-- V57__add_dispute_helper_response_fields.sql
-- Description: Bo sung thong tin giai trinh cua helper va ty le hoan tien khi tranh chap
-- ==========================================

ALTER TABLE bookings
    ADD COLUMN helper_dispute_message TEXT NULL,
    ADD COLUMN helper_dispute_evidence_url VARCHAR(1000) NULL,
    ADD COLUMN helper_dispute_at TIMESTAMP NULL,
    ADD COLUMN dispute_refund_ratio DECIMAL(5,2) NULL,
    ADD COLUMN dispute_refund_amount DECIMAL(12,2) NULL;

CREATE INDEX idx_bookings_helper_dispute_at ON bookings (helper_dispute_at);
