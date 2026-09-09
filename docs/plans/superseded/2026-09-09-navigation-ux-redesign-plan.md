---
status: superseded
domain: ux
created: 2026-09-09
superseded_by: 2026-09-09-master-ux-consolidation-plan.md
---

# Kế Hoạch Triển Khai: Tái Cấu Trúc Điều Hướng, Trạng Thái Tuyến Đường & Trải Nghiệm Sản Phẩm QCET E-Office

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triệt để giải quyết các vấn đề điều hướng: phân định rạch ròi Bàn làm việc (`/`) và Quản lý nhiệm vụ (`/tasks`), thiết lập nguồn chân lý duy nhất (SSOT) cho cấu hình menu, chuẩn hóa thuật toán active state chống lệch pha mobile/desktop, chuyển đổi trung tâm thông báo thành Actionable Inbox và vệ sinh giao diện loại bỏ AI-slop.

**Architecture:** Tạo `canonical-navigation-registry.ts` làm Single Source of Truth cho toàn bộ menu, tuyến đường và quyền hạn; cập nhật fallback của `parseZoneParam` từ `"tasks"` thành `"dashboard"` để trả Bàn làm việc về đúng Cockpit điều hành; chuẩn hóa `isRouteActive` theo hướng pure memoized derivation; nối `NotificationPopover` vào Topbar; xóa bỏ chuyển hướng kép trên `/calendar` và xóa bỏ xung đột modal kép.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Node.js Test Runner (`tsx --test`), Lucide Icons.

**Spec:** `docs/superpowers/specs/2026-09-09-navigation-ux-redesign-spec.md`

## Global Constraints
- Tuân thủ quy tắc CSS: Tailwind CSS v4 thuần túy Light mode (`OKLCH`), tuyệt đối không thêm class `dark:` hoặc logic đổi theme (`CLAUDE.md`).
- Quy tắc Build: Không chạy `next build` khi dev server đang chạy. Sử dụng `npm run typecheck` (`tsc --noEmit`) và `npm test` (`tsx --test tests/**/*.test.ts`) để kiểm tra chất lượng.
- Không sử dụng Emoji trong các layout components (`app-sidebar.tsx`, `app-topbar.tsx`, `sidebar-context.tsx`) theo kiểm thử `tests/role-based-workspace-workflow.test.ts`.

---

### Task 1: Module Đăng Ký Điều Hướng Chuẩn Hóa Duy Nhất (Canonical Navigation Registry)

**Files:**
- Create: `src/lib/navigation/canonical-navigation-registry.ts`
- Test: `tests/navigation-single-source-of-truth.test.ts`

**Interfaces:**
- Produces: `CANONICAL_ROUTES`, `CANONICAL_ZONES`, `getSidebarNavItems()`, `getMobileBottomNavItems()`, `getMobileDrawerItems()`, `getRouteByPath()`

- [ ] **Step 1: Viết bài test thất bại (Failing Test) xác nhận Registry tồn tại và đầy đủ 7 tuyến đường**

Tạo tệp `tests/navigation-single-source-of-truth.test.ts`:
```typescript
import test from "node:test";
import assert from "node:assert/strict";
import {
  CANONICAL_ROUTES,
  getSidebarNavItems,
  getMobileBottomNavItems,
  getMobileDrawerItems,
} from "../src/lib/navigation/canonical-navigation-registry.js";

test("Canonical Navigation Registry defines exactly 7 canonical routes with zero duplicates", () => {
  assert.equal(CANONICAL_ROUTES.length, 7);
  const hrefs = CANONICAL_ROUTES.map((r) => r.href);
  const uniqueHrefs = new Set(hrefs);
  assert.equal(uniqueHrefs.size, 7, "All route hrefs must be unique");
  assert.ok(hrefs.includes("/"), "Must contain root /");
  assert.ok(hrefs.includes("/calendar"), "Must contain /calendar");
  assert.ok(hrefs.includes("/tasks"), "Must contain /tasks");
  assert.ok(hrefs.includes("/documents"), "Must contain /documents");
  assert.ok(hrefs.includes("/org"), "Must contain /org");
  assert.ok(hrefs.includes("/notifications"), "Must contain /notifications");
  assert.ok(hrefs.includes("/settings"), "Must contain /settings");
});

test("Canonical Navigation Registry yields correct desktop and mobile item breakdowns", () => {
  const sidebarItems = getSidebarNavItems();
  assert.ok(sidebarItems.length >= 6, "Sidebar items should cover primary modules");
  
  const bottomItems = getMobileBottomNavItems();
  assert.ok(bottomItems.some((item) => item.href === "/"), "Bottom nav must include Home");
  assert.ok(bottomItems.some((item) => item.href === "/tasks"), "Bottom nav must include Tasks");
  assert.ok(bottomItems.some((item) => item.href === "/notifications"), "Bottom nav must include Notifications");

  const drawerItems = getMobileDrawerItems();
  assert.ok(drawerItems.some((item) => item.href === "/calendar"), "Drawer must include Calendar");
  assert.ok(drawerItems.some((item) => item.href === "/documents"), "Drawer must include Documents");
  assert.ok(drawerItems.some((item) => item.href === "/org"), "Drawer must include Org");
  assert.equal(drawerItems.some((item) => item.href === "/kiosk"), false, "Must not contain dead /kiosk route");
});
```

- [ ] **Step 2: Chạy bài test để xác nhận thất bại**

Run: `npx tsx --test tests/navigation-single-source-of-truth.test.ts`  
Expected: FAIL với lỗi "Cannot find module .../canonical-navigation-registry.js"

- [ ] **Step 3: Viết mã nguồn triển khai Registry**

Tạo tệp `src/lib/navigation/canonical-navigation-registry.ts`:
```typescript
import type { WorkspaceZone } from "@/types/workspace";

export type NavigationSection = "personal" | "workspace" | "operations";

export interface CanonicalRouteConfig {
  id: string;
  href: string;
  label: string;
  shortLabel: string;
  section: NavigationSection;
  iconName: "LayoutDashboard" | "Calendar" | "CheckSquare" | "FileText" | "Building2" | "Bell" | "Settings";
  zone?: WorkspaceZone;
  badgeKey?: "calendar" | "notifications" | "docsInbox" | "docsOutbox" | "docsPending";
  aliases?: string[];
  mobilePlacement?: "bottom-bar" | "drawer" | "none";
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
    mobilePlacement: "bottom-bar",
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
    mobilePlacement: "drawer",
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
    mobilePlacement: "bottom-bar",
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
    mobilePlacement: "drawer",
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
    mobilePlacement: "drawer",
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
    mobilePlacement: "bottom-bar",
    order: 6,
  },
  {
    id: "settings",
    href: "/settings",
    label: "Cài đặt hệ thống",
    shortLabel: "Cài đặt",
    section: "operations",
    iconName: "Settings",
    mobilePlacement: "drawer",
    order: 7,
  },
] as const;

export function getSidebarNavItems(): CanonicalRouteConfig[] {
  return [...CANONICAL_ROUTES].sort((a, b) => a.order - b.order);
}

export function getMobileBottomNavItems(): CanonicalRouteConfig[] {
  return CANONICAL_ROUTES.filter((r) => r.mobilePlacement === "bottom-bar").sort((a, b) => a.order - b.order);
}

export function getMobileDrawerItems(): CanonicalRouteConfig[] {
  return CANONICAL_ROUTES.filter((r) => r.mobilePlacement === "drawer").sort((a, b) => a.order - b.order);
}

export function getRouteByPath(pathname: string): CanonicalRouteConfig | undefined {
  const cleanPath = pathname.split("?")[0].split("#")[0].trim();
  return CANONICAL_ROUTES.find(
    (r) => r.href === cleanPath || r.aliases?.some((alias) => alias === cleanPath || cleanPath.startsWith(`${alias}/`))
  );
}
```

- [ ] **Step 4: Chạy bài test xác nhận vượt qua**

Run: `npx tsx --test tests/navigation-single-source-of-truth.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/navigation/canonical-navigation-registry.ts tests/navigation-single-source-of-truth.test.ts
git commit -m "feat(navigation): introduce canonical navigation registry as single source of truth"
```

---

### Task 2: Phân Định Rõ Ràng Bàn Làm Việc (`/`) & Quản Lý Nhiệm Vụ (`/tasks`)

**Files:**
- Modify: `src/types/workspace.ts:14-25`
- Modify: `src/lib/navigation/active-matcher.ts:144-150`
- Modify: `src/hooks/use-url-params-sync.ts:60-75`
- Test: `tests/workspace-zone-fallback.test.ts`
- Test: `tests/app-layout.test.ts`

**Interfaces:**
- Consumes: `parseZoneParam` from `src/types/workspace.ts`
- Produces: `parseZoneParam(null) === "dashboard"`, `resolveBreadcrumb("/") === ["QCET E-Office", "Bàn làm việc"]`

- [ ] **Step 1: Viết test kiểm tra fallback phân khu mặc định**

Tạo `tests/workspace-zone-fallback.test.ts`:
```typescript
import test from "node:test";
import assert from "node:assert/strict";
import { parseZoneParam } from "../src/types/workspace.js";
import { resolveBreadcrumb } from "../src/lib/navigation/active-matcher.js";

test("parseZoneParam defaults to 'dashboard' when param is null or undefined (Bàn làm việc Cockpit)", () => {
  assert.equal(parseZoneParam(null), "dashboard");
  assert.equal(parseZoneParam(undefined), "dashboard");
  assert.equal(parseZoneParam(""), "dashboard");
  assert.equal(parseZoneParam("tasks"), "tasks");
  assert.equal(parseZoneParam("calendar"), "calendar");
});

test("resolveBreadcrumb for root path '/' resolves to 'Bàn làm việc'", () => {
  const crumbs = resolveBreadcrumb("/");
  assert.deepEqual(crumbs, ["QCET E-Office", "Bàn làm việc"]);
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx tsx --test tests/workspace-zone-fallback.test.ts`  
Expected: FAIL vì `parseZoneParam(null)` đang trả về `"tasks"` và breadcrumb đang trả về `["QCET E-Office", "Quản lý công việc"]`.

- [ ] **Step 3: Cập nhật `src/types/workspace.ts`, `src/lib/navigation/active-matcher.ts`, và `src/hooks/use-url-params-sync.ts`**

Trong `src/types/workspace.ts`:
```typescript
export function parseZoneParam(param: string | null | undefined): WorkspaceZone {
  if (!param) return "dashboard"; // Fallback chuẩn xác về Bàn làm việc Cockpit
  const normalized = param.toLowerCase().trim();
  if (normalized === "tasks") return "tasks";
  if (normalized === "calendar") return "calendar";
  if (normalized === "documents") return "documents";
  if (normalized === "org") return "org";
  if (normalized === "portal") return "portal";
  return "dashboard";
}
```

Trong `src/lib/navigation/active-matcher.ts`:
```typescript
if (path === "/") {
  return ["QCET E-Office", "Bàn làm việc"];
}
```

Trong `src/hooks/use-url-params-sync.ts`:
Đảm bảo khi `searchParams.get("zone")` rỗng, `zone` state được khởi tạo là `"dashboard"`.

- [ ] **Step 4: Chạy test xác nhận vượt qua**

Run: `npx tsx --test tests/workspace-zone-fallback.test.ts tests/app-layout.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/workspace.ts src/lib/navigation/active-matcher.ts src/hooks/use-url-params-sync.ts tests/workspace-zone-fallback.test.ts
git commit -m "fix(navigation): set default zone to dashboard for root route and fix breadcrumb title"
```

---

### Task 3: Chuẩn Hóa Thuật Toán Khớp Active-State (`isRouteActive`)

**Files:**
- Modify: `src/lib/navigation/active-matcher.ts`
- Modify: `tests/navigation-active-matcher.test.ts`

**Interfaces:**
- Consumes: `CANONICAL_ROUTES` from `src/lib/navigation/canonical-navigation-registry.ts`
- Produces: `isRouteActive(targetHref, currentPathname, searchParams, aliases)`

- [ ] **Step 1: Viết test cho toàn bộ ma trận active routes**

Mở `tests/navigation-active-matcher.test.ts` và bổ sung các test cases:
```typescript
test("isRouteActive: accurately activates root '/' when no query parameter is present", () => {
  assert.equal(isRouteActive("/", "/", null), true);
  assert.equal(isRouteActive("/tasks", "/", null), false);
  assert.equal(isRouteActive("/calendar", "/", null), false);
});

test("isRouteActive: respects query parameter ?zone=tasks on root '/'", () => {
  const params = new URLSearchParams("zone=tasks");
  assert.equal(isRouteActive("/", "/", params), false);
  assert.equal(isRouteActive("/tasks", "/", params), true);
});

test("isRouteActive: boundary check prevents subroute collision", () => {
  assert.equal(isRouteActive("/tasks", "/tasks/task-001"), true);
  assert.equal(isRouteActive("/tasks", "/tasks-archive"), false);
  assert.equal(isRouteActive("/documents", "/documents-audit"), false);
});
```

- [ ] **Step 2: Chạy test kiểm tra trạng thái hiện tại**

Run: `npx tsx --test tests/navigation-active-matcher.test.ts`

- [ ] **Step 3: Triển khai thuật toán chuẩn hóa trong `src/lib/navigation/active-matcher.ts`**

Thay thế nội dung hàm `isRouteActive` bằng thuật toán chuẩn hóa an toàn boundary, hỗ trợ cả zone query và pathname alias:
```typescript
export function normalizePath(path: string): string {
  if (!path) return "/";
  const clean = path.split("?")[0].split("#")[0].trim();
  if (clean.length > 1 && clean.endsWith("/")) {
    return clean.slice(0, -1);
  }
  return clean || "/";
}

export function isRouteActive(
  targetHref: string,
  currentPathname: string,
  searchParams?: URLSearchParams | null,
  aliases?: string[]
): boolean {
  if (!targetHref || !currentPathname) return false;

  const pathname = normalizePath(currentPathname);
  const targetBase = normalizePath(targetHref);
  const zone = searchParams?.get("zone")?.toLowerCase();
  const view = searchParams?.get("view")?.toLowerCase();

  // 1. Phân định Bàn làm việc ("/")
  if (targetBase === "/" || targetBase === "/dashboard") {
    if (pathname === "/dashboard") return true;
    if (pathname === "/") {
      if (zone && ["tasks", "calendar", "documents", "org"].includes(zone)) {
        return false;
      }
      if (view && ["calendar", "month"].includes(view)) {
        return false;
      }
      return true;
    }
    return false;
  }

  // 2. Khi đang ở "/" kèm query zone tương ứng
  if (pathname === "/") {
    if (targetBase === "/tasks" && zone === "tasks") return true;
    if (targetBase === "/calendar" && (zone === "calendar" || view === "calendar" || view === "month")) return true;
    if (targetBase === "/documents" && zone === "documents") return true;
    if (targetBase === "/org" && zone === "org") return true;
  }

  // 3. Khớp chính xác Pathname
  if (pathname === targetBase) return true;

  // 4. Khớp Aliases
  if (aliases && aliases.length > 0) {
    for (const alias of aliases) {
      const cleanAlias = normalizePath(alias);
      if (pathname === cleanAlias || pathname.startsWith(`${cleanAlias}/`)) {
        return true;
      }
    }
  }

  // 5. Khớp Subroutes phân cấp an toàn
  if (targetBase !== "/" && pathname.startsWith(`${targetBase}/`)) {
    return true;
  }

  return false;
}
```

- [ ] **Step 4: Chạy test xác nhận toàn bộ passed**

Run: `npx tsx --test tests/navigation-active-matcher.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/navigation/active-matcher.ts tests/navigation-active-matcher.test.ts
git commit -m "feat(navigation): implement canonical boundary-safe route active matcher"
```

---

### Task 4: Đồng Bộ Desktop Sidebar & Tối Ưu Tương Tác Phím Tắt

**Files:**
- Modify: `src/components/layout/app-sidebar.tsx:112-130`
- Modify: `src/components/layout/sidebar-context.tsx:200-240`
- Test: `tests/single-tier-sidebar.test.ts`
- Test: `tests/app-layout.test.ts`

**Interfaces:**
- Consumes: `isRouteActive` from `src/lib/navigation/active-matcher.ts`, `CANONICAL_ROUTES` from `src/lib/navigation/canonical-navigation-registry.ts`
- Produces: Safe `Ctrl+B / ⌘B` toggle without input hijacking, pure memoized `currentModule`

- [ ] **Step 1: Viết test kiểm tra phím tắt và không emoji trong sidebar**

Chạy test kiểm tra:
Run: `npx tsx --test tests/single-tier-sidebar.test.ts tests/role-based-workspace-workflow.test.ts`

- [ ] **Step 2: Thêm guard clause cho phím tắt `⌘B / Ctrl+B` trong `src/components/layout/app-sidebar.tsx`**

Tìm khối xử lý `keydown` (dòng 112-126) và bổ sung kiểm tra `document.activeElement`:
```tsx
React.useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Không cướp phím khi người dùng đang nhập liệu
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable)
    ) {
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
      e.preventDefault();
      toggleCollapsed();
    }
  };

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [toggleCollapsed]);
```

- [ ] **Step 3: Chuyển `currentModule` trong `sidebar-context.tsx` sang pure derivation (useMemo)**

Loại bỏ `useState` và `useEffect` cho `currentModule`:
```tsx
const currentModule = React.useMemo<NavigationModule>(() => {
  return resolveModuleFromPathname(pathname || "");
}, [pathname]);
```

- [ ] **Step 4: Chạy test xác nhận không vi phạm quy tắc layout & không emoji**

Run: `npx tsx --test tests/single-tier-sidebar.test.ts tests/app-layout.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/app-sidebar.tsx src/components/layout/sidebar-context.tsx
git commit -m "fix(sidebar): guard Ctrl+B against input hijacking and remove 1-frame state lag"
```

---

### Task 5: Đồng Bộ Mobile Bottom Nav, Xóa Bỏ Điểm Chết & Xung Đột Modal

**Files:**
- Modify: `src/components/layout/mobile-bottom-nav.tsx:25-45`
- Modify: `src/components/layout/mobile-menu-drawer.tsx:240-285`
- Modify: `src/components/layout/app-topbar.tsx:140-155, 445-460`
- Modify: `src/lib/utils.ts`
- Test: `tests/mobile-navigation-alignment.test.ts`

**Interfaces:**
- Consumes: `isRouteActive` from `src/lib/navigation/active-matcher.ts`
- Produces: Unified active state on mobile bottom nav, 0 dead `/kiosk` links, single modal host

- [ ] **Step 1: Viết test kiểm tra Mobile Bottom Nav và Drawer**

Tạo `tests/mobile-navigation-alignment.test.ts`:
```typescript
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("mobile-menu-drawer contains zero references to dead route /kiosk", () => {
  const drawerPath = path.resolve(process.cwd(), "src/components/layout/mobile-menu-drawer.tsx");
  const content = fs.readFileSync(drawerPath, "utf-8");
  assert.equal(content.includes('href="/kiosk"'), false, "Must not contain href='/kiosk'");
  assert.equal(content.includes("Kiosk TV"), false, "Must not contain dead Kiosk TV link");
});

test("app-topbar does not mount duplicate CreateTaskModal directly", () => {
  const topbarPath = path.resolve(process.cwd(), "src/components/layout/app-topbar.tsx");
  const content = fs.readFileSync(topbarPath, "utf-8");
  assert.equal(content.includes("<CreateTaskModal"), false, "Topbar must not mount CreateTaskModal directly to prevent double-modal collision");
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx tsx --test tests/mobile-navigation-alignment.test.ts`  
Expected: FAIL

- [ ] **Step 3: Cập nhật `mobile-bottom-nav.tsx`, `mobile-menu-drawer.tsx`, và `app-topbar.tsx`**

1. Trong `mobile-bottom-nav.tsx`:
   Dùng `isRouteActive` thay cho điều kiện inline tự tính:
   ```tsx
   const isHomeActive = isRouteActive("/", pathname, searchParams, ["/dashboard"]);
   const isTasksActive = isRouteActive("/tasks", pathname, searchParams, ["/unit-tasks"]);
   const isNotificationsActive = isRouteActive("/notifications", pathname, searchParams);
   ```

2. Trong `mobile-menu-drawer.tsx`:
   Xóa bỏ thẻ card `/kiosk`. Thay vào đó, nếu cần liên kết nhanh, trỏ tới `/portal` ("Cổng thông tin & Dashboard").

3. Trong `app-topbar.tsx`:
   Gỡ bỏ state `isCreateModalOpen` và thẻ `<CreateTaskModal ... />` ở chân component. Sự kiện `qcet:open-create-task` được giao trọn vẹn cho `DashboardModalsHost` quản lý.

4. Trong `src/lib/utils.ts`:
   Đảm bảo export hàm `getInitials(name: string): string` chuẩn để cả Topbar và Mobile Drawer cùng sử dụng, loại bỏ chênh lệch initials ("NV" vs "NG").

- [ ] **Step 4: Chạy test xác nhận vượt qua**

Run: `npx tsx --test tests/mobile-navigation-alignment.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/mobile-bottom-nav.tsx src/components/layout/mobile-menu-drawer.tsx src/components/layout/app-topbar.tsx src/lib/utils.ts tests/mobile-navigation-alignment.test.ts
git commit -m "fix(mobile-nav): synchronize active states, remove dead /kiosk route, and eliminate double-modal collision"
```

---

### Task 6: Render Trực Tiếp Lịch Biểu Tại `/calendar` (Loại Bỏ Trampoline Redirect)

**Files:**
- Modify: `src/app/calendar/page.tsx`
- Test: `tests/calendar-route-integrity.test.ts`

**Interfaces:**
- Produces: Direct render of calendar view at `/calendar` without client-side `router.replace`

- [ ] **Step 1: Viết test kiểm tra route `/calendar` render trực tiếp**

Tạo `tests/calendar-route-integrity.test.ts`:
```typescript
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("calendar page renders calendar directly without router.replace trampoline", () => {
  const calendarPagePath = path.resolve(process.cwd(), "src/app/calendar/page.tsx");
  const content = fs.readFileSync(calendarPagePath, "utf-8");
  assert.equal(content.includes('router.replace("/?view=calendar")'), false, "Must not bounce redirect to /?view=calendar");
  assert.ok(content.includes("CalendarMonthView") || content.includes("CalendarZone") || content.includes("Lịch"), "Must render calendar interface");
});
```

- [ ] **Step 2: Chạy test kiểm tra thất bại**

Run: `npx tsx --test tests/calendar-route-integrity.test.ts`  
Expected: FAIL vì `page.tsx` hiện chỉ chứa `router.replace`.

- [ ] **Step 3: Triển khai nội dung trang `/calendar/page.tsx`**

Cập nhật `src/app/calendar/page.tsx` để render trực tiếp phân khu Lịch công tác với layout đầy đủ:
```tsx
import { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { CalendarZone } from "@/components/dashboard/zones/calendar-zone";

export const metadata: Metadata = {
  title: "Lịch công tác | QCET E-Office",
  description: "Lịch tuần Ban Giám hiệu và lịch đào tạo, công tác các đơn vị",
};

export default function CalendarPage() {
  return (
    <AppShell>
      <div className="container max-w-7xl mx-auto px-4 py-6">
        <CalendarZone />
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 4: Chạy test xác nhận vượt qua**

Run: `npx tsx --test tests/calendar-route-integrity.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/calendar/page.tsx tests/calendar-route-integrity.test.ts
git commit -m "feat(calendar): render calendar directly at /calendar, eliminating trampoline redirect"
```

---

### Task 7: Nâng Cấp Trung Tâm Thông Báo Thành Actionable Inbox & Gắn Popover

**Files:**
- Modify: `src/components/layout/app-topbar.tsx:280-310`
- Modify: `src/components/layout/sidebar-context.tsx:390-420`
- Modify: `src/hooks/use-dashboard-state.ts:50-65`
- Modify: `src/components/notifications/notification-popover.tsx`
- Modify: `prisma/seed.ts`
- Test: `tests/notification-integration.test.ts`

**Interfaces:**
- Consumes: `NotificationPopover`
- Produces: Working notification popover trigger on topbar bell, real unread count derivation

- [ ] **Step 1: Viết test kiểm tra liên kết Topbar Bell và de-hardcoding**

Tạo `tests/notification-integration.test.ts`:
```typescript
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("sidebar-context does not hardcode notifications count to 5", () => {
  const sidebarContextPath = path.resolve(process.cwd(), "src/components/layout/sidebar-context.tsx");
  const content = fs.readFileSync(sidebarContextPath, "utf-8");
  assert.equal(content.includes('badge: "5", badgeVariant: "danger"'), false, "Must not hardcode badge 5 danger");
});

test("app-topbar mounts NotificationPopover", () => {
  const topbarPath = path.resolve(process.cwd(), "src/components/layout/app-topbar.tsx");
  const content = fs.readFileSync(topbarPath, "utf-8");
  assert.ok(content.includes("NotificationPopover"), "Topbar must import and mount NotificationPopover");
});
```

- [ ] **Step 2: Chạy test kiểm tra thất bại**

Run: `npx tsx --test tests/notification-integration.test.ts`  
Expected: FAIL

- [ ] **Step 3: Cập nhật Topbar, SidebarContext, và Seed Data**

1. Trong `src/components/layout/sidebar-context.tsx` & `src/hooks/use-dashboard-state.ts`:
   Loại bỏ việc gán cứng `notifications: 5` và `badge: "5", badgeVariant: "danger"`. Khởi tạo `notifications: 0` khi chưa có dữ liệu thực tế.

2. Trong `src/components/layout/app-topbar.tsx`:
   Import `NotificationPopover` từ `@/components/notifications/notification-popover` và thay thế nút chuông chuyển hướng tĩnh bằng component popover này.

3. Trong `prisma/seed.ts`:
   Bổ sung việc seed ít nhất 3 bản ghi thông báo tác nghiệp thực tế (1 thông báo giao nhiệm vụ mới, 1 thông báo nộp minh chứng chờ duyệt, 1 thông báo nhắc hạn 24h) gắn với các user BGH và Trưởng phòng.

- [ ] **Step 4: Chạy test xác nhận vượt qua**

Run: `npx tsx --test tests/notification-integration.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/app-topbar.tsx src/components/layout/sidebar-context.tsx src/hooks/use-dashboard-state.ts prisma/seed.ts tests/notification-integration.test.ts
git commit -m "feat(notifications): mount NotificationPopover to topbar, de-hardcode badges, and seed actionable notifications"
```

---

### Task 8: Vệ Sinh Giao Diện Loại Bỏ AI-Slop (Anti AI-Slop Polish)

**Files:**
- Modify: `src/components/workspace/components/adaptive-metric-strip.tsx:210-260`
- Modify: `src/components/tasks/cascading-task-table.tsx:108-157`
- Modify: `src/app/tasks/page.tsx:358-375`
- Test: `tests/anti-slop-hygiene.test.ts`

**Interfaces:**
- Produces: Flat hairline grid metric strip, neutral departmental tags, clean single-tier breadcrumb

- [ ] **Step 1: Viết test kiểm tra vệ sinh giao diện anti-slop**

Tạo `tests/anti-slop-hygiene.test.ts`:
```typescript
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("tasks page has no duplicate in-page breadcrumb navigation", () => {
  const tasksPagePath = path.resolve(process.cwd(), "src/app/tasks/page.tsx");
  const content = fs.readFileSync(tasksPagePath, "utf-8");
  assert.equal(content.includes("aria-label=\"Breadcrumb\""), false, "Page body must not duplicate topbar breadcrumb");
});

test("adaptive-metric-strip uses flat hairline grid without triple-nested cards", () => {
  const metricStripPath = path.resolve(process.cwd(), "src/components/workspace/components/adaptive-metric-strip.tsx");
  const content = fs.readFileSync(metricStripPath, "utf-8");
  assert.ok(content.includes("divide-x") || content.includes("divide-border"), "Metric strip should use hairline divider grid");
});
```

- [ ] **Step 2: Chạy test kiểm tra thất bại**

Run: `npx tsx --test tests/anti-slop-hygiene.test.ts`  
Expected: FAIL

- [ ] **Step 3: Triển khai tinh chỉnh anti-slop**

1. Trong `src/app/tasks/page.tsx`:
   Xóa bỏ khối `<nav aria-label="Breadcrumb">` lặp lại ở dòng 358–372 (vì thanh Topbar đã cung cấp breadcrumb chuẩn theo WCAG).

2. Trong `src/components/workspace/components/adaptive-metric-strip.tsx`:
   Thay thế cấu trúc thẻ lồng trong thẻ bằng cấu trúc lưới phẳng:
   ```tsx
   <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-border/50 rounded-xl border border-border/70 bg-card shadow-2xs overflow-hidden">
     {/* Từng metric item tinh gọn, không bọc thêm card riêng */}
   </div>
   ```

3. Trong `src/components/tasks/cascading-task-table.tsx`:
   Chuyển các badge danh mục phòng ban (CNTT, ATTT, Chuyển đổi số,...) từ màu cầu vồng (sky, indigo, rose, teal) sang class trung tính chuẩn công sở: `bg-secondary text-muted-foreground border-transparent`.

- [ ] **Step 4: Chạy test xác nhận vượt qua**

Run: `npx tsx --test tests/anti-slop-hygiene.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/tasks/page.tsx src/components/workspace/components/adaptive-metric-strip.tsx src/components/tasks/cascading-task-table.tsx tests/anti-slop-hygiene.test.ts
git commit -m "style(ui): eradicate bento card nesting, eliminate duplicate breadcrumb, and neutralize rainbow category tags"
```

---

### Task 9: Kiểm Thử Toàn Diện & Đảm Bảo Không Hồi Quy (Verification & Quality Floor)

**Files:**
- Check: Toàn bộ codebase
- Test: Toàn bộ test suite (`tests/**/*.test.ts`)

- [ ] **Step 1: Chạy kiểm tra TypeScript Typecheck**

Run: `npm run typecheck`  
Expected: Exit code 0, 0 type errors.

- [ ] **Step 2: Chạy toàn bộ test suites**

Run: `npm test`  
Expected: Tất cả các bài test (trên 60 test suites) đều xanh hoàn toàn (100% pass).

- [ ] **Step 3: Commit hoàn thiện**

```bash
git commit --allow-empty -m "chore: verify navigation redesign passes all quality floors with zero regressions"
```
