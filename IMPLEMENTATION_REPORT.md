# 🏠 HomeConnect Backend - Hướng Dẫn Bàn Giao
**Ngày bàn giao:** 12/02/2026

---

## 📧 HƯỚNG DẪN SETUP EMAIL 

### **Bước 1: Tạo App Password cho Gmail**
1. **Đăng nhập** vào Gmail của bạn
2. **Vào Google Account Settings**: https://myaccount.google.com/
3. **Bật 2-Step Verification** (nếu chưa có):
   - Vào **Security** → **2-Step Verification** → **Get Started**
4. **Tạo App Password**:
   - Vào **Security** → **2-Step Verification** → **App passwords**
   - Chọn **Select app** → **Other (custom name)**
   - Gõ tên: "HomeConnect Backend"
   - Click **Generate**
   - **LƯU LẠI** mã password 16 ký tự (dạng: abcd efgh ijkl mnop)

### **Bước 2: Cấu hình Environment Variables**
```bash
# vài file .env trong thư mục backend có sẵn(chỗ để pass, username, localhost connect db) thêm pass(https://myaccount.google.com/ trang này đăng ký sinh ra) và mail của mình )
GMAIL_USERNAME=your_email@gmail.com
GMAIL_APP_PASSWORD=abcd efgh ijkl mnop  # App password vừa tạo
```

---

## 🚀 CÁCH CHẠY PROJECT

### **Prerequisites:**
- Java 17
- MySQL đã cài đặt và chạy
- Database `homeconnect` đã tạo

### **Chạy Backend:**
```bash
cd homeconnect/backend
./gradlew bootRun
```

**Server chạy tại:** `http://localhost:8080`

---

## 📋 API DOCUMENTATION CHO FRONTEND

### **🎯 Swagger UI (Giao diện test API):**
**URL:** `http://localhost:8080/swagger-ui.html`

**Lưu ý:** Swagger UI hiển thị giao diện nhưng API docs có trouble loading. Tuy nhiên các API endpoints hoạt động bình thường.

### **🛡️ API Endpoints đã hoàn thành:**

#### **1. Đăng ký bước 1 - Gửi OTP**
```http
POST /api/v1/auth/register-init
Content-Type: application/json

Body:
{
  "email": "test@example.com",
  "password": "SecurePass123!",
  "fullName": "Nguyễn Văn A",
  "phoneNumber": "0123456789"
}

Response thành công:
{
  "success": true,
  "message": "Mã OTP đã được gửi đến email của bạn. Vui lòng kiểm tra email!",
  "data": null
}
```

#### **2. Đăng ký bước 2 - Xác thực OTP**
```http
POST /api/v1/auth/register-verify
Content-Type: application/json

Body:
{
  "email": "test@example.com",  // FE tự động gửi email từ bước 1, user KHÔNG cần nhập lại
  "otp": "123456"               // User chỉ cần nhập OTP
}

Response thành công:
{
  "success": true,
  "message": "Đăng ký tài khoản thành công! Chào mừng bạn đến với HomeConnect.",
  "data": 1  // User ID
}
```

**🎯 Lưu ý UX cho Frontend:**
- **Bước 1:** User nhập email + password + thông tin cá nhân
- **Bước 2:** User CHỈ nhập OTP, FE tự động gửi email đã lưu từ bước 1  
- FE lưu email trong state/localStorage giữa 2 bước

### **📱 Test với Postman/Curl:**

```bash
# Test đăng ký bước 1
curl -X POST http://localhost:8080/api/v1/auth/register-init \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your_test_email@gmail.com",
    "password": "SecurePass123!",
    "fullName": "Test User",
    "phoneNumber": "0123456789"
  }'

# (Kiểm tra email, lấy mã OTP)

# Test đăng ký bước 2
curl -X POST http://localhost:8080/api/v1/auth/register-verify \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your_test_email@gmail.com", 
    "otp": "123456"
  }'
```

---

## 🔧 KẾT QUẢ IMPLEMENTATION

### **✅ Đã hoàn thành:**
- **JWT Authentication & Security**
- **Email Service với HTML template**
- **API Register 2 bước với OTP**
- **Exception Handler toàn cục**
- **Database với 7 bảng**

### **✅ Đã test thành công:**
- Gửi email OTP: ✅
- Xác thực OTP: ✅  
- Tạo user account: ✅
- Tạo wallet & helper profile: ✅

### **⚠️ Vấn đề:**
- **Swagger API docs:** UI hiển thị nhưng docs không load được (compatibility issue với Spring Boot 4.x)
- **Giải pháp:** Dùng Postman hoặc curl để test API, hoặc tham khảo documentation này

---

## 🗄️ DATABASE

**MySQL Schema:** `homeconnect`
**Tables:** users, wallets, helper_profiles, categories, services, bookings, reviews

**Auto-migration:** Flyway tự động tạo bảng khi start app

---

## 📞 LƯU Ý CHO FRONTEND TEAM

1. **Base URL:** `http://localhost:8080`
2. **API Response format:** 
   ```json
   {
     "success": boolean,
     "message": "string", 
     "data": object,
     "timestamp": "2026-02-12T...",
     "path": "/api/..."
   }
   ```
3. **Error handling:** Tất cả lỗi đều trả về format trên với `success: false`
4. **CORS:** Đã config cho localhost ports

**Swagger UI:** `http://localhost:8080/swagger-ui.html` (để xem giao diện, dù docs không load)

---

*Bàn giao hoàn tất - 12/02/2026*