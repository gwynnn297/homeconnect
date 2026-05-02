-- V59: Tạo bảng direct_booking_requests (yêu cầu đặt thợ trực tiếp)
-- Song song với job_posts nhưng dành cho flow đặt trực tiếp (không qua đấu thầu)

CREATE TABLE direct_booking_requests (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    customer_id  INT NOT NULL COMMENT 'Khách hàng gửi yêu cầu',
    helper_id    INT NOT NULL COMMENT 'Thợ được đặt trực tiếp',
    category_id  INT    NOT NULL COMMENT 'Danh mục dịch vụ chính',
    address_id   INT NULL     COMMENT 'FK địa chỉ đã lưu (nullable nếu nhập tay)',

    work_date        DATE         NOT NULL  COMMENT 'Ngày làm việc',
    start_time       TIME         NOT NULL  COMMENT 'Giờ bắt đầu',
    duration_hours   INT          NOT NULL  COMMENT 'Số giờ làm',

    work_size        DOUBLE       NULL      COMMENT 'Diện tích / số trẻ / số món tùy danh mục',
    description      TEXT         NULL      COMMENT 'Ghi chú / mô tả từ khách',
    additional_data  TEXT         NULL      COMMENT 'JSON dữ liệu bổ sung (isTaskerShopping, shoppingAmount...)',
    service_ids      VARCHAR(500) NULL      COMMENT 'Danh sách ID dịch vụ con (VD: "10,11,12")',

    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm tạo yêu cầu',
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (helper_id)   REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES service_categories(category_id) ON DELETE RESTRICT,
    FOREIGN KEY (address_id)  REFERENCES addresses(address_id) ON DELETE SET NULL,

    INDEX idx_dbr_customer (customer_id),
    INDEX idx_dbr_helper   (helper_id),
    INDEX idx_dbr_work_date (work_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Yêu cầu đặt thợ trực tiếp (không qua tin đăng marketplace)';

-- Thêm FK từ bookings sang bảng mới (nullable - chỉ direct bookings mới có)
ALTER TABLE bookings
    ADD COLUMN direct_booking_request_id INT NULL
        COMMENT 'FK sang direct_booking_requests (chỉ có với đặt trực tiếp)',
    ADD CONSTRAINT fk_booking_direct_req
        FOREIGN KEY (direct_booking_request_id)
        REFERENCES direct_booking_requests(id)
        ON DELETE SET NULL;

-- Đồng thời thêm description cho bookings marketplace (từ job_posts)
ALTER TABLE bookings
    ADD COLUMN description TEXT NULL COMMENT 'Mô tả từ khách (direct booking)';
