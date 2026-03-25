-- ==========================================
-- V34__init_category_ui_configs.sql
-- Description: Khởi tạo dữ liệu cấu hình UI cho các danh mục hiện tại
-- ==========================================

-- 1. Dọn dẹp nhà cửa (Id=1)
UPDATE service_categories 
SET ui_config = '{"show_work_size": true, "work_size_label": "Diện tích (m2)", "work_size_unit": "m2", "show_pets": true, "show_tools": true, "show_premium": true}'
WHERE category_id = 1;

-- 2. Ăn uống & Đi chợ (Id=2)
UPDATE service_categories 
SET ui_config = '{"show_work_size": true, "work_size_label": "Số lượng người ăn", "work_size_unit": "người", "show_pets": true, "show_tools": false, "show_premium": false}'
WHERE category_id = 2;

-- 3. Vệ sinh chuyên dụng (Id=3)
UPDATE service_categories 
SET ui_config = '{"show_work_size": true, "work_size_label": "Số lượng (m2/cái)", "work_size_unit": "đơn vị", "show_pets": false, "show_tools": true, "show_premium": true}'
WHERE category_id = 3;

-- 4. Trông trẻ & Chăm sóc (Id=4)
UPDATE service_categories 
SET ui_config = '{"show_work_size": true, "work_size_label": "Số lượng bé", "work_size_unit": "bé", "show_pets": true, "show_tools": false, "show_premium": true}'
WHERE category_id = 4;

-- 5. Công việc ngoài (Id=5)
UPDATE service_categories 
SET ui_config = '{"show_work_size": true, "work_size_label": "Khối lượng công việc", "work_size_unit": "m2/công", "show_pets": false, "show_tools": true, "show_premium": false}'
WHERE category_id = 5;
