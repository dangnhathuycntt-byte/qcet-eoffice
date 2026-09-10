---
status: superseded
domain: ux
created: 2026-09-06
superseded_by: 2026-09-09-master-ux-consolidation-plan.md
---

# Executive Header Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the top navigation header (`AppTopbar`) to eliminate clutter and anti-patterns (Zoom button, LiveClock second-timer, contextual task creation button, exposed role switcher), delivering a high-end 3-zone Executive Header: Left (Sidebar toggle + Contextual Breadcrumbs), Center (Global Command Search bar with ⌘K), and Right (Notification Bell, Theme switch, User Profile with embedded dev role switcher).

**Architecture:** Update `resolveBreadcrumb` in `src/components/layout/sidebar-context.tsx` to handle route paths and query parameters. Rebuild `src/components/layout/app-topbar.tsx` with clean 52px height, Search trigger, Bell button with badge, Theme toggle, and an upgraded Profile dropdown containing user details and embedded dev role testing controls. Clean up legacy helper components and update test suite `tests/app-layout.test.ts`.

**Tech Stack:** Next.js 15 (App Router), React 19, Tailwind CSS v4, Lucide Icons, TypeScript.

**Spec:** [docs/superpowers/specs/2026-09-06-executive-header-redesign-spec.md](../specs/2026-09-06-executive-header-redesign-spec.md)

## Global Constraints

- Header height: exactly `52px` (`h-[52px]`), sticky with `bg-background/80 backdrop-blur-md` and `border-b border-border/50`.
- Anti-slop: 0% emojis in navigation labels, search placeholders, tooltips, and breadcrumbs.
- Accessibility: standard native browser zoom (`Ctrl/Cmd +/-`), no intrusive `style.zoom` buttons.
- Separation of concerns: Task creation is contextual and handled inside Task Hub / Cascading Task Table, not pinned globally in the header.
- Backward compatibility & safety: preserve global events (`qcet:open-create-task`) and ensure full test suite passes.

---

### Task 1: Contextual Breadcrumb Resolver Upgrade

**Files:**
- Modify: `src/components/layout/sidebar-context.tsx`
- Modify: `tests/app-layout.test.ts`

**Interfaces:**
- Consumes: pathname, search params
- Produces: `resolveBreadcrumb(pathname: string, searchParams?: string | URLSearchParams)`

- [ ] **Step 1: Update `resolveBreadcrumb` to support zones and sub-routes**

Extend `resolveBreadcrumb` to accept optional search params or query string so that:
- `/?zone=portal` resolves to `["QCET E-Office", "Cổng Portal Điều hành"]`
- `/?zone=dashboard` resolves to `["QCET E-Office", "Dashboard Điều hành & KPI"]`
- `/` or `/?zone=tasks` resolves to `["QCET E-Office", "Quản lý công việc"]`
- `/calendar` resolves to `["QCET E-Office", "Lịch công tác"]`
- `/org` resolves to `["QCET E-Office", "Cơ cấu tổ chức & Danh bạ"]`
- `/notifications` resolves to `["QCET E-Office", "Thông báo điều hành"]`

- [ ] **Step 2: Run test suite to verify breadcrumb resolution**

Run: `node --test tests/app-layout.test.ts`

---

### Task 2: Rebuild Executive AppTopbar Component

**Files:**
- Modify: `src/components/layout/app-topbar.tsx`

**Interfaces:**
- Consumes: `useSidebar`, `useTheme`, `useAuth`, `resolveBreadcrumb`
- Produces: Refined `AppTopbar` component conforming to 3-zone Executive Header layout

- [ ] **Step 1: Remove cluttering anti-patterns from AppTopbar**
- Remove `ZoomToggle` and `LiveClock` components and their imports.
- Remove visible `RoleSwitcherPill` from the topbar bar.
- Remove the topbar `+ Giao việc` button (task creation remains accessible in the page work areas).

- [ ] **Step 2: Implement Center Command Search Bar**
- Add search trigger button with `Search` icon (`size-3.5`), placeholder `Tìm nhanh công việc, nhân sự...` or `Tìm kiếm nhanh... (⌘K)`, and `<kbd>⌘K</kbd>` badge.
- Clicking dispatches a global search event or triggers task/people search.

- [ ] **Step 3: Implement Right Section with Notification Bell, Theme Toggle & Profile Popover**
- Add Notification Bell link/button (`size-8 rounded-lg`) with `Bell` icon (`size-4`) linking to `/notifications` with badge.
- Add Theme toggle button (`Sun` / `Moon`).
- Upgrade Profile dropdown:
  - Header with user info, avatar, role badge.
  - Action items: Hồ sơ cá nhân (`setIsProfileModalOpen(true)`).
  - Collapsible or nested "Chế độ kiểm thử vai trò (Dev)" for role simulation (`ADMIN`, `MANAGER`, `STAFF`).
  - Logout button.

- [ ] **Step 4: Verify syntax and preview build**
Run: `npm test` and verify browser preview.

---

### Task 3: Clean Legacy Components & Update Test Contracts

**Files:**
- Modify: `src/components/navigation.tsx`
- Modify: `tests/app-layout.test.ts`

- [ ] **Step 1: Deprecate/clean unused helpers in navigation.tsx**
Remove or streamline unused `ZoomToggle` / `LiveClock` if not used anywhere else.

- [ ] **Step 2: Update `tests/app-layout.test.ts` assertions**
Update `AppTopbar Component Contracts` tests:
- Assert that search command bar is present (`⌘K` or search trigger).
- Assert that Notification Bell and theme toggle are wired.
- Assert that `ZoomToggle` and `LiveClock` are no longer in the topbar bar.
- Assert that user profile menu renders cleanly with role testing support.

- [ ] **Step 3: Run entire test suite to guarantee 0 regressions**
Run: `npm test` (verify all 275+ tests pass).
