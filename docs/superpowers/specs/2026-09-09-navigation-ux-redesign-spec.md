# Đặc Tả Kỹ Thuật & Thiết Kế Kiến Trúc: Tái Cấu Trúc Điều Hướng, Trạng Thái Tuyến Đường & Trải Nghiệm Sản Phẩm QCET E-Office

**Tài liệu:** Design Specification  
**Mã đặc tả:** SPEC-2026-09-09-NAV-UX  
**Ngày ban hành:** 09/09/2026  
**Trạng thái:** Chờ phê duyệt (Pending Approval)  
**Phạm vi:** Điều hướng (Navigation), Kiến trúc thông tin (IA), Khớp tuyến đường (Active State), Trung tâm thông báo (Notification Center), Vệ sinh giao diện (Anti AI-Slop).

---

## 1. Bối Cảnh & Mục Tiêu Dự Án (Context & Objectives)

### 1.1. Bối cảnh
Hệ thống phần mềm quản lý điều hành tác nghiệp trường học **QCET E-Office** (Cao đẳng Kỹ thuật Công nghệ Quy Nhơn) đã trải qua nhiều giai đoạn phát triển, dẫn đến sự tích tụ nợ kỹ thuật (technical debt) trong cơ chế điều hướng:
- Có sự lẫn lộn giữa mô hình Single Page Navigation (thay đổi `?zone=...` trên route `/`) và Multi-page Navigation của Next.js App Router (`/tasks`, `/calendar`, `/documents`, `/org`).
- Định nghĩa các mục menu điều hướng, hằng số route và danh sách badge bị sao chép phân tán ở 11 tệp tin khác nhau.
- Trang chủ `/` bị phân giải nhầm thành phân khu công việc (`TasksZone`), khiến người dùng khi bấm vào **"Bàn làm việc"** và **"Quản lý nhiệm vụ"** đều thấy chung một bảng danh sách công việc (`CascadingTaskTable`).
- Trạng thái Active trên điện thoại (Mobile Bottom Nav) và máy tính (Desktop Sidebar) bị lệch pha (desync).
- Trung tâm thông báo (`/notifications`) thiếu tính tác nghiệp, mang tính hình thức với số đếm badge bị gán cứng = 5.
- Giao diện có dấu hiệu của "AI-Slop" (hội chứng bento box thẻ lồng thẻ, lạm phát màu sắc pastel, bảng dữ liệu quá tải nút bấm ngụy trang thành badge).

### 1.2. Mục tiêu kỹ thuật & sản phẩm
1. **Thiết lập Single Source of Truth (SSOT):** Tạo module đăng ký điều hướng chuẩn hóa duy nhất (`src/lib/navigation/canonical-navigation-registry.ts`), loại bỏ hoàn toàn sự phân mảnh cấu hình.
2. **Phân định rõ ràng Kiến trúc Thông tin (IA):**
   - **Bàn làm việc (`/`):** Đúng bản chất Cockpit điều hành (KPIs, Hàng đợi duyệt việc khẩn cấp, Ma trận tiến độ 11 Khoa/Phòng, Hoạt động mới nhất).
   - **Quản lý nhiệm vụ (`/tasks`):** Trung tâm tác nghiệp phân cấp duy nhất (Bảng Cascading Task, Kanban Board, Bộ lọc chuyên sâu).
3. **Chuẩn hóa Thuật toán Active-State (`isRouteActive`):** Triệt tiêu hiện tượng nhấp nháy (flicker), chuyển hướng kép (redirect bouncing) trên `/calendar`, và đồng bộ hóa 100% giữa Desktop Sidebar, Topbar Breadcrumb, Mobile Bottom Nav và Mobile Drawer.
4. **Tái thiết kế Trung tâm Thông báo thành Actionable Inbox:** Gắn `NotificationPopover` vào Topbar, xóa số 5 giả, hỗ trợ nút thao tác nhanh (Duyệt nhanh, Xem minh chứng, Nhận chỉ đạo) ngay tại chỗ.
5. **Loại bỏ AI-Slop:** Làm phẳng dải metric (flat hairline grid), chuẩn hóa màu ngữ nghĩa (chỉ dùng màu cho trạng thái, không tô màu cầu vồng cho phòng ban), loại bỏ các thanh điều hướng trùng lặp.

---

## 2. Kiến Trúc Thông Tin & Bản Đồ Tuyến Đường (Information Architecture)

### 2.1. Phân cấp Menu & Route chuẩn hóa

| Thứ tự | Tên hiển thị (Label) | Tuyến đường chuẩn (Canonical Href) | Nhóm chức năng (Section) | Zone tương ứng (WorkspaceZone) | Vai trò & Mục đích sử dụng |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **1** | **Bàn làm việc** | `/` | `personal` | `dashboard` | **Cockpit điều hành:** BGH xem KPI, điểm nghẽn, tiến độ 11 đơn vị; Cán bộ xem việc trọng tâm hôm nay. |
| **2** | **Lịch công tác** | `/calendar` | `personal` | `calendar` | **Lịch biểu:** Lịch tuần BGH, lịch công tác đào tạo, lịch họp đơn vị. Render trực tiếp (bỏ redirect). |
| **3** | **Quản lý nhiệm vụ** | `/tasks` | `workspace` | `tasks` | **Kho công việc:** Bảng phân cấp (Trường $\rightarrow$ Đơn vị $\rightarrow$ Cá nhân), Kanban, phân công và kiểm soát hạn chót. |
| **4** | **Văn bản & Công văn** | `/documents` | `workspace` | `documents` | **Văn thư số:** Sổ văn bản đến, văn bản đi, dự thảo tờ trình theo Nghị định 30/2020/NĐ-CP. |
| **5** | **Cơ cấu & Danh bạ** | `/org` | `operations` | `org` | **Tổ chức:** Cây tổ chức 11 Khoa/Phòng/Trung tâm, danh bạ nhân sự QCET, tra cứu VTVL. |
| **6** | **Trung tâm thông báo** | `/notifications` | `personal` | N/A | **Hàng đợi hành động (Action Inbox):** Hồ sơ chờ duyệt, nhắc việc cận hạn, chỉ đạo khẩn. |
| **7** | **Cài đặt hệ thống** | `/settings` | `operations` | N/A | **Cấu hình:** Hồ sơ cá nhân, đổi mật khẩu, phân quyền, cấu hình Push PWA. |

### 2.2. Xử lý các liên kết chết và trùng lặp (Deprecations & Cleanups)
1. **`/kiosk`:** Xóa bỏ khỏi `mobile-menu-drawer.tsx`. Thay thế bằng lối tắt mở `/portal` hoặc xem toàn màn hình.
2. **`/unit-tasks`:** Giữ lại dưới dạng alias an toàn cho `/tasks?scope=unit` trong matcher, không hiển thị thành mục riêng trên menu để tránh gây rối.
3. **`/dashboard`:** Giữ lại làm alias trỏ về `/` (với `zone=dashboard`).

---

## 3. Đặc Tả Chi Tiết Thành Phần Kỹ Thuật (Technical Specifications)

### 3.1. Module Đăng Ký Điều Hướng Tập Trung (`canonical-navigation-registry.ts`)
Tệp mới: `src/lib/navigation/canonical-navigation-registry.ts`

```typescript
export type NavigationSection = "personal" | "workspace" | "operations";

export interface CanonicalRouteConfig {
  id: string;
  href: string;
  label: string;
  shortLabel: string;
  section: NavigationSection;
  iconName: "LayoutDashboard" | "Calendar" | "CheckSquare" | "FileText" | "Building2" | "Bell" | "Settings";
  zone?: "dashboard" | "tasks" | "calendar" | "documents" | "org" | "portal";
  badgeKey?: "calendar" | "notifications" | "docsInbox" | "docsOutbox" | "docsPending";
  aliases?: string[];
  mobileBottomPlacement?: boolean;
  mobileDrawerPlacement?: boolean;
  order: number;
}

export const CANONICAL_ROUTES: readonly CanonicalRouteConfig[] = [
  {
    id: "desk",
    href: "/",
    label: "Bàn làm việc",
    shortLabel: "Tổng quan",
    section: "personal",
    iconName: "LayoutDashboard",
    zone: "dashboard",
    aliases: ["/dashboard"],
    mobileBottomPlacement: true,
    mobileDrawerPlacement: false,
    order: 1,
  },
  {
    id: "calendar",
    href: "/calendar",
    label: "Lịch công tác",
    shortLabel: "Lịch tuần",
    section: "personal",
    iconName: "Calendar",
    zone: "calendar",
    badgeKey: "calendar",
    aliases: ["/?zone=calendar", "/?view=calendar", "/?view=month"],
    mobileBottomPlacement: false,
    mobileDrawerPlacement: true,
    order: 2,
  },
  {
    id: "tasks",
    href: "/tasks",
    label: "Quản lý nhiệm vụ",
    shortLabel: "Nhiệm vụ",
    section: "workspace",
    iconName: "CheckSquare",
    zone: "tasks",
    aliases: ["/unit-tasks", "/?zone=tasks"],
    mobileBottomPlacement: true,
    mobileDrawerPlacement: false,
    order: 3,
  },
  {
    id: "documents",
    href: "/documents",
    label: "Văn bản & Công văn",
    shortLabel: "Văn bản",
    section: "workspace",
    iconName: "FileText",
    zone: "documents",
    badgeKey: "docsInbox",
    aliases: ["/?zone=documents"],
    mobileBottomPlacement: false,
    mobileDrawerPlacement: true,
    order: 4,
  },
  {
    id: "org",
    href: "/org",
    label: "Cơ cấu & Danh bạ",
    shortLabel: "Tổ chức",
    section: "operations",
    iconName: "Building2",
    zone: "org",
    aliases: ["/?zone=org"],
    mobileBottomPlacement: false,
    mobileDrawerPlacement: true,
    order: 5,
  },
  {
    id: "notifications",
    href: "/notifications",
    label: "Thông báo & Nhắc việc",
    shortLabel: "Thông báo",
    section: "personal",
    iconName: "Bell",
    badgeKey: "notifications",
    mobileBottomPlacement: true,
    mobileDrawerPlacement: false,
    order: 6,
  },
  {
    id: "settings",
    href: "/settings",
    label: "Cài đặt hệ thống",
    shortLabel: "Cài đặt",
    section: "operations",
    iconName: "Settings",
    mobileBottomPlacement: false,
    mobileDrawerPlacement: true,
    order: 7,
  },
] as const;
```

### 3.2. Thuật Toán So Khớp Active-State (`active-matcher.ts`)
Tệp: `src/lib/navigation/active-matcher.ts`

- **Loại bỏ trễ khung hình:** Sử dụng Pure Derivation (tính toán thuần túy), không sao chép pathname vào `useState + useEffect`.
- **Logic phân định root `/` và các zone query:**
  1. Nếu người dùng ở `/` và không có param `zone`: Khớp duy nhất `/` ("Bàn làm việc").
  2. Nếu người dùng ở `/` kèm `?zone=tasks`: Khớp `/tasks` ("Quản lý nhiệm vụ"), không kích hoạt `/`.
  3. Nếu người dùng ở `/` kèm `?zone=calendar` hoặc `?view=calendar`: Khớp `/calendar`.
  4. Nếu truy cập route con `/tasks/NV-102`: Khớp `/tasks` với boundary check `/` an toàn (không match nhầm `/tasks-archive`).

### 3.3. Tái Phân Phối Trách Nhiệm Trang Chủ (`src/app/page.tsx`) & Fallback Zone
Tệp: `src/types/workspace.ts`
- Sửa hàm `parseZoneParam`:
  ```typescript
  export function parseZoneParam(param: string | null | undefined): WorkspaceZone {
    if (!param) return "dashboard"; // <-- SỬA: Mặc định rơi vào Cockpit/Dashboard
    const norm = param.toLowerCase().trim();
    if (norm === "tasks") return "tasks";
    if (norm === "calendar") return "calendar";
    if (norm === "documents") return "documents";
    if (norm === "org") return "org";
    if (norm === "portal") return "portal";
    return "dashboard";
  }
  ```
- Kết quả: Khi vào `http://localhost:3000/`, trang sẽ render:
  - **`DashboardZone`:** Gồm `ExecutiveStatStrip` (chỉ số toàn trường), `ExecutiveActionCenter` (hàng đợi duyệt việc cấp bách), `DepartmentProgressMatrix` (ma trận 11 Khoa/Phòng), `UpcomingDeadlinesWidget` và `ActivityFeedWidget`.
  - Không tải nhầm `CascadingTaskTable`.

### 3.4. Loại Bỏ Chuyển Hướng Kép Trên `/calendar`
Tệp: `src/app/calendar/page.tsx`
- Hiện tại: `useEffect` gọi `router.replace("/?view=calendar")` gây giật, nháy và lag URL.
- Cải tiến: Render trực tiếp component `CalendarZone` (hoặc `CalendarMonthView`) ngay trong `src/app/calendar/page.tsx`, đồng bộ với layout shell mà không cần chuyển trang vòng vo.

### 3.5. Xử Lý Các Lỗi Tương Tác Cốt Lõi (UX Interaction Fixes)
1. **Guard phím tắt `⌘B / Ctrl+B` (`src/components/layout/app-sidebar.tsx`):**
   - Bổ sung kiểm tra thẻ đang focus (`document.activeElement`). Nếu là `INPUT`, `TEXTAREA`, `SELECT` hoặc `isContentEditable`, bỏ qua sự kiện toggle sidebar.
2. **Khắc phục xung đột Modal kép (`CreateTaskModal`):**
   - Gỡ bỏ việc mount `CreateTaskModal` độc lập trong `src/components/layout/app-topbar.tsx`.
   - Toàn bộ sự kiện `qcet:open-create-task` do duy nhất `DashboardModalsHost` quản lý và kích hoạt.
3. **Đồng bộ hóa tên viết tắt Avatar (User Initials):**
   - Đưa hàm `getInitials(name)` chuẩn vào `src/lib/utils.ts`.
   - Sử dụng thống nhất cho cả Topbar và Mobile Drawer (loại bỏ lỗi cùng 1 người mà Topbar hiện "NV", Mobile hiện "NG").
4. **Khắc phục lỗi Bottom Bar che khuất nội dung:**
   - Cập nhật `app-shell.tsx`: Bổ sung padding đáy an toàn `pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-8`.

### 3.6. Tái Cấu Trúc Trung Tâm Thông Báo (Actionable Notification Hub)
1. **Gắn `NotificationPopover` vào Topbar:**
   - Thay thế thẻ `<Link href="/notifications">` trên `app-topbar.tsx` bằng nút bấm mở `NotificationPopover`.
   - Popover tải danh sách 5 thông báo chưa đọc gần nhất, hỗ trợ duyệt nhanh ngay tại chỗ và có link "Xem tất cả thông báo $\rightarrow$".
2. **Xóa bỏ badge hardcode = 5:**
   - Gỡ bỏ giá trị gán cứng trong `sidebar-context.tsx` và `use-dashboard-state.ts`.
   - Đồng bộ số đếm qua `useSidebarContext().badgeCounts` dựa trên dữ liệu thực tế từ database.
3. **Bổ sung Seed Data thông báo thực tế (`prisma/seed.ts`):**
   - Khởi tạo các bản ghi thông báo thực tế cho BGH, Trưởng phòng Đào tạo và Giảng viên (giao việc, nộp minh chứng, nhắc hạn 24h).

### 3.7. Vệ Sinh Thị Giác (Anti AI-Slop Guidelines)
1. **Làm phẳng `AdaptiveMetricStrip`:**
   - Chuyển cấu trúc thẻ lồng trong thẻ (3 lớp border) sang dạng lưới phẳng `grid divide-x divide-border/40 rounded-xl border border-border/60 bg-card`.
2. **Khử màu cầu vồng cho danh mục:**
   - Trong `CascadingTaskTable`: Thay các badge màu sắc pastel (indigo, sky, rose, teal, amber) của các phòng ban/chuyên môn thành tông trung tính `bg-secondary text-muted-foreground`.
   - Chỉ giữ màu cảnh báo cho: Đỏ (Quá hạn), Hổ phách (Chờ duyệt), Xanh lục (Hoàn thành).
3. **Loại bỏ Breadcrumb lặp lại:**
   - Xóa bỏ khối breadcrumb thứ 2 trong thân trang `src/app/tasks/page.tsx` (dòng 358–372).

---

## 4. Kế Hoạch Kiểm Thử & Chống Hồi Quy (Verification & Regression Plan)

### 4.1. Unit & Integration Tests Cần Bổ Sung/Cập Nhật
- `tests/navigation-active-matcher.test.ts`:
  - Test case: Truy cập `/` không param kích hoạt đúng "Bàn làm việc", tắt "Nhiệm vụ".
  - Test case: Truy cập `/?zone=tasks` kích hoạt đúng "Quản lý nhiệm vụ", tắt "Bàn làm việc".
  - Test case: Truy cập `/calendar` kích hoạt đúng "Lịch công tác".
  - Test case: Chống xung đột tiền tố `/tasks` vs `/tasks-archive`.
- `tests/app-layout.test.ts`:
  - Kiểm tra `resolveBreadcrumb("/")` trả về `["QCET E-Office", "Bàn làm việc"]`.
  - Đảm bảo 0% emoji xuất hiện trong các layout components.
- `tests/navigation-single-source-of-truth.test.ts` (Viết mới):
  - Kiểm tra tính đồng bộ tuyệt đối giữa `CANONICAL_ROUTES`, `SINGLE_TIER_NAV_ITEMS`, `NAV_ITEMS` và `WORKSPACE_ZONES`.

### 4.2. Quality Floor Commands
Tuân thủ nghiêm ngặt quy tắc tại `CLAUDE.md`:
1. `npm run typecheck` (`tsc --noEmit`) đạt 0 lỗi.
2. `npm test` (`tsx --test tests/**/*.test.ts`) 100% tests xanh.
3. Không chạy đè `next build` khi dev server đang chạy để tránh xung đột cache chunk.

---

Tài liệu thiết kế trên đã hoàn tất tự đánh giá tính khả thi và loại bỏ mọi placeholder. Vui lòng xem xét để chuyển sang giai đoạn tạo kế hoạch triển khai (Implementation Plan)!
