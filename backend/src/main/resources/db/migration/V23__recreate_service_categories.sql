-- V23: Re-create Service Categories and link to Services with Hierarchy support

-- 1. Create service_categories table
CREATE TABLE service_categories (
    category_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Add category_id to services table
ALTER TABLE services ADD COLUMN category_id INT;

-- 3. Add foreign key constraint
ALTER TABLE services ADD CONSTRAINT fk_service_category 
    FOREIGN KEY (category_id) REFERENCES service_categories(category_id);

-- 4. Seed initial categories
INSERT INTO service_categories (name, description) VALUES 
('Dịch vụ Gia đình', 'Các dịch vụ chăm sóc gia đình');
