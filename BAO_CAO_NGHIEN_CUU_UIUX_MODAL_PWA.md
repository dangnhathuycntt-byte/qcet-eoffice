# BÁO CÁO NGHIÊN CỨU & ĐÁNH GIÁ TOÀN DIỆN: MODALS, FORMS & CÔNG NGHỆ PWA TRÊN DI ĐỘNG
## DỰ ÁN: HỆ THỐNG VĂN PHÒNG ĐIỆN TỬ QCET E-OFFICE
**Đơn vị:** Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET)  
**Thời gian lập:** Tháng 09/2026  
**Chủ đề:** Rà soát chuyên sâu Modals, Forms nhập liệu, Xử lý Bàn phím ảo, Safe Area & Chuẩn PWA Standalone trên iOS / Android

---

## 1. TỔNG QUAN HIỆN TRẠNG & CÁC LỖI KỸ THUẬT TIỀM ẨN

Qua quá trình rà soát trực tiếp toàn bộ mã nguồn các component hiển thị dạng cửa sổ nổi (Modals, Dialogs, Side Sheets, Bottom Sheets) và cấu hình PWA trong thư mục `src/components/` và `src/app/`, chúng tôi phát hiện **5 lỗi kỹ thuật và công thái học nghiêm trọng** ảnh hưởng trực tiếp tới trải nghiệm của Giảng viên và Cán bộ khi sử dụng trên điện thoại thông minh:

```
                  [ RÀ SOÁT CÁC LỖI MODALS, FORMS & PWA TRÊN MOBILE ]
                                         │
     ┌──────────────────┬────────────────┴────────────────┬──────────────────┐
     ▼                  ▼                                 ▼                  ▼
[Lỗi iOS Auto-Zoom] [Lỗi Bàn phím ảo đè Form]    [Lỗi Dynamic Island] [Modal Cài đặt App]
- Cỡ chữ ô nhập 12px - Viewport không co giãn     - Header sát mép đỉnh - Bắt điện thoại...
- Safari ép phóng to - Nút Lưu bị đẩy mất        - Bị che nút Đóng (X) - ...quét QR trên màn hình!
```

---

## 2. KẾT QUẢ RÀ SOÁT CHI TIẾT MÃ NGUỒN TỪNG THÀNH PHẦN

### 2.1. LỖI NGHIÊM TRỌNG: iOS Safari Auto-Zoom phá vỡ giao diện PWA
* **Vị trí mã nguồn:** Toàn bộ các thẻ `<input>`, `<textarea>`, `<select>` trong `create-task-modal.tsx` (dòng 735, 780, 840), `task-detail-side-sheet.tsx` (dòng 1522), `submit-deliverable-modal.tsx`.
* **Hiện tượng thực tế:** Các ô nhập liệu đang được gán class `text-xs` (12px) hoặc `text-sm` (14px).
* **Cơ chế lỗi của iOS Safari:**
  - Theo cơ chế mặc định của Apple Safari trên iPhone, khi người dùng chạm vào một ô nhập văn bản có cỡ chữ nhỏ hơn **16px**, trình duyệt sẽ **tự động phóng to (auto-zoom)** toàn bộ trang web thêm 133% - 150% để "hỗ trợ thị lực".
  - **Hậu quả tàn phá:** Việc phóng to đột ngột này đẩy thanh Topbar, Bottom Nav và các mép màn hình lệch hoàn toàn khỏi khung nhìn (viewport offset). Người dùng sau khi gõ phím xong phải dùng 2 ngón tay thu nhỏ lại (pinch-to-zoom) để lấy lại giao diện bình thường!

### 2.2. Lỗi Bàn phím ảo che khuất nút bấm (Virtual Keyboard Viewport Collision)
* **Vị trí mã nguồn:** `src/app/layout.tsx` (dòng 52-59).
* **Hiện trạng cấu hình:**
  ```typescript
  export const viewport: Viewport = {
    colorScheme: "light",
    themeColor: "#fbfbfb",
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    viewportFit: "cover",
  };
  ```
* **Thiếu hụt thuộc tính:** Thiếu `interactiveWidget: "resizes-content"`.
* **Hậu quả:** Khi người dùng mở `CreateTaskModal` trên điện thoại và bấm vào ô nhập, bàn phím ảo iOS trồi lên chiếm 45% chiều cao màn hình. Vì layout viewport không co lại, nút "Giao nhiệm vụ" ở đáy form bị bàn phím ảo đè bẹp, người dùng không thể cuộn xuống để bấm Lưu nếu không hạ bàn phím xuống.

### 2.3. Lỗi Dynamic Island & Tai thỏ cắt đứt nút Đóng (X) trên iPhone
* **Vị trí mã nguồn:** `src/components/dashboard/task-detail-side-sheet.tsx` (dòng 627) và `create-task-modal.tsx` (dòng 650).
* **Hiện trạng mã nguồn:**
  - Header dính ở mép trên: `sticky top-0 z-10 flex items-center justify-between ...`.
  - Không hề có class xử lý vùng an toàn: `pt-[env(safe-area-inset-top,0px)]`.
* **Hậu quả:** Khi chạy ứng dụng ở chế độ PWA Standalone (không có thanh địa chỉ Safari), đỉnh của màn hình ăn sát mép trên cùng của vỏ máy. Cụm Dynamic Island / Tai thỏ của iPhone đè trực tiếp lên nút Đóng `✕` và nhãn trạng thái, khiến người dùng bấm vào nút đóng thì lại kích hoạt thanh hệ thống của iOS!

### 2.4. Trải nghiệm vô lý trong Modal Cài đặt PWA (`MobileAppInstallModal`)
* **Vị trí mã nguồn:** `src/components/pwa/mobile-app-install-modal.tsx`.
* **Hiện trạng bất cập:**
  - Khi người dùng đang cầm điện thoại di động và mở modal "Cài đặt ứng dụng", hệ thống lại hiển thị một **Mã QR to tướng** yêu cầu "Dùng camera điện thoại để quét mã cài đặt"!
  - Người dùng đang dùng chính chiếc điện thoại đó thì không thể nào dùng camera của máy để quét màn hình của chính mình.
* **Chuẩn mực di động:** Nếu phát hiện đang mở trên di động (`isMobile`), modal phải chuyển ngay sang hướng dẫn trực tiếp:
  - Trên **iOS Safari:** Hiện hình minh họa nút Share $\rightarrow$ "Thêm vào MH chính (Add to Home Screen)".
  - Trên **Android Chrome:** Hiện nút "Cài đặt ngay" gọi trực tiếp API `installApp()`.

---

## 3. KẾT QUẢ NGHIÊN CỨU EXA: CHUẨN MỰC QUỐC TẾ CHO FORM & MODAL PWA

Tra cứu tài liệu của Apple Safari Web Content Guide, CSS-Tricks, MDN Web Docs và các diễn đàn chuyên sâu về PWA:

### 3.1. Quy tắc "16px Input Floor Rule" chống Auto-Zoom
* **Nghiên cứu từ AuditBuffet Pattern Catalog & CSS-Tricks:**
  > *"iOS Safari auto-zooms the entire page whenever a form input with a font-size below 16px receives focus. That zoom disrupts the layout, forces users to manually zoom back out, and breaks the PWA experience. Remediation: Enforce font-size: 16px on mobile inputs via responsive typography: text-base sm:text-xs or global CSS override."*
* **Giải pháp áp dụng:**
  Thêm quy tắc toàn cục vào `src/app/globals.css`:
  ```css
  /* Chống iOS Safari tự động phóng to làm lệch màn hình */
  @media (max-width: 639px) {
    input, select, textarea {
      font-size: 16px !important;
    }
  }
  ```

### 3.2. Chuẩn Viewport `interactive-widget=resizes-content`
* **Nghiên cứu từ W3C & MDN VirtualKeyboard API:**
  - Thêm `interactiveWidget: "resizes-content"` vào thẻ `viewport` của Next.js `layout.tsx`.
  - Khi bàn phím ảo xuất hiện, visual viewport và layout viewport tự động co giãn đồng bộ, giúp form và thanh nút bấm nổi lên trên bàn phím mượt mà.

### 3.3. Chuẩn hóa Bottom Sheet cho Form tạo việc di động
* **Nghiên cứu từ Nielsen Norman Group (NN/g):**
  - Trên mobile, cửa sổ modal không bao giờ đặt lơ lửng chính giữa màn hình (`items-center justify-center`).
  - Phải sử dụng **Bottom Sheet neo đáy hoặc Full-page Sheet**:
    - Vuốt từ dưới lên (`animate-in slide-in-from-bottom`).
    - Nút Lưu / Xác nhận được neo cố định phía trên bàn phím ảo.
    - Có thanh kéo nhỏ (drag handle) và nút `✕` to rõ ràng ở góc trên bên phải.

---

## 4. BẢNG TỔNG HỢP GIẢI PHÁP NÂNG CẤP KỸ THUẬT

| Hạng mục | Tình trạng hiện tại | Giải pháp chuẩn hóa (Linear / Apple PWA) |
| :--- | :--- | :--- |
| **Ô nhập liệu (Inputs)** | Dùng `text-xs` (12px), bị Safari phóng to đè mép màn hình. | Bổ sung quy tắc CSS `@media (max-width: 639px) { input, select, textarea { font-size: 16px !important; } }`. |
| **Cấu hình Viewport** | Thiếu `interactiveWidget`. Bàn phím đè mất nút Lưu. | Bổ sung `interactiveWidget: "resizes-content"` vào `src/app/layout.tsx`. |
| **Vùng an toàn Đỉnh (Safe Area Top)** | Header SideSheet và Modal ăn sát đỉnh, bị Dynamic Island che nút ✕. | Thêm `pt-[max(env(safe-area-inset-top,0px),0.75rem)]` cho tất cả các sticky header. |
| **Vùng an toàn Đáy (Safe Area Bottom)** | Nút bấm sát đáy bị Home Indicator của iPhone đè. | Thêm `pb-[max(env(safe-area-inset-bottom,0px),1rem)]` cho các action bars. |
| **Modal Chi tiết công việc** | Side sheet trượt từ phải sang (Desktop-first). | Trên mobile hiển thị dạng **Full Page Sheet** có Safe Area chuẩn, kéo cuộn êm ái. |
| **Modal Cài đặt App (PWA)** | Hiện mã QR bắt điện thoại tự quét màn hình của mình. | Khi mở trên mobile: Ẩn mã QR, hiển thị trực quan các bước "Bấm Chia sẻ $\rightarrow$ Thêm vào Màn hình chính". |

---

## 5. KẾT LUẬN & KIẾN NGHỊ

Hệ thống Modals, Forms và PWA của QCET E-Office đã có nền tảng kiến trúc vững chắc, nhưng cần áp dụng ngay các chuẩn kỹ thuật di động nói trên để đạt độ mượt mà tương đương các ứng dụng Native (iOS/Android) cao cấp nhất.
