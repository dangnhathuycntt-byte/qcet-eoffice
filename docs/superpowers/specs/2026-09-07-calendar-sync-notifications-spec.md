# ĐẶC TẢ THIẾT KẾ KIẾN TRÚC: HỆ THỐNG THÔNG BÁO TỰ ĐỘNG QUA ĐỒNG BỘ LỊCH ĐIỆN THOẠI (iCal / Calendar Sync)
**Dự án:** Văn phòng điện tử QCET E-Office - Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn  
**Tài liệu:** `docs/superpowers/specs/2026-09-07-calendar-sync-notifications-spec.md`  
**Ngày lập:** 07/09/2026  
**Trạng thái:** Chờ Ban Giám hiệu & Quản trị phê duyệt (Draft)

---

## 1. BỐI CẢNH & TÍNH CẤP THIẾT

### 1.1. Điểm nghẽn của các giải pháp thông báo truyền thống
Trong quá trình khảo sát thực tế tại Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET):
* **Tin nhắn Zalo ZNS / SMS:** Tính phí theo từng tin (200đ - 450đ/tin). Với hàng trăm giảng viên và hàng ngàn đầu việc giao nhận mỗi tháng, chi phí viễn thông sẽ tạo gánh nặng ngân sách định kỳ, không phù hợp cho trường công lập.
* **Web Push Notification trên trình duyệt:**
  * Trên iPhone/iOS: Buộc người dùng phải biết thao tác "Thêm vào màn hình chính" (PWA). Đa số cán bộ, giảng viên không rành kỹ thuật sẽ không kích hoạt được.
  * Tỷ lệ bị từ chối cao: Người dùng có thói quen bấm "Chặn" (Block) khi thấy popup xin quyền của trình duyệt.
  * Bị hệ điều hành Android (Oppo, Xiaomi, Samsung) tối ưu pin tắt ngầm tiến trình duyệt web chạy ngầm.
* **Tình trạng trôi việc:** Giảng viên đi dạy thực hành ở xưởng, di chuyển công tác không thể ngồi 24/7 trước màn hình máy tính để canh tab E-Office.

### 1.2. Mục tiêu của Giải pháp "Calendar Sync" (Đồng bộ Lịch)
Tận dụng chuẩn mở quốc tế **iCalendar (RFC 5545)** và giao thức **`webcal://`** để biến chính ứng dụng Lịch mặc định trên điện thoại (Apple Calendar trên iPhone/iPad, Google Calendar trên Android/PC, Outlook) thành kênh thông báo chính thức của Nhà trường:
* **"Bấm 1 lần – Nhận thông báo mãi mãi":** Người dùng chỉ cần kích hoạt 1 lần duy nhất, toàn bộ chỉ đạo, nhiệm vụ và lịch họp tự động chảy về điện thoại.
* **0 Đồng chi phí vĩnh viễn:** Hoàn toàn miễn phí, không tốn bất kỳ chi phí viễn thông nào.
* **Rung chuông báo thức chuẩn xác:** Điện thoại tự động phát chuông nhắc việc trước 24 giờ và trước 2 giờ đến hạn chót (kể cả khi điện thoại không có kết nối mạng tại thời điểm chuông reo).
* **Trực quan:** Lịch công việc hiển thị cùng lúc với lịch giảng dạy, lịch thi, lịch sinh hoạt của giảng viên.

---

## 2. KIẾN TRÚC TỔNG THỂ & LUỒNG DỮ LIỆU

```
┌────────────────────────────────────────────────────────────────────────┐
│                        QCET E-OFFICE BACKEND                           │
│  (Next.js 15 App Router + Prisma PostgreSQL)                           │
│                                                                        │
│   [Nhiệm vụ mới] / [Bút phê BGH] / [Lịch họp Trường]                   │
│                       │                                                │
│                       ▼                                                │
│         /api/calendar/feed?token={USER_SECURE_TOKEN}                   │
│         (Trả về nội dung chuẩn iCalendar RFC 5545)                     │
└───────────────────────┬────────────────────────────────────────────────┘
                        │ Giao thức webcal:// (HTTPS Polling ngầm)
                        │ Định kỳ 15 - 30 phút / lần
                        ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   HỆ ĐIỀU HÀNH THIẾT BỊ NGƯỜI DÙNG                     │
│                                                                        │
│   ┌───────────────────────────┐    ┌───────────────────────────┐       │
│   │   APPLE CALENDAR (iOS)    │    │  GOOGLE CALENDAR (Android)│       │
│   └─────────────┬─────────────┘    └─────────────┬─────────────┘       │
│                 │                                │                     │
│                 ▼                                ▼                     │
│         [TỰ ĐỘNG TẠO SỰ KIỆN TRÊN MÀN HÌNH KHÓA & WIDGET]              │
│         • Tên nhiệm vụ, người giao, mức độ khẩn                        │
│         • Báo thức 1: Trước 24h (8:00 sáng hôm trước)                  │
│         • Báo thức 2: Trước 2h (Chặng nước rút hoàn thành)             │
│         • Đường link 1-chạm mở trực tiếp trang nộp báo cáo             │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. THIẾT KẾ KỸ THUẬT CHI TIẾT

### 3.1. Cơ chế Sinh Mã Định Danh Bảo Mật (Personal Calendar Token)
Để đảm bảo Thầy Hùng không đọc được lịch nội bộ riêng của Thầy Vinh, mỗi người dùng sở hữu một **Token bảo mật duy nhất**:
1. Thêm trường `calendarToken` vào bảng `User` (hoặc bảng `UserSettings`):
   ```prisma
   model User {
     // ... các trường hiện có
     calendarToken   String?   @unique @default(cuid()) @map("calendar_token")
     calendarEnabled Boolean   @default(true) @map("calendar_enabled")
   }
   ```
2. Nếu nghi ngờ lộ link, người dùng có nút **"Tạo lại mã đồng bộ mới" (Revoke & Rotate Token)** ngay trên giao diện cá nhân.

### 3.2. Endpoint Dịch Vụ Lịch (`GET /api/calendar/feed`)
* **URL định dạng:** `webcal://eoffice.qcet.edu.vn/api/calendar/feed?token=cuid_user_123`  
  *(Trình duyệt tự động mở app Lịch khi bấm vào URL dạng `webcal://`)*
* **Headers phản hồi:**
  ```http
  Content-Type: text/calendar; charset=utf-8
  Content-Disposition: inline; filename="qcet-eoffice.ics"
  Cache-Control: private, max-age=900, must-revalidate
  ```
* **Bộ lọc dữ liệu (Query Logic):**
  * Lấy các nhiệm vụ mà User là **Chủ trì (DRI)** hoặc **Phối hợp xử lý**.
  * Nếu là Trưởng phòng/khoa: Bổ sung thêm các việc lớn của đơn vị có deadline gần.
  * Chỉ lấy các nhiệm vụ ở trạng thái: `TODO` (Đợi xử lý), `IN_PROGRESS` (Đang xử lý), `REPORTED` (Chờ BGH duyệt).
  * Ẩn các nhiệm vụ đã `COMPLETED` quá 3 ngày để cuốn lịch luôn tinh gọn.

### 3.3. Cấu trúc Đối tượng Sự kiện trong iCalendar (`VEVENT` & `VALARM`)
Mỗi nhiệm vụ trong E-Office được chuyển đổi thành một `VEVENT` chuẩn mực:
```ics
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//QCET//E-Office Calendar Service//VI
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:QCET E-Office - Nhiệm vụ của Thầy Hùng
X-WR-TIMEZONE:Asia/Ho_Chi_Minh
X-PUBLISHED-TTL:PT15M

BEGIN:VEVENT
UID:qcet-task-2805-ubnd@eoffice.qcet.edu.vn
DTSTAMP:20260907T080000Z
DTSTART:20260915T093000Z
DTEND:20260915T103000Z
SUMMARY:🚨 [QCET] Báo cáo tình hình quản lý, sử dụng tài sản công
DESCRIPTION:Văn bản chỉ đạo: [2805/UBND-KTTH]\nNgười giao: Ban Giám hiệu\nĐơn vị chủ trì: Khoa CNTT\nHạn xử lý: 17:30 ngày 15/09/2026\n\n👉 Bấm vào link để xử lý và nộp minh chứng:\nhttps://eoffice.qcet.edu.vn/?task=2805-ubnd
URL:https://eoffice.qcet.edu.vn/?task=2805-ubnd
STATUS:CONFIRMED
PRIORITY:1

BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:Nhắc nhở: Ngày mai hết hạn nhiệm vụ Báo cáo tài sản công
TRIGGER:-P1D
END:VALARM

BEGIN:VALARM
ACTION:AUDIO
TRIGGER:-PT2H
ATTACH;VALUE=URI:Chord
END:VALARM

END:VEVENT
END:VCALENDAR
```

---

## 4. THIẾT KẾ GIAO DIỆN NGƯỜI DÙNG (UI/UX)

Hệ thống cung cấp trải nghiệm kết nối **thông minh theo ngữ cảnh thiết bị**:

### 4.1. Điểm kích hoạt trên giao diện Web (Entrypoints)
1. **Nút bấm trên thanh Header / Menu cá nhân:** Nút `[📅 Đồng bộ Lịch điện thoại]` đặt cạnh Chuông thông báo.
2. **Banner gợi ý ở l��n đầu đăng nhập:** Khi cán bộ mới đăng nhập lần đầu, hệ thống hiện banner nhẹ:  
   *"Thầy/Cô có muốn nhận thông báo việc tự động trên điện thoại không? [Kích hoạt trong 5 giây]"*.

### 4.2. Hộp thoại kích hoạt đa kênh (Smart Sync Modal)
Khi bấm nút, hệ thống tự nhận diện người dùng đang dùng thiết bị gì:
* **Nếu đang mở bằng Điện thoại (iOS / Android):**
  * Nút to nổi bật: **"Thêm vào Ứng dụng Lịch trên máy này"**.
  * Bấm 1 phát ➔ Mở trực tiếp hộp thoại `Subscribe Calendar` mặc định của iOS / Android ➔ Bấm **Đăng ký (Subscribe)** là xong.
* **Nếu đang mở bằng Máy tính văn phòng (Laptop / Desktop):**
  * Hiển thị **Mã QR Code cá nhân**: Cán bộ chỉ cần lấy camera điện thoại quét mã QR ➔ Điện thoại tự mở ứng dụng Lịch để đăng ký.
  * Kèm theo nút **"Sao chép liên kết iCal"** cho người muốn thêm vào Google Calendar hoặc Microsoft Outlook trên máy tính.

---

## 5. BẢO MẬT & QUẢN TRỊ DỮ LIỆU

1. **Bảo mật đường dẫn (URL Obfuscation):**
   * Link iCal không dùng mã định danh số tăng tuần tự (không dùng `/feed?user_id=1`).
   * Sử dụng CUID hoặc UUIDv4 ngẫu nhiên có độ dài lớn, chống brute-force.
2. **Cơ chế thu hồi quyền (Instant Revocation):**
   * Khi cán bộ mất điện thoại hoặc chuyển công tác: Bấm nút "Thu hồi liên kết cũ & Cấp mã mới". Toàn bộ lịch trên máy cũ sẽ bị vô hiệu hóa ngay lập tức.
3. **Hiệu năng & Chống nghẽn Server (Rate Limiting & Caching):**
   * Các thiết bị điện thoại sẽ gọi định kỳ 15 - 60 phút / lần.
   * Dùng cơ chế **HTTP ETag** và `Cache-Control: private, max-age=900` (15 phút). Nếu danh sách việc không có gì thay đổi, server trả về `304 Not Modified` ngay lập tức (tiêu tốn gần như 0% CPU và băng thông).

---

## 6. LỘ TRÌNH TRIỂN KHAI DỰ KIẾN (2 GIAI ĐOẠN)

### Giai đoạn 1: Xây dựng Backend & API Feed iCal (1 - 2 ngày)
* Cài đặt thư viện `ical-generator` (chuẩn TypeScript, tương thích Next.js 15).
* Tạo API Route `src/app/api/calendar/feed/route.ts` xử lý sinh chuỗi `.ics`.
* Bổ sung trường `calendarToken` vào schema dữ liệu.
* Viết unit test kiểm thử cú pháp iCalendar theo chuẩn RFC 5545.

### Giai đoạn 2: Tích hợp Giao diện & Trải nghiệm 1-Click (1 ngày)
* Xây dựng Component `CalendarSyncModal` có QR Code + nút bấm `webcal://`.
* Thêm nút đồng bộ trên thanh công cụ Workspace và trang Cá nhân.
* Kiểm thử thực tế trên iPhone (Apple Calendar) và máy Android (Google Calendar).

---

## 7. KẾT LUẬN & ĐỀ XUẤT

Giải pháp **Đồng bộ Lịch điện thoại (iCal Sync)** là phương án tối ưu bậc nhất cho bài toán thông báo của Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn:
* Không phụ thuộc nhà mạng hay đơn vị thu phí tin nhắn (tiết kiệm 100% ngân sách).
* Không bị lỗi trình duyệt hay cơ chế chặn quyền như Web Push.
* Đem lại trải nghiệm làm việc hiện đại, chuyên nghiệp ngang tầm các tập đoàn công nghệ lớn.
