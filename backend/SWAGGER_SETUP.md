# 🔧 Hướng Dẫn Fix Lỗi Swagger

## Vấn đề: IDE không nhận ra import `io.swagger`

### Giải pháp:

#### 1. Sync Gradle trong IDE (VS Code / IntelliJ)

**VS Code:**
- Mở Command Palette (`Ctrl+Shift+P`)
- Chọn: `Java: Clean Java Language Server Workspace`
- Chọn: `Java: Reload Projects`

**IntelliJ IDEA:**
- Click chuột phải vào `build.gradle.kts`
- Chọn: `Reload Gradle Project`
- Hoặc: `File` → `Invalidate Caches / Restart`

#### 2. Rebuild Project

```bash
cd homeconnect/backend
./gradlew clean build -x test
```

#### 3. Kiểm tra Dependencies

Đảm bảo dependency đã được thêm:
```kotlin
implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:2.6.0")
```

#### 4. Nếu vẫn lỗi, tạm thời comment OpenApiConfig

Nếu IDE vẫn không nhận ra imports, bạn có thể:
1. Tạm thời comment `@Configuration` trong `OpenApiConfig.java`
2. Swagger vẫn sẽ hoạt động với cấu hình mặc định
3. Sau khi IDE sync xong, uncomment lại

#### 5. Truy cập Swagger UI

Sau khi build và chạy ứng dụng:
- **Swagger UI**: http://localhost:8080/swagger-ui/index.html
- **OpenAPI JSON**: http://localhost:8080/v3/api-docs

---

## Lưu ý

- Build đã thành công (chỉ test fail vì thiếu DB)
- Dependencies đã được tải về
- Chỉ cần IDE sync lại là xong

