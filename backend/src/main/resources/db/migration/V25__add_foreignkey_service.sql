-- 1.5. Tighten Foreign Key constraints (ON DELETE CASCADE)
ALTER TABLE services DROP FOREIGN KEY fk_service_category;
ALTER TABLE services ADD CONSTRAINT fk_service_category 
    FOREIGN KEY (category_id) REFERENCES service_categories(category_id) ON DELETE CASCADE;