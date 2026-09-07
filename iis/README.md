# Hướng Dẫn Cấu Hình IIS Reverse Proxy Cho QCET E-Office

Tài liệu hướng dẫn quản trị viên hệ thống triển khai cổng Reverse Proxy trên IIS (Internet Information Services) 10.0+ (Windows Server 2019 / 2022) chuyển tiếp lưu lượng an toàn vào cụm Docker container Next.js (`127.0.0.1:3000`).

---

## 1. Yêu Cầu Tiền Đề (Prerequisites)

1. **Hệ điều hành**: Windows Server 2019 hoặc Windows Server 2022 với vai trò Web Server (IIS 10.0+) đã được cài đặt.
2. **IIS URL Rewrite Module 2.1**: Tải và cài đặt từ Microsoft Web Platform Installer hoặc trang chủ Microsoft.
3. **Application Request Routing (ARR) 3.0**: Tải và cài đặt ARR 3.0 trên IIS.
4. **Chứng chỉ số SSL**: Chứng chỉ hợp lệ cấp cho tên miền `e-office.cdktcnqn.edu.vn` (đã import vào *Server Certificates* trong IIS Manager).
5. **Docker Engine & Docker Compose**: Cụm ứng dụng QCET E-Office đang chạy với container lắng nghe tại cổng nội bộ `127.0.0.1:3000`.

---

## 2. Các Bước Cấu Hình Từng Bước Trên IIS Manager

### Bước 1: Bật tính năng Reverse Proxy trong ARR (Application Request Routing)
1. Mở **IIS Manager** (`inetmgr.exe`).
2. Ở cây điều hướng bên trái, chọn nút **Server gốc** (tên máy chủ).
3. Trong khung hiển thị tính năng, tìm và nhấp đúp vào biểu tượng **Application Request Routing**.
4. Ở cột **Actions** bên phải, nhấp vào liên kết **Server Proxy Settings...**.
5. Đánh dấu tích chọn vào ô checkbox **Enable proxy**.
6. Giữ nguyên các thiết lập cổng mặc định (HTTP port 80, HTTPS port 443).
7. Nhấp **Apply** ở cột Actions bên phải để áp dụng.

### Bước 2: Tối ưu hóa Buffer Streaming & Host Header trong Configuration Editor
Để đảm bảo xem trước và truyền phát (streaming) tệp PDF văn bản NĐ30 mượt mà, không bị IIS giữ đệm (buffering), cần cấu hình tham số proxy cấp Server:
1. Tại nút **Server gốc**, mở tính năng **Configuration Editor** (trong nhóm *Management*).
2. Tại mục thả xuống **Section**, chọn đường dẫn:
   `system.webServer/proxy`
3. Tìm và thiết lập 2 tham số quan trọng:
   - `preserveHostHeader`: Chuyển thành `True` (giúp container nhận biết đúng tên miền gốc).
   - `responseBufferLimit`: Đặt giá trị bằng `0` (vô hiệu hóa buffer phản hồi, truyền stream trực tiếp cho tệp PDF lớn).
4. Nhấp **Apply** ở cột Actions bên phải để lưu lại.

### Bước 3: Thêm Biến Máy Chủ Được Phép (Allowed Server Variables)
Quy tắc URL Rewrite trong `web.config` sử dụng 2 server variables để chuyển tiếp IP và giao thức gốc tới Next.js. Cần khai báo các biến này trong danh sách cho phép:
1. Tại nút **Server gốc** (hoặc tại site `QCET-EOffice`), mở tính năng **URL Rewrite**.
2. Ở cột **Actions** bên phải, nhấp vào liên kết **View Server Variables...**.
3. Ở cột Actions, nhấp **Add...** và thêm lần lượt 2 biến sau:
   - `HTTP_X_FORWARDED_PROTO`
   - `HTTP_X_FORWARDED_FOR`
4. Nhấp **Back to Rules** ở cột Actions để quay lại giao diện danh sách luật.

### Bước 4: Tạo Website và Liên Kết Chứng Chỉ SSL
1. Trong IIS Manager, mở rộng nhánh **Sites**, nhấp chuột phải chọn **Add Website...**.
2. Thiết lập thông số:
   - **Site name**: `QCET-EOffice`
   - **Application pool**: `DefaultAppPool` (hoặc tạo một Pool riêng với .NET CLR version: *No Managed Code*).
   - **Physical path**: Trỏ tới thư mục chứa tệp `web.config` này (ví dụ: `C:\inetpub\wwwroot\qcet-gateway` hoặc thư mục triển khai gateway).
3. **Cấu hình Bindings**:
   - Thêm binding HTTP:
     - Type: `http`
     - Port: `80`
     - Host name: `e-office.cdktcnqn.edu.vn`
   - Thêm binding HTTPS:
     - Type: `https`
     - Port: `443`
     - Host name: `e-office.cdktcnqn.edu.vn`
     - SSL Certificate: Chọn chứng chỉ SSL đã import trước đó.
4. Nhấp **OK** để khởi tạo Website.

---

## 3. Chi Tiết Cấu Hình Trong `web.config`

Tệp `iis/web.config` được chuẩn hóa với các thông số:
- **Giới hạn kích thước tệp đính kèm**:
  - `requestLimits maxAllowedContentLength="104857600"` (100MB cho văn bản NĐ30 & tài liệu lưu trữ).
  - `httpRuntime maxRequestLength="102400"` (100MB trong ASP.NET pipeline) và `executionTimeout="300"` (5 phút).
- **Chuyển hướng lỗi**:
  - `httpErrors existingResponse="PassThrough"`: Đảm bảo IIS không can thiệp hoặc thay thế các phản hồi lỗi chi tiết từ Next.js App.
- **URL Rewrite & Proxy**:
  - Quy tắc `Redirect to HTTPS`: Chuyển hướng mã 301 Permanent toàn bộ truy vấn HTTP sang HTTPS.
  - Quy tắc `ReverseProxyToNextjs`: Chuyển tiếp toàn bộ truy vấn tới `http://127.0.0.1:3000/{R:1}` kèm query string và header `X-Forwarded-Proto`, `X-Forwarded-For`.
- **Tiêu đề bảo mật HTTP (Security Headers)**:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`

---

## 4. Kiểm Tra Và Xác Nhận (Verification)

Sau khi hoàn tất cấu hình:
1. Mở trình duyệt truy cập: `http://e-office.cdktcnqn.edu.vn` -> Kiểm tra tự động chuyển hướng sang `https://e-office.cdktcnqn.edu.vn`.
2. Kiểm tra biểu tượng khóa bảo mật SSL hiển thị an toàn trên thanh địa chỉ.
3. Đăng nhập hệ thống và thử nghiệm tải lên/xem trước văn bản PDF có dung lượng lớn (> 20MB) để xác nhận giới hạn tải lên và tính năng streaming hoạt động trơn tru.
