-- ==========================================
-- V31__create_reviews_table.sql
-- Description: Tạo bảng reviews để lưu đánh giá của khách hàng cho thợ
-- ==========================================

CREATE TABLE reviews (
    review_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL UNIQUE COMMENT 'Một đơn hàng chỉ có thể đánh giá 1 lần',
    customer_id INT NOT NULL,
    helper_id INT NOT NULL,
    rating TINYINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    is_visible BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
    FOREIGN KEY (customer_id) REFERENCES users(id),
    FOREIGN KEY (helper_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Thêm index để tối ưu việc lấy review của thợ
CREATE INDEX idx_review_helper_id ON reviews(helper_id);
