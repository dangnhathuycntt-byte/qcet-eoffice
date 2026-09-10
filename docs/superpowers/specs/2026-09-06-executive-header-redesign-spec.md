# Executive Header Redesign Specification

- **System:** QCET E-Office (Phân hệ Điều hành & Quản lý Công việc)
- **Status:** Approved
- **Author:** Antigravity / Claude
- **Date:** 2026-09-06

---

## 1. Context & Objectives

The current `AppTopbar` in `src/components/layout/app-topbar.tsx` contains several UX anti-patterns:
1. **Zoom 120% button:** Intervenes directly in `document.documentElement.style.zoom`, violating WCAG accessibility and modern browser standards where zoom is native via `Ctrl/Cmd +/-`.
2. **LiveClock timer:** Re-renders every second, distracting users in an enterprise executive interface.
3. **RoleSwitcherPill pinned globally:** In a real production system, each employee has one assigned identity/role. A persistent switcher in the top bar is confusing for end users and breaks the mental model of enterprise SSO.
4. **`+ Giao việc` pinned globally in Header:** Creating and delegating tasks is a contextual action belonging inside the Task Management workspace (`UnifiedTaskToolbar` & `CascadingTaskTable`), not globally pinned across unrelated screens like calendar or org directory.

### Core Objectives:
1. Eliminate all anti-pattern controls (`ZoomToggle`, `LiveClock`, global `+ Giao việc`, and visible `RoleSwitcherPill`).
2. Implement a 3-zone Executive Header layout conforming to 52px height:
   - **Left:** Sidebar collapse/open toggle (`Ctrl+B`) + Dynamic breadcrumb path (`QCET E-Office › [Trang/Phân khu]`).
   - **Center:** Global Command Search trigger bar (`Tìm nhanh công việc, nhân sự... ⌘K`).
   - **Right:** Notification Bell (with unread badge linking to `/notifications`), Theme Toggle (Sun/Moon), and User Profile popover.
3. Move Dev/Testing role switching inside the User Profile popover menu so engineers/testers can still switch RBAC roles without cluttering the main UI.
4. Maintain 0% emoji anti-slop rules, Lucide SVG icons only, and full test suite passing.

---

## 2. Component Specifications

### 2.1 Left Section: Navigation & Context
- **Desktop Sidebar Toggle:** `Button` (ghost, icon-sm) with `PanelLeftClose` (expanded) / `PanelLeftOpen` (collapsed).
- **Mobile Menu Trigger:** `Button` (ghost, icon-sm) with `Menu` icon (`< 768px`).
- **Dynamic Breadcrumbs:**
  - Map current route and query parameter to readable title:
    - `/` or `/?zone=tasks`: `Quản lý công việc`
    - `/?zone=portal`: `Cổng Portal Điều hành`
    - `/?zone=dashboard`: `Dashboard Điều hành & KPI`
    - `/calendar`: `Lịch công tác`
    - `/org`: `Cơ cấu tổ chức & Danh bạ`
    - `/notifications`: `Thông báo điều hành`
  - Render `QCET E-Office` as root text, separated by `ChevronRight` (12px), followed by bold `pageTitle`.

### 2.2 Center Section: Command Search Bar
- Width: `w-64 sm:w-80 md:w-96`, height: `h-8`.
- Rounded corners (`rounded-lg`), subtle border (`border border-border/60`), muted background (`bg-muted/30 hover:bg-muted/50`).
- Left icon: `Search` (size 14, `text-muted-foreground`).
- Placeholder text: `Tìm kiếm nhanh...` or `Tìm nhanh công việc, nhân sự...` (`text-xs text-muted-foreground`).
- Right shortcut key: `<kbd className="text-[10px] font-mono px-1 py-0.5 rounded border border-border/60 bg-background/80 text-muted-foreground">⌘K</kbd>`.
- Interaction: Clicking or pressing `⌘K` / `Ctrl+K` triggers the search action / search palette.

### 2.3 Right Section: Personal Utilities & Profile
- **Notification Bell:**
  - Ghost icon button (`size-8 rounded-lg text-muted-foreground hover:text-foreground`).
  - Icon: `Bell` (size 15).
  - Unread badge: Red indicator dot or count pill when urgent/unread items exist. Links or navigates to `/notifications`.
- **Theme Switcher:**
  - Ghost icon button (`size-8 rounded-lg text-muted-foreground hover:text-foreground`).
  - Icon: `Sun` (amber in dark mode) or `Moon` (muted in light mode).
- **User Profile Trigger & Dropdown:**
  - Avatar badge (`size-8 rounded-lg bg-primary/10 text-primary border border-primary/20 font-semibold text-xs`).
  - Text block: User name (truncated, font-semibold text-xs) + Role title / Department (text-[10.5px] text-muted-foreground).
  - Icon `ChevronDown` (size 12).
  - **Dropdown Menu:**
    - Profile summary header (name, email, role badge, verified icon).
    - Link to `UserProfileModal` ("Hồ sơ cá nhân").
    - Sub-menu or collapsable section: "Chế độ kiểm thử vai trò (Dev)" containing ADMIN / MANAGER / STAFF selection so developers and testers can verify role-based access.
    - Divider.
    - Logout button ("Đăng xuất" with `LogOut` icon).

---

## 3. Files & Test Changes

1. `src/components/layout/app-topbar.tsx`: Rebuilt with the new clean 3-zone layout.
2. `src/components/layout/sidebar-context.tsx`: Updated breadcrumb resolver to recognize `?zone=` parameters.
3. `src/components/navigation.tsx`: Remove redundant legacy Zoom/Clock exports or mark deprecated.
4. `tests/app-layout.test.ts`: Update assertions to match the new topbar structure (verifying Search bar, Bell, new Profile dropdown, absence of Zoom/LiveClock/Header Giao việc).
