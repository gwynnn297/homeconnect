-- ==========================================
-- V7__sprint2_schema_expansion.sql
-- Description: Bổ sung các bảng và cấu trúc cho Sprint 2 (Đã tinh chỉnh theo feedback)
-- ==========================================

-- 1. Bảng Roles & Phân quyền
CREATE TABLE roles (
    role_id INT AUTO_INCREMENT PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL UNIQUE COMMENT 'admin, customer, helper',
    description TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO roles (role_name, description) VALUES 
('ADMIN', 'Quản trị viên hệ thống'),
('CUSTOMER', 'Khách hàng sử dụng dịch vụ'),
('HELPER', 'Người giúp việc');

-- 2. Cấu trúc bảng Users
ALTER TABLE users 
ADD COLUMN role_id INT AFTER password_hash,
ADD COLUMN gender VARCHAR(10) COMMENT 'male, female, other' AFTER avatar_url,
ADD COLUMN is_verified BOOLEAN DEFAULT FALSE AFTER status;

-- Cập nhật dữ liệu cũ cho role_id dựa trên cột role cũ (Nếu đã có dữ liệu)
UPDATE users SET role_id = 1 WHERE role = 'ADMIN';
UPDATE users SET role_id = 2 WHERE role = 'CUSTOMER';
UPDATE users SET role_id = 3 WHERE role = 'HELPER';

ALTER TABLE users ADD CONSTRAINT fk_user_role FOREIGN KEY (role_id) REFERENCES roles(role_id);

-- 3. Bảng Tài khoản ngân hàng (PB-15)
CREATE TABLE user_bank_accounts (
    bank_account_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    bank_name VARCHAR(100) NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    account_holder_name VARCHAR(100) NOT NULL COMMENT 'Phải trùng tên thật trong KYC',
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Bảng Địa chỉ chi tiết (PB-20)
CREATE TABLE addresses (
    address_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    contact_name VARCHAR(100),
    contact_phone VARCHAR(15),
    address_detail TEXT,
    ward_id INT,
    district_id INT,
    province_id INT,
    latitude DECIMAL(10,8) COMMENT 'Tọa độ Vĩ độ',
    longitude DECIMAL(11,8) COMMENT 'Tọa độ Kinh độ',
    is_default BOOLEAN DEFAULT FALSE,
    type VARCHAR(20) DEFAULT 'HOME' COMMENT 'HOME, OFFICE, OTHER',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (ward_id) REFERENCES locations(location_id),
    FOREIGN KEY (district_id) REFERENCES locations(location_id),
    FOREIGN KEY (province_id) REFERENCES locations(location_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Cập nhật Helper Profiles (PB-09, PB-07)
ALTER TABLE helper_profiles 
ADD COLUMN rating_average DECIMAL(3,2) DEFAULT 0.00 AFTER selfie_url,
ADD COLUMN total_reviews INT DEFAULT 0 AFTER rating_average,
ADD COLUMN is_online BOOLEAN DEFAULT FALSE COMMENT 'Công tắc Master nhận việc' AFTER kyc_status;

-- 6. Lịch rảnh Helper (PB-08) - Lưu theo ngày cụ thể (Flexible Batch)
CREATE TABLE helper_schedules (
    schedule_id INT AUTO_INCREMENT PRIMARY KEY,
    helper_id INT NOT NULL,
    work_date DATE NOT NULL COMMENT 'Ngày rảnh cụ thể: 2026-03-01',
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (helper_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Danh mục & Dịch vụ nâng cấp (PB-29)
CREATE TABLE service_categories (
    category_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    icon_url TEXT,
    is_active BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE services 
ADD COLUMN category_id INT AFTER service_id,
ADD COLUMN description TEXT AFTER name,
ADD CONSTRAINT fk_service_category FOREIGN KEY (category_id) REFERENCES service_categories(category_id);

-- 8. Chợ việc làm (PB-20, PB-21)
CREATE TABLE job_posts (
    post_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    service_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    address_detail TEXT,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    work_date DATE NOT NULL,
    start_time TIME NOT NULL,
    duration_hours INT NOT NULL,
    offer_price DECIMAL(12,2) NOT NULL COMMENT 'Giá do hệ thống tính',
    status VARCHAR(20) DEFAULT 'OPEN' COMMENT 'OPEN, CLOSED, EXPIRED, CANCELLED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES users(id),
    FOREIGN KEY (service_id) REFERENCES services(service_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE job_applications (
    application_id INT AUTO_INCREMENT PRIMARY KEY,
    post_id INT NOT NULL,
    helper_id INT NOT NULL,
    type VARCHAR(20) DEFAULT 'APPLIED' COMMENT 'APPLIED (Tự xin), INVITED (Hệ thống match)',
    status VARCHAR(20) DEFAULT 'PENDING' COMMENT 'PENDING, ACCEPTED, REJECTED, EXPIRED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES job_posts(post_id) ON DELETE CASCADE,
    FOREIGN KEY (helper_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Bookings & Đơn hàng (Core)
CREATE TABLE bookings (
    booking_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    helper_id INT NOT NULL,
    service_id INT NOT NULL,
    post_id INT DEFAULT NULL,
    scheduled_start_time TIMESTAMP NOT NULL,
    scheduled_end_time TIMESTAMP NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    status VARCHAR(30) DEFAULT 'CONFIRMED' COMMENT 'CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED',
    payment_status VARCHAR(20) DEFAULT 'HOLDING' COMMENT 'HOLDING, RELEASED, REFUNDED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES users(id),
    FOREIGN KEY (helper_id) REFERENCES users(id),
    FOREIGN KEY (service_id) REFERENCES services(service_id),
    FOREIGN KEY (post_id) REFERENCES job_posts(post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Giao dịch & Thông báo
CREATE TABLE wallet_transactions (
    transaction_id INT AUTO_INCREMENT PRIMARY KEY,
    wallet_id INT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    type VARCHAR(20) NOT NULL COMMENT 'DEPOSIT, WITHDRAW, PAYMENT, REFUND, HOLD, RELEASE',
    reference_type VARCHAR(50) NOT NULL COMMENT 'JOB_POST, BOOKING, DEPOSIT',
    reference_id INT NOT NULL COMMENT 'ID của thực thể tương ứng',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (wallet_id) REFERENCES wallets(wallet_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(20) DEFAULT 'SYSTEM' COMMENT 'BOOKING, SYSTEM, MATCHING',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Cấu hình hệ thống
CREATE TABLE system_settings (
    setting_key VARCHAR(50) PRIMARY KEY,
    setting_value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
