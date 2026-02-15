# 📚 Hướng Dẫn Test API với Swagger UI

## 🎯 Mục đích
Tài liệu này hướng dẫn Frontend Developer cách test các API endpoints của HomeConnect Backend thông qua Swagger UI.

---

## 🚀 Truy cập Swagger UI

### 1. Khởi động Backend
```bash
cd homeconnect/backend
./gradlew bootRun
```

### 2. Mở Swagger UI
Sau khi backend chạy thành công, truy cập:
- **Swagger UI**: http://localhost:8080/api/swagger-ui/index.html
- **OpenAPI JSON**: http://localhost:8080/api/v3/api-docs

---

## 📍 Server Configuration

Trong Swagger UI, bạn sẽ thấy:
- **Server URL**: `http://localhost:8080`
- **Base Path**: `/api`
- **Full API URL**: `http://localhost:8080/api`

---

## 🔐 API Endpoints - Xác thực (Authentication)

### 1. POST `/api/auth/register-init` - Đăng ký bước 1 - Gửi OTP

**Mô tả**: Gửi mã OTP đến email/số điện thoại để bắt đầu quá trình đăng ký tài khoản mới.

**Request Body**:
```json
{
  "identifier": "newuser@example.com",
  "fullName": "Nguyễn Văn A",
  "phone": "0123456789",
  "role": "CUSTOMER"
}
```

**Response thành công (200 OK)**:
```json
{
  "success": true,
  "message": "Mã OTP đã được gửi tới email/số điện thoại của bạn"
}
```

**Lưu ý**: 
- OTP sẽ được gửi qua email (kiểm tra inbox/spam)
- OTP có thời hạn (thường là 5-10 phút)
- Role có thể là: `CUSTOMER`, `HELPER`, `ADMIN`

**Cách test trong Swagger**:
1. Mở endpoint `POST /api/auth/register-init`
2. Click "Try it out"
3. Nhập thông tin đăng ký (email, fullName, phone, role)
4. Click "Execute"
5. Kiểm tra email để lấy mã OTP

---

### 2. POST `/api/auth/register-verify` - Đăng ký Bước 2 - Xác thực OTP

**Mô tả**: Xác thực mã OTP và hoàn tất đăng ký tài khoản mới.

**Request Body**:
```json
{
  "identifier": "newuser@example.com",
  "otp": "123456",
  "password": "secure_password123"
}
```

**Response thành công (200 OK)**:
```json
{
  "success": true,
  "message": "Đăng ký thành công",
  "user": {
    "userId": 1,
    "fullName": "Nguyễn Văn A",
    "email": "newuser@example.com",
    "phone": "0123456789",
    "role": "CUSTOMER",
    "status": "ACTIVE"
  }
}
```

**Cách test trong Swagger**:
1. Mở endpoint `POST /api/auth/register-verify`
2. Click "Try it out"
3. Nhập `identifier`, `otp` (từ email ở bước register-init) và `password`
4. Click "Execute"
5. Tài khoản sẽ được tạo và kích hoạt

---

### 3. POST `/api/auth/login` - Đăng nhập

**Mô tả**: Đăng nhập vào hệ thống bằng email/phone và mật khẩu.

**Request Body**:
```json
{
  "identifier": "user@example.com",
  "password": "your_password"
}
```

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
    "phone": "0123456789",
    "role": "CUSTOMER",
    "kycStatus": null
  }
}
```

**Cách test trong Swagger**:
1. Mở endpoint `POST /api/auth/login`
2. Click "Try it out"
3. Nhập JSON request body
4. Click "Execute"
5. Copy `accessToken` từ response để dùng cho các API cần authentication

---

### 4. POST `/api/auth/forgot-password` - Quên mật khẩu (Bước 1)

**Mô tả**: Gửi mã OTP đến email/số điện thoại để đặt lại mật khẩu.

**Request Body**:
```json
{
  "identifier": "user@example.com"
}
```

**Response thành công (200 OK)**:
```json
{
  "success": true,
  "message": "Nếu tài khoản tồn tại, mã OTP đã được gửi tới email/số điện thoại của bạn"
}
```

**Lưu ý**: 
- OTP sẽ được gửi qua email (kiểm tra inbox/spam)
- OTP có thời hạn (thường là 5-10 phút)

**Cách test trong Swagger**:
1. Mở endpoint `POST /api/auth/forgot-password`
2. Click "Try it out"
3. Nhập email hoặc số điện thoại
4. Click "Execute"
5. Kiểm tra email để lấy mã OTP

---

### 5. POST `/api/auth/verify-forgot-otp` - Xác thực OTP (Bước 2)

**Mô tả**: Xác thực mã OTP và nhận reset token để đặt lại mật khẩu.

**Request Body**:
```json
{
  "identifier": "user@example.com",
  "otp": "123456"
}
```

**Response thành công (200 OK)**:
```json
{
  "success": true,
  "resetToken": "reset_token_here_xyz123..."
}
```

**Cách test trong Swagger**:
1. Mở endpoint `POST /api/auth/verify-forgot-otp`
2. Click "Try it out"
3. Nhập `identifier` và `otp` (lấy từ email ở bước trước)
4. Click "Execute"
5. Copy `resetToken` từ response để dùng ở bước tiếp theo

---

### 6. POST `/api/auth/reset-password` - Đặt lại mật khẩu (Bước 3)

**Mô tả**: Đặt lại mật khẩu mới bằng reset token.

**Request Body**:
```json
{
  "resetToken": "reset_token_here_xyz123...",
  "newPassword": "new_secure_password123"
}
```

**Response thành công (200 OK)**:
```json
{
  "success": true,
  "message": "Mật khẩu của bạn đã được đặt lại thành công"
}
```

**Cách test trong Swagger**:
1. Mở endpoint `POST /api/auth/reset-password`
2. Click "Try it out"
3. Nhập `resetToken` (từ bước verify OTP) và `newPassword`
4. Click "Execute"

---

## 🔑 Authentication với JWT Token

### Cách sử dụng JWT Token trong Swagger

1. **Sau khi login thành công**, copy `accessToken` từ response
2. **Click nút "Authorize"** ở góc trên bên phải Swagger UI
3. **Nhập token** theo format: `Bearer <your_token>`
   - Ví dụ: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
4. **Click "Authorize"** và "Close"
5. Tất cả các request sau đó sẽ tự động gửi kèm token trong header

### Cách sử dụng JWT Token trong Frontend Code

```javascript
// Sau khi login, lưu token
const loginResponse = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier, password })
});
const { accessToken } = await loginResponse.json();

// Sử dụng token cho các API khác
const response = await fetch('/api/your-protected-endpoint', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  }
});
```

---

## 📝 Ví dụ Test Flow Hoàn Chỉnh

### Flow 1: Đăng ký tài khoản mới (2 bước)
```
1. POST /api/auth/register-init
   → Nhập thông tin: email, fullName, phone, role
   → Nhận thông báo OTP đã gửi
   → Kiểm tra email để lấy OTP

2. POST /api/auth/register-verify
   → Nhập OTP từ email + password
   → Tài khoản được tạo và kích hoạt
   → Có thể đăng nhập ngay
```

### Flow 2: Đăng nhập
```
1. POST /api/auth/login
   → Nhận accessToken
   → Lưu token để dùng cho các API khác
```

### Flow 3: Quên mật khẩu (3 bước)
```
1. POST /api/auth/forgot-password
   → Nhận thông báo OTP đã gửi
   → Kiểm tra email để lấy OTP

2. POST /api/auth/verify-forgot-otp
   → Nhập OTP từ email
   → Nhận resetToken

3. POST /api/auth/reset-password
   → Nhập resetToken + mật khẩu mới
   → Hoàn tất đặt lại mật khẩu
```

---

## ⚠️ Lưu ý Quan Trọng

### 1. Validation Errors
Nếu request thiếu hoặc sai format, bạn sẽ nhận được lỗi:
```json
{
  "timestamp": "2024-01-01T10:00:00",
  "status": 400,
  "error": "Bad Request",
  "message": "Identifier (email or phone) is required",
  "path": "/api/auth/login"
}
```

### 2. Authentication Errors
- Nếu token hết hạn hoặc không hợp lệ: `401 Unauthorized`
- Nếu thiếu token cho protected endpoint: `403 Forbidden`

### 3. Email OTP
- OTP được gửi qua email Gmail đã cấu hình
- Kiểm tra cả inbox và spam folder
- OTP có thời hạn, cần sử dụng ngay

### 4. CORS (Nếu test từ Frontend)
Nếu test từ frontend (React/Vue), đảm bảo backend đã cấu hình CORS cho phép origin của frontend.

---

## 🐛 Troubleshooting

### Swagger UI không mở được
- Kiểm tra backend đã chạy chưa: `http://localhost:8080/api`
- Kiểm tra port 8080 có bị chiếm không
- Xem logs trong console để tìm lỗi

### API trả về 401/403
- Kiểm tra token đã được thêm vào header chưa
- Kiểm tra token còn hạn không (expiresIn: 3600000ms = 1 giờ)
- Thử login lại để lấy token mới

### OTP không nhận được
- Kiểm tra email đã được cấu hình đúng trong `application.properties`
- Kiểm tra spam folder
- Xem logs backend để kiểm tra lỗi gửi email

---

## 📞 Hỗ trợ

Nếu gặp vấn đề khi test API:
1. Kiểm tra logs backend trong console
2. Kiểm tra database connection
3. Kiểm tra email configuration
4. Liên hệ Backend Team để được hỗ trợ

---

## 📌 Quick Reference

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/api/auth/register-init` | POST | ❌ | Đăng ký bước 1 - Gửi OTP |
| `/api/auth/register-verify` | POST | ❌ | Đăng ký bước 2 - Xác thực OTP |
| `/api/auth/login` | POST | ❌ | Đăng nhập |
| `/api/auth/forgot-password` | POST | ❌ | Gửi OTP quên mật khẩu |
| `/api/auth/verify-forgot-otp` | POST | ❌ | Xác thực OTP |
| `/api/auth/reset-password` | POST | ❌ | Đặt lại mật khẩu |

---

**Chúc bạn test API thành công! 🎉**

