# Wallet Module Implementation Report

## Tổng quan
Module Wallet đã được triển khai hoàn chỉnh cho hệ thống HomeConnect, bao gồm tất cả các tính năng từ BE-Wallet-01 đến BE-Wallet-06.

## ✅ Tasks đã hoàn thành

### 1. BE-Wallet-01: Khởi tạo ví tự động
**Chức năng**: Khi user đăng ký tài khoản thành công, hệ thống tự động tạo ví với số dư ban đầu = 0.

**File đã chỉnh sửa**:
- `AuthService.java`: Thêm logic tạo ví trong method `registerVerify()`

**Logic**:
```java
// Sau khi user verify OTP và activate account
User savedUser = userRepository.save(user);
walletService.createWalletForUser(savedUser); // Tự động tạo ví
```

---

### 2. BE-Wallet-02: API Lấy thông tin ví
**Endpoint**: `GET /api/v1/wallets/me`

**Chức năng**: User xem số dư khả dụng, số tiền đang giữ, trạng thái ví.

**Response**:
```json
{
  "walletId": 1,
  "userId": 123,
  "availableBalance": 500000.00,
  "holdBalance": 100000.00,
  "debtBalance": 0.00,
  "isFrozen": false
}
```

**Frontend sử dụng**: Polling API này sau khi hiển thị QR code để check xem tiền đã vào chưa.

---

### 3. BE-Wallet-03: API Lấy lịch sử giao dịch
**Endpoint**: `GET /api/v1/wallets/transactions?page=0&size=20`

**Chức năng**: Xem lịch sử nạp tiền, giữ tiền, thanh toán (có phân trang).

**Response**:
```json
{
  "transactions": [
    {
      "transactionId": 1,
      "amount": 100000.00,
      "type": "DEPOSIT",
      "referenceType": "WEBHOOK",
      "referenceId": 45678,
      "description": "Nạp tiền qua TXN-123456",
      "createdAt": "2026-03-04T10:30:00"
    }
  ],
  "currentPage": 0,
  "totalPages": 5,
  "totalElements": 95
}
```

---

### 4. BE-Wallet-04: Sinh URL VietQR
**Endpoint**: `POST /api/v1/wallets/generate-qr`

**Request**:
```json
{
  "amount": 100000
}
```

**Response**:
```json
{
  "qrCodeUrl": "https://img.vietqr.io/image/MB-0123456789-compact.png?amount=100000&addInfo=HOMIE123&accountName=NGUYEN%20VAN%20A",
  "bankCode": "MB",
  "accountNumber": "0123456789",
  "amount": 100000,
  "transferContent": "HOMIE123"
}
```

**Logic**:
- Nội dung chuyển khoản: `HOMIE{userId}` (VD: HOMIE123)
- Frontend hiển thị ảnh QR từ URL này
- User scan QR và chuyển khoản
- Webhook sẽ tự động cộng tiền khi nhận được thông báo từ ngân hàng

**Cấu hình** (trong `application.properties`):
```properties
wallet.bank.code=MB
wallet.bank.account=0123456789
wallet.bank.name=NGUYEN VAN A
```

---

### 5. BE-Wallet-05: API Webhook nhận deposit
**Endpoint**: `POST /api/v1/wallets/webhook` (PUBLIC - Không cần authentication)

**Request** (từ PayOS/Casso):
```json
{
  "transactionId": "TXN-123456",
  "amount": 100000,
  "description": "HOMIE123 NAP TIEN",
  "status": "SUCCESS",
  "signature": "...",
  "timestamp": 1709530000
}
```

**Logic xử lý**:
1. ✅ **Validate signature**
2. ✅ **Chỉ xử lý transaction SUCCESS**
3. ✅ **Parse userId từ description** bằng Regex: `HOMIE(\d+)`
4. ✅ **Idempotency check**: Kiểm tra `referenceId` đã tồn tại chưa (chống duplicate)
5. ✅ **Cộng tiền**: `availableBalance += amount`
6. ✅ **Lưu lịch sử giao dịch** với type = DEPOSIT, referenceType = WEBHOOK
7. ✅ **Response 200 OK** để webhook provider không retry

**Đặc điểm**:
- **@Transactional**: Đảm bảo tính toàn vẹn dữ liệu
- **Idempotent**: Giao dịch trùng sẽ bị bỏ qua (không cộng 2 lần)
- **Regex parsing**: Linh hoạt xử lý description "HOMIE123" hoặc "HOMIE123 NAP TIEN"

---

### 6. BE-Wallet-06: Internal Service - holdMoney()
**Function**: `public void holdMoney(Long userId, BigDecimal amount, Long jobPostId)`

**Chức năng**: Giữ tiền khi User đăng tin hoặc đặt booking (KHÔNG PHẢI API PUBLIC).

**Logic xử lý**:
```java
@Transactional
public void holdMoney(Long userId, BigDecimal amount, Long jobPostId) {
    // 1. Lock row với Pessimistic Write
    Wallet wallet = walletRepository.findByUserIdWithLock(userId);
    
    // 2. Validate số dư
    if (wallet.getAvailableBalance() < amount) {
        throw new InsufficientBalanceException("Số dư không đủ");
    }
    
    // 3. Trừ available, cộng hold
    wallet.setAvailableBalance(wallet.getAvailableBalance() - amount);
    wallet.setHoldBalance(wallet.getHoldBalance() + amount);
    
    // 4. Lưu lịch sử type=HOLD, referenceType=JOB_POST
}
```

**Đặc điểm kỹ thuật**:
- ✅ **Pessimistic Write Lock**: `SELECT ... FOR UPDATE` để tránh race condition
- ✅ **@Transactional**: Đảm bảo ACID
- ✅ **BigDecimal**: Tránh lỗi sai số thập phân với Float/Double
- ✅ **InsufficientBalanceException**: Custom exception khi số dư không đủ

**Sử dụng**: Gọi từ `JobPostService` khi tạo tin đăng việc.

---

## 📦 Files đã tạo mới

### Entities & Enums
- ✅ `WalletTransaction.java` - Entity lưu lịch sử giao dịch
- ✅ `TransactionType.java` - Enum (DEPOSIT, WITHDRAW, PAYMENT, REFUND, HOLD, RELEASE)
- ✅ `ReferenceType.java` - Enum (JOB_POST, BOOKING, DEPOSIT, WEBHOOK)
- ✅ `InsufficientBalanceException.java` - Custom exception

### Repositories
- ✅ `WalletTransactionRepository.java` - JPA Repository cho wallet_transactions
- ✅ `WalletRepository.java` - Thêm method `findByUserIdWithLock()` với @Lock

### DTOs
**Request DTOs**:
- ✅ `GenerateQRRequest.java` - Request sinh QR code
- ✅ `WebhookDepositRequest.java` - Request từ webhook

**Response DTOs**:
- ✅ `WalletInfoResponse.java` - Response thông tin ví
- ✅ `WalletTransactionResponse.java` - Response 1 giao dịch
- ✅ `WalletTransactionListResponse.java` - Response danh sách giao dịch (có phân trang)
- ✅ `VietQRResponse.java` - Response URL VietQR

### Services & Controllers
- ✅ `WalletService.java` - ✨ Mở rộng với 6 phương thức mới
- ✅ `WalletController.java` - Expose 4 API endpoints

### Configuration
- ✅ `application.properties` - Thêm config cho wallet bank info

---

## 📊 Database Schema

### Bảng `wallets` (Đã có sẵn)
```sql
CREATE TABLE wallets (
    wallet_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    available_balance DECIMAL(15,2) DEFAULT 0.00,
    hold_balance DECIMAL(15,2) DEFAULT 0.00,
    debt_balance DECIMAL(15,2) DEFAULT 0.00,
    is_frozen BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Bảng `wallet_transactions` (Đã có sẵn)
```sql
CREATE TABLE wallet_transactions (
    transaction_id INT AUTO_INCREMENT PRIMARY KEY,
    wallet_id INT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    type VARCHAR(20) NOT NULL,
    reference_type VARCHAR(50) NOT NULL,
    reference_id INT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (wallet_id) REFERENCES wallets(wallet_id)
);
```

---

## 🔐 Security & Best Practices

### 1. BigDecimal cho tiền tệ ✅
```java
private BigDecimal availableBalance; // ✅ Chính xác
private Float balance; // ❌ SAI - Bị lỗi sai số
```

### 2. Pessimistic Lock cho hold money ✅
```java
@Lock(LockModeType.PESSIMISTIC_WRITE)
Optional<Wallet> findByUserIdWithLock(Long userId);
```

### 3. @Transactional cho consistency ✅
```java
@Transactional
public void processWebhookDeposit(...) { ... }
```

### 4. Idempotency cho webhook ✅
```java
if (transactionRepository.findByReferenceId(id).isPresent()) {
    return; // Đã xử lý, bỏ qua
}
```

---

## 🧪 Testing Checklist

### Manual Testing
- [ ] User đăng ký → Ví được tạo tự động
- [ ] GET /wallets/me → Trả về thông tin ví
- [ ] POST /wallets/generate-qr → Nhận URL QR code
- [ ] Scan QR và chuyển khoản → Webhook nhận được → Tiền vào ví
- [ ] GET /wallets/transactions → Xem lịch sử
- [ ] Call holdMoney() → available giảm, hold tăng

### Integration Testing
- [ ] Webhook với description "HOMIE123" → Parse đúng userId
- [ ] Webhook duplicate → Không cộng tiền 2 lần
- [ ] holdMoney() khi không đủ tiền → Throw InsufficientBalanceException
- [ ] holdMoney() concurrent → Lock hoạt động đúng

---

## 📡 Ngrok Setup (Dev Environment)

Để test webhook ở localhost:
```bash
# 1. Tải Ngrok: https://ngrok.com/download
# 2. Chạy backend ở port 8080
# 3. Start ngrok
ngrok http 8080

# 4. Copy URL https://xxxx.ngrok.io
# 5. Cấu hình webhook URL trên PayOS/Casso:
#    https://xxxx.ngrok.io/api/v1/wallets/webhook
```

---

## 🚀 API Endpoints Summary

| Endpoint | Method | Auth | Chức năng |
|----------|--------|------|-----------|
| `/api/v1/wallets/me` | GET | ✅ | Lấy thông tin ví |
| `/api/v1/wallets/transactions` | GET | ✅ | Lịch sử giao dịch |
| `/api/v1/wallets/generate-qr` | POST | ✅ | Sinh mã VietQR |
| `/api/v1/wallets/webhook` | POST | ❌ | Nhận webhook deposit |

---

## 📝 Notes cho Frontend Team

### 1. Luồng nạp tiền
```javascript
// 1. User nhập số tiền
const amount = 100000;

// 2. Gọi API sinh QR
const qrResponse = await fetch('/api/v1/wallets/generate-qr', {
  method: 'POST',
  body: JSON.stringify({ amount })
});

// 3. Hiển thị QR code
<img src={qrResponse.qrCodeUrl} />

// 4. Polling để check tiền đã vào chưa (mỗi 3 giây)
setInterval(async () => {
  const wallet = await fetch('/api/v1/wallets/me');
  if (wallet.availableBalance > oldBalance) {
    alert('Nạp tiền thành công!');
  }
}, 3000);
```

### 2. Lưu ý Transfer Content
- User PHẢI chuyển khoản với đúng nội dung: `HOMIE{userId}`
- VD: User ID = 123 → Nội dung CK: `HOMIE123`
- Hệ thống tự động parse userId từ description webhook

---

## ✨ Hoàn thành
Module Wallet đã sẵn sàng tích hợp với:
- ✅ Payment Gateway (PayOS/Casso)
- ✅ JobPost Service (gọi holdMoney khi đăng tin)
- ✅ Booking Service (gọi holdMoney khi đặt việc)
- ✅ Frontend (hiển thị ví, lịch sử, nạp tiền)

**Build Status**: ✅ BUILD SUCCESSFUL

---

*Tài liệu này được tạo bởi GitHub Copilot - 4/3/2026*
