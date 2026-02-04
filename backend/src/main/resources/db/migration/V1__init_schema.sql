

-- 1. Bảng Users (Người dùng - Core)
-- Chứa thông tin cơ bản của Customer, Helper, Admin
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL COMMENT 'Họ và tên đầy đủ',
    phone VARCHAR(15) NOT NULL UNIQUE COMMENT 'Số điện thoại (duy nhất)',
    email VARCHAR(100) NOT NULL UNIQUE COMMENT 'Email đăng ký',
    password_hash VARCHAR(255) NOT NULL COMMENT 'Mật khẩu đã mã hóa',
    role VARCHAR(20) NOT NULL COMMENT 'Vai trò: CUSTOMER, HELPER, ADMIN',
    status VARCHAR(20) DEFAULT 'PENDING_OTP' COMMENT 'Trạng thái: PENDING_OTP, ACTIVE, BLOCKED',
    avatar_url TEXT COMMENT 'Đường dẫn ảnh đại diện',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời gian tạo tài khoản',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Thời gian cập nhật cuối',
    INDEX idx_phone (phone),
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng người dùng cơ sở';

-- 2. Bảng Wallets (Ví tiền - Tạo tự động khi User Active)
-- Quản lý số dư tiền của mỗi User
CREATE TABLE wallets (
    wallet_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE COMMENT 'ID người dùng (duy nhất)',
    available_balance DECIMAL(15,2) DEFAULT 0.00 COMMENT 'Số dư khả dụng (VNĐ)',
    hold_balance DECIMAL(15,2) DEFAULT 0.00 COMMENT 'Số tiền đang bị giữ (chưa thanh toán xong)',
    debt_balance DECIMAL(15,2) DEFAULT 0.00 COMMENT 'Số tiền nợ sàn',
    is_frozen BOOLEAN DEFAULT FALSE COMMENT 'Ví bị đóng băng hay không',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Thời gian cập nhật cuối',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng ví tiền người dùng';

-- 3. Bảng Locations (Master Data - Địa điểm: Tỉnh/Quận/Huyện)
-- Dữ liệu tham chiếu về địa chỉ Việt Nam
CREATE TABLE locations (
    location_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL COMMENT 'Tên địa điểm (VD: Hà Nội, Quận 1)',
    parent_id INT DEFAULT NULL COMMENT 'ID của địa điểm cha (NULL nếu là Tỉnh)',
    type VARCHAR(20) NOT NULL COMMENT 'Loại: PROVINCE (Tỉnh), DISTRICT (Quận/Huyện)',
    FOREIGN KEY (parent_id) REFERENCES locations(location_id) ON DELETE SET NULL,
    INDEX idx_parent_id (parent_id),
    INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng địa điểm (Tỉnh/Quận)';

-- 4. Bảng Services (Master Data - Dịch vụ)
-- Danh mục các dịch vụ hệ thống cung cấp
CREATE TABLE services (
    service_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL COMMENT 'Tên dịch vụ (VD: Dọn dẹp nhà, Chăm sóc trẻ em)',
    icon_url TEXT COMMENT 'Đường dẫn icon dịch vụ',
    base_price DECIMAL(15,2) DEFAULT 0.00 COMMENT 'Giá cơ bản (VNĐ)',
    is_active BOOLEAN DEFAULT TRUE COMMENT 'Dịch vụ còn hoạt động không',
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng danh mục dịch vụ';

-- 5. Bảng Helper Profiles (Hồ sơ Helper)
-- Thông tin bổ sung cho User có role = HELPER
CREATE TABLE helper_profiles (
    profile_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE COMMENT 'ID người dùng (1-1 với User)',
    bio TEXT COMMENT 'Giới thiệu bản thân',
    experience_years INT DEFAULT 0 COMMENT 'Số năm kinh nghiệm',
    hometown_id INT COMMENT 'ID quê quán (trong bảng locations)',
    current_city_id INT COMMENT 'ID nơi ở hiện tại (trong bảng locations)',
    
    -- Thông tin KYC (Xác thực danh tính)
    identity_number VARCHAR(20) UNIQUE COMMENT 'Số CMND/CCCD',
    identity_front_url TEXT COMMENT 'Đường dẫn ảnh mặt trước CMND',
    identity_back_url TEXT COMMENT 'Đường dẫn ảnh mặt sau CMND',
    selfie_url TEXT COMMENT 'Đường dẫn ảnh selfie',
    kyc_status VARCHAR(20) DEFAULT 'PENDING' COMMENT 'Trạng thái KYC: PENDING, WAITING_APPROVAL, VERIFIED, REJECTED',
    rejection_reason TEXT COMMENT 'Lý do từ chối KYC (nếu bị từ chối)',
    
    address_detail TEXT COMMENT 'Địa chỉ cụ thể nơi ở',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Thời gian cập nhật cuối',
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (hometown_id) REFERENCES locations(location_id) ON DELETE SET NULL,
    FOREIGN KEY (current_city_id) REFERENCES locations(location_id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_kyc_status (kyc_status),
    INDEX idx_identity_number (identity_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng hồ sơ Helper';

-- 6. Bảng Helper Working Districts (Khu vực làm việc của Helper)
-- Mỗi Helper có thể chọn nhiều quận để làm việc
CREATE TABLE helper_working_districts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    helper_id INT NOT NULL COMMENT 'ID Helper (từ bảng users)',
    location_id INT NOT NULL COMMENT 'ID khu vực làm việc (Quận/Huyện)',
    FOREIGN KEY (helper_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES locations(location_id) ON DELETE CASCADE,
    INDEX idx_helper_id (helper_id),
    INDEX idx_location_id (location_id),
    UNIQUE KEY unique_helper_location (helper_id, location_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng khu vực làm việc của Helper';

-- 7. Bảng Helper Services (Dịch vụ Helper đăng ký làm)
-- Mỗi Helper có thể đăng ký nhiều dịch vụ
CREATE TABLE helper_services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    helper_id INT NOT NULL COMMENT 'ID Helper (từ bảng users)',
    service_id INT NOT NULL COMMENT 'ID dịch vụ (từ bảng services)',
    is_active BOOLEAN DEFAULT TRUE COMMENT 'Helper còn nhận dịch vụ này không',
    FOREIGN KEY (helper_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(service_id) ON DELETE CASCADE,
    INDEX idx_helper_id (helper_id),
    INDEX idx_service_id (service_id),
    INDEX idx_is_active (is_active),
    UNIQUE KEY unique_helper_service (helper_id, service_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng dịch vụ Helper cung cấp';