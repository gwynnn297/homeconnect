# 🏠 HomeConnect Backend API

## 🚀 Setup Environment

### 1. Clone Repository
```bash
git clone [repository-url]
cd homeconnect/backend
```

### 2. Database Setup
Bạn cần MySQL và tạo database:
```sql
CREATE DATABASE homeconnect CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3. Environment Variables
Copy và cấu hình file `.env`:
```bash
cp .env.template .env
```

Sửa file `.env` với thông tin database của bạn:
```env
# Database Configuration
MYSQL_HOST=localhost
MYSQL_PORT=3306
DB_NAME=homeconnect
DB_USERNAME=your_username
DB_PASSWORD=your_password
```

### 4. Run Application
```bash
./gradlew bootRun
```

Application sẽ chạy trên: http://localhost:8080/api

## 📋 Tech Stack

- **Spring Boot 4.0.2** - Framework chính
- **MySQL 9.1** - Database 
- **Flyway** - Database migration
- **JPA/Hibernate** - ORM
- **Spring Security** - Authentication/Authorization
- **Lombok** - Code generation

## 🗄️ Database Schema

Application tự động tạo 7 tables khi start:
- `users` - Thông tin người dùng cơ bản
- `wallets` - Ví tiền người dùng  
- `locations` - Địa điểm (Tỉnh/Quận/Huyện)
- `services` - Danh mục dịch vụ
- `helper_profiles` - Hồ sơ Helper
- `helper_working_districts` - Khu vực làm việc Helper
- `helper_services` - Dịch vụ Helper đăng ký

## 🔐 Security Note

- File `.env` chứa thông tin nhạy cảm **KHÔNG được commit lên git**
- Mỗi developer cần tự tạo file `.env` với database credentials của mình