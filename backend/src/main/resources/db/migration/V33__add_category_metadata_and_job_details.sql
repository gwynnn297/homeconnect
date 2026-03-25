-- ==========================================
-- V33__add_category_metadata_and_job_details.sql
-- Description: Thêm cấu hình UI động cho danh mục và các trường mô tả công việc
-- ==========================================

ALTER TABLE service_categories 
    ADD COLUMN ui_config TEXT; -- JSON string lưu cấu hình giao diện

ALTER TABLE job_posts 
    ADD COLUMN work_size DOUBLE,
    ADD COLUMN is_premium BOOLEAN DEFAULT FALSE,
    ADD COLUMN has_pets BOOLEAN DEFAULT FALSE,
    ADD COLUMN bring_tools BOOLEAN DEFAULT FALSE;
