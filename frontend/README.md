# HomeConnect - Frontend

Ứng dụng React + Vite cho HomeConnect Core API.

## Yêu Cầu Hệ Thống

- Node.js (v18.0.0 trở lên)
- npm hoặc yarn

## Cài Đặt

### 1. Clone Repository và vào thư mục frontend

```bash
git clone <repository-url>
cd homeconnect/frontend
```

### 2. Cài đặt Dependencies

```bash
npm install
```

Hoặc nếu dùng yarn:

```bash
yarn install
```

## Chạy Dự Án

### Development Server

```bash
npm run dev
```

Hoặc với yarn:

```bash
yarn dev
```

Frontend sẽ chạy tại **http://localhost:5173**

## Build cho Production

```bash
npm run build
```

Hoặc với yarn:

```bash
yarn build
```

Build output sẽ được tạo tại `dist/`

## Các Lệnh Khác

### Kiểm tra Lint (ESLint)

```bash
npm run lint
```

### Preview Build (xem production build cục bộ)

```bash
npm run preview
```

## Troubleshooting

- **Lỗi khi npm install:** Xóa `node_modules` và `package-lock.json`, rồi chạy lại `npm install`
- **Port 5173 đã được sử dụng:** Vite sẽ tự động sử dụng port khác
- **Module không tìm thấy:** Chạy `npm install` lại và xóa cache với `npm cache clean --force`
