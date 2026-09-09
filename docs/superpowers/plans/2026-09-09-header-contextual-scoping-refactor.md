# Kế Hoạch Triển Khai: Tái Cấu Trúc Global Topbar & Contextual Page Action Bar (Chuẩn World-Class B2B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển `ScopeSwitcher` và `GlobalMonthSelector` từ thanh Global Topbar (`AppTopbar`) về thanh công cụ ngữ cảnh của trang Dashboard (`DashboardZone`), loại bỏ triệt để Anti-pattern "Leaky Global Shell", xóa bỏ các badge trùng lặp và giữ nguyên 100% tính năng cùng Spotlight Tour.

**Architecture:** Áp dụng mô hình Inverted-L Chrome theo chuẩn B2B SaaS (Linear, Stripe, Vercel). `AppTopbar` chỉ đảm nhận nhận diện vị trí và tiện ích toàn trường. `DashboardZone` tiếp nhận `ScopeSwitcher` và `GlobalMonthSelector` vào thanh Contextual Action Bar có bọc `Suspense` và giữ DOM ID `#tour-scope-switcher`, `#tour-month-selector`. Cập nhật các test suite bảo đảm 100% test xanh.

**Tech Stack:** Next.js 15 (App Router, React 19, Suspense), Tailwind CSS v4 (Light-Only OKLCH), TypeScript, Node.js Test Runner.

**Spec:** `docs/superpowers/specs/2026-09-09-header-contextual-scoping-refactor-design.md`

## Global Constraints

- Không dùng class `dark:`, khối `.dark`, hay logic chuyển theme (Light-Only chuẩn công sở hành chính giáo dục).
- 0% Emojis trong code và giao diện (QCET Anti-slop engineering rule).
- Không chạy `next build` đè lên dev server (tránh cache poisoning .next). Dùng `npm run typecheck` và `npm test`.
- Bảo đảm touch target tối thiểu 44x44px trên giao diện di động.
- Giữ nguyên DOM ID `#tour-scope-switcher` và `#tour-month-selector` cho Spotlight Tour.

---

### Task 1: Tinh Gọn Global Topbar (`src/components/layout/app-topbar.tsx`)

**Files:**
- Modify: `src/components/layout/app-topbar.tsx`
- Test: `tests/topbar-scope-switcher-integration.test.ts`

**Interfaces:**
- Consumes: `TopbarBreadcrumbs`, `useSidebar`, `useAuth`, `NotificationPopover`, `UserProfileModal`
- Produces: `AppTopbar` component không chứa `ScopeSwitcher` và `GlobalMonthSelector`, trả lại không gian thoáng cho Breadcrumbs và Global Search `⌘K`.

- [ ] **Step 1: Cập nhật test suite `tests/topbar-scope-switcher-integration.test.ts` theo tiêu chuẩn Clean Chrome**

Cập nhật `tests/topbar-scope-switcher-integration.test.ts` để kiểm tra:
1. `app-topbar.tsx` KHÔNG c��n import hay render `ScopeSwitcher` hay `GlobalMonthSelector` (Clean Chrome Invariant).
2. `app-topbar.tsx` giữ nguyên `TopbarBreadcrumbs`, `tour-topbar-search`, và các utility action.
3. `dashboard-zone.tsx` là nơi import và bọc `ScopeSwitcher` trong `Suspense`.

```typescript
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Topbar Clean Chrome & Contextual Scoping Invariants", () => {
  const topbarPath = path.join(process.cwd(), "src/components/layout/app-topbar.tsx");
  const dashboardZonePath = path.join(process.cwd(), "src/components/dashboard/zones/dashboard-zone.tsx");

  test("app-topbar.tsx exists and is readable", () => {
    assert.strictEqual(fs.existsSync(topbarPath), true, "app-topbar.tsx must exist");
  });

  test("app-topbar.tsx enforces Clean Chrome: does NOT import ScopeSwitcher or GlobalMonthSelector", () => {
    const content = fs.readFileSync(topbarPath, "utf-8");
    assert.ok(
      !content.includes("ScopeSwitcher"),
      "app-topbar.tsx must not contain ScopeSwitcher to prevent Leaky Global Shell"
    );
    assert.ok(
      !content.includes("GlobalMonthSelector"),
      "app-topbar.tsx must not contain GlobalMonthSelector to prevent Leaky Global Shell"
    );
  });

  test("app-topbar.tsx maintains essential global chrome elements", () => {
    const content = fs.readFileSync(topbarPath, "utf-8");
    assert.ok(content.includes("TopbarBreadcrumbs"), "Topbar must retain TopbarBreadcrumbs");
    assert.ok(content.includes('id="tour-topbar-search"'), "Topbar must retain tour-topbar-search");
    assert.ok(content.includes("NotificationPopover"), "Topbar must retain NotificationPopover");
  });

  test("dashboard-zone.tsx mounts ScopeSwitcher and GlobalMonthSelector inside React Suspense", () => {
    const content = fs.readFileSync(dashboardZonePath, "utf-8");
    assert.match(
      content,
      /import\s+\{\s*ScopeSwitcher\s*\}\s+from\s+["']@\/components\/layout\/scope-switcher["']/,
      "dashboard-zone.tsx must import ScopeSwitcher"
    );
    assert.match(
      content,
      /import\s+\{\s*GlobalMonthSelector\s*\}\s+from\s+["']@\/components\/layout\/global-month-selector["']/,
      "dashboard-zone.tsx must import GlobalMonthSelector"
    );
    assert.ok(
      content.includes('id="tour-scope-switcher"'),
      "dashboard-zone.tsx must maintain id='tour-scope-switcher' for Spotlight Tour"
    );
    assert.ok(
      content.includes('id="tour-month-selector"'),
      "dashboard-zone.tsx must maintain id='tour-month-selector' for Spotlight Tour"
    );
  });

  test("Anti-slop rule: 0% emojis in app-topbar.tsx", () => {
    const content = fs.readFileSync(topbarPath, "utf-8");
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
    const matches = content.match(emojiRegex);
    assert.strictEqual(matches, null, "app-topbar.tsx must contain zero emojis");
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại (Red)**

Run: `node --test tests/topbar-scope-switcher-integration.test.ts`
Expected: FAIL (vì `app-topbar.tsx` vẫn đang chứa `ScopeSwitcher` và `dashboard-zone.tsx` chưa import).

- [ ] **Step 3: Sửa `src/components/layout/app-topbar.tsx`**

1. Gỡ bỏ imports:
```typescript
import { ScopeSwitcher } from "@/components/layout/scope-switcher";
import { GlobalMonthSelector } from "@/components/layout/global-month-selector";
```
2. Gỡ bỏ khối chứa separator và 2 dropdowns ở `Left Zone`:
```tsx
{/* Breadcrumb - Scope Separator */}
<div className="h-4 w-px bg-border/60 shrink-0 hidden sm:block" />

{/* Scope Switcher Dropdown */}
<div id="tour-scope-switcher">
  ...
</div>

{/* Global Academic Month Selector */}
<div id="tour-month-selector">
  ...
</div>
```
3. Giữ nguyên cấu trúc `Left Zone`:
```tsx
{/* Left Zone: Desktop Collapse Toggle & Dynamic Breadcrumbs */}
<div className="flex items-center min-w-0 gap-2 sm:gap-3">
  {/* Desktop Sidebar Toggle (>= 768px) */}
  <Button
    variant="ghost"
    size="icon-sm"
    className="hidden md:inline-flex size-8 mr-1 shrink-0 text-muted-foreground hover:text-foreground"
    onClick={toggleCollapse}
    title="Thu gọn / Mở rộng thanh bên (phím [ hoặc Ctrl+B)"
    aria-label="Thu gọn / Mở rộng thanh bên"
  >
    {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
  </Button>

  {/* Dynamic Breadcrumbs */}
  <Suspense fallback={<TopbarBreadcrumbsFallback pathname={pathname} />}>
    <TopbarBreadcrumbs pathname={pathname} />
  </Suspense>
</div>
```

- [ ] **Step 4: Chạy lại test riêng của topbar để xác nhận phần topbar đã sạch**

Run: `node --test tests/topbar-consolidation.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/app-topbar.tsx tests/topbar-scope-switcher-integration.test.ts
git commit -m "refactor(topbar): remove contextual scope and month selectors from global chrome"
```

---

### Task 2: Tích Hợp Contextual Action Bar Tại `DashboardZone` (`src/components/dashboard/zones/dashboard-zone.tsx`)

**Files:**
- Modify: `src/components/dashboard/zones/dashboard-zone.tsx`
- Test: `tests/topbar-scope-switcher-integration.test.ts`
- Test: `tests/global-month-selector.test.ts`

**Interfaces:**
- Consumes: `ScopeSwitcher` from `@/components/layout/scope-switcher`, `GlobalMonthSelector` from `@/components/layout/global-month-selector`, `useDashboardActions`, `useDashboardData`
- Produces: Contextual Action Bar trong `DashboardZone` gồm ScopeSwitcher, GlobalMonthSelector, nút Làm mới dữ liệu, và loại bỏ các text badge trùng lặp.

- [ ] **Step 1: Cập nhật `tests/global-month-selector.test.ts`**

Cập nhật test case số 2 trong `tests/global-month-selector.test.ts` để kiểm tra `dashboard-zone.tsx` chứa `GlobalMonthSelector`:
```typescript
  test("dashboard-zone.tsx includes GlobalMonthSelector alongside ScopeSwitcher in contextual toolbar", () => {
    const dashboardZonePath = path.resolve(process.cwd(), "src/components/dashboard/zones/dashboard-zone.tsx");
    const content = fs.readFileSync(dashboardZonePath, "utf8");
    assert.match(content, /GlobalMonthSelector/);
    assert.match(content, /ScopeSwitcher/);
  });
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại (Red)**

Run: `node --test tests/global-month-selector.test.ts`
Expected: FAIL with "GlobalMonthSelector not found in dashboard-zone.tsx".

- [ ] **Step 3: Triển khai Contextual Action Bar trong `src/components/dashboard/zones/dashboard-zone.tsx`**

1. Import thêm `Suspense` từ `"react"`, `ScopeSwitcher` từ `"@/components/layout/scope-switcher"`, và `GlobalMonthSelector` từ `"@/components/layout/global-month-selector"`.
2. Thay thế khối Header hiện tại (dòng 45-85) bằng layout chuẩn World-Class:
   - Header title & subtitle rõ ràng.
   - Loại bỏ badge tĩnh `KỲ VẬN HÀNH THÁNG ...` và `BGH Giám sát toàn trường` / `Đơn vị: ...` vì người dùng đã có 2 bộ chọn trực tiếp ngay bên dưới.
   - Contextual Toolbar bọc trong container `flex flex-wrap items-center justify-between gap-3 p-2 rounded-2xl bg-muted/30 border border-border/50`:
     - Nhóm bên trái:
       - `<div id="tour-scope-switcher"><Suspense fallback={<div className="h-8 w-44 rounded-lg bg-muted/40 animate-pulse" />}><ScopeSwitcher /></Suspense></div>`
       - `<div id="tour-month-selector"><Suspense fallback={<div className="h-8 w-32 rounded-lg bg-muted/40 animate-pulse" />}><GlobalMonthSelector /></Suspense></div>`
     - Nhóm bên phải:
       - Nút `<Button variant="outline" size="sm" onClick={handleManualRefresh}>` với `RefreshCw` và text `Làm mới dữ liệu`.

- [ ] **Step 4: Chạy test kiểm chứng**

Run: `node --test tests/global-month-selector.test.ts tests/topbar-scope-switcher-integration.test.ts`
Expected: PASS cả 2 test files!

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/zones/dashboard-zone.tsx tests/global-month-selector.test.ts
git commit -m "feat(dashboard): integrate contextual action bar with scope and academic month selectors"
```

---

### Task 3: Cập Nhật & Đồng Bộ Hóa Các Test Suite Phụ Thuộc (E2E & Integration Tests)

**Files:**
- Modify: `tests/single-tier-navigation-e2e.test.ts`
- Modify: `tests/onboarding-integration.test.ts`

**Interfaces:**
- Consumes: Existing test suite invariants
- Produces: 100% green test suite phản ánh đúng kiến trúc mới.

- [ ] **Step 1: Cập nhật `tests/single-tier-navigation-e2e.test.ts`**

Trong `tests/single-tier-navigation-e2e.test.ts`, cập nhật test case dòng 243:
- Kiểm tra `AppTopbar` duy trì Clean Chrome (không import `ScopeSwitcher`).
- Kiểm tra `DashboardZone` mount `ScopeSwitcher` bọc trong `Suspense`.

- [ ] **Step 2: Cập nhật `tests/onboarding-integration.test.ts`**

Trong `tests/onboarding-integration.test.ts`, đảm bảo kiểm tra `#tour-scope-switcher` tìm thấy trong `dashboard-zone.tsx` hoặc `scope-switcher.tsx`.

- [ ] **Step 3: Chạy toàn bộ test suites**

Run: `npm test`
Expected: Toàn bộ các bài test đều PASS (100% xanh).

- [ ] **Step 4: Chạy kiểm tra kiểu dữ liệu TypeScript**

Run: `npm run typecheck`
Expected: `tsc --noEmit` thoát mã 0, không có bất kỳ lỗi type nào.

- [ ] **Step 5: Commit**

```bash
git add tests/single-tier-navigation-e2e.test.ts tests/onboarding-integration.test.ts
git commit -m "test(navigation): sync e2e and onboarding test suites with contextual toolbar architecture"
```

---

### Task 4: Kiểm Thử Thực Tế & Thẩm Định Trực Quan (Verification & Visual Polish)

**Files:**
- Read-only verify: UI rendering trên `http://localhost:3001`

- [ ] **Step 1: Kiểm tra trạng thái Dev Server**

Kiểm tra dev server đang chạy cổng 3001 (không chạy `next build` để tránh cache conflict theo rule CLAUDE.md).

- [ ] **Step 2: Thẩm định trực quan (Visual Verification)**

Xác nhận:
1. Topbar trên mọi trang (`/`, `/calendar`, `/tasks`, `/documents`, `/org`, `/settings`) tinh gọn, chỉ có breadcrumb + ô tìm kiếm ⌘K + notification/profile.
2. Trên Dashboard (`/`): Thanh Contextual Toolbar hiển thị hài hòa, bộ chọn Scope và Tháng nằm liền kề số liệu KPI và nút Làm mới.
3. Không có lỗi hydration hay console error.
4. Đạt chuẩn 0% emojis, Light-only, min 44x44px touch target.
