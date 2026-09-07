# KẾ HOẠCH TRIỂN KHAI: HỆ THỐNG THÔNG BÁO KÉP (LỊCH ĐIỆN THOẠI iCal + EMAIL CÔNG VỤ)
**Dự án:** QCET E-Office - Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn  
**Tài liệu:** `docs/superpowers/plans/2026-09-07-calendar-and-email-notification-plan.md`  
**Ngày lập:** 07/09/2026  
**Dựa trên:** Đặc tả [docs/superpowers/specs/2026-09-07-calendar-sync-notifications-spec.md](../specs/2026-09-07-calendar-sync-notifications-spec.md)

---

## 1. MỤC TIÊU & NGUYÊN TẮC THIẾT KẾ

Xây dựng hệ sinh thái thông báo 0 đồng chi phí viễn thông, ổn định 100% không bị phụ thuộc vào Zalo hay lỗi cấp quyền của Web Push:
1. **Đồng bộ Lịch điện thoại (iCal / `webcal://`):** 
   * Cán bộ/Giảng viên bấm 1 lần duy nhất để kết nối vào Apple Calendar hoặc Google Calendar.
   * Tự động rung chuông nhắc việc trước 24 giờ và trước 2 giờ đến hạn chót (Deadline).
   * Tự làm mới và loại bỏ các việc đã hoàn thành.
2. **Email công vụ tức thì (`@qcet.edu.vn`):**
   * Dành cho các nhiệm vụ **Hỏa tốc / Khẩn cấp / Trong ngày** hoặc khi BGH giao chỉ đạo mới.
   * Đính kèm trực tiếp file `nhiem-vu.ics` trong email để người nhận mở mail trên điện thoại là sự kiện tự động nạp vào lịch máy với độ trễ 0 giây.

---

## 2. CÁC PHA TRIỂN KHAI CHI TIẾT (PHASED IMPLEMENTATION)

### PHA 1: HẠ TẦNG DỮ LIỆU & QUẢN LÝ TOKEN BẢO MẬT
**Mục tiêu:** Đảm bảo mỗi cán bộ sở hữu 1 token định danh lịch duy nhất, chống xem chéo và có thể thu hồi khi cần.
* **Tệp tác động:**
  * `prisma/schema.prisma` (hoặc mở rộng mock data store nếu đang chạy in-memory mock).
  * `src/lib/calendar-token.ts`: Hàm tạo token, kiểm tra tính hợp lệ và xoay vòng mã (rotate token).
* **Kiểm thử:** Unit test sinh token và xác thực quyền truy cập hợp lệ.

---

### PHA 2: XÂY DỰNG API ROUTE XUẤT LỊCH iCal (`/api/calendar/feed`)
**Mục tiêu:** Endpoint chuẩn quốc tế RFC 5545 trả về file `.ics` siêu nhẹ kèm ETag tối ưu hóa tải 304 Not Modified.
* **Thư viện sử dụng:** `ical-generator` (chuẩn công nghiệp, hỗ trợ đầy đủ `VALARM`, `VTIMEZONE`, `X-WR-CALNAME`).
* **Tệp tác động:**
  * `src/app/api/calendar/feed/route.ts`:
    * Nhận `token` từ URL query: `GET /api/calendar/feed?token={token}`.
    * Lọc các nhiệm vụ mà User là DRI (Chủ trì) hoặc Co-assignee (Phối hợp).
    * Thiết lập 2 mốc chuông báo thức:
      * `VALARM` 1: Nhắc trước 24 giờ (TRIGGER: `-P1D`).
      * `VALARM` 2: Nhắc trước 2 giờ (TRIGGER: `-PT2H`).
    * Tạo mã `ETag` băm từ trạng thái công việc; nếu request có `If-None-Match` trùng khớp ➔ Trả về `304 Not Modified`.
* **Kiểm thử:** Viết unit test `tests/calendar-feed.test.ts` kiểm tra định dạng cú pháp iCalendar, tính đúng đắn của ETag và các mốc VALARM.

---

### PHA 3: HỆ THỐNG GỬI EMAIL CÔNG VỤ KÈM LỊCH MỜI (`.ics`)
**Mục tiêu:** Khi có nhiệm vụ hỏa tốc hoặc giao việc mới, hệ thống tự động gửi email thông báo định dạng HTML trang trọng của Trường kèm file lịch đính kèm.
* **Tệp tác động:**
  * `src/lib/email-service.ts`:
    * Hàm `sendTaskNotificationEmail({ task, recipient, isUrgent })`.
    * Sinh file `invite.ics` đính kèm có MIME type `text/calendar; method=REQUEST`.
    * Mẫu email HTML thương hiệu QCET (Logo trường, tiêu đề nhiệm vụ, hạn xử lý, nút bấm "Mở E-Office xử lý").
* **Kiểm thử:** Viết unit test `tests/email-service.test.ts` giả lập gửi mail và kiểm tra cấu trúc MIME tệp lịch đính kèm.

---

### PHA 4: GIAO DIỆN NGƯỜI DÙNG - HỘP THOẠI ĐỒNG BỘ LỊCH 1-CLICK
**Mục tiêu:** Giảng viên mở điện thoại bấm 1 nút là xong; mở máy tính thì quét mã QR bằng camera.
* **Tệp tác động:**
  * `src/components/notifications/calendar-sync-modal.tsx`:
    * Nút lớn: *"Thêm vào Lịch điện thoại (1 Cú chạm)"* (gắn link `webcal://...`).
    * Khu vực hiển thị **Mã QR Code cá nhân** (tạo bằng thư viện QR Canvas nhẹ).
    * Nút *"Mở bằng Google Calendar"* và nút *"Sao chép liên kết"*.
    * Dòng hướng dẫn ngắn gọn cho người dùng iPhone: *"Chọn 'Keep Alarms' để nhận chuông báo giờ"*.
  * `src/components/notifications/notification-popover.tsx` & Header:
    * Bổ sung nút bấm `[📅 Lịch công tác / Đồng bộ]` ngay cạnh Chuông thông báo để Thầy/Cô dễ dàng thấy và bấm kích hoạt.
* **Kiểm thử:** Kiểm tra visual rendering trên trình duyệt, test tính năng mở link `webcal://` và copy link.

---

### PHA 5: TỔNG KIỂM TRA CHẤT LƯỢNG (QA & VERIFICATION)
1. Chạy `npm run typecheck` đảm bảo không lỗi kiểu dữ liệu TypeScript.
2. Chạy `npm test` đảm bảo 100% test suite xanh.
3. Kiểm thử trên môi trường Dev Preview (trình duyệt).
4. Xác nhận không can thiệp đè lên `.next` gây xung đột dev server theo quy tắc trong `CLAUDE.md`.

---

## 3. DANH SÁCH GÓI CẦN CÀI ĐẶT
```bash
npm install ical-generator qrcode
npm install -D @types/qrcode
```
*(Các thư viện này đều rất nhẹ, không làm nặng bundle web của client)*
