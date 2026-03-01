# BE-Admin-03: Admin Management APIs

## Tổng quan
Bổ sung các API Admin để quản lý hệ thống: xem danh sách Helper, chi tiết Helper, thống kê, gửi thông báo broadcast.

---

## 📋 Setup: Tạo tài khoản Admin

### Bước 1: Generate password hash

Chạy Gradle task để tạo BCrypt hash:

```bash
cd backend
./gradlew generateAdminPassword 
```

Kết quả sẽ in ra password hash và câu SQL INSERT sẵn:

```
========================================
🔐 ADMIN PASSWORD GENERATOR
========================================

📝 Raw password: Phuc!@#29072003

🔒 Hashed password (BCrypt):
$2a$10$aiICbWk19u4QVCJ.jeaWAO17ZIOK4zPmp.dDUfji6hzo.HrPhHdZa

========================================
📋 SQL để tạo admin account:
========================================

INSERT INTO users (full_name, phone, email, password_hash, role, status, created_at)
VALUES (
    'Admin HomeConnect',
    '0999999999',
    'admin@homeconnect.com',
    '$2a$10$aiICbWk19u4QVCJ.jeaWAO17ZIOK4zPmp.dDUfji6hzo.HrPhHdZa',
    'ADMIN',
    'ACTIVE',
    NOW()
);
```

### Bước 2: Insert admin vào database

Kết nối MySQL và chạy câu SQL trên:

```bash
mysql -u root -p homeconnect
```

```sql
INSERT INTO users (full_name, phone, email, password_hash, role, status, created_at)
VALUES (
    'Admin HomeConnect',
    '0999999999',
    'admin@homeconnect.com',
    '$2a$10$aiICbWk19u4QVCJ.jeaWAO17ZIOK4zPmp.dDUfji6hzo.HrPhHdZa',
    'ADMIN',
    'ACTIVE',
    NOW()
);
```

### Bước 3: Xác nhận tạo thành công

```sql
SELECT id, full_name, email, role, status FROM users WHERE role = 'ADMIN';
```

### Bước 4: Lấy JWT token để test APIs

Login để nhận access token:

```bash
curl -X POST "http://localhost:8080/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@homeconnect.com",
    "password": "Phuc!@#29072003"
  }'
```

Response:
```json
{
  "accessToken": "eyJhbGciOiJIUzUxMiJ9...",
  "tokenType": "Bearer",
  "expiresIn": 86400000,
  "user": {
    "userId": 10,
    "fullName": "Admin HomeConnect",
    "email": "admin@homeconnect.com",
    "phone": "0999999999",
    "role": "ADMIN",
    "kycStatus": null
  }
}
```

**Lưu lại `accessToken`** để sử dụng cho các API calls bên dưới!

### 🔐 Lưu ý bảo mật

- **Đổi password** trong file `GenerateAdminPassword.java` (dòng 13) thành password mạnh của bạn
- Không commit password vào git
- Nên thay đổi email admin thành email thật để nhận notifications

---

## 🚀 Quick Start Guide

### 1. Tạo admin account (một lần duy nhất)

```bash
# Generate password hash
./gradlew generateAdminPassword

# Copy SQL và chạy trong MySQL
mysql -u root -p homeconnect < admin_insert.sql
```

### 2. Login để lấy token

```bash
curl -X POST "http://localhost:8080/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@homeconnect.com", "password": "Phuc!@#29072003"}'

# Copy accessToken từ response
```

### 3. Test APIs

```bash
export TOKEN="paste_your_token_here"

# Xem dashboard
curl -X GET "http://localhost:8080/api/v1/admin/statistics" \
  -H "Authorization: Bearer $TOKEN"

# Danh sách helpers chờ duyệt
curl -X GET "http://localhost:8080/api/v1/admin/helpers?status=WAITING_APPROVAL" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 1. API: Danh sách Helper

### GET /api/v1/admin/helpers

**Mô tả:** Lấy danh sách Helper với filter và pagination

**Headers:**
```
Authorization: Bearer {admin_token}
```

**Query Parameters:**
- `status` (optional): Filter theo KYC status - `PENDING`, `WAITING_APPROVAL`, `VERIFIED`, `REJECTED`
- `page` (optional, default: 0): Số trang (bắt đầu từ 0)
- `size` (optional, default: 20): Số lượng item mỗi trang
- `sortBy` (optional, default: user.createdAt): Sắp xếp theo field
  - `user.createdAt` - Ngày tạo tài khoản (từ User)
  - `user.fullName` - Tên helper (từ User)
  - `updatedAt` - Ngày cập nhật profile (từ HelperProfile)
  - `kycStatus` - Trạng thái KYC (từ HelperProfile)
- `sortDir` (optional, default: desc): Hướng sắp xếp `asc` hoặc `desc`

**Response Success (200):**
```json
{
  "helpers": [
    {
      "helperId": 7,
      "fullName": "Hoàng Ngọc Phúc",
      "email": "phuchoang29072000@gmail.com",
      "phone": "0123456789",
      "avatarUrl": "https://...",
      "kycStatus": "WAITING_APPROVAL",
      "identityNumber": "001234567890",
      "dateOfBirth": "2000-07-29",
      "currentCityName": "Hà Nội",
      "experienceYears": 3,
      "bio": "Giúp việc nhà có kinh nghiệm...",
      "totalServices": 2,
      "totalWorkingDistricts": 3,
      "createdAt": "2026-01-15T10:00:00",
      "updatedAt": "2026-03-01T08:30:00"
    }
  ],
  "totalElements": 45,
  "totalPages": 3,
  "currentPage": 0,
  "pageSize": 20,
  "message": "Danh sách Helper với trạng thái Chờ phê duyệt"
}
```

**Example:**
```bash
# Lấy tất cả helpers, sort theo ngày tạo mới nhất
curl -X GET "http://localhost:8080/api/v1/admin/helpers" \
  -H "Authorization: Bearer {admin_token}"

# Filter helpers PENDING, sort theo tên
curl -X GET "http://localhost:8080/api/v1/admin/helpers?status=PENDING&sortBy=user.fullName&sortDir=asc" \
  -H "Authorization: Bearer {admin_token}"

# Filter helpers chờ duyệt, trang 1, 10 items, sort theo ngày cập nhật
curl -X GET "http://localhost:8080/api/v1/admin/helpers?status=WAITING_APPROVAL&page=1&size=10&sortBy=updatedAt&sortDir=desc" \
  -H "Authorization: Bearer {admin_token}"
```

---

## 2. API: Chi tiết Helper

### GET /api/v1/admin/helpers/{helperId}

**Mô tả:** Xem chi tiết đầy đủ hồ sơ Helper bao gồm KYC, dịch vụ, khu vực làm việc

**Headers:**
```
Authorization: Bearer {admin_token}
```

**Path Parameters:**
- `helperId` (Long): ID của Helper

**Response Success (200):**
```json
{
  "helperId": 7,
  "fullName": "Hoàng Ngọc Phúc",
  "email": "phuchoang29072000@gmail.com",
  "phone": "0123456789",
  "avatarUrl": "https://...",
  "status": "ACTIVE",
  "createdAt": "2026-01-15T10:00:00",
  
  "profileId": 7,
  "bio": "Có 3 năm kinh nghiệm...",
  "experienceYears": 3,
  "dateOfBirth": "2000-07-29",
  "addressDetail": "123 Đường ABC, Phường XYZ",
  
  "hometown": {
    "locationId": 1,
    "name": "Hà Nội",
    "type": "PROVINCE"
  },
  "currentCity": {
    "locationId": 1,
    "name": "Hà Nội",
    "type": "PROVINCE"
  },
  
  "kycStatus": "WAITING_APPROVAL",
  "rejectionReason": null,
  "identityNumber": "001234567890",
  "identityFrontUrl": "https://cloudinary.com/...",
  "identityBackUrl": "https://cloudinary.com/...",
  "selfieUrl": "https://cloudinary.com/...",
  
  "services": [
    {
      "serviceId": 1,
      "name": "Dọn dẹp nhà cửa",
      "iconUrl": "https://..."
    },
    {
      "serviceId": 2,
      "name": "Chăm sóc trẻ em",
      "iconUrl": "https://..."
    }
  ],
  
  "workingDistricts": [
    {
      "locationId": 10,
      "name": "Quận Ba Đình"
    },
    {
      "locationId": 11,
      "name": "Quận Hoàn Kiếm"
    }
  ],
  
  "profileUpdatedAt": "2026-03-01T08:30:00"
}
```

**Example:**
```bash
curl -X GET "http://localhost:8080/api/v1/admin/helpers/7" \
  -H "Authorization: Bearer {admin_token}"
```

---

## 3. API: Thống kê hệ thống

### GET /api/v1/admin/statistics

**Mô tả:** Dashboard thống kê tổng quan: users, helpers theo KYC status, services, locations

**Headers:**
```
Authorization: Bearer {admin_token}
```

**Response Success (200):**
```json
{
  "userStats": {
    "totalUsers": 150,
    "totalCustomers": 80,
    "totalHelpers": 68,
    "totalAdmins": 2,
    "activeUsers": 140,
    "blockedUsers": 3
  },
  "helperStats": {
    "totalHelpers": 68,
    "pendingKyc": 15,
    "waitingApproval": 8,
    "verifiedHelpers": 42,
    "rejectedHelpers": 3
  },
  "systemStats": {
    "totalServices": 12,
    "totalLocations": 63
  },
  "message": "Thống kê hệ thống HomeConnect"
}
```

**Example:**
```bash
curl -X GET "http://localhost:8080/api/v1/admin/statistics" \
  -H "Authorization: Bearer {admin_token}"
```

---

## 4. API: Gửi thông báo Broadcast

### POST /api/v1/admin/notifications/broadcast

**Mô tả:** Gửi email thông báo tới tất cả user hoặc filter theo role

**Headers:**
```
Authorization: Bearer {admin_token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "Thông báo bảo trì hệ thống",
  "message": "Hệ thống sẽ bảo trì vào 00:00 ngày 05/03/2026. Vui lòng lưu ý!",
  "targetRole": "HELPER"
}
```

**Fields:**
- `title` (required): Tiêu đề email
- `message` (required): Nội dung thông báo
- `targetRole` (optional): Role nhận thông báo - `CUSTOMER`, `HELPER`, `ADMIN`. Bỏ trống hoặc null để gửi tất cả

**Response Success (200):**
```json
{
  "success": true,
  "message": "Đã gửi thông báo broadcast",
  "totalRecipients": 68,
  "successCount": 67,
  "failureCount": 1
}
```

**Example:**
```bash
# Gửi cho tất cả helpers
curl -X POST "http://localhost:8080/api/v1/admin/notifications/broadcast" \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Thông báo quan trọng",
    "message": "Nội dung thông báo...",
    "targetRole": "HELPER"
  }'

# Gửi cho tất cả user
curl -X POST "http://localhost:8080/api/v1/admin/notifications/broadcast" \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Thông báo bảo trì",
    "message": "Hệ thống sẽ bảo trì..."
  }'
```

---

## Implementation Files

### DTOs Created:
1. `HelperListItemResponse.java` - Item trong danh sách helper
2. `HelperListResponse.java` - Response cho danh sách helper (paginated)
3. `HelperDetailResponse.java` - Chi tiết helper đầy đủ
4. `AdminStatisticsResponse.java` - Thống kê dashboard
5. `BroadcastNotificationRequest.java` - Request gửi thông báo
6. `BroadcastNotificationResponse.java` - Response thông báo

### Repositories Updated:
1. `HelperProfileRepository.java` - Thêm query methods filter và count
2. `UserRepository.java` - Thêm countByRole, countByStatus, findByRole
3. `HelperServiceRepository.java` - Thêm findByHelper_Id, countByHelper_Id
4. `HelperWorkingDistrictRepository.java` - Thêm findByHelper_Id, countByHelper_Id

### Services:
1. `AdminService.java` - Thêm 4 methods mới:
   - `getHelpers(status, pageable)` - Danh sách helper
   - `getHelperDetail(helperId)` - Chi tiết helper
   - `getStatistics()` - Thống kê
   - `broadcastNotification(request)` - Gửi thông báo

### Controllers:
1. `AdminController.java` - Thêm 4 endpoints mới

---

## Security

- Tất cả API đều yêu cầu authentication với JWT token
- Chỉ user có role `ADMIN` mới được phép gọi APIs này (`@PreAuthorize("hasRole('ADMIN')")`)
- Validation đầy đủ input
- Log tất cả hoạt động Admin

---

## Testing

### Setup Admin Token

Trước khi test, bạn cần lấy admin token:

```bash
# 1. Login admin
curl -X POST "http://localhost:8080/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@homeconnect.com",
    "password": "Phuc!@#29072003"
  }'

# 2. Copy accessToken từ response
# Thay {admin_token} bên dưới bằng token vừa lấy
```

### 1. Test danh sách helpers

```bash
# Tất cả helpers (mặc định sort theo user.createdAt desc)
curl -X GET "http://localhost:8080/api/v1/admin/helpers" \
  -H "Authorization: Bearer {admin_token}"

# Filter helpers PENDING
curl -X GET "http://localhost:8080/api/v1/admin/helpers?status=PENDING" \
  -H "Authorization: Bearer {admin_token}"

# Filter helpers chờ duyệt (WAITING_APPROVAL)
curl -X GET "http://localhost:8080/api/v1/admin/helpers?status=WAITING_APPROVAL" \
  -H "Authorization: Bearer {admin_token}"

# Với pagination và sort
curl -X GET "http://localhost:8080/api/v1/admin/helpers?status=PENDING&page=0&size=10&sortBy=user.fullName&sortDir=asc" \
  -H "Authorization: Bearer {admin_token}"
```

### 2. Test chi tiết helper

```bash
# Xem chi tiết helper ID 7
curl -X GET "http://localhost:8080/api/v1/admin/helpers/7" \
  -H "Authorization: Bearer {admin_token}"
```

### 3. Test thống kê

```bash
# Dashboard statistics
curl -X GET "http://localhost:8080/api/v1/admin/statistics" \
  -H "Authorization: Bearer {admin_token}"
```

### 4. Test broadcast notification

```bash
# Gửi cho tất cả helpers
curl -X POST "http://localhost:8080/api/v1/admin/notifications/broadcast" \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Thông báo cập nhật hệ thống",
    "message": "Ứng dụng HomeConnect vừa có phiên bản mới với nhiều tính năng hấp dẫn!",
    "targetRole": "HELPER"
  }'

# Gửi cho tất cả customers
curl -X POST "http://localhost:8080/api/v1/admin/notifications/broadcast" \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Ưu đãi đặc biệt",
    "message": "Giảm 20% cho lần đặt dịch vụ đầu tiên!",
    "targetRole": "CUSTOMER"
  }'

# Gửi cho tất cả users (bỏ targetRole)
curl -X POST "http://localhost:8080/api/v1/admin/notifications/broadcast" \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Thông báo bảo trì",
    "message": "Hệ thống sẽ bảo trì từ 00:00 - 02:00 ngày 05/03/2026"
  }'
```

### 5. Test review helper (từ BE-Admin-02)

```bash
# Approve helper
curl -X PATCH "http://localhost:8080/api/v1/admin/helpers/7/review" \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "VERIFIED"
  }'

# Reject helper
curl -X PATCH "http://localhost:8080/api/v1/admin/helpers/7/review" \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "REJECTED",
    "rejectionReason": "Ảnh CMND không rõ ràng, vui lòng chụp lại"
  }'
```

---

## Lưu ý quan trọng

### Sort Fields
Khi sử dụng `sortBy`, sử dụng đúng field path:

✅ **ĐÚNG:**
- `user.createdAt` - Ngày tạo tài khoản
- `user.fullName` - Tên helper
- `updatedAt` - Ngày cập nhật profile
- `kycStatus` - Trạng thái KYC

❌ **SAI:**
- `createdAt` (không tồn tại trong HelperProfile)
- `fullName` (không tồn tại trong HelperProfile)

### Pagination
- `page` bắt đầu từ 0 (page đầu tiên là 0, không phải 1)
- Default page size là 20
- Có thể tùy chỉnh size từ 1-100

### Error Handling
Tất cả APIs đều có error handling:
- **401 Unauthorized:** Thiếu hoặc sai JWT token
- **403 Forbidden:** User không phải ADMIN
- **400 Bad Request:** Tham số không hợp lệ
- **404 Not Found:** Helper không tồn tại

---

## Troubleshooting

### Lỗi: "Could not resolve attribute 'createdAt'"

**Nguyên nhân:** Sử dụng sai field name trong `sortBy`

**Giải pháp:** 
```bash
# ❌ SAI
sortBy=createdAt

# ✅ ĐÚNG
sortBy=user.createdAt
```

### Lỗi: 401 Unauthorized

**Nguyên nhân:** Token hết hạn hoặc thiếu Bearer prefix

**Giải pháp:**
```bash
# ❌ SAI
-H "Authorization: {token}"

# ✅ ĐÚNG
-H "Authorization: Bearer {token}"
```

### Lỗi: 403 Forbidden

**Nguyên nhân:** User đang login không phải ADMIN

**Giải pháp:** Đăng nhập lại bằng tài khoản admin

### Lỗi: Empty response hoặc no helpers

**Nguyên nhân:** 
- Database chưa có helper nào
- Hoặc filter status không match với data

**Kiểm tra:**
```sql
-- Kiểm tra số lượng helpers
SELECT COUNT(*) FROM users WHERE role = 'HELPER';

-- Kiểm tra phân bố KYC status
SELECT kyc_status, COUNT(*) 
FROM helper_profiles 
GROUP BY kyc_status;
```

### Broadcast notification không gửi được

**Nguyên nhân:** Email service chưa config hoặc Gmail App Password sai

**Kiểm tra:**
1. File `.env` có đúng `GMAIL_USERNAME` và `GMAIL_APP_PASSWORD`
2. Gmail App Password 16 ký tự (không có dấu cách)
3. Kiểm tra logs: `tail -f logs/spring.log`

---

## 📚 Tổng kết APIs Admin

### Tất cả endpoints:

| Method | Endpoint | Chức năng | Từ Doc |
|--------|----------|-----------|--------|
| PATCH | `/api/v1/admin/helpers/{id}/review` | Review & approve/reject helper KYC | BE-Admin-02 |
| GET | `/api/v1/admin/helpers` | Danh sách helper (filter, sort, paginate) | BE-Admin-03 |
| GET | `/api/v1/admin/helpers/{id}` | Chi tiết helper đầy đủ | BE-Admin-03 |
| GET | `/api/v1/admin/statistics` | Thống kê dashboard | BE-Admin-03 |
| POST | `/api/v1/admin/notifications/broadcast` | Gửi thông báo broadcast | BE-Admin-03 |

### Workflow Admin quản lý Helper:

1. **Xem danh sách:** `GET /helpers?status=WAITING_APPROVAL` → Lấy danh sách helpers chờ duyệt
2. **Xem chi tiết:** `GET /helpers/{id}` → Xem đầy đủ thông tin KYC, ảnh CMND, dịch vụ
3. **Review KYC:** `PATCH /helpers/{id}/review` → Approve hoặc Reject
4. **Dashboard:** `GET /statistics` → Xem tổng quan hệ thống
5. **Thông báo:** `POST /notifications/broadcast` → Gửi email tới users

---

*Documentation completed: 01/03/2026*
*Last updated: 01/03/2026 - Fixed sortBy field path issue*
