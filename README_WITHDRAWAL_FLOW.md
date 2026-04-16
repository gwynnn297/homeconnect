# Hướng dẫn Cấu hình & Chạy Team (Dành cho thành viên Nhóm)

Tài liệu này hướng dẫn cách các thành viên trong nhóm thiết lập môi trường cá nhân để test tính năng rút tiền.

---

## 0. Cách lấy mã API Key & Webhook Secret cá nhân
Để có thông tin điền vào code, mỗi bạn trong nhóm cần làm như sau trên Dashboard xGate của mình:

1.  **Đăng ký & Liên kết ngân hàng**: 
    *   Truy cập [xgate.vn](https://xgate.vn) và đăng ký tài khoản.
    *   Vào mục **Liên kết ngân hàng** -> Thêm mới: Liên kết số tài khoản ngân hàng của bạn để hệ thống theo dõi được biến động số dư.
2.  **Lấy API Key**: 
    *   Vào mục **REST API** -> Nhấn **Tạo mới**. 
    *   Copy mã có dạng `xgate_...` và dán vào dòng `xgate.api.key` (Mục 1).
3.  **Lấy Webhook Secret**: 
    *   Vào mục **Kênh thông báo** -> Thêm mới -> Chọn **Webhook**.
    *   **Tên kênh**: Đặt tên bất kỳ (VD: `local_test_nam`).
    *   **Webhook URL**: Dùng link ngrok của bạn (Xem Mục 2).
    *   **Mã bí mật (Secret)**: Đây chính là mã bạn tự đặt hoặc hệ thống cấp, hãy copy nó dán vào dòng `xgate.webhook.secret` (Mục 1).

---

## 1. Cấu hình Key vào Project
Bạn hãy mở file sau để nhập Key của mình:
*   **Vị trí file**: `homeconnect/backend/src/main/resources/application.properties`
*   **Các dòng cần sửa (Dòng 202 - 204)**:
    ```properties
    xgate.api.key=dán_mã_xgate_của_bạn_vào_đây
    xgate.api.url=https://api.xgate.vn/v1
    xgate.webhook.secret=nhập_mã_bí_mật_bất_kỳ_của_bạn
    ```

⚠️ **CẢNH BÁO QUAN TRỌNG**: 
Khi dùng cách này, lúc bạn `git commit` hoặc `push` code, tuyệt đối **KHÔNG ĐƯỢC CHỌN** file `application.properties` để up lên Github. 
*   Trước khi push code, bạn hãy chạy lệnh này để xóa dấu vết key cá nhân: 
    `git checkout -- homeconnect/backend/src/main/resources/application.properties`

---

## 2. Quy trình Test Webhook cá nhân (Cực kỳ quan trọng)
Vì xGate chỉ gửi thông báo về một địa chỉ tại một thời điểm, mỗi người muốn test "Tự động hoàn thành" cần làm như sau:

### Bước 1: Chạy Ngrok
Tải ngrok tại: [https://ngrok.com/download](https://ngrok.com/download)
Mở Terminal tại thư mục có file `ngrok.exe` và chạy:
Thiết lập ngrok
- Thành viên đang cần test trên máy mình cần đăng ký tài khoản tại [ngrok.com](https://ngrok.com) để lấy **Authtoken**.
- Chạy lệnh: `ngrok config add-authtoken <TOKEN_CỦA_BẠN>`.
- Chạy lệnh khởi động: `ngrok http 8080`.
- Copy đường dẫn công khai (Ví dụ: `https://abcd-1234.ngrok-free.dev/api/v1/webhooks/xgate`).
- Gửi đường dẫn này cho **Admin** (người giữ tài khoản Casso/xGate).


### Bước 2: Cấu hình Webhook trên xGate cá nhân
1. Vào Dashboard của xGate -> **Kênh thông báo**.
2. Sửa (Dấu 3 chấm) -> Cấu hình Webhook.
3. Dán link ngrok của bạn vào: `https://abcd-1234.ngrok-free.dev/api/v1/webhooks/xgate`.
4. Nhấn Lưu.


---

## 3. Cách test nhanh không cần Ngrok (Dùng Postman)
Nếu bạn lười chạy Ngrok, bạn có thể "giả lập" Webhook bằng Postman:
*   **Method**: `POST`
*   **URL**: `http://localhost:8080/api/v1/webhooks/xgate`
*   **Body (Raw JSON)**:
    ```json
    {
      "transferAmount": 3000,
      "content": "HOMIRT123",
      "transferType": "out"
    }
    ```
    *(Thay `123` bằng ID đơn rút tiền của bạn và `3000` bằng số tiền tương ứng)*.

---

## 4. Tóm tắt các trạng thái đơn rút tiền
*   **PENDING (Vàng)**: Chờ Admin duyệt.
*   **PROCESSING (Xanh dương)**: Đã duyệt, chờ Admin chuyển khoản hoặc chờ Webhook.
*   **COMPLETED (Xanh lá)**: Webhook đã khớp lệnh tự động thành công.
*   **REJECTED (Đỏ)**: Admin từ chối và tiền đã được trả lại ví.

---
**Lưu ý**: Hãy luôn đảm bảo Backend đang chạy khi thực hiện chuyển tiền thật hoặc test Webhook!
