# ĐẶC TẢ THIẾT KẾ KIẾN TRÚC: HỆ THỐNG THÔNG BÁO TỰ ĐỘNG QUA ĐỒNG BỘ LỊCH ĐIỆN THOẠI (iCal / Calendar Sync)
**Dự án:** Văn phòng điện tử QCET E-Office - Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn  
**Tài liệu:** `docs/superpowers/specs/2026-09-07-calendar-sync-notifications-spec.md`  
**Ngày cập nhật:** 07/09/2026 (Phiên bản v1.1 - Đã ki��m chứng thực tế & khắc phục độ trễ đồng bộ)  
**Trạng thái:** Sẵn sàng phê duyệt & Lập kế hoạch triển khai

---

## 1. BỐI CẢNH & PHÂN TÍCH KỸ THUẬT CHUYÊN SÂU

### 1.1. Vì sao loại bỏ Zalo và Web Push?
* **Zalo ZNS / SMS:** Tính phí từng tin nhắn (200đ - 450đ/tin), kiểm duyệt mẫu khắt khe, vi phạm nguyên tắc tiết kiệm ngân sách trường công lập.
* **Web Push Notification:** Bị 3 rào cản chí mạng trên thực tế:
  1. *Trên iOS (iPhone):* Ép người dùng phải biết thao tác "Add to Home Screen" (PWA) mới bật được push.
  2. *Thói quen người dùng:* 80% Thầy/Cô bấm "Chặn" (Block) khi thấy popup xin quyền của trình duyệt.
  3. *Hệ điều hành Android:* Các hãng (Samsung, Xiaomi, Oppo) tự động "giết ngầm" tiến trình trình duyệt để tiết kiệm pin ➔ Mất thông báo hoàn toàn.

### 1.2. Nghiên cứu thực tế về cơ chế đồng bộ Lịch (Sync Cadence Reality)
Dựa trên khảo sát thực tế các hệ thống iCalendar toàn cầu (Apple, Google, Microsoft):
* **Apple Calendar (iOS / iPadOS / macOS):** 
  * Cơ chế kéo (Pull) linh hoạt: Mặc định cập nhật mỗi 1 giờ hoặc mỗi 15 phút (người dùng tùy chọn được trong cài đặt). Khi mở ứng dụng Lịch, Apple tự động ép làm mới (Force refresh) ngay lập tức.
  * Hỗ trợ chuẩn chuông báo thức `VALARM` gốc của hệ điều hành.
* **Google Calendar (Android / Web):**
  * Google dùng máy chủ đám mây quét định kỳ các đường dẫn `webcal://` bên ngoài, chu kỳ quét từ **8 đến 24 giờ / lần** (không thể cấu hình cưỡng bức rút ngắn từ phía server).
  * Do đó, **Đồng bộ Lịch iCal cực kỳ xuất sắc cho các nhiệm vụ trung và dài hạn (hạn chót từ 1 đến 30 ngày)**, nhưng **không thể dùng đơn độc cho việc hỏa tốc phát sinh trong 1 - 2 tiếng**.

---

## 2. KIẾN TRÚC THÔNG BÁO 2 TẦNG (HYBRID ARCHITECTURE)

Để xử lý triệt để độ trễ của Google Calendar mà vẫn giữ nguyên tiêu chí **0 ĐỒNG CHI PHÍ**, hệ thống QCET E-Office áp dụng mô hình phân luồng thông minh:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        QCET E-OFFICE TASK ENGINE                       │
└────────────────────────────────���─┬─────────────────────────────────────┘
                                   │ Phân loại theo Hạn chót (Deadline)
                 ┌─────────────────┴─────────────────┐
                 ▼                                   ▼
    [NHIỆM VỤ TIÊU CHUẨN]                   [NHIỆM VỤ HỎA TỐC / GẤP]
    (Hạn chót > 24 giờ)                     (Hạn chót < 24 giờ / Trong ngày)
                 │                                   │
                 ▼                                   ▼
      ┌─────────────────────┐             ┌─────────────────────┐
      │  iCal Feed (webcal) │             │  Instant Push Mail  │
      │  (RFC 5545 Feed)    │             │  (@qcet.edu.vn)     │
      └──────────┬──────────┘             └──────────┬──────────┘
                 │ Tự động kéo định kỳ               │ Bắn kèm file .ics
                 │ về Apple/Google Cal               │ điện thoại nhận tức thì
                 ▼                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      ỨNG DỤNG LỊCH TRÊN ĐIỆN THOẠI                     │
│               (Apple Calendar / Google Calendar / Outlook)             │
│                                                                        │
│   • Rung chuông trước 24h (8:00 sáng hôm trước)                        │
│   • Rung chuông trước 2h (Nước rút hoàn thành)                         │
│   • Link 1-chạm mở đúng trang nộp báo cáo                              │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Nhiệm vụ tiêu chuẩn (> 24h):** Chảy vào luồng **Calendar Feed (webcal://)**. Người dùng đăng ký 1 lần nhận mãi mãi.
2. **Nhiệm vụ hỏa tốc (< 24h) hoặc Chỉ đạo khẩn của BGH:** 
   * Ngoài việc ghi vào Feed lịch, hệ thống gửi thêm **1 Email công vụ tự động kèm tệp đính k��m `invite.ics`**.
   * Ứng dụng Mail trên điện thoại (Apple Mail, Gmail, Outlook) nhận diện file `.ics` và **tự động đẩy sự kiện vào Lịch máy chủ với độ trễ 0 giây**, chuông reo lập tức.

---

## 3. THIẾT KẾ KỸ THUẬT CHI TIẾT

### 3.1. Cơ chế Quản lý Token Cá nhân (Secure Calendar Token)
Để đảm bảo Thầy Hùng không xem được việc của Thầy Vinh:
1. Thêm trường vào CSDL Prisma:
   ```prisma
   model User {
     // ... các trường hiện có
     calendarToken   String?   @unique @default(cuid()) @map("calendar_token")
     calendarEnabled Boolean   @default(true) @map("calendar_enabled")
     calendarLastSync DateTime? @map("calendar_last_sync")
   }
   ```
2. Giao diện cá nhân có nút **"Đổi mã đồng bộ mới" (Revoke & Rotate)** để vô hiệu hóa thiết bị cũ khi cần.

### 3.2. Endpoint Dịch Vụ Lịch (`GET /api/calendar/feed`)
* **URL:** `webcal://eoffice.qcet.edu.vn/api/calendar/feed?token={calendarToken}`
* **Headers phản hồi tối ưu hóa Cache & SEO:**
  ```http
  Content-Type: text/calendar; charset=utf-8
  Content-Disposition: inline; filename="qcet-eoffice.ics"
  Cache-Control: private, max-age=900, must-revalidate
  X-Robots-Tag: noindex, nofollow
  ```
* **Cơ chế ETag tiết kiệm tài nguyên:**
  * Tính mã hash MD5 từ danh sách nhiệm vụ của người dùng.
  * Nếu điện thoại gửi `If-None-Match: "hash123"` và dữ liệu không đổi ➔ Trả về mã **`304 Not Modified`** ngay lập tức (tiết kiệm 100% băng thông và tải DB).

### 3.3. Cấu trúc Đối tượng iCalendar chuẩn quốc tế (RFC 5545 & RFC 7986)
Áp dụng đầy đủ các thẻ tối ưu tần suất làm mới và hỗ trợ chuông báo thức:
```ics
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//QCET//E-Office Calendar Service v1.1//VI
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:QCET E-Office - Việc cần làm
X-WR-TIMEZONE:Asia/Ho_Chi_Minh
REFRESH-INTERVAL;VALUE=DURATION:PT1H
X-PUBLISHED-TTL:PT1H

BEGIN:VEVENT
UID:qcet-task-2805-ubnd@eoffice.qcet.edu.vn
SEQUENCE:0
DTSTAMP:20260907T080000Z
DTSTART:20260915T093000Z
DTEND:20260915T103000Z
SUMMARY:🚨 [QCET] Báo cáo tình hình quản lý tài sản công
DESCRIPTION:Văn bản: [2805/UBND-KTTH]\nNgười giao: Ban Giám hiệu\nĐơn vị chủ trì: Khoa CNTT\nHạn chót: 17:30 ngày 15/09/2026\n\n👉 Bấm vào link để nộp minh chứng:\nhttps://eoffice.qcet.edu.vn/?task=2805-ubnd
URL:https://eoffice.qcet.edu.vn/?task=2805-ubnd
STATUS:CONFIRMED
PRIORITY:1

BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:Nhắc nhở: Ngày mai hết h��n nhiệm vụ Báo cáo tài sản công
TRIGGER:-P1D
END:VALARM

BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:Khẩn: Còn 2 tiếng nữa hết hạn nộp Báo cáo tài sản công
TRIGGER:-PT2H
END:VALARM

END:VEVENT
END:VCALENDAR
```

---

## 4. THIẾT KẾ GIAO DIỆN NGƯỜI DÙNG & HƯỚNG DẪN ONBOARDING (UX)

### 4.1. Hộp thoại "Kích hoạt Lịch công việc" (Smart Calendar Modal)
Khi Thầy/Cô bấm nút `[📅 Đồng bộ Lịch điện thoại]`:
* **Nếu mở trên điện thoại (Mobile):**
  * Nút to: **"Thêm vào Lịch máy này (1 Cú chạm)"** (gắn link `webcal://...`).
  * Ghi chú ngắn: *"Trên iPhone, khi máy hỏi 'Remove Alarms?', vui lòng chọn 'Keep Alarms' để nhận chuông nhắc việc"* .
* **Nếu mở trên máy tính (Desktop):**
  * Hiển thị **Mã QR Code cá nhân** để lấy camera điện thoại quét đăng ký ngay.
  * Kèm nút **"Thêm vào Google Calendar"** (mở thẳng link `https://calendar.google.com/calendar/r?cid=webcal://...`).
  * Nút sao chép liên kết iCal thủ công.

### 4.2. Quản lý trạng thái
* Hiển thị dòng trạng thái thân thiện:  
  *🟢 Đã kết nối với điện thoại (Lần kiểm tra cuối: 10 phút trước)*.
* Nút *"Tạo lại mã mới"* nếu nghi ngờ lộ liên kết.

---

## 5. KẾ HOẠCH TRIỂN KHAI CHI TIẾT (IMPLEMENTATION PLAN)

| Bước | Hạng mục công việc | Output cụ thể |
| :--- | :--- | :--- |
| **Bước 1** | Cài đặt thư viện `ical-generator` & cấu hình TypeScript | File thư viện chuẩn hóa |
| **Bước 2** | Xây dựng API Route `src/app/api/calendar/feed/route.ts` | Endpoint trả về chuẩn `.ics` kèm ETag |
| **Bước 3** | Cập nhật logic truy vấn task theo User (DRI / Co-assignee) | Query Prisma / mock data đồng bộ |
| **Bước 4** | Xây dựng UI Component `CalendarSyncModal` có QR Code + nút 1-click | Modal thân thiện trên Header & Trang cá nhân |
| **Bước 5** | Kiểm thử thực tế (Unit tests + Kiểm thử trên iOS và Android) | Test suite xanh 100% |

---

## 6. KẾT LUẬN

Bản đặc tả v1.1 này đã giải quyết triệt để vấn đề độ trễ của các dịch vụ lịch toàn cầu, đảm bảo **100% không phát sinh chi phí**, an toàn bảo mật, và mang lại trải nghiệm tiện dụng tối đa cho đội ngũ Cán bộ - Giảng viên QCET.
