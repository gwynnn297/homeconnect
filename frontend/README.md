# HomeConnect Frontend

Frontend của hệ thống HomeConnect, xây dựng bằng React + Vite.

## Công nghệ chính

- React 19
- Vite 7
- React Router DOM
- Axios

## Yêu cầu hệ thống

- Node.js >= 18
- npm (khuyến nghị) hoặc yarn

## Cài đặt nhanh

```bash
cd frontend
npm install
```

## Cấu hình biến môi trường

1. Tạo file `.env` trong thư mục `frontend/` (hoặc copy từ `.env template`).
2. Khai báo các biến cần thiết:

```env
VITE_API_URL=http://localhost:8080
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=your_upload_preset
VITE_GOONG_JS_KEY=your_goong_js_key
VITE_GOONG_REST_API_KEY=your_goong_rest_api_key
```

### Ghi chú

- `VITE_API_URL` dùng cho toàn bộ API call ở frontend.  
  Nếu không khai báo, ứng dụng sẽ mặc định gọi `http://localhost:8080`.
- Không commit `.env` chứa key thật lên git.

## Chạy dự án ở môi trường dev

```bash
npm run dev
```

Mặc định app chạy tại: `http://localhost:5173`

## Build và preview

```bash
npm run build
npm run preview
```

- Thư mục build output: `dist/`

## Scripts

- `npm run dev`: chạy local development server
- `npm run build`: build production
- `npm run preview`: chạy thử bản build local
- `npm run lint`: kiểm tra lint

## Troubleshooting

- **Lỗi khi `npm install`:** xóa `node_modules` và `package-lock.json`, sau đó cài lại.
- **Port 5173 bị chiếm:** Vite sẽ tự chuyển sang port khác.
- **Lỗi thiếu module:** chạy lại `npm install`.