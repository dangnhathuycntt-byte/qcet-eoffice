# BÁO CÁO NGHIÊN CỨU & RÀ SOÁT CHUYÊN SÂU: SERVICE WORKER, WEB PUSH, APP SHORTCUTS & OFFLINE PWA
## DỰ ÁN: HỆ THỐNG VĂN PHÒNG ĐIỆN TỬ QCET E-OFFICE
**Đơn vị:** Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET)  
**Thời gian lập:** Tháng 09/2026  
**Chủ đề:** Rà soát chuyên sâu Service Worker, Điều hướng Push Notification, Lỗi Splash Screen, App Shortcuts và Trải nghiệm Ngoại tuyến (Offline UX)

---

## 1. TỔNG HỢP CÁC LỖI KỸ THUẬT TIỀM ẨN MỚI PHÁT HIỆN

Trong đợt rà soát mở rộng mã nguồn hệ thống ngầm (Background Service Worker, Web App Manifest, Push Notifications, Gesture Scrolling), chúng tôi phát hiện thêm **5 vấn đề kỹ thuật trọng yếu**:

```
           [ CÁC PHÁT HIỆN MỚI VỀ SERVICE WORKER & NỀN TẢNG PWA DI ĐỘNG ]
                                         │
     ┌──────────────────┬────────────────┴────────────────┬──────────────────┐
     ▼                  ▼                                 ▼                  ▼
[Lỗi Điều hướng Push] [Lỗi Màu Màn hình chờ]     [Thiếu App Shortcuts] [Cuộn Lệch Khung]
- Bấm thông báo đẩy   - Splash screen chớp đen   - Nhấn giữ Icon App   - Vuốt tab bị kích
  lại mở màn hình TV!   trước khi ra màu trắng!    chưa có menu nhanh    hoạt Back/Forward
```

---

## 2. CHI TIẾT CÁC LỖI & PHÂN TÍCH NGUYÊN NHÂN MÃ NGUỒN

### 2.1. LỖI NGHIÊM TRỌNG: Bấm Thông báo đẩy trên điện thoại lại mở màn hình TV Kiosk!
* **Vị trí mã nguồn:** `public/sw.js` (dòng 90, 100, 110, 148).
* **Mã nguồn hiện tại:**
  ```javascript
  self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const data = event.notification.data || {};
    const rawTargetUrl = data.linkHref || '/portal'; // <--- NGUY HIỂM!
    ...
  });
  ```
* **Thực tế tuyến đường `/portal`:**
  - Qua kiểm tra `src/app/portal/page.tsx`, đây là giao diện **Màn hình Kiosk / TV Tường họp** (có đồng hồ kỹ thuật số toàn màn hình `PortalLiveClock`, chế độ Zoom cho TV).
* **Hậu quả người dùng:** Khi Giảng viên hoặc Trưởng khoa nhận được thông báo đẩy trên điện thoại (ví dụ: *"Có nhiệm vụ mới được phân công"*), người dùng chạm vào thông báo thì Service Worker lại điều hướng người dùng vào trang **Màn hình TV phòng họp** thay vì mở Kho công việc cá nhân (`/?zone=tasks` hoặc `/tasks`)!

### 2.2. LỖI GIAO DIỆN: Màn hình chờ (Splash Screen) chớp màu đen tối trước khi tải trang
* **Vị trí mã nguồn:** `src/app/manifest.ts` (dòng 10-11) và `public/manifest.webmanifest` (dòng 7-8).
* **Hiện trạng giá trị:**
  ```json
  "background_color": "#0f172a",
  "theme_color": "#1e3a8a"
  ```
* **Xung đột chuẩn mực:**
  - Dự án QCET E-Office đã chuẩn hóa **Light-Only Standard** (`#fbfbfb` trắng sáng công sở giáo dục theo `CLAUDE.md` và `layout.tsx`).
  - Tuy nhiên, giá trị trong Manifest vẫn còn sót lại mã màu đen Slate (`#0f172a`) từ phiên bản Dark mode cũ.
* **Hậu quả:** Khi người dùng mở app từ Màn hình chính điện thoại (PWA Standalone), hệ điều hành iOS/Android dựng màn hình chờ chớp màu đen sì (`#0f172a`) trong 0.5s - 1s, sau đó trang web tải xong lại biến thành màu trắng (`#fbfbfb`). Cú giật màu này gây cảm giác ứng dụng bị lỗi hiển thị.

### 2.3. Lỗi Cuộn tràn trang và vô tình kích hoạt vuốt Back/Forward trình duyệt
* **Vị trí mã nguồn:** Dải Tab lọc công việc nằm ngang `src/components/dashboard/unified-task-toolbar.tsx` và thân các modal.
* **Hiện tượng:**
  - Khi người dùng vuốt nhanh dải tab lọc công việc sang trái hoặc sang phải, nếu vuốt quá đà chạm mép màn hình, iOS Safari và Android Chrome sẽ kích hoạt tính năng **Swipe Navigation (Quay lại trang trước / Tiến tới trang sau)** của trình duyệt.
  - Khi cuộn bên trong Modal, khi cuộn hết nội dung, trang nền phía sau bắt đầu bị giật nảy (Scroll Chaining / Rubber-banding).
* **Chuẩn hóa (W3C CSS `overscroll-behavior`):**
  - Thêm `overscroll-behavior-x: contain` cho các container cuộn ngang.
  - Thêm `overscroll-behavior-y: contain` cho các modal và drawer trượt.

### 2.4. Tính năng Cao cấp còn thiếu: App Shortcuts khi nhấn giữ Icon ứng dụng
* **Theo chuẩn Web App Manifest W3C & Apple iOS PWA:**
  - Ứng dụng PWA hiện đại cho phép người dùng **nhấn giữ (Long-press)** vào biểu tượng App trên màn hình chính để mở menu thao tác nhanh (Quick Actions).
  - Hệ thống QCET E-Office hiện chưa khai báo mảng `shortcuts` trong Manifest.
* **Đề xuất bổ sung 3 App Shortcuts thiết yếu:**
  1. ⚡ **Tạo việc mới:** Mở trực tiếp hộp thoại phân công (`/?action=create_task`).
  2. 📋 **Việc cần xử lý:** Mở ngay danh sách việc khẩn cấp / chờ duyệt (`/?zone=tasks&filter=needs_review`).
  3. 📅 **Lịch công tác trường:** Xem lịch tuần Ban Giám hiệu (`/calendar`).

### 2.5. Trải nghiệm Ngoại tuyến (Offline Status Feedback)
* **Thực trạng:** Service Worker đã cấu hình bộ nhớ đệm Cache-First/Network-First, nhưng giao diện ứng dụng hoàn toàn không có cơ chế phát hiện và thông báo trạng thái mạng (`navigator.onLine`).
* **Giải pháp:** Bổ sung một Offline Status Banner/Pill thanh thoát: khi mất kết nối mạng trong khuôn viên trường, hiển thị cảnh báo nhẹ nhàng: *"Đang ngoại tuyến — Hệ thống đang hoạt động ở chế độ đọc offline"*.

---

## 3. BẢNG TỔNG HỢP GIẢI PHÁP ĐIỀU CHỈNH

| Hạng mục | Tình trạng hiện tại | Giải pháp khắc phục chuẩn mực |
| :--- | :--- | :--- |
| **URL Đích khi bấm Push** | `linkHref: '/portal'` (mở trang Kiosk TV). | Đổi thành `linkHref: '/?zone=tasks'` (mở Kho công việc di động). |
| **Màu Splash Screen Manifest** | `#0f172a` (màu đen tối cũ). | Đổi thành `#fbfbfb` (đồng bộ hoàn hảo với Light Mode công sở). |
| **Menu thao tác nhanh (Shortcuts)** | Chưa có `shortcuts` trong Manifest. | Bổ sung 3 shortcut: *Tạo việc*, *Việc cần làm*, *Lịch công tác*. |
| **Kiểm soát cuộn (Overscroll)** | Bị Scroll chaining và vuốt mép nhầm trang. | Áp dụng `overscroll-behavior: contain` trên các container trượt. |
| **Thông báo trạng thái mạng** | Không có thông báo khi mất mạng. | Bổ sung Network Status Listener và Pill cảnh báo offline nhẹ nhàng. |
| **Hướng dẫn Push trên iOS** | Báo "Trình duyệt không hỗ trợ" chung chung. | Nếu là iOS chưa cài PWA: Nhắc nhở *"Thêm vào MH chính để bật thông báo"*. |

---

## 4. KẾT LUẬN

Việc tinh chỉnh Service Worker, sửa lỗi chuyển hướng thông báo đẩy, chuẩn hóa màu sắc khởi động và khai báo App Shortcuts sẽ nâng tầm QCET E-Office trở thành một ứng dụng PWA hoàn thiện, đẳng cấp tương đương ứng dụng Native trên cả hai hệ điều hành iOS và Android.
