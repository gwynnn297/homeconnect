-- ==========================================
-- V58__add_dispute_admin_note.sql
-- Description: Luu ly do xu ly tranh chap cua admin
-- ==========================================

ALTER TABLE bookings
    ADD COLUMN dispute_admin_note TEXT NULL;
