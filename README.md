# QCET E-Office - Hệ Thống Quản Lý Điều Hành Điện Tử

**Đơn vị chủ quản:** Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET)  
**Địa chỉ:** 172 An Dương Vương, TP. Quy Nhơn, Tỉnh Bình Định  
**Tên miền hệ thống:** `e-office.cdktcnqn.edu.vn`  
**Công nghệ nền tảng:** Next.js 15 (App Router, Standalone), React 19, Tailwind CSS v4, Prisma ORM, PostgreSQL 16, Docker, IIS 10.0+ ARR

---

## 1. Giới Thiệu

QCET E-Office là nền tảng quản lý điều hành điện tử và tác nghiệp nội bộ phục vụ toàn thể Ban Giám hiệu, lãnh đạo các Phòng/Khoa/Trung tâm, cùng đội ngũ giảng viên và chuyên viên tại Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn.

Hệ thống được thiết kế hướng tới tính bảo mật, hiệu năng cao, khả năng tự vận hành tại chỗ (On-Premise) trên hạ tầng máy chủ của Trường, bảo đảm tuân thủ nghiêm ngặt các quy định pháp luật hiện hành của Nhà nước về quản lý văn bản, an toàn thông tin và quy chuẩn giáo dục nghề nghiệp.

---

## 2. Tính Năng Nổi Bật

### 2.1. Phân công nhiệm vụ & Điều phối 3 cấp theo phương pháp DACUM
- Mô hình phân cấp thẩm quyền 3 cấp rõ ràng:
  1. **Ban Giám hiệu:** Giám sát tổng quan tiến độ các đơn vị, giao nhiệm vụ chiến lược, xử lý tờ trình và phê duyệt văn bản.
  2. **Trưởng phòng / Khoa / Trung tâm:** Nhận chỉ đạo, phân rã nhiệm vụ chi tiết thành các đầu việc chuyên môn, phân công cho nhân sự trực thuộc, giám sát chất lượng và thời hạn hoàn thành.
  3. **Chuyên viên / Giảng viên:** Tiếp nhận nhiệm vụ, cập nhật tiến độ theo thời gian thực, báo cáo kết quả và tải lên minh chứng công việc.
- Đồng bộ chu kỳ năm học và tháng điều hành đặc thù (chu kỳ từ ngày 25 tháng trước đến ngày 24 tháng sau) bảo đảm tính chính xác trong đánh giá KPI và tổng kết công tác.

### 2.2. Quản lý sổ đăng ký văn bản theo Nghị định 30/2020/NĐ-CP
- Quản lý tập trung toàn diện sổ văn bản đến, văn bản đi, và văn bản nội bộ.
- Số hóa hồ sơ công văn theo đúng thể thức, kỹ thuật trình bày, số hiệu, ngày ban hành và cấp độ khẩn/mật theo chuẩn Nghị định 30/2020/NĐ-CP của Chính phủ.
- Tự động hóa luồng luân chuyển, xin ý kiến lãnh đạo, bút phê điện tử và theo dõi quá trình xử lý văn bản.

### 2.3. Phục vụ tệp văn bản lớn 100MB với HTTP 206 Byte-Range Streaming & Bảo Mật
- Hệ thống tệp tĩnh chuyên dụng qua route `/api/files/[...path]` cho phép truyền phát (streaming) tệp PDF và minh chứng dung lượng lên tới 100MB.
- Hỗ trợ đầy đủ chuẩn HTTP 206 Partial Content (Byte-Range requests), giúp trình duyệt và trình đọc PDF (PDF.js) tải tức thì các trang cần hiển thị mà không phải nạp toàn bộ tệp vào bộ nhớ.
- Cơ chế bảo vệ đường dẫn (Path Traversal Protection) ngăn chặn tuyệt đối các kỹ thuật tấn công dạng `../` vượt ngoài vùng thư mục lưu trữ được chỉ định.
- Tích hợp kiểm tra mã băm SHA-256 để kiểm toán tính toàn vẹn của tệp tài liệu lưu trữ.

### 2.4. Endpoint giám sát sức khỏe hệ thống `/api/health`
- Cung cấp API giám sát độ sẵn sàng và hiệu năng phục vụ tích hợp với IIS ARR, Prometheus, Uptime Robot hoặc các công cụ giám sát mạng nội bộ.
- Kiểm tra trực tiếp trạng thái kết nối cơ sở dữ liệu PostgreSQL thông qua truy vấn `SELECT 1`.
- Báo cáo chi tiết dung lượng bộ nhớ Node.js process (RSS, Heap), thời gian máy chủ đã chạy (uptime), múi giờ chuẩn hóa và thông tin phiên bản.

---

## 3. Phát Triển Cục Bộ (Local Development)

### 3.1. Yêu cầu môi trường
- **Node.js**: Phiên bản 20.x LTS trở lên
- **npm**: Phiên bản 10.x trở lên
- **PostgreSQL**: Phiên bản 16.x (chạy cục bộ hoặc qua container Docker)

### 3.2. Cài đặt và khởi chạy
```bash
# 1. Cài đặt các gói phụ thuộc
npm install

# 2. Khởi tạo Prisma Client
npx prisma generate

# 3. Chạy môi trường phát triển (khuyến nghị cổng 3001)
npm run dev -- -p 3001
```

Truy cập ứng dụng tại địa chỉ: `http://localhost:3001`

### 3.3. Kiểm thử và kiểm tra chất lượng mã nguồn
```bash
# Kiểm tra tĩnh kiểu dữ liệu TypeScript (0 lỗi)
npm run typecheck

# Chạy toàn bộ bộ kiểm thử tự động (Unit & Integration tests)
npm test
```

---

## 4. Triển Khai Môi Trường Sản Xuất On-Premise (Windows Server + Docker + IIS)

### 4.1. Kiến trúc tổng thể hạ tầng

Hệ thống được thiết kế theo mô hình 3 tầng phân tách rõ ràng trên máy chủ vật lý Windows Server 2019 / 2022 của Trường:

```
[Client / Trình duyệt]
        │
        ▼ (HTTPS 443 / SSL Certificate *.cdktcnqn.edu.vn)
┌──────────────────────────────────────────────────────────────┐
│  TẦNG 1: IIS 10.0+ (Reverse Proxy & SSL Offloading)          │
│  - URL Rewrite 2.1 & Application Request Routing (ARR 3.0)   │
│  - maxAllowedContentLength = 104857600 (100MB)               │
│  - responseBufferLimit = 0 (Next.js Streaming)               │
│  - Chuyển tiếp lưu lượng n��i bộ -> http://127.0.0.1:3000     │
└──────────────────────────────┬───────────────────────────────┘
                               │ (HTTP 127.0.0.1:3000)
┌──────────────────────────────▼───────────────────────────────┐
│  TẦNG 2: DOCKER COMPOSE RUNTIME (WSL2 / Engine)              │
│  - qcet-app (Next.js 15 Standalone, non-root user)           │
│  - qcet-db (PostgreSQL 16 Alpine, Docker Named Volume)       │
│  - Mount thư mục tĩnh: D:\QCET-Eoffice-Data\uploads         │
└──────────────────────────────┬───────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────┐
│  TẦNG 3: VẬN HÀNH & SAO LƯU (PowerShell & Task Scheduler)    │
│  - D:\QCET-Eoffice-Data\backups                              │
│  - QCET_EOffice_AutoBoot: Tự khởi động Docker khi boot server│
│  - QCET_EOffice_DailyBackup: Sao lưu tự động 01:00 AM hàng ngày│
└──────────────────────────────────────────────────────────────┘
```

### 4.2. Chuẩn bị biến môi trường sản xuất
Tạo tệp cấu hình `.env.production` từ mẫu có sẵn:
```bash
cp .env.production.example .env.production
```

Cập nhật các biến nhạy cảm trong `.env.production`:
- `POSTGRES_PASSWORD`: Đặt mật khẩu quản trị CSDL mạnh.
- `DATABASE_URL`: Cập nhật mật khẩu tương ứng theo chuỗi kết nối:
  `postgresql://qcet_admin:<MAT_KHAU_MANH>@qcet-db:5432/qcet_eoffice?schema=public`
- `JWT_SECRET`: Khởi tạo khóa bảo mật phiên làm việc ngẫu nhiên:
  ```bash
  openssl rand -base64 48
  ```
- `NEXTAUTH_URL` và `NEXT_PUBLIC_APP_URL`: Đặt thành `https://e-office.cdktcnqn.edu.vn`.
- `UPLOADS_HOST_PATH`: `D:/QCET-Eoffice-Data/uploads`.

### 4.3. Khởi động ứng dụng với Docker Compose
```bash
# Khởi động dịch vụ ở chế độ chạy ngầm (detached) và tái biên dịch image
docker compose up -d --build

# Kiểm tra trạng thái hoạt động của các container
docker compose ps

# Xem nhật ký thực thi di chuyển dữ liệu (Prisma migration) và khởi động
docker compose logs -f qcet-app
```

Entrypoint `docker-entrypoint.sh` sẽ tự động thực hiện lệnh `npx prisma migrate deploy` trước khi chạy máy chủ `node server.js`.

### 4.4. Cấu hình Cổng IIS Reverse Proxy Gateway
1. Đảm bảo máy chủ Windows Server đã cài đặt **IIS 10.0+**, **URL Rewrite 2.1** và **ARR 3.0**.
2. Bật Proxy trong ARR:
   - Mở *IIS Manager* -> Nhấp vào tên Server gốc -> Mở *Application Request Routing*.
   - Nhấp vào *Server Proxy Settings...* -> Đánh dấu chọn **Enable proxy** -> Chọn *Apply*.
3. Cấu hình Configuration Editor cấp Server:
   - Mở *Configuration Editor* tại Server gốc -> Chọn Section `system.webServer/proxy`.
   - Đặt `preserveHostHeader` = `True`.
   - Đặt `responseBufferLimit` = `0`.
   - Chọn *Apply*.
4. Thêm Server Variables:
   - Mở *URL Rewrite* tại Server gốc -> Chọn *View Server Variables...*.
   - Thêm lần lượt 2 biến: `HTTP_X_FORWARDED_PROTO` và `HTTP_X_FORWARDED_FOR`.
5. Tạo Website trên IIS:
   - Tạo Site mới mang tên `QCET-EOffice`.
   - Đặt **Physical path** trỏ trực tiếp vào thư mục `iis/` của dự án (nơi chứa sẵn tệp `iis/web.config`).
   - Gắn kết (Bindings):
     - HTTP (Port 80): Host name `e-office.cdktcnqn.edu.vn`.
     - HTTPS (Port 443): Host name `e-office.cdktcnqn.edu.vn`, chọn chứng chỉ SSL chính thức của trường.

Chi tiết các bước vui lòng tham khảo thêm tại tệp `iis/README.md`.

### 4.5. Thi���t lập Tự động hóa Vận hành & Sao lưu Dự phòng

Toàn bộ các tác vụ tự động hóa được xây dựng bằng PowerShell và tích hợp trực tiếp vào Windows Task Scheduler.

#### Đăng ký tác vụ hệ thống tự động:
Mở PowerShell với quyền Administrator và chạy lệnh:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\register-windows-tasks.ps1 -AppDir "C:\QCET\QCET Work"
```
Lệnh trên sẽ tự động khởi tạo 2 tác vụ:
1. `QCET_EOffice_AutoBoot`: Chạy ngầm khi máy chủ khởi động lại (độ trễ 1 phút) để tự động gọi `docker compose up -d`, bảo đảm hệ thống online sau sự cố điện mà không cần đăng nhập thủ công.
2. `QCET_EOffice_DailyBackup`: Định kỳ chạy lúc 01:00 AM mỗi ngày, tự động sao lưu CSDL PostgreSQL dưới dạng nhị phân (`pg_dump -F c`), nén thư mục tài liệu `uploads` thành tệp `.zip`, ghi nhật ký và tự động xóa các bản sao lưu cũ quá 30 ngày.

#### Kịch bản Phục hồi Thảm họa (Disaster Recovery):
Khi xảy ra sự cố hỏng hóc hoặc cần phục hồi dữ liệu về thời điểm sao lưu trước đó, chạy kịch bản phục hồi 1-chạm:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\restore-disaster.ps1 `
  -DbDumpPath "D:\QCET-Eoffice-Data\backups\qcet_db_YYYY-MM-DD_HHmmss.dump" `
  -UploadsZipPath "D:\QCET-Eoffice-Data\backups\qcet_uploads_YYYY-MM-DD_HHmmss.zip"
```

---

## 5. Lưu Ý Vận Hành & Quy Chuẩn Kỹ Thuật (Engineering Rules)

### 5.1. Phòng tránh xung đột NTFS WSL2 (WSL2 NTFS Trap)
- **Cơ sở dữ liệu PostgreSQL:** Bắt buộc phải lưu trữ trên **Docker Named Volume** (`qcet_postgres_data`), được quản lý bên trong hệ thống tệp ext4 của WSL2. Tuyệt đối không gắn kết (bind-mount) thư mục dữ liệu PostgreSQL trực tiếp vào ổ đĩa NTFS của Windows Server (như `D:\...`), do cơ chế đồng bộ và khóa tệp của Windows NTFS sẽ gây crash và corrupt dữ liệu PostgreSQL khi có truy vấn đồng thời.
- **Tệp đính kèm người dùng:** Thư mục lưu trữ tệp đính kèm văn bản và minh chứng (`D:\QCET-Eoffice-Data\uploads`) được bind-mount trực tiếp từ ổ đĩa máy chủ vào container `/app/uploads` để dễ dàng sao lưu, giám sát dung lượng và bảo đảm an toàn dữ liệu vật lý.

### 5.2. Quy tắc Build & Tránh xung đột Cache Dev (Critical)
- Trong quá trình bảo trì và phát triển trên máy chủ:
  - Khi máy chủ dev đang chạy (`npm run dev`), **tuyệt đối không chạy lệnh `npm run build`** (`next build`). Lệnh build sẽ xóa và ghi đè thư mục `.next/`, làm mất các chunks động của dev server dẫn đến hiện tượng giao diện bị mất định dạng CSS (unstyled HTML 404).
  - Để kiểm tra mã nguồn, luôn sử dụng:
    ```bash
    npm run typecheck
    npm test
    ```
  - Nếu gặp hiện tượng giao diện bị mất định dạng do xung đột cache, thực hiện quy trình phục hồi:
    ```bash
    kill -9 $(lsof -ti:3001) 2>/dev/null || true
    rm -rf .next
    npm run dev -- -p 3001
    ```
    Sau đó tải lại trình duyệt với tổ hợp phím `Ctrl + Shift + R`.

---

## 6. Liên Hệ Hỗ Trợ Kỹ Thuật

- **Đơn vị phát triển & vận hành:** Đội ngũ Kỹ thuật Hệ thống & Quản trị Mạng QCET
- **Email quản trị:** `quantrimang@cdktcnqn.edu.vn`
- **Địa chỉ:** Số 172 An Dương Vương, Phường Nguyễn Văn Cừ, TP. Quy Nhơn, Tỉnh Bình Định
