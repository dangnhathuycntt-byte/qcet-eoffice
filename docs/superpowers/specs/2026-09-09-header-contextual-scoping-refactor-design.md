# Thiết Kế Kỹ Thuật: Tái Cấu Trúc Phân Tách Global Topbar & Contextual Page Action Bar (Chuẩn World-Class B2B)

- **Ngày ban hành:** 2026-09-09
- **Dự án:** QCET E-Office (Hệ thống Điều hành Văn phòng Điện tử)
- **Mục tiêu:** Xóa bỏ Anti-pattern "Leaky Global Shell", đưa bộ chọn Phạm vi (`ScopeSwitcher`) và Kỳ vận hành (`GlobalMonthSelector`) từ Global Topbar về đúng Page Header của Dashboard; chuẩn hóa thanh điều hướng toàn trường theo tiêu chuẩn Linear, Stripe, Vercel.

---

## 1. Bối cảnh & Vấn đề (Context & Root Cause)

### 1.1. Thực trạng hiện tại
Trong thanh tiêu đề toàn cục `AppTopbar` (`src/components/layout/app-topbar.tsx`), hai bộ điều khiển dữ liệu:
1. `ScopeSwitcher` (`#tour-scope-switcher`) - Bộ chọn phạm vi: *Toàn trường (BGH QCET) / Đơn vị / Việc của tôi*
2. `GlobalMonthSelector` (`#tour-month-selector`) - Bộ chọn kỳ vận hành học viện: *Tháng 9 (25/08 - 24/09)...*

đang bị gắn cứng vào giữa Breadcrumbs và Ô tìm kiếm `⌘K`.

### 1.2. Hậu quả UX/UI
- **Rò rỉ bộ lọc ngữ cảnh (Leaky Global Shell):** Khi người dùng điều hướng sang bất kỳ trang nào khác trong hệ thống như:
  - `Lịch công tác` (`/calendar`): Trang đã có sẵn thanh điều hướng Tháng/Tuần/Ngày/Hôm nay; bộ chọn tháng trên Topbar trở nên dư thừa và gây xung đột nhận thức.
  - `Quản lý nhiệm vụ` (`/tasks`): Quản lý công việc có hệ thống lọc danh sách/kanban riêng;
  - `Văn bản` (`/documents`), `Cơ cấu & Danh bạ` (`/org`), `Cài đặt` (`/settings`): Hoàn toàn không liên quan đến chu kỳ vận hành tháng 9 của Dashboard.
- **Trùng lặp hiển thị nặng nề trên Dashboard (Redundancy):**
  - Trên Topbar: Hiển thị `[Phạm vi: Toàn trường]` và `[Tháng 9 (25/08 - 24/09)]`.
  - Ngay bên dưới tiêu đề trang (cách 20px): Lại lặp lại 2 badge: `KỲ VẬN HÀNH THÁNG 9 (25/08 - 24/09)` và `BGH Giám sát toàn trường`.
  - Người dùng phải tiếp nhận cùng một thông tin trạng thái 2 lần trên cùng một màn hình.

---

## 2. Chuẩn mực Thiết kế World-Class (Design Principles)

Tuân thủ nghiêm ngặt mô hình **Inverted-L Architecture** của các sản phẩm B2B SaaS hàng đầu (Linear, Stripe Dashboard, Vercel, SAP Fiori Dynamic Page):

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ GLOBAL APP SHELL (Topbar) - Toàn trường, bất biến, thuần túy điều hướng                │
│ [☰] QCET E-Office > Bàn làm việc           [🔍 Tìm nhanh... ⌘K]        [🔔] [📱] [👤 TT]│
├────────────────────────────────────────────────────────────────────────────────────────┤
│ PAGE WORKSPACE (Dashboard)                                                             │
│                                                                                        │
│   [Phân khu Điều hành]                                                                 │
│   Dashboard Điều Hành & Báo Cáo KPI                                                    │
│   Theo dõi toàn cảnh tiến độ, điểm nghẽn, và hàng đợi phê duyệt chiến lược 11 đơn vị   │
│                                                                                        │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │ CONTEXTUAL ACTION BAR / TOOLBAR                                                │   │
│   │ [ Phạm vi: Toàn trường ▾ ]   [ Kỳ tháng 9 (25/08 - 24/09) ▾ ]  [ ↻ Làm mới ]   │   │
│   └────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                        │
│   [ KPI Stat Strip: 130 Nhiệm vụ | 0 Công việc ĐV | 0 Cần xử lý | 44% Tiến độ ]        │
│   ...                                                                                  │
└─────────────────────────────────────────────────────────────────────────────��──────────┘
```

### Nguyên tắc phân tầng:
1. **Global Topbar (Khung vỏ hệ thống):**
   - Chỉ chứa thông tin nhận diện vị trí (*Breadcrumbs*), truy cập nhanh toàn trường (*Command Search ⌘K*), và tiện ích cá nhân (*Thông báo, App, Profile*).
   - **Tuyệt đối không chứa bộ lọc dữ liệu của một trang cụ thể.**
2. **Page Header & Contextual Toolbar (Thanh công cụ nghiệp vụ):**
   - Nằm trực tiếp bên trong từng trang/phân khu.
   - Gắn liền các bộ điều khiển (*Scope, Month, View Mode, Action Buttons*) vào ngay phía trên dữ liệu/chỉ số mà nó kiểm soát.
   - Xóa bỏ các badge chữ tĩnh bị trùng lặp, biến các lựa chọn thành bộ điều khiển tương tác trực quan.

---

## 3. Kiến Trúc Kỹ Thuật & Chi Tiết Triển Khai

### 3.1. Tinh gọn `AppTopbar` (`src/components/layout/app-topbar.tsx`)
- **Loại bỏ:**
  - Import `ScopeSwitcher` và `GlobalMonthSelector`.
  - Vạch phân cách `div.h-4.w-px`.
  - Khối chứa `<div id="tour-scope-switcher">` và `<div id="tour-month-selector">`.
- **Cấu trúc sau tái cấu trúc:**
  - **Zone Trái:**
    - Button Desktop Sidebar Toggle (`PanelLeftOpen`/`PanelLeftClose`).
    - `TopbarBreadcrumbs` bọc trong `Suspense`.
  - **Zone Giữa:**
    - Button Command Search `⌘K` (Responsive: icon trên mobile, search bar trên tablet/desktop).
  - **Zone Phải:**
    - Mobile Search trigger button.
    - Notification Popover trigger.
    - Mobile App Install Modal trigger.
    - User Profile dropdown menu + User Avatar initials.

### 3.2. Nâng cấp Page Header & Toolbar tại `DashboardZone` (`src/components/dashboard/zones/dashboard-zone.tsx`)
- **Tích hợp Contextual Toolbar:**
  Tạo khu vực công cụ ngữ cảnh nằm ngay dưới phần tiêu đề Dashboard, tập hợp:
  1. `<ScopeSwitcher />` (được bọc trong `Suspense` và giữ DOM ID `id="tour-scope-switcher"`).
  2. `<GlobalMonthSelector />` (được bọc trong `Suspense` và giữ DOM ID `id="tour-month-selector"`).
  3. `<Button onClick={handleManualRefresh}>` ("Làm mới dữ liệu" với icon spin khi `isRefreshing`).
- **Loại bỏ hiển thị trùng lặp:**
  - Loại bỏ badge tĩnh `KỲ VẬN HÀNH THÁNG ${selectedAcademicMonth}` vì `GlobalMonthSelector` đã thể hiện rõ ràng và cho phép người dùng click để đổi kỳ.
  - Loại bỏ chuỗi tĩnh `BGH Giám sát toàn trường` / `Đơn vị: ...` vì `ScopeSwitcher` đã hiển thị đầy đủ nhãn ngữ cảnh và cho phép người dùng chuyển đổi.
- **Thiết kế Responsive Flexbox:**
  - Màn hình Desktop (>= 768px): Một thanh ngang tinh gọn, các bộ lọc nằm bên trái, nút "Làm mới dữ liệu" nằm bên phải hoặc nhóm lại khoa học.
  - Màn hình Mobile (< 768px): Stack dọc mượt mà với min touch target 44x44px.

---

## 4. Bảo Toàn Tương Thích & Tính Năng Phụ Thuộc (Compatibility Invariants)

1. **Spotlight Tour & Onboarding:**
   - Các selector `#tour-scope-switcher` và `#tour-month-selector` được bảo lưu nguyên vẹn tại `DashboardZone` (màn hình chính mà người dùng trải nghiệm tour).
   - Đảm bảo `src/components/onboarding/spotlight-tour.tsx` và `src/lib/onboarding-constants.ts` tiếp tục định vị và highlight chính xác các thành phần này.
2. **URL Search Params & Context Sync:**
   - `ScopeSwitcher` vẫn đọc/ghi `?scope=...&dept=...` đồng bộ với `useDashboardNav`.
   - `GlobalMonthSelector` vẫn đọc/ghi `?month=...` đồng bộ với `DashboardStateProvider`.
3. **Tiêu chuẩn Giao diện QCET:**
   - **0% Emojis** (Anti-slop rule của toàn dự án).
   - **Light-only** (OKLCH, không dùng `dark:`).
   - Touch targets chuẩn tối thiểu 44x44px cho tương tác di động.

---

## 5. Kế Hoạch Kiểm Thử & Di Chuyển Test (Test Migration Strategy)

Cập nhật các test suite hiện tại vốn giả định `ScopeSwitcher` và `GlobalMonthSelector` nằm trong Topbar:

| File Test | Hiện trạng | Cập nhật sau Refactor |
| :--- | :--- | :--- |
| `tests/global-month-selector.test.ts` | Khẳng định Topbar import `GlobalMonthSelector` | Đổi sang kiểm tra `GlobalMonthSelector` được import và mount trong `dashboard-zone.tsx` (đúng chuẩn contextual page header). |
| `tests/topbar-scope-switcher-integration.test.ts` | Kiểm tra Topbar import `ScopeSwitcher` | Đổi tên/cập nhật sang kiểm tra `AppTopbar` sạch sẽ (clean chrome invariant) và `dashboard-zone.tsx` tích hợp `ScopeSwitcher` với `Suspense`. |
| `tests/single-tier-navigation-e2e.test.ts` | Khẳng định Topbar mount `ScopeSwitcher` | Cập nhật kiểm tra cấu trúc Topbar tinh gọn và vị trí mới của `ScopeSwitcher`. |
| `tests/onboarding-integration.test.ts` | Tìm `#tour-scope-switcher` trong Topbar | Cập nhật selector xác nhận `#tour-scope-switcher` tồn tại trong layout ứng dụng (tại Page Workspace). |
| `tests/topbar-consolidation.test.ts` | Đảm bảo Topbar hợp nhất không lỗi | Kiểm tra Topbar hoạt động ổn định không còn dư thừa các bộ lọc dữ liệu. |

Toàn bộ quá trình hoàn tất phải vượt qua `npm run typecheck` và `npm test` với 100% test xanh.
