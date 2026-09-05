# Two-Tier Sidebar Navigation Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the application navigation into a standard enterprise 2-tier layout: a collapsible left sidebar (240px expanded / 64px icon-only collapsed, with mobile drawer) plus a clean 52px topbar with dynamic breadcrumbs and quick actions.

**Architecture:** Create a dedicated `SidebarContext` to manage desktop collapse and mobile drawer open/closed state with client-side `localStorage` persistence. Build `AppSidebar` with primary routes, active state badges, and tooltips. Build `AppTopbar` with breadcrumbs and action controls (Quick Create ⌘K, Role Switcher, Theme, Avatar). Connect them in an `AppShell` container component and update `src/app/layout.tsx`. Maintain backward compatibility by re-exporting `NAVIGATION_ITEMS` in `src/components/navigation.tsx`.

**Tech Stack:** Next.js 15 (App Router), React 19, Tailwind CSS, Lucide Icons, TypeScript.

**Spec:** [docs/superpowers/specs/2026-09-06-two-tier-sidebar-navigation-layout-design.md](docs/superpowers/specs/2026-09-06-two-tier-sidebar-navigation-layout-design.md)

## Global Constraints

- Sidebar width: expanded is `240px` (`w-60`), collapsed is `64px` (`w-16`).
- Topbar height: `52px` (`h-13`), sticky with `backdrop-blur-md` and hairline bottom border.
- Anti-slop: 0% emojis in navigation labels, tooltips, and breadcrumbs.
- SSR Safety: default `isCollapsed = false` on server, read `localStorage` only in `useEffect` on client.
- Backward compatibility: `NAVIGATION_ITEMS` must remain exported from `src/components/navigation.tsx` to keep existing test suites green.
- Keyboard shortcuts: `⌘K` / `Ctrl+K` or `N` opens Create Task modal; `[` or `Ctrl+B` toggles sidebar collapse.

---

### Task 1: Sidebar Context & Navigation Config

**Files:**
- Create: `src/components/layout/sidebar-context.tsx`
- Create: `tests/app-layout.test.ts`

**Interfaces:**
- Consumes: React context APIs, `localStorage`
- Produces: `SidebarContext`, `SidebarProvider`, `useSidebar()`, `NAVIGATION_ITEMS`, `resolveBreadcrumb(pathname: string)`

- [ ] **Step 1: Write the unit test for Sidebar Context and Breadcrumbs**

```typescript
// tests/app-layout.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  NAVIGATION_ITEMS,
  resolveBreadcrumb,
  SIDEBAR_STORAGE_KEY,
} from "../src/components/layout/sidebar-context";

describe("Two-Tier Layout Configuration & Breadcrumbs", () => {
  it("defines required 4 navigation items with routes and icons", () => {
    assert.strictEqual(NAVIGATION_ITEMS.length, 4);
    assert.strictEqual(NAVIGATION_ITEMS[0].href, "/");
    assert.strictEqual(NAVIGATION_ITEMS[0].label, "Quản lý công việc");
    assert.strictEqual(NAVIGATION_ITEMS[1].href, "/dashboard");
    assert.strictEqual(NAVIGATION_ITEMS[1].label, "Báo cáo KPI");
    assert.strictEqual(NAVIGATION_ITEMS[2].href, "/org");
    assert.strictEqual(NAVIGATION_ITEMS[2].label, "Cơ cấu & Danh bạ");
    assert.strictEqual(NAVIGATION_ITEMS[3].href, "/notifications");
    assert.strictEqual(NAVIGATION_ITEMS[3].label, "Thông báo");
  });

  it("resolves breadcrumbs accurately for all system routes", () => {
    assert.deepStrictEqual(resolveBreadcrumb("/"), ["QCET E-Office", "Quản lý công việc"]);
    assert.deepStrictEqual(resolveBreadcrumb("/dashboard"), ["QCET E-Office", "Báo cáo & Thống kê KPI"]);
    assert.deepStrictEqual(resolveBreadcrumb("/org"), ["QCET E-Office", "Cơ cấu tổ chức & Danh bạ"]);
    assert.deepStrictEqual(resolveBreadcrumb("/notifications"), ["QCET E-Office", "Thông báo điều hành"]);
    assert.deepStrictEqual(resolveBreadcrumb("/login"), ["QCET E-Office", "Đăng nhập"]);
  });

  it("zero emojis in navigation labels and breadcrumbs (anti-slop rule)", () => {
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    for (const item of NAVIGATION_ITEMS) {
      assert.ok(!emojiRegex.test(item.label), `Item ${item.label} contains emojis`);
    }
  });

  it("uses qcet_sidebar_collapsed as persistent storage key", () => {
    assert.strictEqual(SIDEBAR_STORAGE_KEY, "qcet_sidebar_collapsed");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/app-layout.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `src/components/layout/sidebar-context.tsx`**

```typescript
"use client";

import * as React from "react";
import {
  CheckSquare,
  LayoutDashboard,
  Network,
  Bell,
  type LucideIcon,
} from "lucide-react";

export interface NavigationItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  badgeVariant?: "primary" | "warning" | "danger" | "muted";
}

export const NAVIGATION_ITEMS: NavigationItem[] = [
  { href: "/", label: "Quản lý công việc", icon: CheckSquare },
  { href: "/dashboard", label: "Báo cáo KPI", icon: LayoutDashboard },
  { href: "/org", label: "Cơ cấu & Danh bạ", icon: Network },
  { href: "/notifications", label: "Thông báo", icon: Bell },
];

export const SIDEBAR_STORAGE_KEY = "qcet_sidebar_collapsed";

export function resolveBreadcrumb(pathname: string): [string, string] {
  if (pathname === "/") return ["QCET E-Office", "Quản lý công việc"];
  if (pathname.startsWith("/dashboard")) return ["QCET E-Office", "Báo cáo & Thống kê KPI"];
  if (pathname.startsWith("/org")) return ["QCET E-Office", "Cơ cấu tổ chức & Danh bạ"];
  if (pathname.startsWith("/notifications")) return ["QCET E-Office", "Thông báo điều hành"];
  if (pathname.startsWith("/login")) return ["QCET E-Office", "Đăng nhập"];
  return ["QCET E-Office", "Tổng quan"];
}

interface SidebarContextValue {
  isCollapsed: boolean;
  toggleCollapse: () => void;
  setCollapsed: (collapsed: boolean) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  toggleMobile: () => void;
}

const SidebarContext = React.createContext<SidebarContextValue | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = React.useState<boolean>(false);
  const [isMobileOpen, setIsMobileOpen] = React.useState<boolean>(false);
  const [mounted, setMounted] = React.useState<boolean>(false);

  React.useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (saved !== null) {
        setIsCollapsed(saved === "true");
      }
    } catch {
      // safe fallback if storage unavailable
    }
  }, []);

  const toggleCollapse = React.useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // safe fallback
      }
      return next;
    });
  }, []);

  const setCollapsed = React.useCallback((val: boolean) => {
    setIsCollapsed(val);
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(val));
    } catch {
      // safe fallback
    }
  }, []);

  const toggleMobile = React.useCallback(() => {
    setIsMobileOpen((prev) => !prev);
  }, []);

  // Global hotkey: '[' or 'Ctrl+B' to toggle sidebar collapse
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
      if (
        (e.key === "[" && !e.metaKey && !e.ctrlKey && !e.altKey) ||
        ((e.key === "b" || e.key === "B") && (e.metaKey || e.ctrlKey))
      ) {
        e.preventDefault();
        toggleCollapse();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleCollapse]);

  return (
    <SidebarContext.Provider
      value={{
        isCollapsed,
        toggleCollapse,
        setCollapsed,
        isMobileOpen,
        setIsMobileOpen,
        toggleMobile,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar(): SidebarContextValue {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/app-layout.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/sidebar-context.tsx tests/app-layout.test.ts
git commit -m "feat(layout): create SidebarContext with storage persistence and breadcrumbs"
```

---

### Task 2: Left Sidebar Component (`AppSidebar`)

**Files:**
- Create: `src/components/layout/app-sidebar.tsx`

**Interfaces:**
- Consumes: `useSidebar`, `NAVIGATION_ITEMS`, `usePathname` from Next.js
- Produces: `<AppSidebar />` component

- [ ] **Step 1: Implement `src/components/layout/app-sidebar.tsx`**
  - Renders desktop sidebar: `w-60` when expanded, `w-16` when collapsed.
  - Header: Logo QCET, title text, v1.2 Enterprise badge, and collapse button (`ChevronLeft` / `ChevronRight`).
  - Navigation list: active route styling, subtle icon, label (hidden when collapsed), badge indicator.
  - Tooltips: when collapsed, hover over icon displays tooltip with page name.
  - Footer: Notion sync status pill with active green dot.
  - Mobile Drawer: `<aside>` inside backdrop overlay (`z-50`), sliding `translate-x-0` vs `-translate-x-full`.

- [ ] **Step 2: Verify component compiles and tests pass**

Run: `npx tsx --test tests/app-layout.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/app-sidebar.tsx
git commit -m "feat(layout): implement collapsible AppSidebar with mobile drawer"
```

---

### Task 3: Topbar Component (`AppTopbar`)

**Files:**
- Create: `src/components/layout/app-topbar.tsx`

**Interfaces:**
- Consumes: `useSidebar`, `resolveBreadcrumb`, `RoleSwitcherPill`, `UserProfileModal`, `useAuth`, `useTheme`
- Produces: `<AppTopbar />` component

- [ ] **Step 1: Implement `src/components/layout/app-topbar.tsx`**
  - Left side:
    - Mobile menu hamburger button (`Menu` icon) to open drawer.
    - Desktop toggle sidebar button (`PanelLeftClose` / `PanelLeftOpen` or `Sidebar` icon).
    - Dynamic Breadcrumb trail (`QCET E-Office / Quản lý công việc`).
  - Right side:
    - `+ Giao việc` primary button with `⌘K` badge.
    - `RoleSwitcherPill` (Ban Giám hiệu / Trưởng đơn vị / Chuyên viên).
    - Theme switcher (`Sun` / `Moon`).
    - User avatar trigger with profile dropdown.
  - Quick Task Modal support via `CreateTaskModal`.

- [ ] **Step 2: Verify component compiles and tests pass**

Run: `npx tsx --test tests/app-layout.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/app-topbar.tsx
git commit -m "feat(layout): implement AppTopbar with breadcrumbs and action controls"
```

---

### Task 4: App Shell Container & Layout Wire-Up

**Files:**
- Create: `src/components/layout/app-shell.tsx`
- Modify: `src/components/navigation.tsx` (re-export `NAVIGATION_ITEMS` from `sidebar-context` for backward compatibility)
- Modify: `src/app/layout.tsx` (mount `<AppShell>{children}</AppShell>`)

**Interfaces:**
- Consumes: `SidebarProvider`, `AppSidebar`, `AppTopbar`
- Produces: `<AppShell>` that wraps `<main>` with adaptive padding `md:pl-60` or `md:pl-16`.

- [ ] **Step 1: Implement `src/components/layout/app-shell.tsx`**
  - Checks if `pathname === "/login"`. If so, renders `children` with full width and no sidebar/topbar.
  - Otherwise, renders `AppSidebar`, `AppTopbar`, and `<main className="min-h-screen transition-all duration-200 ...">`.
  - Main container uses `md:pl-60` when expanded, `md:pl-16` when collapsed.

- [ ] **Step 2: Update `src/components/navigation.tsx`**
  - Export `NAVIGATION_ITEMS` from `src/components/layout/sidebar-context.tsx`.
  - Keep `Navigation` component as an alias or deprecated fallback so any other callers do not break.

- [ ] **Step 3: Update `src/app/layout.tsx`**
  - Replace `<Navigation />` with `<AppShell>{children}</AppShell>`.

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: All 23+ test suites pass with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/app-shell.tsx src/components/navigation.tsx src/app/layout.tsx
git commit -m "feat(layout): wire AppShell into root layout with adaptive margins"
```

---

### Task 5: Visual Verification & Browser Preview Inspection

**Files:**
- Visual check on preview dev server `http://localhost:3001`
- Test routes: `/`, `/dashboard`, `/org`, `/notifications`, `/login`

- [ ] **Step 1: Verify Desktop Expanded View**
  - Navigate to `/` on 1280px+.
  - Verify left sidebar displays logo, 4 nav items, and footer.
  - Verify topbar displays breadcrumbs, Quick Create `⌘K`, Role Switcher, Theme button, Avatar.
  - Verify main content table has full width without horizontal overlap.

- [ ] **Step 2: Verify Desktop Collapsed View**
  - Click collapse button (or press `[`).
  - Verify sidebar width shrinks to 64px (`w-16`).
  - Verify main content expands to take full width (`md:pl-16`).
  - Reload page to confirm `localStorage` preserves collapsed state.

- [ ] **Step 3: Verify Mobile Responsive View**
  - Resize preview to mobile (`375px`).
  - Verify sidebar is hidden by default and topbar displays hamburger menu button.
  - Click hamburger menu button, verify drawer slides open.
  - Click backdrop or menu item, verify drawer closes smoothly.

- [ ] **Step 4: Take screenshot proof and commit final adjustments if any**

```bash
git add -A
git commit -m "chore(layout): polish transitions and complete 2-tier navigation migration"
```
