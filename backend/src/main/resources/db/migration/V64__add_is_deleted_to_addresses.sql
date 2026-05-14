-- Thêm cột is_deleted vào bảng addresses để hỗ trợ Soft Delete (Xóa mềm)
-- Giúp bảo vệ lịch sử địa chỉ trong các đơn hàng cũ.

ALTER TABLE addresses ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;
