-- Bổ sung address_id vào bảng bookings để xác định địa chỉ làm việc cụ thể cho mỗi đơn hàng
ALTER TABLE bookings 
    ADD COLUMN address_id INT AFTER service_id,
    ADD CONSTRAINT fk_booking_address FOREIGN KEY (address_id) REFERENCES addresses(address_id);
