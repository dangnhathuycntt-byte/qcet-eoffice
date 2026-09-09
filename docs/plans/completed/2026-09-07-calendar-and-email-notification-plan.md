---
status: completed
domain: architecture
created: 2026-09-07
---

# KẾ HOẠCH TRIỂN KHAI CHI TIẾT (ĐÃ EXA REVIEW & TỐI ƯU HÓA)
## HỆ THỐNG THÔNG BÁO KÉP: LỊCH ĐIỆN THOẠI (iCal) + EMAIL CÔNG VỤ (`@qcet.edu.vn`)
**Dự án:** QCET E-Office - Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn  
**Tài liệu:** `docs/superpowers/plans/2026-09-07-calendar-and-email-notification-plan.md`  
**Phiên bản:** v1.2 (Đã rà soát chuyên sâu qua Exa Research)  
**Ngày lập:** 07/09/2026

---

## 1. KẾT QUẢ RÀ SOÁT CHUYÊN SÂU (EXA REVIEW FINDINGS)

Qua quá trình tra cứu và đối chiếu các hệ thống sản phẩm thực tế trên thế giới (Next.js 15, Nodemailer, Gmail Workspace, Apple Mail):
1. **Next.js 15 Route Handler (`app/api/calendar/feed/route.ts`):**
   * Bắt buộc khai báo `export const dynamic = 'force-dynamic'` để ngăn Next.js 15 cache tĩnh (Static Render) nội dung file `.ics` tại thời điểm build.
   * Cần kiểm tra header `if-none-match` để trả về `HTTP 304 Not Modified` với body rỗng (`new Response(null, { status: 304 })`).
2. **Cấu trúc MIME Email Lịch mời (`method=REQUEST`):**
   * Nếu chỉ đính kèm file `.ics` dạng attachment thông thường, Outlook và Gmail đôi khi chỉ coi là file tải về.
   * Để Gmail, Apple Mail và Outlook tự động bật **Banner "Thêm vào Lịch" / RSVP interactive widget** ngay đầu email, phần đính kèm phải tuân thủ chuẩn MIME multipart:
     ```ts
     icalEvent: {
       filename: "nhiem-vu.ics",
       method: "REQUEST",
       content: icsContentString
     }
     ```
3. **Hiển thị QR Code trên giao diện Web:**
   * Dùng thư viện `qrcode` sinh chuỗi SVG thuần (`QRCode.toString(url, { type: 'svg' })`), hiển thị nhẹ nhàng và an toàn 100% khi chạy trên Next.js Server Components / Client Components mà không bị lỗi canvas hydration.

---

## 2. KẾ HOẠCH CHI TIẾT TỪNG BƯỚC (STEP-BY-STEP EXECUTION)

### Bước 1: Cài đặt thư viện phụ trợ (Dependencies)
* Cài đặt `ical-generator` và `qrcode`:
  ```bash
  npm install ical-generator qrcode
  npm install -D @types/qrcode
  ```
* Không cài đặt các thư viện nặng nề, đảm bảo bundle size client luôn dưới 50KB.

### Bước 2: Xây dựng Module Quản lý Token Cá nhân (`src/lib/calendar-token.ts`)
* Tạo các hàm tiện ích:
  * `getUserCalendarToken(userId: string): Promise<string>`
  * `verifyCalendarToken(token: string): Promise<{ userId: string; role: string } | null>`
  * `rotateUserCalendarToken(userId: string): Promise<string>` (Dùng khi người dùng muốn đổi máy hoặc hủy liên kết cũ)
* Viết mock store token ánh xạ các tài khoản mẫu hiện tại (`BGH-01`, `TRUONGKHOA-01`, `GIANGVIEN-01`...).

### Bước 3: Xây dựng API Route iCal (`src/app/api/calendar/feed/route.ts`)
* Khai báo:
  * `export const dynamic = 'force-dynamic'`
  * `export const runtime = 'nodejs'`
* Logic xử lý:
  1. Kiểm tra `token` từ URL query: `GET /api/calendar/feed?token=...`.
  2. Lấy danh sách nhiệm vụ của user từ `unified-task-hub.ts`.
  3. Sử dụng `ical-generator`:
     * Đặt tên lịch: `X-WR-CALNAME: QCET E-Office - [Tên User]`.
     * Tần suất làm mới: `REFRESH-INTERVAL;VALUE=DURATION:PT1H`, `X-PUBLISHED-TTL:PT1H`.
     * Mỗi nhiệm vụ có 2 mốc `VALARM`: Trước 24h và trước 2h.
     * Thêm deep-link mở trực tiếp trang nộp báo cáo.
  4. Tính toán mã băm ETag; nếu trùng với `If-None-Match` ➔ Trả về `304 Not Modified`.

### Bước 4: Xây dựng Service Gửi Email Công vụ (`src/lib/email-service.ts`)
* Thiết kế mẫu Email HTML nhận diện thương hiệu Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (màu xanh Navy + biểu tượng đại bàng/kỹ thuật, font chữ rõ ràng, nút CTA màu xanh nổi bật).
* Hàm `sendUrgentTaskEmail({ task, recipient })`:
  * Tự động tạo tệp `invite.ics` tương ứng với nhiệm vụ.
  * Tích hợp cấu trúc MIME `method: 'REQUEST'` để kích hoạt tính năng tự động ghi lịch trên điện thoại của người nhận.

### Bước 5: Xây dựng Giao diện "Đồng bộ Lịch 1-Click" (`CalendarSyncModal.tsx`)
* Vị trí xuất hiện:
  * Nút `[📅 Đồng bộ Lịch điện thoại]` đặt trang trọng trên Header (cạnh Chuông thông báo).
* Nội dung Modal:
  * **Tab Mobile (hoặc tự nhận diện màn hình nhỏ):** Nút to `[Thêm vào Lịch điện thoại (1-Click)]` với link `webcal://...`.
  * **Tab Desktop:** Hiển thị **Mã QR Code cá nhân** để mở camera quét trực tiếp.
  * Nút phụ: *"Mở trên Google Calendar"* & *"Sao chép liên kết"*.
  * Hướng dẫn iPhone: *"Thầy/Cô chọn 'Keep Alarms' nếu máy h���i để nhận chuông báo"*.

### Bước 6: Kiểm thử tự động (Unit Tests & QA)
* Viết test suite:
  * `tests/calendar-feed.test.ts`: Kiểm tra định dạng chuỗi iCal, các thẻ VEVENT, VALARM, ETag 304, và chặn token không hợp lệ.
  * `tests/email-service.test.ts`: Kiểm tra cấu trúc HTML email và nội dung `invite.ics`.
* Chạy kiểm tra toàn diện:
  ```bash
  npm run typecheck
  npm test
  ```

---

## 3. CHECKLIST ĐẢM BẢO QUY TẮC DỰ ÁN (ENGINEERING RULES)
- [x] Không chạy `next build` đè lên `.next` trong lúc dev server đang chạy.
- [x] Đảm bảo giao diện tuân thủ Tailwind CSS v4 trong `src/app/globals.css`.
- [x] Toàn bộ code có Type an toàn 100%, không dùng `any` bừa bãi.
