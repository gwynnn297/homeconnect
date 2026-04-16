# Hướng dẫn Kiểm thử Luồng Tiền thật (Dành cho Nhóm)

Tài liệu này hướng dẫn cách để các thành viên trong nhóm có thể trải nghiệm luồng đối soát tự động (Success) ngay trên máy cá nhân khi Admin thực hiện chuyển khoản thật từ ngân hàng.

---

##  Cơ chế Hoạt động
Vì nhà cung cấp Webhook (Casso/xGate) chỉ gửi thông báo về **duy nhất 01 địa chỉ** tại một thời điểm, nên cả nhóm cần phối hợp với Admin để "điều hướng" thông báo về đúng máy người cần test.

---

##  Quy trình Thực hiện (4 Bước)

### Bước 1: Thiết lập ngrok
- Thành viên đang cần test trên máy mình cần đăng ký tài khoản tại [ngrok.com](https://ngrok.com) để lấy **Authtoken**.
- Chạy lệnh: `ngrok config add-authtoken <TOKEN_CỦA_BẠN>`.
- Chạy lệnh khởi động: `ngrok http 8080`.
- Copy đường dẫn công khai (Ví dụ: `https://abc-xyz.ngrok-free.app`).
- Gửi đường dẫn này cho **Admin** (người giữ tài khoản Casso/xGate).

### Bước 2: Admin cấu hình Dashboard Webhook
- Admin truy cập vào Dashboard của  **xGate**.
- Thay đổi **Webhook URL** thành đường dẫn ngrok của bạn đó:
  `https://abc-xyz.ngrok-free.app/api/v1/webhooks/xgate`

### Bước 3: Admin thực hiện Quét mã Chuyển tiền
- Admin nhấn **Chi tiết** một yêu cầu rút tiền.
- Dùng App ngân hàng quét mã QR (chứa nội dung `HOMIRT{ID}`).
- Admin thực hiện chuyển tiền thật ngoài đời.

### Bước 4: Kiểm tra kết quả tự động
- Khi tiền đi, hệ thống trên máy của thành viên đó sẽ **tự động** chuyển trạng thái từ `PROCESSING` sang `COMPLETED` mà không cần can thiệp thủ công.

---

## ⚠️ Lưu ý Quan trọng
- Tại một thời điểm, chỉ có 01 thành viên có thể nhận Webhook thật.
- Đảm bảo file `application.properties` của mọi người dùng chung mã `webhook.secret` trùng với mã trên Dashboard Webhook.
