---
status: superseded
domain: ux
created: 2026-09-08
superseded_by: 2026-09-09-master-ux-consolidation-plan.md
---

# Unified Mobile PWA & Responsive Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform QCET E-Office into a world-class, unified, highly performant Progressive Web App on mobile (360px - 430px) that shares 100% data, state, and business logic with desktop while delivering native-grade touch ergonomics, 44px+ touch targets, instant page loads, and zero UI collisions.

**Architecture:** 
1. **Foundation & Performance Layer**: Decouple data models (`QCET_DEPARTMENT_GROUPS` to `src/lib/departments.ts`, `isSchoolTask` to `src/types/dashboard.ts`), enable compile-time tree-shaking in `next.config.ts`, and introduce `src/lib/haptics.ts`.
2. **Platform & Layout Layer**: Configure Viewport Virtual Keyboard resize in `layout.tsx`, 16px iOS auto-zoom floor in `globals.css`, and Light-Only `#fbfbfb` PWA manifest/splash screen with App Shortcuts.
3. **Adaptive UI Layer**: Implement Dual-Mode Table-to-Card Feed in `CascadingTaskTable`, Horizontal Snap-Carousel in `TaskKanbanBoard`, synchronize Mobile Bottom Navigation with desktop, and lazy-load non-critical modals with `next/dynamic`.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind CSS v4, Lucide React, W3C Vibration API, Web Push API, TypeScript 5.

**Spec:** `docs/superpowers/specs/2026-09-08-unified-mobile-pwa-and-menu-architecture-spec.md`

## Global Constraints

- Light-Only Theme Standard: Pure light mode using OKLCH color space (`#fbfbfb` base, `oklch(0.985 0.003 250)`). No `dark:` classes or theme switchers.
- Build Safety Rule: Never run `next build` over `.next` while `next dev` is running. Use `npm run typecheck` and `npm test` for quality assurance.
- Touch Target Floor: Every interactive element on mobile must meet or exceed WCAG 2.2 / Apple HIG 44px x 44px (`min-h-[44px]` or `.touch-target-expand-44`).
- Input Zoom Rule: All form controls (`input`, `select`, `textarea`) on mobile viewports (< 640px) must have `font-size >= 16px` to prevent iOS Safari auto-zoom.
- Single Source of Truth: Mobile and desktop must share the exact same URL parameters (`zone`, `scope`, `academicYear`, `academicMonth`, `view`) via `useUrlParamsSync` and `UnifiedTaskHub`.

---

### Task 1: Foundation & Performance Decoupling (`departments.ts`, `isSchoolTask`, `haptics.ts`)

**Files:**
- Create: `src/lib/departments.ts`
- Create: `src/lib/haptics.ts`
- Modify: `src/types/dashboard.ts`
- Modify: `src/components/dashboard/create-task-modal.tsx:40-75`
- Modify: `src/components/auth/user-profile-modal.tsx:1-35`
- Modify: `src/components/dashboard/task-detail-side-sheet.tsx:1-40`
- Modify: `next.config.ts:1-40`
- Test: `tests/pwa-foundation-haptics.test.ts`

**Interfaces:**
- Consumes: `DepartmentPersonnelGroup` structure from `create-task-modal.tsx`
- Produces: 
  - `QCET_DEPARTMENT_GROUPS` from `@/lib/departments`
  - `isSchoolTask(task: unknown): task is SchoolTask` from `@/types/dashboard`
  - `triggerHaptic(type: HapticType): boolean` from `@/lib/haptics`
  - `experimental.optimizePackageImports` in `next.config.ts`

- [ ] **Step 1: Write the failing test for departments extraction and haptics**

```typescript
// tests/pwa-foundation-haptics.test.ts
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { QCET_DEPARTMENT_GROUPS, getDepartmentByCode } from "@/lib/departments";
import { triggerHaptic, isHapticSupported, HapticType } from "@/lib/haptics";
import { isSchoolTask } from "@/types/dashboard";

describe("PWA Foundation, Departments & Haptics Suite", () => {
  test("QCET_DEPARTMENT_GROUPS contains valid school and unit departments", () => {
    assert.ok(Array.isArray(QCET_DEPARTMENT_GROUPS));
    assert.ok(QCET_DEPARTMENT_GROUPS.length >= 6);
    const bgh = QCET_DEPARTMENT_GROUPS.find((g) => g.id === "bgh");
    assert.ok(bgh);
    assert.strictEqual(bgh.name, "Ban Giám hiệu");
  });

  test("getDepartmentByCode resolves department personnel metadata", () => {
    const dept = getDepartmentByCode("CNTT");
    assert.ok(dept);
    assert.strictEqual(dept.code, "CNTT");
    assert.ok(dept.personnel.length > 0);
  });

  test("isSchoolTask correctly identifies school vs unit task objects", () => {
    const mockSchoolTask = {
      id: "st-1",
      taskCode: "DA-2026-01",
      title: "Kế hoạch chiến lược",
      subTasks: [],
    };
    const mockUnitTask = {
      id: "ut-1",
      title: "Họp khoa định kỳ",
      unitCode: "CNTT",
    };
    assert.strictEqual(isSchoolTask(mockSchoolTask), true);
    assert.strictEqual(isSchoolTask(mockUnitTask), false);
    assert.strictEqual(isSchoolTask(null), false);
  });

  test("Haptics trigger runs safely in Node/SSR environment without throwing", () => {
    assert.strictEqual(isHapticSupported(), false);
    const result = triggerHaptic("light");
    assert.strictEqual(result, false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/pwa-foundation-haptics.test.ts`  
Expected: FAIL (modules `src/lib/departments.ts` and `src/lib/haptics.ts` not found).

- [ ] **Step 3: Implement `src/lib/departments.ts`, `src/lib/haptics.ts`, and update types**

Create `src/lib/departments.ts`:
```typescript
export interface DepartmentPersonnel {
  name: string;
  role: string;
}

export interface DepartmentPersonnelGroup {
  id: string;
  name: string;
  code: string;
  personnel: DepartmentPersonnel[];
}

export const QCET_DEPARTMENT_GROUPS: DepartmentPersonnelGroup[] = [
  {
    id: "bgh",
    name: "Ban Giám hiệu",
    code: "BGH",
    personnel: [
      { name: "ThS. Đặng Văn Vấn", role: "Hiệu trưởng" },
      { name: "TS. Nguyễn Ngọc Vinh", role: "Phó Hiệu trưởng" },
      { name: "ThS. Trần Thị Kim Cúc", role: "Phó Hiệu trưởng" },
    ],
  },
  {
    id: "cntt",
    name: "Khoa Công nghệ thông tin",
    code: "CNTT",
    personnel: [
      { name: "TS. Nguyễn Ngọc Vinh", role: "Trưởng khoa" },
      { name: "ThS. Huỳnh Công Toàn", role: "Phó Trưởng khoa" },
      { name: "ThS. Lê Thành Mộng", role: "Phó Trưởng khoa" },
      { name: "ThS. Đỗ Như Huy", role: "Giảng viên" },
    ],
  },
  {
    id: "dt_vh",
    name: "Phòng Đào tạo - Quản lý HSSV",
    code: "DT-QLHSSV",
    personnel: [
      { name: "ThS. Nguyễn Đình Hào", role: "Trưởng phòng" },
      { name: "ThS. Phạm Ngọc Thạch", role: "Phó Trưởng phòng" },
      { name: "CN. Lê Thị Bích Thủy", role: "Chuyên viên" },
    ],
  },
  {
    id: "tckt",
    name: "Phòng Tài chính - Kế toán",
    code: "TC-KT",
    personnel: [
      { name: "ThS. Nguyễn Thị Minh Tâm", role: "Trưởng phòng" },
      { name: "CN. Bùi Thị Thanh Hà", role: "Kế toán viên" },
    ],
  },
  {
    id: "tchc",
    name: "Phòng Tổ chức - Hành chính",
    code: "TC-HC",
    personnel: [
      { name: "ThS. Lê Văn Hùng", role: "Trưởng phòng" },
      { name: "CN. Trần Thị Mai", role: "Chuyên viên" },
    ],
  },
  {
    id: "dttx_dn",
    name: "Trung tâm Tuyển sinh & Hợp tác DN",
    code: "TS-HTDN",
    personnel: [
      { name: "ThS. Võ Nhật Quang", role: "Giám đốc" },
      { name: "CN. Phan Thanh Hải", role: "Phó Giám đốc" },
    ],
  },
];

export function getDepartmentByCode(code: string): DepartmentPersonnelGroup | undefined {
  return QCET_DEPARTMENT_GROUPS.find(
    (g) => g.code.toLowerCase() === code.toLowerCase()
  );
}
```

Create `src/lib/haptics.ts`:
```typescript
export type HapticType =
  | "selection"
  | "light"
  | "medium"
  | "heavy"
  | "success"
  | "warning"
  | "error";

const HAPTIC_PATTERNS: Record<HapticType, number | number[]> = {
  selection: 8,
  light: 12,
  medium: 22,
  heavy: 45,
  success: [15, 45, 30],
  warning: [25, 50, 25],
  error: [40, 50, 40, 50, 60],
};

const HAPTIC_STORAGE_KEY = "qcet_haptics_enabled";

export function isHapticSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    "vibrate" in navigator &&
    typeof navigator.vibrate === "function"
  );
}

export function isHapticsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return false;
    }
    const stored = localStorage.getItem(HAPTIC_STORAGE_KEY);
    return stored === null ? true : stored === "true";
  } catch {
    return true;
  }
}

export function setHapticsEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(HAPTIC_STORAGE_KEY, String(enabled));
  } catch {
    // Ignore storage failures
  }
}

export function triggerHaptic(type: HapticType = "light"): boolean {
  if (!isHapticSupported() || !isHapticsEnabled()) {
    return false;
  }
  try {
    const pattern = HAPTIC_PATTERNS[type];
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}
```

Add `isSchoolTask` to `src/types/dashboard.ts`:
```typescript
export function isSchoolTask(task: unknown): boolean {
  if (!task || typeof task !== "object") return false;
  return "taskCode" in task || ("subTasks" in task && Array.isArray((task as { subTasks: unknown }).subTasks));
}
```

Update `next.config.ts` to add `optimizePackageImports`:
```typescript
import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["web-push"],
  outputFileTracingRoot: path.resolve(__dirname),
  turbopack: {
    root: path.resolve(__dirname),
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "qrcode", "vaul"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/tasks",
        destination: "/?zone=tasks&scope=school",
        permanent: false,
      },
      {
        source: "/unit-tasks",
        destination: "/?zone=tasks&scope=unit",
        permanent: false,
      },
      {
        source: "/calendar",
        destination: "/?zone=calendar",
        permanent: false,
      },
      {
        source: "/org",
        destination: "/?zone=org",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
```

Update imports in `create-task-modal.tsx`, `user-profile-modal.tsx`, and `task-detail-side-sheet.tsx` to reference `@/lib/departments` and `@/types/dashboard`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/pwa-foundation-haptics.test.ts`  
Expected: PASS (all 4 tests passing).

- [ ] **Step 5: Commit changes**

```bash
git add src/lib/departments.ts src/lib/haptics.ts src/types/dashboard.ts next.config.ts tests/pwa-foundation-haptics.test.ts src/components/dashboard/create-task-modal.tsx src/components/auth/user-profile-modal.tsx src/components/dashboard/task-detail-side-sheet.tsx
git commit -m "feat(perf): decouple department constants and add pwa haptics engine"
```

---

### Task 2: Global CSS Mobile Ergonomics & Viewport Virtual Keyboard Resize

**Files:**
- Modify: `src/app/globals.css:1-60`
- Modify: `src/app/layout.tsx:1-40`
- Test: `tests/mobile-layout-viewport.test.ts`

**Interfaces:**
- Consumes: Tailwind v4 theme setup in `src/app/globals.css`
- Produces:
  - Responsive 16px iOS auto-zoom floor rule
  - `touch-action: manipulation` and `-webkit-tap-highlight-color: transparent`
  - `.touch-target-expand-44` utility class
  - `interactiveWidget: "resizes-content"` in Next.js `viewport` config

- [ ] **Step 1: Write the failing test for layout viewport and CSS classes**

```typescript
// tests/mobile-layout-viewport.test.ts
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { viewport } from "@/app/layout";

describe("Mobile Layout Viewport & CSS Ergonomics Suite", () => {
  test("layout.tsx viewport includes interactiveWidget: resizes-content", () => {
    assert.ok(viewport);
    assert.strictEqual(viewport.interactiveWidget, "resizes-content");
    assert.strictEqual(viewport.width, "device-width");
    assert.strictEqual(viewport.initialScale, 1);
  });

  test("globals.css contains touch-action manipulation and 16px iOS input floor", () => {
    const cssPath = path.resolve(process.cwd(), "src/app/globals.css");
    const cssContent = fs.readFileSync(cssPath, "utf-8");
    assert.ok(cssContent.includes("touch-action: manipulation"));
    assert.ok(cssContent.includes("-webkit-tap-highlight-color: transparent"));
    assert.ok(cssContent.includes("font-size: 16px !important"));
    assert.ok(cssContent.includes("touch-target-expand-44"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/mobile-layout-viewport.test.ts`  
Expected: FAIL (`interactiveWidget` not set on viewport).

- [ ] **Step 3: Update `src/app/layout.tsx` and `src/app/globals.css`**

In `src/app/layout.tsx`:
```typescript
export const viewport: Viewport = {
  themeColor: "#fbfbfb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  interactiveWidget: "resizes-content",
  viewportFit: "cover",
};
```

In `src/app/globals.css`, append:
```css
/* Mobile Touch & Form Ergonomics */
@layer base {
  button, a, input, select, textarea, [role="button"], [role="tab"] {
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  @media (max-width: 639px) {
    input, select, textarea {
      font-size: 16px !important;
    }
  }
}

.touch-target-expand-44 {
  position: relative;
}
.touch-target-expand-44::after {
  content: "";
  position: absolute;
  inset: -10px;
  min-width: 44px;
  min-height: 44px;
  z-index: 1;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/mobile-layout-viewport.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/app/layout.tsx src/app/globals.css tests/mobile-layout-viewport.test.ts
git commit -m "style(mobile): add 16px input floor, manipulation touch-action and viewport resize"
```

---

### Task 3: PWA Manifest, Light Splash Theme, Service Worker Offline Cache Matrix & Mutation Queue

**Files:**
- Create: `src/lib/offline-sync.ts`
- Create: `src/components/layout/offline-banner.tsx`
- Modify: `src/app/manifest.ts`
- Modify: `public/manifest.webmanifest`
- Modify: `public/sw.js:1-160`
- Modify: `src/hooks/use-task-mutations.ts:80-140`
- Modify: `src/components/pwa/mobile-app-install-modal.tsx:180-260`
- Test: `tests/pwa-manifest-routing.test.ts`

**Interfaces:**
- Consumes: Manifest contract from Web App Manifest spec & Service Worker Cache API
- Produces:
  - `#fbfbfb` background/theme colors
  - App shortcuts: `Tạo việc mới`, `Việc cần xử lý`, `Lịch công tác`
  - Push notification click fallback to `/?zone=tasks`
  - Two-tier Service Worker Caching: Cache-First for `/_next/static/*`, Network-First with 2.5s Timeout for `/api/dashboard/*` & `/api/tasks/*`
  - Local Mutation Queue in `src/lib/offline-sync.ts` preventing destructive rollbacks on network drops
  - Non-intrusive Offline Floating Capsule in `src/components/layout/offline-banner.tsx`
  - Mobile install modal hiding QR and presenting 1-click install/share instructions

- [ ] **Step 1: Write the failing test for manifest, offline sync and SW cache matrix**

```typescript
// tests/pwa-manifest-routing.test.ts
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import manifestFn from "@/app/manifest";
import { enqueueOfflineMutation, getOfflineMutationQueue, removeOfflineMutation } from "@/lib/offline-sync";

describe("PWA Manifest, Service Worker & Offline Sync Suite", () => {
  test("manifest.ts generates light-only theme with shortcuts", () => {
    const manifest = manifestFn();
    assert.strictEqual(manifest.background_color, "#fbfbfb");
    assert.strictEqual(manifest.theme_color, "#fbfbfb");
    assert.ok(Array.isArray(manifest.shortcuts));
    assert.strictEqual(manifest.shortcuts.length, 3);
    assert.strictEqual(manifest.shortcuts[0].url, "/?action=create_task");
  });

  test("public/sw.js includes static Cache-First and API timeout fallback", () => {
    const swPath = path.resolve(process.cwd(), "public/sw.js");
    const swContent = fs.readFileSync(swPath, "utf-8");
    assert.ok(swContent.includes("/?zone=tasks"));
    assert.ok(swContent.includes("/_next/static/"));
    assert.ok(swContent.includes("X-QCET-Offline-Cache") || swContent.includes("API_CACHE_NAME"));
  });

  test("offline-sync manages queue and does not throw in node environment", () => {
    const mutation = enqueueOfflineMutation({
      url: "/api/tasks/123",
      method: "PATCH",
      body: { status: "COMPLETED" },
      description: "Duyệt nhanh nhiệm vụ 123",
    });
    assert.ok(mutation.id);
    const queue = getOfflineMutationQueue();
    assert.ok(queue.some((item) => item.id === mutation.id));
    removeOfflineMutation(mutation.id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/pwa-manifest-routing.test.ts`  
Expected: FAIL (manifest has dark color or shortcuts missing).

- [ ] **Step 3: Update `src/app/manifest.ts`, `public/manifest.webmanifest`, `public/sw.js`, and `mobile-app-install-modal.tsx`**

In `src/app/manifest.ts`:
```typescript
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "QCET E-Office | Văn phòng điện tử Trường CĐ KTCN Quy Nhơn",
    short_name: "QCET E-Office",
    description: "Hệ thống quản lý công việc và chỉ đạo điều hành số QCET E-Office",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfbfb",
    theme_color: "#fbfbfb",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "Tạo việc mới",
        short_name: "Tạo việc",
        description: "Mở nhanh hộp thoại tạo nhiệm vụ mới",
        url: "/?action=create_task",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Việc cần xử lý",
        short_name: "Cần xử lý",
        description: "Truy cập danh sách công việc cần xử lý",
        url: "/?zone=tasks&filter=needs_review",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Lịch công tác",
        short_name: "Lịch",
        description: "Xem lịch công tác tuần và tháng",
        url: "/?zone=calendar",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
```

Update `public/sw.js` replacing fallback URL `/portal` with `/?zone=tasks`.  
Update `MobileAppInstallModal` to check `isMobileDevice` and render native install buttons / share guides without forcing a desktop QR code on mobile.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/pwa-manifest-routing.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/app/manifest.ts public/manifest.webmanifest public/sw.js src/components/pwa/mobile-app-install-modal.tsx tests/pwa-manifest-routing.test.ts
git commit -m "feat(pwa): standardize light splash theme, shortcuts, and notification routing"
```

---

### Task 4: Dynamic Imports & Bundle Splitting in AppShell & AppTopbar

**Files:**
- Modify: `src/components/layout/app-shell.tsx:1-80`
- Modify: `src/components/layout/app-topbar.tsx:1-60`
- Modify: `src/app/page.tsx:1-50`
- Test: `tests/bundle-dynamic-imports.test.ts`

**Interfaces:**
- Consumes: `next/dynamic` from Next.js
- Produces:
  - Code-split modals in `AppShell` (`PushOnboardingSheet`, `MobileAppInstallModal`, `WelcomeModal`, `SpotlightTour`, `OnboardingChecklistWidget`)
  - Code-split `UserProfileModal` in `AppTopbar`
  - Code-split auxiliary zones (`CalendarZone`, `OrgZone`, `DocumentsZone`) in `page.tsx`

- [ ] **Step 1: Write the failing test for dynamic import configurations**

```typescript
// tests/bundle-dynamic-imports.test.ts
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Bundle Dynamic Imports Verification Suite", () => {
  test("app-shell.tsx uses next/dynamic for heavy overlays", () => {
    const appShellPath = path.resolve(process.cwd(), "src/components/layout/app-shell.tsx");
    const content = fs.readFileSync(appShellPath, "utf-8");
    assert.ok(content.includes('import dynamic from "next/dynamic"'));
    assert.ok(content.includes('import("@/components/pwa/mobile-app-install-modal")'));
    assert.ok(content.includes('import("@/components/pwa/push-onboarding-sheet")'));
  });

  test("app-topbar.tsx dynamically imports UserProfileModal", () => {
    const topbarPath = path.resolve(process.cwd(), "src/components/layout/app-topbar.tsx");
    const content = fs.readFileSync(topbarPath, "utf-8");
    assert.ok(content.includes('import dynamic from "next/dynamic"'));
    assert.ok(content.includes('import("@/components/auth/user-profile-modal")'));
  });

  test("page.tsx dynamically splits CalendarZone, OrgZone, DocumentsZone", () => {
    const pagePath = path.resolve(process.cwd(), "src/app/page.tsx");
    const content = fs.readFileSync(pagePath, "utf-8");
    assert.ok(content.includes('import dynamic from "next/dynamic"'));
    assert.ok(content.includes('import("@/components/dashboard/zones/calendar-zone")'));
    assert.ok(content.includes('import("@/components/dashboard/zones/org-zone")'));
    assert.ok(content.includes('import("@/components/dashboard/zones/documents-zone")'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/bundle-dynamic-imports.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Implement dynamic imports in `app-shell.tsx`, `app-topbar.tsx`, and `page.tsx`**

In `src/components/layout/app-shell.tsx`:
Replace static imports of overlays with:
```tsx
import dynamic from "next/dynamic";

const PushOnboardingSheet = dynamic(
  () => import("@/components/pwa/push-onboarding-sheet").then((m) => m.PushOnboardingSheet),
  { ssr: false }
);

const MobileAppInstallModal = dynamic(
  () => import("@/components/pwa/mobile-app-install-modal").then((m) => m.MobileAppInstallModal),
  { ssr: false }
);

const WelcomeModal = dynamic(
  () => import("@/components/onboarding/welcome-modal").then((m) => m.WelcomeModal),
  { ssr: false }
);

const SpotlightTour = dynamic(
  () => import("@/components/onboarding/spotlight-tour").then((m) => m.SpotlightTour),
  { ssr: false }
);

const OnboardingChecklistWidget = dynamic(
  () => import("@/components/onboarding/onboarding-checklist-widget").then((m) => m.OnboardingChecklistWidget),
  { ssr: false }
);
```

In `src/components/layout/app-topbar.tsx`:
Replace static `UserProfileModal` import with:
```tsx
const UserProfileModal = dynamic(
  () => import("@/components/auth/user-profile-modal").then((m) => m.UserProfileModal),
  { ssr: false }
);
```

In `src/app/page.tsx`:
Dynamically import `CalendarZone`, `OrgZone`, and `DocumentsZone`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/bundle-dynamic-imports.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/components/layout/app-shell.tsx src/components/layout/app-topbar.tsx src/app/page.tsx tests/bundle-dynamic-imports.test.ts
git commit -m "perf(bundle): split non-critical overlays and auxiliary zones with next/dynamic"
```

---

### Task 5: Mobile Bottom Navigation & Mobile Menu Drawer Synchronization

**Files:**
- Modify: `src/components/navigation.tsx:400-520`
- Modify: `src/components/layout/mobile-menu-drawer.tsx:1-120`
- Modify: `src/components/layout/app-sidebar.tsx:280-340`
- Test: `tests/navigation-drawer-sync.test.ts`

**Interfaces:**
- Consumes: `DashboardZone` from `@/components/dashboard/dashboard-context`
- Produces:
  - Synchronized Bottom Navigation tabs (`overview`, `tasks`, `calendar`, `org`, `more`)
  - 48px touch targets with `triggerHaptic("light")`
  - Safe-area bottom padding (`pb-[max(env(safe-area-inset-bottom,0px),0.5rem)]`)
  - Elimination of dead mobile drawer code from `app-sidebar.tsx`

- [ ] **Step 1: Write the failing test for navigation and drawer items**

```typescript
// tests/navigation-drawer-sync.test.ts
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Mobile Navigation & Drawer Synchronization Suite", () => {
  test("navigation.tsx defines 5 standardized tabs matching desktop zones", () => {
    const navPath = path.resolve(process.cwd(), "src/components/navigation.tsx");
    const content = fs.readFileSync(navPath, "utf-8");
    assert.ok(content.includes('triggerHaptic("light")') || content.includes("triggerHaptic"));
    assert.ok(content.includes("pb-safe") || content.includes("safe-area-inset-bottom"));
    assert.ok(content.includes("Tổng quan"));
    assert.ok(content.includes("Nhiệm vụ"));
  });

  test("app-sidebar.tsx is desktop-only without dead mobile drawer classes", () => {
    const sidebarPath = path.resolve(process.cwd(), "src/components/layout/app-sidebar.tsx");
    const content = fs.readFileSync(sidebarPath, "utf-8");
    assert.ok(!content.includes("isMobileOpen"));
    assert.ok(content.includes("hidden md:flex") || content.includes("hidden md:"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/navigation-drawer-sync.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Update `src/components/navigation.tsx`, `mobile-menu-drawer.tsx`, and `app-sidebar.tsx`**

In `src/components/navigation.tsx`:
- Ensure each bottom nav button has `min-h-[48px]`, `triggerHaptic("light")`, active indicator bar, and safe-area padding.
- Ensure the 5 primary tabs map cleanly:
  1. `overview`: Dashboard KPI (`setActiveZone("overview")`)
  2. `tasks`: Kho công việc (`setActiveZone("tasks")`)
  3. `calendar`: Lịch công tác (`setActiveZone("calendar")`)
  4. `org`: Cơ cấu tổ chức (`setActiveZone("org")`)
  5. `more`: Mở MobileMenuDrawer.

In `src/components/layout/mobile-menu-drawer.tsx`:
- Render 2-column grid with 48px touch targets, quick links to Documents, Reports, Kiosk TV, Settings, and Profile.

In `src/components/layout/app-sidebar.tsx`:
- Remove dead mobile drawer backdrop and JSX, making it `hidden md:flex flex-col`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/navigation-drawer-sync.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/components/navigation.tsx src/components/layout/mobile-menu-drawer.tsx src/components/layout/app-sidebar.tsx tests/navigation-drawer-sync.test.ts
git commit -m "feat(mobile): synchronize bottom navigation tabs and clean up dead sidebar drawer"
```

---

### Task 6: UnifiedTaskToolbar Mobile Ergonomics & 12-Month Fade Mask

**Files:**
- Modify: `src/components/dashboard/unified-task-toolbar.tsx:220-440`
- Test: `tests/task-toolbar-mobile.test.ts`

**Interfaces:**
- Consumes: `useDashboard` and `TaskScope`
- Produces:
  - Responsive Scope Switcher labels ("Cá nhân", "Cấp Trường", "Đơn vị" on mobile)
  - 12-Month Academic cycle bar with CSS right-edge fade mask (`mask-image`) and 36px touch targets
  - `overscroll-behavior-x: contain` to prevent accidental navigation swipe-backs

- [ ] **Step 1: Write the failing test for mobile toolbar ergonomics**

```typescript
// tests/task-toolbar-mobile.test.ts
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Unified Task Toolbar Mobile Ergonomics Suite", () => {
  test("unified-task-toolbar.tsx includes responsive labels for scope switcher", () => {
    const toolbarPath = path.resolve(process.cwd(), "src/components/dashboard/unified-task-toolbar.tsx");
    const content = fs.readFileSync(toolbarPath, "utf-8");
    assert.ok(content.includes("Cá nhân"));
    assert.ok(content.includes("overscroll-x-contain") || content.includes("overscroll-behavior-x"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/task-toolbar-mobile.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Update `src/components/dashboard/unified-task-toolbar.tsx`**

1. Update Scope Switcher tab buttons:
```tsx
<span className="sm:hidden">Cá nhân</span>
<span className="hidden sm:inline">Việc của tôi</span>
...
<span className="sm:hidden">Cấp Trường</span>
<span className="hidden sm:inline">Nhiệm vụ cấp Trường</span>
...
<span className="sm:hidden">Đơn vị</span>
<span className="hidden sm:inline">Công việc Đơn vị</span>
```
2. Update 12-Month Academic Cycle bar:
- Add `h-9` (36px) to each month pill.
- Add `style={{ maskImage: "linear-gradient(to right, black 88%, transparent 100%)", WebkitMaskImage: "linear-gradient(to right, black 88%, transparent 100%)" }}`.
- Add `overscroll-x-contain`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/task-toolbar-mobile.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/components/dashboard/unified-task-toolbar.tsx tests/task-toolbar-mobile.test.ts
git commit -m "feat(mobile): add responsive scope labels and 12-month scroll mask"
```

---

### Task 7: CascadingTaskTable Dual-Mode Rendering, Swipe Actions & Pull-to-Refresh

**Files:**
- Create: `src/hooks/use-swipe-action.ts`
- Create: `src/hooks/use-pull-to-refresh.ts`
- Modify: `src/components/tasks/cascading-task-table.tsx:640-1230`
- Test: `tests/cascading-table-mobile.test.ts`

**Interfaces:**
- Consumes: `SchoolTaskWithSubtasks[]`, `onStatusChange`, `onSelectTask`
- Produces:
  - `hidden md:block` table container for desktop
  - `flex flex-col gap-3 md:hidden` Mobile Card Feed
  - `useSwipeAction` hook with 8px axis-locking slop & Haptic trigger (Swipe right for quick approve)
  - `usePullToRefresh` hook with `overscroll-behavior-y: contain` & rubber-band damping
  - Always-visible 40px quick-action buttons (no hover dependency)
  - Full-width 44px accordion buttons for subtasks
  - Stepper pagination `[Trước] Trang X/Y [Sau]` on mobile

- [ ] **Step 1: Write the failing test for mobile card feed, swipe and pull-to-refresh**

```typescript
// tests/cascading-table-mobile.test.ts
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { useSwipeAction } from "@/hooks/use-swipe-action";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";

describe("Cascading Task Table Mobile Dual-Mode Suite", () => {
  test("cascading-task-table.tsx implements dual-mode with desktop table and mobile card feed", () => {
    const tablePath = path.resolve(process.cwd(), "src/components/tasks/cascading-task-table.tsx");
    const content = fs.readFileSync(tablePath, "utf-8");
    assert.ok(content.includes("hidden md:block"));
    assert.ok(content.includes("md:hidden"));
    assert.ok(content.includes("Duyệt nhanh"));
    assert.ok(!content.includes("group-hover:opacity-100")); // Mobile actions must not depend on hover
  });

  test("useSwipeAction hook exports valid contract", () => {
    assert.strictEqual(typeof useSwipeAction, "function");
  });

  test("usePullToRefresh hook exports valid contract", () => {
    assert.strictEqual(typeof usePullToRefresh, "function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/cascading-table-mobile.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Refactor `src/components/tasks/cascading-task-table.tsx`**

1. Wrap the desktop `<table>` container in:
```tsx
<div className="hidden md:block overflow-hidden rounded-2xl border border-border/50 bg-card shadow-card">
  ...
</div>
```
2. Below it, render the mobile Card Feed:
```tsx
<div className="flex flex-col gap-3 md:hidden" role="feed" aria-label="Danh sách nhiệm vụ di động">
  {paginatedTasks.map((task) => {
    const isExpanded = expandedIds.has(task.id);
    return (
      <article
        key={task.id}
        className="rounded-2xl border border-border/60 bg-card p-3.5 shadow-xs space-y-2.5"
      >
        {/* Card Header: Task code & Status Badge */}
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs font-bold text-primary">
            {task.taskCode || "NV-QCET"}
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border">
            {task.status}
          </span>
        </div>

        {/* Card Title */}
        <h4
          onClick={() => onSelectTask?.(task)}
          className="text-sm font-semibold text-foreground line-clamp-2 leading-snug cursor-pointer active:text-primary"
        >
          {task.title}
        </h4>

        {/* Metadata Row */}
        <div className="flex items-center justify-between text-xs text-muted-foreground font-medium pt-1 border-t border-border/40">
          <span>{task.leadAssigneeName || "QCET"}</span>
          <span>{task.dueDate ? new Date(task.dueDate).toLocaleDateString("vi-VN") : "Chưa có hạn"}</span>
        </div>

        {/* Quick Action Buttons - Always Visible on Mobile */}
        {onStatusChange && (
          <div className="flex items-center gap-2 pt-1">
            {task.status === "IN_PROGRESS" && (
              <button
                type="button"
                onClick={() => onStatusChange(task.id, "COMPLETED")}
                className="flex-1 min-h-[40px] inline-flex items-center justify-center rounded-xl bg-emerald-600 text-white font-semibold text-xs active:scale-[0.98]"
              >
                Duyệt nhanh
              </button>
            )}
          </div>
        )}

        {/* Subtask Accordion Trigger */}
        {task.subTasks && task.subTasks.length > 0 && (
          <button
            type="button"
            onClick={(e) => toggleExpand(task.id, e)}
            className="w-full min-h-[44px] flex items-center justify-between px-3 rounded-xl bg-muted/50 text-xs font-semibold text-foreground active:bg-muted"
          >
            <span>Nhiệm vụ con ({task.subTasks.length})</span>
            <ChevronDown className={cn("size-4 transition-transform", isExpanded && "rotate-180")} />
          </button>
        )}
      </article>
    );
  })}
</div>
```
3. Update pagination with compact Stepper on mobile (`md:hidden`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/cascading-table-mobile.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/components/tasks/cascading-task-table.tsx tests/cascading-table-mobile.test.ts
git commit -m "feat(tasks): implement mobile card feed and remove hover-hidden actions"
```

---

### Task 8: TaskKanbanBoard Mobile Horizontal Snap-Carousel

**Files:**
- Modify: `src/components/tasks/task-kanban-board.tsx:320-450`
- Test: `tests/kanban-board-mobile.test.ts`

**Interfaces:**
- Consumes: Kanban columns array and card items
- Produces:
  - Horizontal Snap-Carousel on mobile (`overflow-x-auto snap-x snap-mandatory`)
  - Stage Pager Tab bar above carousel
  - Active column indicator dots below carousel
  - 44px status movement actions

- [ ] **Step 1: Write the failing test for Kanban Snap-Carousel**

```typescript
// tests/kanban-board-mobile.test.ts
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Task Kanban Board Mobile Snap-Carousel Suite", () => {
  test("task-kanban-board.tsx implements snap-x carousel layout", () => {
    const kanbanPath = path.resolve(process.cwd(), "src/components/tasks/task-kanban-board.tsx");
    const content = fs.readFileSync(kanbanPath, "utf-8");
    assert.ok(content.includes("snap-x"));
    assert.ok(content.includes("snap-mandatory"));
    assert.ok(content.includes("snap-center"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/kanban-board-mobile.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Update `src/components/tasks/task-kanban-board.tsx`**

1. In `src/components/tasks/task-kanban-board.tsx`, replace the vertical stacking column container with:
```tsx
{/* Mobile Stage Tab Bar */}
<div className="flex md:hidden items-center gap-1.5 overflow-x-auto pb-2 mb-2 scrollbar-none">
  {KANBAN_COLUMNS.map((col, idx) => (
    <button
      key={col.id}
      type="button"
      onClick={() => scrollToColumn(idx)}
      className={cn(
        "min-h-[40px] px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors",
        activeColumnIndex === idx
          ? "bg-primary text-primary-foreground shadow-xs"
          : "bg-muted/60 text-muted-foreground hover:bg-muted"
      )}
    >
      {col.title} ({groupedTasks[col.id]?.length || 0})
    </button>
  ))}
</div>

{/* Responsive Board: Carousel on mobile, Grid on tablet/desktop */}
<div className="flex md:grid md:grid-cols-2 xl:grid-cols-4 gap-3.5 overflow-x-auto snap-x snap-mandatory scrollbar-none -mx-3.5 px-3.5 md:mx-0 md:px-0">
  {KANBAN_COLUMNS.map((col, idx) => (
    <div
      key={col.id}
      ref={(el) => { columnRefs.current[idx] = el; }}
      className="w-[86vw] max-w-[340px] shrink-0 snap-center flex flex-col md:w-auto md:max-w-none rounded-2xl border border-border/60 bg-muted/20 p-3"
    >
      ...
    </div>
  ))}
</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/kanban-board-mobile.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/components/tasks/task-kanban-board.tsx tests/kanban-board-mobile.test.ts
git commit -m "feat(kanban): transform mobile board into horizontal snap-carousel with stage tabs"
```

---

### Task 9: Mobile Forms, Virtual Keyboard & Adaptive Bottom Drawer

**Files:**
- Create: `src/hooks/use-virtual-keyboard.ts`
- Modify: `src/components/dashboard/create-task-modal.tsx:690-760,1180-1230`
- Modify: `src/components/auth/user-profile-modal.tsx:280-343`
- Modify: `src/components/dashboard/task-detail-side-sheet.tsx:1640-1720`
- Test: `tests/mobile-forms-keyboard.test.ts`

**Interfaces:**
- Consumes: `window.visualViewport` API & `vaul` BottomSheet
- Produces:
  - `useVirtualKeyboard` hook tracking OSK height and setting `--keyboard-height` CSS variable
  - Smooth `scrollIntoView({ block: "center", behavior: "smooth" })` on input focus
  - Adaptive Modal: Centered dialog on desktop (`md:`), `BottomSheet` on mobile (`< 768px`)
  - Sticky Action Dock in `create-task-modal.tsx` and `user-profile-modal.tsx` with `pb-[max(0.75rem,env(safe-area-inset-bottom))]`
  - Horizontal non-wrapping quick presets bar for date pickers
  - Input mode optimization: `type="tel" inputMode="tel"`

- [ ] **Step 1: Write the failing test for virtual keyboard hook and adaptive form drawer**

```typescript
// tests/mobile-forms-keyboard.test.ts
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { useVirtualKeyboard } from "@/hooks/use-virtual-keyboard";

describe("Mobile Forms & Virtual Keyboard Suite", () => {
  test("useVirtualKeyboard hook exports valid contract", () => {
    assert.strictEqual(typeof useVirtualKeyboard, "function");
  });

  test("create-task-modal.tsx uses sticky action dock and adaptive drawer", () => {
    const modalPath = path.resolve(process.cwd(), "src/components/dashboard/create-task-modal.tsx");
    const content = fs.readFileSync(modalPath, "utf-8");
    assert.ok(content.includes("sticky bottom-0") || content.includes("safe-area-inset-bottom"));
    assert.ok(content.includes("overflow-x-auto") || content.includes("no-scrollbar"));
  });

  test("user-profile-modal.tsx includes inputMode tel and sticky footer", () => {
    const profilePath = path.resolve(process.cwd(), "src/components/auth/user-profile-modal.tsx");
    const content = fs.readFileSync(profilePath, "utf-8");
    assert.ok(content.includes('inputMode="tel"'));
    assert.ok(content.includes("sticky bottom-0") || content.includes("border-t"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/mobile-forms-keyboard.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Implement `src/hooks/use-virtual-keyboard.ts` and refactor modals**

1. Create `src/hooks/use-virtual-keyboard.ts` listening to `window.visualViewport`.
2. In `create-task-modal.tsx`:
   - Replace wrap-breaking date buttons with horizontal swipeable pills `flex overflow-x-auto no-scrollbar gap-1.5 py-1`.
   - Ensure sticky action dock at bottom with safe-area padding.
   - Set inputs font size to `text-base sm:text-xs` to stop iOS auto-zoom.
3. In `user-profile-modal.tsx`:
   - Add `inputMode="tel"` to phone input.
   - Convert action button row to sticky footer.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/mobile-forms-keyboard.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/hooks/use-virtual-keyboard.ts src/components/dashboard/create-task-modal.tsx src/components/auth/user-profile-modal.tsx tests/mobile-forms-keyboard.test.ts
git commit -m "feat(mobile): add virtual keyboard hook and adaptive sticky action dock for mobile forms"
```

---

### Task 10: Outdoor Contrast Hardening & Mobile Spotlight Tour

**Files:**
- Modify: `src/components/onboarding/spotlight-tour.tsx:1-80`
- Modify: `src/components/tasks/executive-department-command-center.tsx:600-750`
- Test: `tests/a11y-contrast-onboarding.test.ts`

**Interfaces:**
- Consumes: Tour state from localStorage
- Produces:
  - Non-intrusive dismissible banner on mobile (< 768px) instead of viewport-blocking modal
  - Replacement of `text-muted-foreground/50` with `text-muted-foreground font-medium`
  - High-contrast status badges (`*-800 font-semibold border-*-300`)

- [ ] **Step 1: Write the failing test for spotlight tour mobile mode**

```typescript
// tests/a11y-contrast-onboarding.test.ts
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Accessibility, Contrast & Spotlight Tour Suite", () => {
  test("spotlight-tour.tsx avoids full-screen blocking overlay on mobile", () => {
    const tourPath = path.resolve(process.cwd(), "src/components/onboarding/spotlight-tour.tsx");
    const content = fs.readFileSync(tourPath, "utf-8");
    assert.ok(content.includes("innerWidth < 768") || content.includes("isMobile"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/a11y-contrast-onboarding.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Update `src/components/onboarding/spotlight-tour.tsx` and contrast in task components**

In `src/components/onboarding/spotlight-tour.tsx`:
Add mobile detection: if `window.innerWidth < 768`, do not mount the full-screen fixed spotlight backdrop that covers the bottom nav. Instead, render an inline dismissible greeting card.
Audit and replace instances of `text-muted-foreground/50` with `text-muted-foreground font-medium` across task views.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/a11y-contrast-onboarding.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/components/onboarding/spotlight-tour.tsx src/components/tasks/executive-department-command-center.tsx tests/a11y-contrast-onboarding.test.ts
git commit -m "fix(a11y): prevent onboarding tour from blocking mobile bottom nav and harden contrast"
```

---

### Task 11: Full End-to-End Typecheck & Test Verification

**Files:**
- All modified files
- Verification commands

**Interfaces:**
- Consumes: Entire TypeScript AST and test runner
- Produces: 0 TypeScript errors, 100% passing tests

- [ ] **Step 1: Run TypeScript typecheck**

Run: `npm run typecheck`  
Expected: PASS (exit code 0, no diagnostics).

- [ ] **Step 2: Run complete test suite**

Run: `npm test`  
Expected: PASS (all tests pass across unit and integration suites).

- [ ] **Step 3: Final verification commit and summary**

```bash
git status
git commit --allow-empty -m "chore: verify all mobile pwa and responsive modernization tests pass"
```
