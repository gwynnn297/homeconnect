# 📖 API Documentation - HomeConnect Backend

## 🎯 Mục đích
Tài liệu này cung cấp hướng dẫn chi tiết về tất cả các API endpoints của HomeConnect Backend, bao gồm request/response examples và cách test trên Swagger UI.

---

## 🚀 Truy cập Swagger UI

### Bước 1: Khởi động Backend
```bash
cd homeconnect/backend
./gradlew bootRun
```

### Bước 2: Mở Swagger UI
Sau khi backend chạy thành công (thường mất 30-60 giây), truy cập:
- **Swagger UI**: http://localhost:8080/swagger-ui/index.html
- **Hoặc**: http://localhost:8080/swagger-ui.html

---

## 📋 Danh sách API Endpoints

### 🔐 Authentication & Registration APIs

| Endpoint | Method | Mô tả | Auth Required |
|----------|--------|-------|---------------|
| `/api/auth/register-init` | POST | Đăng ký bước 1 - Gửi OTP | ❌ |
| `/api/auth/register-verify` | POST | Đăng ký bước 2 - Xác thực OTP | ❌ |
| `/api/auth/login` | POST | Đăng nhập | ❌ |
| `/api/auth/forgot-password` | POST | Quên mật khẩu - Gửi OTP | ❌ |
| `/api/auth/verify-forgot-otp` | POST | Xác thực OTP quên mật khẩu | ❌ |
| `/api/auth/reset-password` | POST | Đặt lại mật khẩu mới | ❌ |

---

## 📝 Chi tiết từng API

### 1. 🔵 BE03: Đăng ký bước 1 - Gửi OTP

**Endpoint**: `POST /api/auth/register-init`

**Mô tả**: Validate thông tin đăng ký và gửi mã OTP qua email.

**Request Body**:
```json
{
  "fullName": "Nguyễn Văn A",
  "phone": "0912345678",
  "email": "user@example.com",
  "password": "SecurePass123",
  "role": "CUSTOMER"
}
```

**Validation Rules**:
- `fullName`: Bắt buộc, tối đa 100 ký tự
- `phone`: Bắt buộc, phải là số Việt Nam hợp lệ (10 chữ số, bắt đầu từ 03,05,07,08,09)
- `email`: Bắt buộc, định dạng email hợp lệ, tối đa 100 ký tự
- `password`: Bắt buộc, 8-50 ký tự, phải có ít nhất 1 chữ thường, 1 chữ hoa và 1 số
- `role`: Bắt buộc, giá trị: `CUSTOMER`, `HELPER`, hoặc `ADMIN`

**Response thành công (200 OK)**:
```json
{
  "success": true,
  "message": "Mã OTP đã được gửi tới email của bạn. Vui lòng kiểm tra hộp thư."
}
```

**Response lỗi (400 Bad Request)**:
```json
{
  "success": false,
  "message": "Email đã được sử dụng"
}
```

**Các lỗi có thể gặp**:
- `"Email đã được sử dụng"` - Email đã tồn tại trong hệ thống
- `"Số điện thoại đã được sử dụng"` - Số điện thoại đã tồn tại
- `"Role không hợp lệ (CUSTOMER | HELPER | ADMIN)"` - Role không đúng
- Validation errors từ các field không hợp lệ

**Lưu ý**:
- OTP có hiệu lực trong **5 phút**
- OTP được gửi qua email đã cấu hình
- User được tạo với status `PENDING_OTP` (chưa active)

---

### 2. 🟢 BE04: Đăng ký bước 2 - Xác thực OTP

**Endpoint**: `POST /api/auth/register-verify`

**Mô tả**: Xác thực mã OTP và hoàn tất đăng ký tài khoản.

**Request Body**:
```json
{
  "email": "user@example.com",
  "otpCode": "123456",
  "password": "SecurePass123"
}
```

**Validation Rules**:
- `email`: Bắt buộc, định dạng email hợp lệ
- `otpCode`: Bắt buộc, phải là 6 chữ số
- `password`: Bắt buộc, 8-50 ký tự

**Response thành công (200 OK)**:
```json
{
  "success": true,
  "message": "Đăng ký thành công! Tài khoản của bạn đã được kích hoạt.",
  "user": {
    "userId": 1,
    "fullName": "Nguyễn Văn A",
    "email": "user@example.com",
    "phone": "0912345678",
    "role": "CUSTOMER",
    "status": "ACTIVE"
  }
}
```

**Response lỗi (400 Bad Request)**:
```json
{
  "success": false,
  "message": "OTP không hợp lệ hoặc đã hết hạn"
}
```

**Các lỗi có thể gặp**:
- `"Không tìm thấy người dùng"` - Email không tồn tại hoặc chưa đăng ký bước 1
- `"Tài khoản không ở trạng thái chờ OTP"` - User đã được verify hoặc đã active
- `"OTP không hợp lệ hoặc đã hết hạn"` - OTP sai hoặc quá 5 phút

**Lưu ý**:
- Sau khi verify thành công, user status chuyển thành `ACTIVE`
- Password được set từ request body
- OTP token được đánh dấu là đã sử dụng

---

### 3. 🔐 Đăng nhập

**Endpoint**: `POST /api/auth/login`

**Mô tả**: Đăng nhập vào hệ thống bằng email và mật khẩu.

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Validation Rules**:
- `email`: Bắt buộc
- `password`: Bắt buộc

**Response thành công (200 OK)**:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": 3600000,
  "user": {
    "userId": 1,
    "fullName": "Nguyễn Văn A",
    "email": "user@example.com",
    "phone": "0912345678",
    "role": "CUSTOMER",
    "kycStatus": null
  }
}
```

**Response lỗi (401 Unauthorized)**:
- Nếu thông tin đăng nhập sai, Spring Security sẽ trả về 401
- Nếu account bị blocked, sẽ trả về error message

**Lưu ý**:
- Token có hiệu lực **1 giờ** (3600000ms)
- Token cần được lưu và gửi kèm trong header `Authorization: Bearer {token}` cho các API protected
- Nếu user là HELPER, `kycStatus` sẽ có giá trị (PENDING, APPROVED, REJECTED)

---

### 4. 🔑 Quên mật khẩu - Gửi OTP

**Endpoint**: `POST /api/auth/forgot-password`

**Mô tả**: Gửi mã OTP đến email để đặt lại mật khẩu.

**Request Body**:
```json
{
  "email": "user@example.com"
}
```

**Validation Rules**:
- `email`: Bắt buộc

**Response thành công (200 OK)**:
```json
{
  "success": true,
  "message": "Nếu tài khoản tồn tại, mã OTP đã được gửi tới email/số điện thoại của bạn"
}
```

**Response lỗi (400 Bad Request)**:
- Nếu email không tồn tại, sẽ trả về error

**Lưu ý**:
- OTP có hiệu lực trong **5 phút**
- OTP được gửi qua email

---

### 5. ✅ Xác thực OTP quên mật khẩu

**Endpoint**: `POST /api/auth/verify-forgot-otp`

**Mô tả**: Xác thực mã OTP và nhận reset token để đặt lại mật khẩu.

**Request Body**:
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

**Validation Rules**:
- `email`: Bắt buộc
- `otp`: Bắt buộc, 6 chữ số

**Response thành công (200 OK)**:
```json
{
  "success": true,
  "resetToken": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response lỗi (400 Bad Request)**:
```json
{
  "success": false,
  "message": "OTP không hợp lệ hoặc đã hết hạn"
}
```

**Lưu ý**:
- Reset token có hiệu lực trong **10 phút**
- Reset token cần được lưu để sử dụng ở bước tiếp theo

---

### 6. 🔄 Đặt lại mật khẩu

**Endpoint**: `POST /api/auth/reset-password`

**Mô tả**: Đặt lại mật khẩu mới bằng reset token.

**Request Body**:
```json
{
  "resetToken": "550e8400-e29b-41d4-a716-446655440000",
  "newPassword": "NewSecurePass123"
}
```

**Validation Rules**:
- `resetToken`: Bắt buộc
- `newPassword`: Bắt buộc

**Response thành công (200 OK)**:
```json
{
  "success": true,
  "message": "Mật khẩu của bạn đã được đặt lại thành công"
}
```

**Response lỗi (400 Bad Request)**:
```json
{
  "success": false,
  "message": "Reset token không hợp lệ hoặc đã hết hạn"
}
```

**Lưu ý**:
- Reset token chỉ dùng được 1 lần
- Sau khi reset thành công, user có thể đăng nhập với mật khẩu mới

---


## 🧪 Cách Test trên Swagger UI

### Bước 1: Mở Swagger UI
1. Đảm bảo backend đang chạy: `http://localhost:8080`
2. Truy cập: `http://localhost:8080/swagger-ui/index.html`

### Bước 2: Test API
1. Tìm API cần test trong danh sách (ví dụ: `POST /api/auth/register-init`)
2. Click vào API để mở rộng
3. Click nút **"Try it out"**
4. Điền thông tin vào Request body (JSON)
5. Click **"Execute"**
6. Xem kết quả trong phần **"Responses"**

### Bước 3: Test Flow hoàn chỉnh

#### Test Flow Đăng ký:
1. **Test BE03**: `POST /api/auth/register-init`
   - Điền đầy đủ thông tin
   - Kiểm tra email nhận được OTP
2. **Test BE04**: `POST /api/auth/register-verify`
   - Dùng email và OTP từ bước 1
   - Nhập password
   - Kiểm tra response có user info

#### Test Flow Quên mật khẩu:
1. **Test forgot-password**: `POST /api/auth/forgot-password`
2. **Test verify-forgot-otp**: `POST /api/auth/verify-forgot-otp`
   - Lưu `resetToken` từ response
3. **Test reset-password**: `POST /api/auth/reset-password`
   - Dùng `resetToken` từ bước 2

---

## 📊 Test Cases

### Test Case 1: Đăng ký thành công

**Input**:
```json
{
  "fullName": "Nguyễn Văn A",
  "phone": "0912345678",
  "email": "test1@example.com",
  "password": "Test123456",
  "role": "CUSTOMER"
}
```

**Expected Output**:
- Status: 200 OK
- Response: `{success: true, message: "Mã OTP đã được gửi..."}`
- Email nhận được OTP (6 chữ số)

### Test Case 2: Đăng ký với email đã tồn tại

**Input**:
```json
{
  "fullName": "Nguyễn Văn B",
  "phone": "0987654321",
  "email": "test1@example.com",  // Email đã dùng ở Test Case 1
  "password": "Test123456",
  "role": "CUSTOMER"
}
```

**Expected Output**:
- Status: 400 Bad Request
- Response: `{success: false, message: "Email đã được sử dụng"}`

### Test Case 3: Verify OTP thành công

**Input**:
```json
{
  "email": "test1@example.com",
  "otpCode": "123456",  // OTP từ email
  "password": "Test123456"
}
```

**Expected Output**:
- Status: 200 OK
- Response có `user` object với `status: "ACTIVE"`

### Test Case 4: Verify OTP sai

**Input**:
```json
{
  "email": "test1@example.com",
  "otpCode": "000000",  // OTP sai
  "password": "Test123456"
}
```

**Expected Output**:
- Status: 400 Bad Request
- Response: `{success: false, message: "OTP không hợp lệ hoặc đã hết hạn"}`

### Test Case 5: Đăng nhập thành công

**Input**:
```json
{
  "email": "test1@example.com",
  "password": "Test123456"
}
```

**Expected Output**:
- Status: 200 OK
- Response có `accessToken` và `user` info

---

## 🔒 Authentication với JWT Token

### Cách sử dụng Token

Sau khi đăng nhập thành công, bạn sẽ nhận được `accessToken`. Để sử dụng cho các API protected:

1. **Trong Swagger UI**:
   - Click nút **"Authorize"** ở góc trên bên phải
   - Nhập: `Bearer {your-token-here}`
   - Click **"Authorize"**
   - Tất cả API protected sẽ tự động thêm token vào header

2. **Trong Code (Frontend)**:
   ```javascript
   const headers = {
     'Authorization': `Bearer ${accessToken}`,
     'Content-Type': 'application/json'
   };
   ```

### Token Expiration
- Token có hiệu lực: **1 giờ** (3600000ms)
- Sau khi hết hạn, cần đăng nhập lại để lấy token mới

---

## ⚠️ Error Handling

### Common Error Codes

| Status Code | Mô tả | Cách xử lý |
|-------------|-------|------------|
| 200 | Success | Xử lý response bình thường |
| 400 | Bad Request | Kiểm tra validation errors trong message |
| 401 | Unauthorized | Token hết hạn hoặc không hợp lệ, cần đăng nhập lại |
| 403 | Forbidden | Không có quyền truy cập |
| 500 | Internal Server Error | Lỗi server, liên hệ backend team |

### Error Response Format

```json
{
  "success": false,
  "message": "Mô tả lỗi chi tiết"
}
```

---

## 📝 Notes cho Frontend Team

### 1. State Management
- Lưu `accessToken` sau khi login thành công
- Lưu `email` giữa bước 1 và bước 2 của đăng ký
- Lưu `resetToken` giữa bước verify OTP và reset password

### 2. Validation
- Tất cả validation đã được xử lý ở backend
- Frontend nên validate trước khi gửi request để UX tốt hơn
- Backend sẽ trả về error message rõ ràng nếu validation fail

### 3. Error Messages
- Tất cả error messages đều bằng tiếng Việt
- Hiển thị trực tiếp message từ response cho user

### 4. OTP Handling
- OTP có hiệu lực 5 phút
- Nên có countdown timer cho user
- Cho phép user request OTP mới nếu hết hạn

### 5. Password Requirements
- Minimum 8 characters
- Maximum 50 characters
- Phải có: ít nhất 1 chữ thường, 1 chữ hoa, 1 số

---

