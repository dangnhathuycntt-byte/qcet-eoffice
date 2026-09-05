# Thiết kế Kiến trúc: Hệ thống Điều hướng 2 Menu (Collapsible Sidebar + Topbar)

**Ngày lập:** 2026-09-06  
**Dự án:** QCET E-Office (Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn)  
**Trạng thái:** Chờ phê duy��t (Pending Review)

---

## 1. Bối cảnh & Vấn đề giải quyết

### 1.1 Vấn đề hiện tại
- Trước đây hệ thống dồn toàn bộ nhận diện thương hiệu, 4 tab điều hướng chính, widget đồng hồ, công cụ đổi vai trò (BGH/Trưởng đơn vị/Chuyên viên), nút giao việc nhanh, chuyển theme và hồ sơ người dùng lên một thanh Topbar duy nhất cao 56px.
- Trên màn hình laptop kích thước 13-15 inch (độ phân giải 1280px - 1440px), không gian chiều ngang bị quá tải, dẫn đến việc các mục điều hướng bị co hẹp hoặc chồng lấn chữ (ví dụ tab "Thông báo" bị đè lên các nút bên phải).
- Các view dạng bảng lớn (Cascading Task Table), bảng Kanban và Lịch tháng cần tối đa bề ngang nhưng thiếu tính linh hoạt để mở rộng không gian làm việc.

### 1.2 Mục tiêu kiến trúc mới
- Chuyển sang mô hình chuẩn công nghiệp dành cho Dashboard Quản trị Doanh nghiệp / Nhà trường: **Layout 2 Menu (Sidebar Trái + Topbar)**.
- **Menu Trái (Sidebar):** Quản lý cấu trúc định hướng, phân cấp trang, có thể mở rộng (`240px`) hoặc thu gọn dạng icon (`64px`) để giải phóng tối đa diện tích cho bảng dữ liệu.
- **Menu Trên (Topbar):** Tinh gọn (`52px`), chỉ tập trung hiển thị thanh dẫn đường ngữ cảnh (Breadcrumbs) và các nút thao tác nhanh toàn cục (Giao việc `⌘K`, chuyển vai trò xem, đổi theme, thông tin tài khoản).
- Đảm bảo trải nghiệm trên thiết bị di động (< 768px) với thanh ngăn kéo Slide-over mượt mà.

---

## 2. Thiết kế Chi tiết các Thành phần

### 2.1 Thành phần 1: `AppSidebar` (`src/components/layout/app-sidebar.tsx`)
- **Vị trí:** Cố định bên trái (`fixed left-0 top-0 bottom-0 z-40`).
- **Kích thước chiều rộng:**
  - Mở rộng (Expanded): `240px` (`w-60`).
  - Thu gọn (Collapsed): `64px` (`w-16`).
- **Lưu trữ trạng thái:** Đồng bộ hóa với `localStorage` qua key `qcet_sidebar_collapsed` để giữ nguyên trạng thái người dùng đã chọn sau khi tải lại trang.
- **Cấu trúc nội dung:**
  1. **Thương hiệu & Nút thu gọn (Header):**
     - Logo QCET (kích thước 32x32) + Tên trường "QCET E-Office" + Huy hiệu "v1.2 Enterprise".
     - Khi thu gọn: Chỉ hiển thị logo QCET căn giữa.
     - Nút toggle thu gọn/mở rộng dạng icon (`ChevronLeft` / `ChevronRight`) ở góc trên/dưới.
  2. **Danh mục điều hướng chính:**
     - **Quản lý công việc** (`/`): Biểu tượng `CheckSquare`.
     - **Báo cáo & KPI** (`/dashboard`): Biểu tượng `LayoutDashboard`.
     - **Cơ cấu & Danh bạ** (`/org`): Biểu tượng `Network`.
     - **Thông báo & Cảnh báo** (`/notifications`): Biểu tượng `Bell` (kèm chấm đỏ hoặc badge số đếm cảnh báo).
  3. **Chân trang Sidebar (Footer):**
     - Hiển thị trạng thái đồng bộ dữ liệu: *Notion: Đang kết nối* (biểu tượng chấm xanh live).
     - Nút đóng/mở Sidebar nhanh.

### 2.2 Thành phần 2: `AppTopbar` (`src/components/layout/app-topbar.tsx`)
- **Vị trí:** Dính trên cùng (`sticky top-0 z-30`), chiều cao `52px` (`h-13`), nền bán trong suốt `bg-background/80 backdrop-blur-md`, viền dưới `border-b border-border/50`.
- **Cấu trúc nội dung:**
  1. **Khu vực bên trái (Ngữ cảnh):**
     - Nút Hamburger mở menu trên di động (`md:hidden`).
     - Nút toggle Sidebar trên màn hình máy tính (`hidden md:flex`).
     - **Breadcrumbs động:** Tự động phân tích `pathname` để hiển thị:
       - Trang chủ: `QCET E-Office` / `Quản lý công việc`
       - Báo cáo KPI: `QCET E-Office` / `Báo cáo & Chỉ số KPI`
       - Cơ cấu: `QCET E-Office` / `Cơ cấu tổ chức & Danh bạ`
       - Thông báo: `QCET E-Office` / `Thông báo điều hành`
  2. **Khu vực bên phải (Thao tác nhanh):**
     - Nút `+ Giao việc` nổi bật (màu Primary, phím tắt `⌘K`).
     - `RoleSwitcherPill` (Ban Giám hiệu / Trưởng đơn vị / Chuyên viên).
     - Nút chuyển chế độ Giao diện Sáng/Tối (`Sun` / `Moon`).
     - Avatar người dùng + Dropdown hồ sơ tài khoản cá nhân.

### 2.3 Thành phần 3: `AppLayout` Shell (`src/components/layout/app-shell.tsx`)
- **Quản lý Context (`SidebarContext`):**
  - Cung cấp `isCollapsed`, `toggleCollapse`, `isMobileOpen`, `setIsMobileOpen`.
- **Căn lề nội dung chính (Main Content Area):**
  - Desktop: `transition-all duration-200 ease-in-out` với `md:pl-60` (khi mở) hoặc `md:pl-16` (khi thu gọn).
  - Mobile: `pl-0`, Sidebar chuyển thành slide-over drawer có lớp phủ đen mờ `bg-black/50 backdrop-blur-sm`.
- **Trường hợp ngoại lệ:** Trang đăng nhập (`/login`) tự động ẩn Sidebar & Topbar để hiển thị toàn màn hình thẻ đăng nhập.

---

## 3. Luồng Dữ liệu & Xử lý Kỹ thuật (Technical Specs)

### 3.1 Tránh lỗi Hydration Mismatch (SSR)
- Đọc `localStorage` trong `useEffect` sau khi component đã mount trên client.
- Giá trị khởi tạo trên server là `isCollapsed = false` để tránh chớp giật giao diện.

### 3.2 Khả năng truy cập (Accessibility & Keyboard Shortcuts)
- Tiếp tục duy trì phím tắt toàn cục:
  - `⌘K` hoặc `Ctrl+K` (hoặc phím `N` khi không gõ text): Mở Modal tạo công việc mới.
  - Phím tắt `[` hoặc `Ctrl+B`: Thu gọn / Mở rộng Sidebar.
- Các mục menu có đầy đủ thuộc tính `aria-label`, `aria-current="page"` khi active.
- Tooltip hiển thị tên trang khi Sidebar ở chế độ thu gọn (`w-16`).

---

## 4. Kế hoạch Kiểm thử & Xác minh (Testing & Verification)

1. **Kiểm thử Đơn vị (Unit Tests):**
   - Tạo file test `tests/app-layout.test.ts` kiểm tra:
     - Khởi tạo và toggle trạng thái Sidebar (collapsed / expanded).
     - Bộ chuyển đổi Breadcrumb tương ứng với từng `pathname`.
     - 0% biểu tượng emoji gây loãng giao diện (tuân thủ nguyên tắc anti-slop).
2. **Kiểm thử Toàn vẹn (Regression Tests):**
   - Đảm bảo toàn bộ 23 bộ test hiện tại (120 test cases) tiếp tục pass 100%.
3. **Kiểm thử Trực quan trên Trình duyệt:**
   - Xác minh trên máy tính (1280px, 1440px) khi mở rộng Sidebar và khi thu gọn.
   - Xác minh trên kích thước điện thoại di động (375px) với thanh drawer trượt.
