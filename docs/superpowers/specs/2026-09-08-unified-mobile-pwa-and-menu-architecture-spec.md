# ĐẶC TẢ THIẾT KẾ & KIẾN TRÚC: HỆ THỐNG GIAO DIỆN & MENU MOBILE PWA ĐỒNG BỘ
## DỰ ÁN: HỆ THỐNG VĂN PHÒNG ĐIỆN TỬ QCET E-OFFICE
**Mã tài liệu:** SPEC-2026-09-08-MOBILE-PWA-UNIFIED-MENU  
**Đơn vị áp dụng:** Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn (QCET)  
**Ngày lập:** 08/09/2026  
**Trạng thái:** Chờ duyệt (Pending User Review)  
**Tiêu chuẩn định hướng:** Linear-Grade Adaptive Mobile, Apple Human Interface Guidelines (HIG) iOS 18/26, Nielsen Norman Group (NN/g) Mobile Sheets Standard

---

## 1. MỤC TIÊU VÀ BỐI CẢNH DỰ ÁN

### 1.1 Vấn đề phát sinh
Trên phiên bản Mobile PWA (đặc biệt khi chạy Standalone trên iPhone 16 Pro Max / Safari iOS), hệ thống QCET E-Office bị biến dạng và mất đi tính thống nhất so với phiên bản máy tính:
1. **Lỗi chiếm quyền định tuyến Zone (Routing Hijack):** Đường dẫn gốc `/` bị ép cứng về `zone=tasks`. Tab "Tổng quan" và "Công việc" ở thanh điều hướng đáy hiển thị chung một trang cá nhân, tước bỏ hoàn toàn quyền xem Dashboard điều hành KPI của người dùng.
2. **Menu "Thêm" chứa liên kết chết (Dead Links 404):** Đường dẫn tới Lịch công tác (`/schedule`) và Cơ cấu tổ chức (`/organization`) đều bị lỗi 404 do lệch route thực tế (`/calendar`, `/org`).
3. **Menu tài khoản vi phạm công thái học di động:** Khi chạm vào avatar trên Topbar, hệ thống mở một popup máy tính 288px lơ lửng sát mép đỉnh màn hình, gây tràn viền và khó chạm bằng ngón tay cái.
4. **Topbar bị bóp nghẹt và cắt cụt văn bản:** Tiêu đề bị cắt thành `Quản lý cô...`, nút Scope Switcher dài hơn 240px đè nát các icon thao tác, huy hiệu Next.js dev badge đè lên chữ.
5. **Onboarding Spotlight đè bẹp 55% màn hình:** Khung hướng dẫn trồi lên từ đáy khóa cứng thanh Bottom Nav và ngăn cản thao tác cuộn.
6. **"Nồi lẩu màu sắc" và vỡ dòng ở bộ lọc:** 6 viên pill mang 6 màu rực rỡ riêng biệt dùng `flex-wrap` rớt thành 3 dòng lởm chởm, chiếm tới 35% chiều cao màn hình.

### 1.2 Mục tiêu thiết kế
* Đưa toàn bộ giao diện và hệ thống Menu trên Mobile PWA về **một cấu trúc thích ứng đồng nhất (Unified Adaptive Architecture)**.
* Đảm bảo tính nhất quán 100% về thương hiệu (Light-only Standard, Be Vietnam Pro typography, Muted Color Palette).
* Khắc phục triệt để mọi lỗi 404, tối ưu công thái học ngón tay cái (Apple 44px Touch Target) và vùng an toàn (Safe Area Insets).

---

## 2. KIẾN TRÚC ĐỊNH TUYẾN & ĐIỀU HƯỚNG (ROUTING & NAVIGATION CONTRACT)

### 2.1 Chuẩn hóa phân giải Zone (`src/types/workspace.ts`)
Hệ thống loại bỏ logic ép cứng `tasks` khi không có tham số URL:
```typescript
// src/types/workspace.ts
export function parseZoneParam(param: string | null | undefined): WorkspaceZone {
  if (!param) return "dashboard"; // Trả về Dashboard mặc định khi truy cập URL gốc
  if (param === "tasks" || param === "dashboard" || param === "meetings" || param === "documents") {
    return param;
  }
  return "dashboard";
}
```

### 2.2 Ma trận Điều hướng Thanh đáy (Mobile Bottom Nav Mapping)
Thanh `MobileBottomNav` chuẩn hóa 5 điểm chạm công thái học với chiều cao `h-14` và padding đáy `pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]`:

| Vị trí | Tên Tab | Icon | Route / Event | Mục đích & Trải nghiệm |
| :---: | :--- | :---: | :--- | :--- |
| **1** | **Tổng quan** | `LayoutDashboard` | `/` (`zone=dashboard`) | Khoang lái điều hành, thẻ KPI, việc khẩn quá hạn, việc chờ duyệt. |
| **2** | **Công việc** | `CheckSquare` | `/?zone=tasks` | Danh sách nhiệm vụ chi tiết, bảng Kanban/List, lọc theo tháng học vụ. |
| **3** | **Tạo việc (+)** | `Plus` | `qcet:open-create-task` | Nút hành động trung tâm nổi bật, kích thước 44px, màu xanh Navy `bg-primary`. |
| **4** | **Thông báo** | `Bell` | `/notifications` | Trung tâm thông báo đẩy, lời nhắc công việc, cập nhật tiến độ. |
| **5** | **Thêm** | `Menu` | `setMenuOpen(true)` | Mở `MobileMenuDrawer` (Lịch tuần, Đơn vị, Văn bản, Báo cáo, Hồ sơ). |

---

## 3. KIẾN TRÚC MENU "THÊM" & HỒ SƠ CÁ NHÂN (DRAWER & BOTTOM SHEETS)

### 3.1 Khắc phục lỗi 404 và Tái cấu trúc `MobileMenuDrawer` (`src/components/layout/mobile-menu-drawer.tsx`)
Menu "Thêm" được phân bổ thành 3 phân khu chức năng (Information Architecture) chuẩn mực:

```
[ HEADER: Tóm tắt Người dùng + Nút đóng X ]
  ├── Phân khu 1: LỐI TẮT ĐIỀU HÀNH & HỆ THỐNG
  │     ├── Lịch công tác tuần    ──> href="/calendar" (ĐÃ SỬA TỪ /schedule)
  │     ├── Cơ cấu tổ chức & Đơn vị ──> href="/org"      (ĐÃ SỬA TỪ /organization)
  │     ├── Văn bản & Điều hành   ──> href="/documents" (GỠ BADGE "ĐANG PHÁT TRIỂN")
  │     ├── Báo cáo KPI & Tiến độ ──> href="/dashboard" (BỔ SUNG MỚI)
  │     └── Quản lý Ủy quyền      ──> Event "qcet:open-delegation-modal" (BỔ SUNG MỚI)
  │
  ├── Phân khu 2: TIỆN ÍCH DI ĐỘNG & PWA
  │     ├── Trạng thái thông báo đẩy (Web Push Toggle & Test Notification)
  │     └── Hướng dẫn cài đặt PWA Add-to-Home-Screen
  │
  └── Phân khu 3: TÀI KHOẢN & HỆ THỐNG
        ├── Hồ sơ cá nhân (Mở UserProfileModal)
        ├── Cài đặt hệ thống (href="/settings")
        └── Đăng xuất (Logout Button)
```

### 3.2 Chuyển đổi User Profile Menu từ Popover sang Bottom Sheet
* **Nguyên tắc:** Trên màn hình di động (`< md`), loại bỏ hoàn toàn desktop popover `w-72 absolute right-0 mt-2`.
* **Cơ chế:** Khi người dùng chạm vào avatar trên Topbar ở màn hình mobile, hệ thống mở một `BottomSheet`:
  - **Header:** Ảnh đại diện, Tên cán bộ, Email Google Workspace xác thực, Huy hiệu Chức vụ (`Ban Giám hiệu` / `Trưởng phòng` / `Giảng viên`).
  - **Danh sách hành động:** Chiều cao mỗi nút tối thiểu 48px, icon nét mảnh 18px.
  - **Hành động gồm:** `Xem hồ sơ chi tiết`, `Quản lý ủy quyền`, `Cài đặt App PWA`, `Hướng dẫn sử dụng`, `Đăng xuất`.

---

## 4. CHUẨN HÓA THANH ĐIỀU HƯỚNG ĐỈNH (TOPBAR MOBILE RESPONSIVE SLOTS)

### 4.1 Quy tắc khe cắm hiển thị (Slot Allocation Rule)
Trên màn hình `< 768px`, chiều ngang chỉ có 390px – 430px. Topbar tuân thủ triệt để nguyên tắc **Single-level Context**:

```
[ TOPBAR MOBILE: Chiều cao chuẩn 48px, padding an toàn Dynamic Island ]
┌───────────────────────────────────────┬───────────────────────────────┐
│              SLOT TRÁI                │           SLOT PHẢI           │
│  [Logo QCET (26px)] + [Scope Switcher] │  [Chuông (Bell)] + [Avatar]   │
└───────────────────────────────────────┴───────────────────────────────┘
```

1. **Ẩn hoàn toàn Breadcrumbs dài dòng:** Ẩn `TopbarBreadcrumbs` (ví dụ: `Bàn làm việc > Quản lý công việc...`) trên mobile để chống cắt cụt văn bản.
2. **Thu gọn nút Scope Switcher:**
   - Khi ở phạm vi Toàn trường: Hiển thị `Toàn trường ▾`.
   - Khi ở phạm vi Cá nhân: Hiển thị `Cá nhân ▾`.
   - Khi ở phạm vi Đơn vị: Chỉ hiển thị mã viết tắt hoặc tên rút gọn (ví dụ: `Khoa CNTT` $\rightarrow$ `K.CNTT ▾`, `Phòng QTM & CNTT` $\rightarrow$ `P.QTM ▾`). Chiều rộng nút tối đa không quá 110px.
3. **Loại bỏ icon thừa thãi:** Nút cài đặt PWA (`Smartphone`) và ô tìm kiếm mở rộng được chuyển trọn vẹn vào menu "Thêm" ở Bottom Nav.

---

## 5. TÁI THIẾT KẾ BỘ LỌC CÔNG VIỆC THEO CHUẨN LINEAR MOBILE
*(Áp dụng cho `LecturerFocusWorkspace` và `TasksZone`)*

### 5.1 Xóa bỏ hiện tượng "Nồi lẩu màu sắc" & "Rớt 3 dòng"
1. **Triệt tiêu `flex-wrap`:** Toàn bộ dải lọc chuyển sang cấu trúc **Single-row Horizontal Scroll Carousel**:
   ```tsx
   <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 px-1 flex-nowrap -mx-3.5 px-3.5">
   ```
2. **Muted Color System (Hệ màu trung tính thanh lịch):**
   - Trạng thái bình thường: `bg-muted/60 text-muted-foreground border border-border/40 hover:bg-muted`.
   - Trạng thái được chọn: `bg-primary text-primary-foreground border-transparent font-semibold shadow-xs`.
   - Số đếm công việc (Count Badge): Màu xám nhẹ khi chưa chọn, chuyển sang màu trắng/primary khi được kích hoạt.
3. **Rút gọn nhãn công thái học:**
   - `Tôi chủ trì (DRI)` $\rightarrow$ `Chủ trì` (kèm icon `User` 14px).
   - `Tôi tham gia (Phối hợp)` $\rightarrow$ `Phối hợp` (kèm icon `Users` 14px).
   - Chiều cao vùng chạm đạt chuẩn 40px (`h-10 min-w-[40px]`).

---

## 6. CÁCH LY ONBOARDING TOUR KHỎI MÀN HÌNH NHỎ (NON-INTRUSIVE UX)

1. **Vô hiệu hóa Blocking Modal trên Mobile:**
   - Trong `src/components/onboarding/spotlight-tour.tsx`, khi phát hiện `window.innerWidth < 768px`, component **không kích hoạt overlay che mờ màn hình** và **không hiển thị popup `fixed bottom-0` đè thanh điều hướng**.
2. **Chuyển thành Inline Notification Card nhẹ nhàng:**
   - Trên mobile, lời chào mừng chỉ hiển thị dưới dạng một Banner thẻ đơn giản nằm trên cùng của luồng danh sách:
     ```
     ┌────────────────────────────────────────────────────────────┐
     │ ℹ️ Chào mừng Thầy/Cô đến với QCET E-Office!             ���  │
     │ Vuốt thanh tab để lọc nhanh công việc hoặc bấm (+) để tạo. │
     └────────────────────────────────────────────────────────────┘
     ```
   - Banner có nút đóng `✕`, tự động lưu trạng thái đã đọc vào LocalStorage.

---

## 7. DỌN DẸP MÃ NGUỒN THỪA (DEAD CODE CLEANUP)

* **Gỡ bỏ khối Mobile Drawer chết trong `src/components/layout/app-sidebar.tsx`:**
  - Xóa bỏ khối JSX `isMobileOpen ? "translate-x-0" : "-translate-x-full"` và backdrop đen kèm theo.
  - Giữ cho `AppSidebar` trở thành một desktop-only component thuần túy (`hidden md:flex flex-col`).
  - Tiết kiệm dung lượng gói tải xuống cho thiết bị di động và tránh hiểu lầm khi bảo trì mã nguồn.

---

## 8. CHUẨN HÓA CÔNG NGHỆ FORMS, BÀN PHÍM ẢO & SAFE AREA PWA STANDALONE

### 8.1 Chống hiện tượng iOS Safari Auto-Zoom (16px Input Floor Rule)
* **Vấn đề:** Khi ô `<input>` hoặc `<textarea>` có font-size < 16px, Safari trên iOS tự động ép zoom 133%, làm méo và lệch toàn bộ khung nhìn PWA.
* **Giải pháp:** Bổ sung CSS quy tắc responsive bắt buộc trong `src/app/globals.css`:
  ```css
  @media (max-width: 639px) {
    input, select, textarea {
      font-size: 16px !important;
    }
  }
  ```

### 8.2 Tự động co giãn Viewport khi Bàn phím ảo xuất hiện (Virtual Keyboard API)
* Cập nhật `src/app/layout.tsx`: Bổ sung `interactiveWidget: "resizes-content"` vào đối tượng `viewport`.
* Khi bàn phím ảo iOS/Android bật lên, viewport tự động co lại, đảm bảo các nút "Lưu" và thanh điều hướng không bị đè khuất.

### 8.3 Safe-Area Insets cho Dynamic Island & Home Indicator
* **Đỉnh trang:** Mọi sticky header trong modal và drawer đều có `pt-[max(env(safe-area-inset-top,0px),0.75rem)]` để không bị Dynamic Island đè nút `✕`.
* **Đáy trang:** Mọi thanh action dock đều có `pb-[max(env(safe-area-inset-bottom,0px),1rem)]` để không bị Home Indicator đè nút Lưu.

### 8.4 Thông minh hóa Modal Cài đặt App PWA (`MobileAppInstallModal`)
* Khi mở trên thiết bị di động: Ẩn mã QR (vốn chỉ dành cho máy tính quét sang điện thoại).
* Hiển thị hướng dẫn trực tiếp theo hệ điều hành:
  - iOS Safari: Nhấp biểu tượng Chia sẻ (Share) $\rightarrow$ Chọn "Thêm vào MH chính".
  - Android Chrome: Nút "Cài đặt ngay" kích hoạt native install prompt.

### 8.5 Sửa lỗi Điều hướng Service Worker khi Bấm Thông báo đẩy
* **Vị trí:** `public/sw.js` (dòng 90, 100, 110, 148).
* **Khắc phục:** Đổi địa chỉ fallback mặc định từ `/portal` (trang Kiosk TV) thành `/?zone=tasks` (Kho công việc di động).

### 8.6 Đồng bộ Màu Màn hình chờ (Splash Screen) sang Light-Only Standard
* **Vị trí:** `src/app/manifest.ts` và `public/manifest.webmanifest`.
* **Khắc phục:** Thay đổi `background_color` và `theme_color` từ `#0f172a` (đen tối cũ) sang `#fbfbfb` (trắng sáng công sở), triệt tiêu hoàn toàn hiện tượng chớp đen khi khởi động ứng dụng trên điện thoại.

### 8.7 Bổ sung App Shortcuts cho Menu Nhấn giữ Icon Ứng dụng
* **Vị trí:** `src/app/manifest.ts` và `public/manifest.webmanifest`.
* **Khai báo 3 Shortcuts:**
  1. `Tạo việc mới` $\rightarrow$ `/?action=create_task`
  2. `Việc cần xử lý` $\rightarrow$ `/?zone=tasks&filter=needs_review`
  3. `Lịch công tác` $\rightarrow$ `/calendar`

### 8.8 Ngăn chặn Scroll Chaining & Quản lý Trạng thái Ngoại tuyến (Offline UX)
* Áp dụng `overscroll-behavior-x: contain` cho dải tab cuộn ngang và `overscroll-behavior-y: contain` cho thân modal/drawer.
* Bổ sung Offline Status Pill thông báo nhẹ nhàng khi mất kết nối mạng trong khuôn viên trường.

---

## 9. BẢNG TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)

| Mã tiêu chí | Hạng mục kiểm tra | Tiêu chuẩn đạt |
| :---: | :--- | :--- |
| **AC-01** | Bấm tab "Tổng quan" ở Bottom Nav | Mở đúng Dashboard KPI, không bị chuyển hướng sang danh sách việc cá nhân. |
| **AC-02** | Bấm tab "Công việc" ở Bottom Nav | Mở đúng Kho nhiệm vụ (`/?zone=tasks`). |
| **AC-03** | Bấm "Lịch công tác" trong menu Thêm | Chuyển hướng tới `/calendar` thành công, không gặp lỗi 404. |
| **AC-04** | Bấm "Cơ cấu tổ chức" trong menu Thêm | Chuyển hướng tới `/org` thành công, không gặp lỗi 404. |
| **AC-05** | Bấm Avatar trên Topbar điện thoại | Mở User Profile Bottom Sheet trượt từ đáy, không mở popover máy tính. |
| **AC-06** | Topbar trên iPhone 16 Pro Max | Không còn hiện tượng cắt cụt chữ `Quản lý cô...`; Scope Switcher thu gọn vừa vặn. |
| **AC-07** | Dải nút lọc công việc | Cuộn ngang 1 hàng mượt mà, không rớt dòng, tone màu Muted trang nhã; không bị vuốt nhầm sang trang trước. |
| **AC-08** | Lần đầu truy cập trên điện thoại | Không bị modal Onboarding đè bẹp 55% màn hình; thanh Bottom Nav luôn bấm được. |
| **AC-09** | Gõ phím vào ô nhập liệu trên iPhone | Safari KHÔNG tự động phóng to (font-size >= 16px), không lệch viewport. |
| **AC-10** | Bàn phím ảo xuất hiện | Layout co giãn đúng (`interactiveWidget: "resizes-content"`), không mất nút Lưu. |
| **AC-11** | Vùng an toàn Safe Area | Đỉnh không bị Dynamic Island che nút Đóng; đáy không bị Home Indicator che nút bấm. |
| **AC-12** | Modal Cài đặt PWA trên mobile | Tự động ẩn mã QR, hiển thị hướng dẫn cài đặt màn hình chính 1-chạm. |
| **AC-13** | Bấm Thông báo đẩy trên điện thoại | Mở đúng Kho công việc (`/?zone=tasks`), KHÔNG mở màn hình TV Kiosk (`/portal`). |
| **AC-14** | Màn hình chờ PWA khi mở App | Màu nền trắng sáng `#fbfbfb`, không bị chớp đen `#0f172a`. |
| **AC-15** | Nhấn giữ Icon trên Màn hình chính | Hiện menu Shortcuts: *Tạo việc mới*, *Việc cần xử lý*, *Lịch công tác*. |
| **AC-16** | Kiểm tra chất lượng code | `npm run typecheck` đạt 0 lỗi, `npm test` toàn bộ suites đều PASS. |

---

## 10. KẾ HOẠCH BƯỚC TIẾP THEO

Sau khi Thầy/Cô xem xét và phê duyệt Đặc tả Thiết kế này:
1. Tạo Kế hoạch triển khai chi tiết (`writing-plans`).
2. Tiến hành áp dụng mã nguồn từng thành phần theo quy trình kiểm thử TDD.
3. Xác minh hiển thị trên trình duyệt mô phỏng di động.
