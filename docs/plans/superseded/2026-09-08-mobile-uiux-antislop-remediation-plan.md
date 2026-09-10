---
status: superseded
domain: ux
created: 2026-09-08
superseded_by: 2026-09-09-master-ux-consolidation-plan.md
---

# Mobile UI/UX, Anti-AI Slop & Academic Microcopy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khắc phục triệt để các lỗ hổng công thái học di động P0 (che khuất bàn phím ảo trên modal, giật khung hình 100vh, touch targets < 44px), xóa bỏ các dấu hiệu AI Slop (dải màu gradient tím-xanh, pulsing dots, fake badges) và chuẩn hóa toàn diện 28 điểm văn phong sư phạm - hành chính theo Nghị định 30/2020/NĐ-CP & DACUM.

**Architecture:** (1) Thiết lập nền tảng Mobile Web chuẩn W3C với `100dvh`, root `overscroll-behavior-y: none`, `prefers-reduced-motion` và safe-area insets dự phòng `0px`; (2) Khắc phục PWA registration scope và precache atomicity; (3) Chuyển đổi hộp thoại nổi giữa màn hình sang Native Bottom Sheet trên viewport hẹp; (4) Nâng chuẩn vùng chạm 44×44px (iOS HIG / Material); (5) Thanh lọc visual AI slop sang thẩm mỹ công sở tôn nghiêm; (6) Hiệu chuẩn 28 điểm copy/microcopy sư phạm chuẩn mực.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript 5, Tailwind CSS v4 (@tailwindcss/postcss), Lucide React, W3C Web App Manifest & Service Worker API, Node.js Native Test Runner (`node:test`, `node:assert/strict`).

**Spec:** `docs/BAO_CAO_DANH_GIA_UIUX_MOBILE_ANTISLOP.md`

## Global Constraints

- **Light-Only Standard:** Tuyệt đối không thêm class `dark:`, khối `.dark`, hoặc logic chuyển đổi theme `useTheme`/`ThemeProvider` (tuân thủ QCET Engineering Rules).
- **Zero Cache Poisoning:** Nghiêm cấm chạy `next build` khi dev server đang chạy. Kiểm thử bằng `npm run typecheck` và `npm test` (`tsx --test tests/**/*.test.ts`).
- **Academic Tone Invariant:** Tuyệt đối không sử dụng đại từ suồng sã "bạn", "khách", "người dùng" đối với giảng viên; xưng hô chuẩn mực là "Thầy/Cô" hoặc "Quý Thầy/Cô".
- **Regulatory Citation:** Sử dụng đúng thuật ngữ Nghị định 30/2020/NĐ-CP ("Văn bản", "Hồ sơ", "Thẩm định", "Nghiệm thu", "Chỉ đạo"); không dùng thuật ngữ tiếp thị SaaS ("Toàn năng", "Thần tốc", "Radar", "45 giây").
- **Touch Ergonomics Invariant:** Mọi nút bấm, tab điều hướng, trigger icon trên mobile bắt buộc có touch target tối thiểu 44×44px (iOS HIG) kèm `touch-action: manipulation`.
- **Dynamic Viewport (dvh):** Sử dụng `dvh` thay vì `vh` hoặc `min-h-screen` tại các vùng cuộn hoặc chiều cao full-screen trên thiết bị di động.

---

### Task 1: Mobile Viewport Stability, Touch Standards & Safe-Area Safeguards

**Files:**
- Modify: `src/app/globals.css:125-215`
- Modify: `src/components/layout/app-shell.tsx:105-125`
- Modify: `src/app/layout.tsx:35-85`
- Test: `tests/viewport-accessibility.test.ts`

**Interfaces:**
- Consumes: Tailwind v4 `@layer base` và `@layer utilities`
- Produces: CSS rules cho `overscroll-behavior-y: none`, `min-h-[100dvh]`, `@media (prefers-reduced-motion: reduce)`, và safe-area insets có fallback `0px`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/viewport-accessibility.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Task 1: Mobile Viewport & Accessibility Standards", () => {
  const globalsCss = fs.readFileSync(
    path.join(process.cwd(), "src/app/globals.css"),
    "utf8"
  );
  const appShell = fs.readFileSync(
    path.join(process.cwd(), "src/components/layout/app-shell.tsx"),
    "utf8"
  );
  const appLayout = fs.readFileSync(
    path.join(process.cwd(), "src/app/layout.tsx"),
    "utf8"
  );

  it("globals.css defines overscroll-behavior-y: none on html and body", () => {
    assert.match(globalsCss, /html[\s\S]*?overscroll-behavior-y:\s*none/);
    assert.match(globalsCss, /body[\s\S]*?overscroll-behavior-y:\s*none/);
  });

  it("globals.css defines safe-area insets with 0px fallback", () => {
    assert.match(globalsCss, /env\(safe-area-inset-bottom,\s*0px\)/);
    assert.match(globalsCss, /env\(safe-area-inset-top,\s*0px\)/);
  });

  it("globals.css includes prefers-reduced-motion reset block", () => {
    assert.match(globalsCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    assert.match(globalsCss, /animation-duration:\s*0\.01ms/);
  });

  it("app-shell.tsx uses 100dvh instead of 100vh / min-h-screen", () => {
    assert.match(appShell, /min-h-\[100dvh\]/);
    assert.doesNotMatch(appShell, /min-h-screen/);
  });

  it("layout.tsx does not load redundant uncompressed /logo-qcet.png apple-touch-icon", () => {
    assert.doesNotMatch(appLayout, /<link[^>]*rel="apple-touch-icon"[^>]*href="\/logo-qcet\.png"/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/viewport-accessibility.test.ts`
Expected: FAIL với assertion errors.

- [ ] **Step 3: Write minimal implementation**

1. Cập nhật `src/app/globals.css`:
Thêm `overscroll-behavior-y: none;` vào `html` và `body`.
Thay `min-h-screen` bằng `min-h-[100dvh]`.
Thêm fallback `0px` cho `.safe-area-bottom`, `.pb-safe`, `.safe-area-top`, `.pt-safe`, và `body padding-bottom`:
```css
  html {
    @apply font-sans scroll-smooth;
    overscroll-behavior-y: none;
  }

  body {
    @apply bg-background text-foreground tracking-normal selection:bg-primary/20 selection:text-primary relative min-h-[100dvh] font-sans;
    overscroll-behavior-y: none;
  }
```
Thêm fallback `0px`:
```css
  .safe-area-bottom,
  .pb-safe {
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }

  .safe-area-top,
  .pt-safe {
    padding-top: env(safe-area-inset-top, 0px);
  }

  @media (max-width: 768px) {
    body {
      padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px));
    }
  }
```
Thêm khối `@media (prefers-reduced-motion: reduce)`:
```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

2. Cập nhật `src/components/layout/app-shell.tsx`:
Đổi class `min-h-screen` thành `min-h-[100dvh]` ở dòng 108 và 114.

3. Cập nhật `src/app/layout.tsx`:
Xóa thẻ `<link rel="apple-touch-icon" href="/logo-qcet.png" />` ở dòng 75 (để Next.js tự quản lý `metadata.icons.apple`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/viewport-accessibility.test.ts`
Expected: PASS (5/5 passing).

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/components/layout/app-shell.tsx src/app/layout.tsx tests/viewport-accessibility.test.ts
git commit -m "fix(mobile): stabilize 100dvh dynamic viewport, overscroll lock, and safe-area fallbacks"
```

---

### Task 2: PWA Web App Manifest & Service Worker Scope Hardening

**Files:**
- Modify: `src/app/manifest.ts:1-50`
- Modify: `src/hooks/use-push-notification.ts:90-170`
- Modify: `public/sw.js:20-35, 230-245`
- Modify: `src/components/layout/offline-banner.tsx:80-95`
- Test: `tests/pwa-resilience.test.ts`

**Interfaces:**
- Consumes: W3C Web App Manifest spec, Push API `navigator.serviceWorker.getRegistration`
- Produces: Correct PWA metadata (`scope: "/"`, `id: "/?source=pwa"`), reliable push registration, and collision-free offline banner.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/pwa-resilience.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import manifest from "../src/app/manifest";

describe("Task 2: PWA Configuration & Push Resilience", () => {
  const swJs = fs.readFileSync(path.join(process.cwd(), "public/sw.js"), "utf8");
  const pushHook = fs.readFileSync(
    path.join(process.cwd(), "src/hooks/use-push-notification.ts"),
    "utf8"
  );
  const offlineBanner = fs.readFileSync(
    path.join(process.cwd(), "src/components/layout/offline-banner.tsx"),
    "utf8"
  );

  it("manifest() defines scope, id, lang, and start_url", () => {
    const data = manifest();
    assert.equal(data.scope, "/");
    assert.equal(data.id, "/?source=pwa");
    assert.equal(data.lang, "vi");
    assert.equal(data.dir, "ltr");
  });

  it("use-push-notification.ts calls getRegistration('/') or ready instead of '/sw.js'", () => {
    assert.doesNotMatch(pushHook, /getRegistration\(['"]\/sw\.js['"]\)/);
    assert.match(pushHook, /getRegistration\(['"]\/['"]\)|getRegistration\(\)/);
  });

  it("public/sw.js uses Promise.allSettled for precaching", () => {
    assert.match(swJs, /Promise\.allSettled/);
  });

  it("public/sw.js does not use heavy /logo-qcet.png for notification badge", () => {
    assert.doesNotMatch(swJs, /badge:\s*payload\.badge\s*\|\|\s*['"]\/logo-qcet\.png['"]/);
    assert.match(swJs, /badge:\s*payload\.badge\s*\|\|\s*['"]\/icons\/badge-72x72\.png['"]/);
  });

  it("offline-banner.tsx avoids colliding with mobile bottom navigation bar", () => {
    assert.match(offlineBanner, /bottom-\[calc\(4\.\d+rem\+env\(safe-area-inset-bottom/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/pwa-resilience.test.ts`
Expected: FAIL với assertion errors.

- [ ] **Step 3: Write minimal implementation**

1. Cập nhật `src/app/manifest.ts`:
Bổ sung `scope: "/"`, `id: "/?source=pwa"`, `lang: "vi"`, `dir: "ltr"` vào object trả về của `manifest()`.

2. Cập nhật `src/hooks/use-push-notification.ts`:
Thay thế tất cả `navigator.serviceWorker.getRegistration('/sw.js')` thành `navigator.serviceWorker.getRegistration('/')`.

3. Cập nhật `public/sw.js`:
Tại sự kiện `install`:
```javascript
self.addEventListener('install', (event) => {
  const installTasks = [self.skipWaiting()];
  if (typeof caches !== 'undefined') {
    installTasks.push(
      caches.open(CACHE_NAME).then(async (cache) => {
        await Promise.allSettled(
          PRECACHE_ASSETS.map((asset) => cache.add(asset).catch(() => {}))
        );
      })
    );
  }
  event.waitUntil(Promise.all(installTasks));
});
```
Tại sự kiện `push`:
Thay `badge: payload.badge || '/logo-qcet.png'` bằng `badge: payload.badge || '/icons/badge-72x72.png'`.

4. Cập nhật `src/components/layout/offline-banner.tsx`:
Thay `bottom-20 left-1/2 -translate-x-1/2` bằng:
`bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 sm:bottom-6`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/pwa-resilience.test.ts`
Expected: PASS (5/5 passing).

- [ ] **Step 5: Commit**

```bash
git add src/app/manifest.ts src/hooks/use-push-notification.ts public/sw.js src/components/layout/offline-banner.tsx tests/pwa-resilience.test.ts
git commit -m "fix(pwa): harden manifest scope, sw registration, precache atomicity, and offline banner positioning"
```

---

### Task 3: Mobile Bottom Sheet Transformation for Review & Deliverable Modals (P0 Keyboard Occlusion)

**Files:**
- Modify: `src/components/ui/bottom-sheet.tsx:40-60`
- Modify: `src/components/portal/review-action-dialog.tsx:300-340, 545-600`
- Modify: `src/components/portal/submit-deliverable-modal.tsx:400-435, 630-685`
- Test: `tests/mobile-modals-ergonomics.test.ts`

**Interfaces:**
- Consumes: Dialog / Portal primitives
- Produces: Adaptive modals that become native Bottom Sheets on mobile (`< sm`) with `items-end sm:items-center`, `rounded-t-2xl sm:rounded-2xl`, full-width buttons (`min-h-[48px]`), `max-h-[90dvh]`, and drag handles.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/mobile-modals-ergonomics.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Task 3: Mobile Modal Bottom Sheet Ergonomics", () => {
  const bottomSheet = fs.readFileSync(
    path.join(process.cwd(), "src/components/ui/bottom-sheet.tsx"),
    "utf8"
  );
  const reviewDialog = fs.readFileSync(
    path.join(process.cwd(), "src/components/portal/review-action-dialog.tsx"),
    "utf8"
  );
  const submitModal = fs.readFileSync(
    path.join(process.cwd(), "src/components/portal/submit-deliverable-modal.tsx"),
    "utf8"
  );

  it("ui/bottom-sheet.tsx uses 90dvh instead of 90vh", () => {
    assert.match(bottomSheet, /max-h-\[90dvh\]/);
  });

  it("review-action-dialog.tsx morphs to bottom sheet on mobile (< sm)", () => {
    assert.match(reviewDialog, /items-end sm:items-center/);
    assert.match(reviewDialog, /rounded-t-2xl sm:rounded-2xl/);
    assert.match(reviewDialog, /max-h-\[90dvh\]/);
  });

  it("submit-deliverable-modal.tsx morphs to bottom sheet on mobile (< sm)", () => {
    assert.match(submitModal, /items-end sm:items-center/);
    assert.match(submitModal, /rounded-t-2xl sm:rounded-2xl/);
    assert.match(submitModal, /max-h-\[90dvh\]/);
  });

  it("submit-deliverable-modal.tsx uses updated formal academic microcopy", () => {
    assert.match(submitModal, /Gửi hồ sơ thẩm định/);
    assert.doesNotMatch(submitModal, /Gửi Trưởng đơn vị duyệt/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/mobile-modals-ergonomics.test.ts`
Expected: FAIL với assertion errors.

- [ ] **Step 3: Write minimal implementation**

1. Cập nhật `src/components/ui/bottom-sheet.tsx`:
Tại dòng 48, đổi `max-h-[90vh]` thành `max-h-[90dvh]`.

2. Cập nhật `src/components/portal/review-action-dialog.tsx`:
- Tại container bọc ngoài (dòng 305):
  Đổi `fixed inset-0 z-50 flex items-center justify-center p-4` thành:
  `fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4`.
- Tại dialog content (dòng 315):
  Đổi class bo góc và chiều cao tối đa thành:
  `w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-card border border-border/80 shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden`.
- Thêm thanh gạt cảm ứng ở đỉnh trên mobile:
  `<div className="w-12 h-1 bg-muted-foreground/30 rounded-full mx-auto my-2 sm:hidden shrink-0" />`
- Nút hành động chân trang:
  Dàn `w-full sm:w-auto min-h-[44px] sm:min-h-[38px] pb-safe`.

3. Cập nhật `src/components/portal/submit-deliverable-modal.tsx`:
- Tại container bọc ngoài (dòng 403):
  Đổi thành `fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4`.
- Tại modal content (dòng 410):
  Đổi thành `w-full max-w-xl rounded-t-2xl sm:rounded-2xl bg-card border border-border/80 shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden`.
- Thêm thanh gạt cảm ứng ở đỉnh trên mobile:
  `<div className="w-12 h-1 bg-muted-foreground/30 rounded-full mx-auto my-2 sm:hidden shrink-0" />`
- Sửa microcopy dòng 633: `label` thành `"Nội dung giải trình / Ghi chú gửi cấp phê duyệt"`.
- Sửa microcopy dòng 673: nút submit thành `"Gửi hồ sơ thẩm định"`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/mobile-modals-ergonomics.test.ts`
Expected: PASS (4/4 passing).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/bottom-sheet.tsx src/components/portal/review-action-dialog.tsx src/components/portal/submit-deliverable-modal.tsx tests/mobile-modals-ergonomics.test.ts
git commit -m "fix(mobile): convert desktop dialogs to native bottom sheets preventing keyboard occlusion"
```

---

### Task 4: Touch Target Standard (44px) on Action Queues, Header & Topbar

**Files:**
- Modify: `src/components/workspace/components/universal-action-queue.tsx:195-235, 305-340`
- Modify: `src/components/workspace/components/adaptive-scope-header.tsx:140-180, 240-260`
- Modify: `src/components/workspace/components/adaptive-metric-strip.tsx:220-250`
- Modify: `src/components/workspace/unified-adaptive-workspace.tsx:135-145`
- Modify: `src/components/layout/app-topbar.tsx:265-320`
- Test: `tests/touch-targets-ergonomics.test.ts`

**Interfaces:**
- Consumes: Workspace action configs, Topbar navigation
- Produces: Guaranteed minimum 44×44px touch targets on interactive mobile buttons, safe bottom padding on workspace root, and clean metric cards.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/touch-targets-ergonomics.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Task 4: Touch Targets & Workspace Ergonomics", () => {
  const actionQueue = fs.readFileSync(
    path.join(process.cwd(), "src/components/workspace/components/universal-action-queue.tsx"),
    "utf8"
  );
  const scopeHeader = fs.readFileSync(
    path.join(process.cwd(), "src/components/workspace/components/adaptive-scope-header.tsx"),
    "utf8"
  );
  const metricStrip = fs.readFileSync(
    path.join(process.cwd(), "src/components/workspace/components/adaptive-metric-strip.tsx"),
    "utf8"
  );
  const workspaceRoot = fs.readFileSync(
    path.join(process.cwd(), "src/components/workspace/unified-adaptive-workspace.tsx"),
    "utf8"
  );
  const topbar = fs.readFileSync(
    path.join(process.cwd(), "src/components/layout/app-topbar.tsx"),
    "utf8"
  );

  it("universal-action-queue.tsx enforces min-h-[44px] on action buttons", () => {
    assert.match(actionQueue, /min-h-\[44px\]/);
    assert.doesNotMatch(actionQueue, /min-h-\[30px\]/);
  });

  it("adaptive-scope-header.tsx enforces min-h-[44px] on mobile scope tabs", () => {
    assert.match(scopeHeader, /min-h-\[44px\]/);
  });

  it("adaptive-scope-header.tsx hides top-right create task button on mobile", () => {
    assert.match(scopeHeader, /hidden\s+sm:inline-flex/);
  });

  it("adaptive-metric-strip.tsx avoids backdrop-blur-xs and uses solid card styling", () => {
    assert.doesNotMatch(metricStrip, /backdrop-blur-xs/);
  });

  it("unified-adaptive-workspace.tsx sets safe bottom padding for iOS Home Bar", () => {
    assert.match(workspaceRoot, /pb-\[calc\(5\.\d+rem\+env\(safe-area-inset-bottom/);
  });

  it("app-topbar.tsx enforces min-h-[44px] min-w-[44px] touch target on icon buttons", () => {
    assert.match(topbar, /min-h-\[44px\]\s+min-w-\[44px\]/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/touch-targets-ergonomics.test.ts`
Expected: FAIL với assertion errors.

- [ ] **Step 3: Write minimal implementation**

1. Cập nhật `src/components/workspace/components/universal-action-queue.tsx`:
- Nâng nút hành động duyệt/giao/nộp từ `min-h-[30px]` lên `min-h-[44px]` (thêm `min-h-[44px] touch-manipulation px-3.5`).
- Thay "Duyệt nhanh" thành "Phê duyệt".
- Thay "Giao việc" thành "Phân công".
- Thay "Không có tác vụ nào cần xử lý khẩn cấp" thành "Không có nhiệm vụ cần xử lý gấp".
- Thay "Nhiệm vụ cá nhân cần nộp" thành "Nhiệm vụ cần nộp hồ sơ minh chứng".

2. Cập nhật `src/components/workspace/components/adaptive-scope-header.tsx`:
- Các pill tab phạm vi: thêm `min-h-[44px] sm:min-h-[36px] touch-manipulation`.
- Nút "Giao nhiệm vụ" trên header: đổi class thành `hidden sm:inline-flex` (để tránh với tay vùng khó chạm trên mobile, nhường quyền tạo việc cho nút (+) trung tâm ở `MobileBottomNav`).

3. Cập nhật `src/components/workspace/components/adaptive-metric-strip.tsx`:
- Bỏ `backdrop-blur-xs`, đổi thành `bg-card border border-border/70`.
- Đổi `truncate` thành `line-clamp-1 leading-snug`.
- Sửa copy "Hồ sơ chờ bạn phê duyệt" thành "Hồ sơ chờ Thầy/Cô phê duyệt".
- Sửa copy "Tiến độ khoa" thành "Tiến độ đơn vị".

4. Cập nhật `src/components/workspace/unified-adaptive-workspace.tsx`:
- Đổi `pb-20 sm:pb-8` thành `pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:pb-8`.

5. Cập nhật `src/components/layout/app-topbar.tsx`:
- Thêm `min-h-[44px] min-w-[44px] touch-manipulation flex items-center justify-center` vào các trigger icon (Notification Bell, PWA Button, Avatar Trigger).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/touch-targets-ergonomics.test.ts`
Expected: PASS (6/6 passing).

- [ ] **Step 5: Commit**

```bash
git add src/components/workspace/ src/components/layout/app-topbar.tsx tests/touch-targets-ergonomics.test.ts
git commit -m "fix(ergonomics): standardize 44px touch targets on action queues, header tabs, and topbar icons"
```

---

### Task 5: Anti-AI Slop & Visual Tells Eradication

**Files:**
- Modify: `src/components/ui/button.tsx:15-35`
- Modify: `src/components/dashboard/cascading-task-table.tsx:575-595`
- Modify: `src/components/tasks/cascading-task-table.tsx:575-595`
- Modify: `src/components/layout/app-sidebar.tsx:540-555`
- Modify: `src/components/portal/bento-portal-hub.tsx:110-125, 540-550`
- Modify: `src/app/portal/page.tsx:160-175, 205-235`
- Modify: `src/components/navigation.tsx:355-365`
- Modify: `src/components/dashboard/activity-feed-widget.tsx:100-115`
- Test: `tests/anti-ai-slop.test.ts`

**Interfaces:**
- Consumes: Button variants, table indicators, portal branding
- Produces: Clean administrative visual language without AI gradients, pulsing indicator dots, or fake "Enterprise" badges.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/anti-ai-slop.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Task 5: Anti-AI Slop & Visual Tells Eradication", () => {
  const button = fs.readFileSync(
    path.join(process.cwd(), "src/components/ui/button.tsx"),
    "utf8"
  );
  const portalHub = fs.readFileSync(
    path.join(process.cwd(), "src/components/portal/bento-portal-hub.tsx"),
    "utf8"
  );
  const navigation = fs.readFileSync(
    path.join(process.cwd(), "src/components/navigation.tsx"),
    "utf8"
  );
  const sidebar = fs.readFileSync(
    path.join(process.cwd(), "src/components/layout/app-sidebar.tsx"),
    "utf8"
  );
  const activityFeed = fs.readFileSync(
    path.join(process.cwd(), "src/components/dashboard/activity-feed-widget.tsx"),
    "utf8"
  );

  it("button.tsx eliminates purple/blue gradient from premium variant", () => {
    assert.doesNotMatch(button, /from-blue-600\s+to-indigo-600/);
    assert.match(button, /bg-primary/);
  });

  it("bento-portal-hub.tsx removes fake Enterprise v1.2 badge and Sparkles", () => {
    assert.doesNotMatch(portalHub, /Enterprise\s+v1\.2/);
    assert.doesNotMatch(portalHub, /Sparkles/);
    assert.match(portalHub, /2025-2026/);
  });

  it("navigation.tsx removes v1.2 Enterprise badge", () => {
    assert.doesNotMatch(navigation, /v1\.2\s+Enterprise/);
  });

  it("app-sidebar.tsx removes unmotivated animate-pulse on connection status dot", () => {
    assert.doesNotMatch(sidebar, /bg-emerald-500[^\n]*?animate-pulse/);
  });

  it("activity-feed-widget.tsx uses administrative History/Clock icon instead of Zap", () => {
    assert.doesNotMatch(activityFeed, /<Zap/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/anti-ai-slop.test.ts`
Expected: FAIL với assertion errors.

- [ ] **Step 3: Write minimal implementation**

1. Cập nhật `src/components/ui/button.tsx`:
Trong `buttonVariants`, đổi variant `premium` từ:
`"border-transparent bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-card hover:from-blue-700 hover:to-indigo-700"`
thành:
`"border-transparent bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 font-medium"`.

2. Cập nhật `src/components/portal/bento-portal-hub.tsx`:
- Dòng 115-116: Xóa `<Sparkles /> Hệ thống E-Office v1.2 Enterprise`, thay bằng huy hiệu hành chính:
  `<span className="text-xs font-semibold text-primary">Năm học 2025-2026 - Cơ sở Quy Nhơn</span>`.
- Dòng 544: Xóa `animate-pulse` khỏi chấm trạng thái xanh.

3. Cập nhật `src/components/navigation.tsx`:
- Dòng 359: Xóa `v1.2 Enterprise`, thay bằng `Năm học 2025-2026`.

4. Cập nhật `src/components/layout/app-sidebar.tsx`:
- Dòng 547: Xóa `animate-pulse` khỏi chấm trạng thái kết nối.

5. Cập nhật `src/app/portal/page.tsx` và `src/components/dashboard/cascading-task-table.tsx`:
- Xóa `animate-pulse` và `animate-ping` khỏi các chấm chỉ báo trạng thái.
- Thay `hover:scale-105 active:scale-95` bằng `hover:bg-muted/40 transition-colors`.

6. Cập nhật `src/components/dashboard/activity-feed-widget.tsx`:
- Thay import icon `Zap` bằng `History`, thay thẻ `<Zap size={16} />` bằng `<History size={16} />`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/anti-ai-slop.test.ts`
Expected: PASS (5/5 passing).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/button.tsx src/components/portal/ src/components/navigation.tsx src/components/layout/app-sidebar.tsx src/app/portal/page.tsx src/components/dashboard/ tests/anti-ai-slop.test.ts
git commit -m "fix(design): eradicate AI slop gradients, decorative pulsing dots, and fake enterprise badges"
```

---

### Task 6: Academic Microcopy & Tone Detox (28-Point Administrative Standardization)

**Files:**
- Modify: `src/components/auth/user-profile-modal.tsx:140-150, 275-320`
- Modify: `src/components/auth/google-login-button.tsx:100-115, 180-190, 215-235`
- Modify: `src/components/auth/role-viewpoint-banner.tsx:15-30, 60-75`
- Modify: `src/lib/onboarding-constants.ts:45-165`
- Modify: `src/components/onboarding/welcome-modal.tsx:130-140`
- Modify: `src/components/onboarding/onboarding-checklist-widget.tsx:70-80, 265-275`
- Modify: `src/components/tasks/cascading-task-table.tsx:160-175`
- Test: `tests/academic-microcopy.test.ts`

**Interfaces:**
- Consumes: Administrative roles (STAFF, UNIT_HEAD, RECTORATE), Task statuses
- Produces: Polished Vietnamese institutional copy adhering strictly to Decree 30/2020/ND-CP and respectful academic hierarchy.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/academic-microcopy.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ONBOARDING_FEATURES } from "../src/lib/onboarding-constants";

describe("Task 6: Academic Microcopy & Tone Detox", () => {
  const userProfile = fs.readFileSync(
    path.join(process.cwd(), "src/components/auth/user-profile-modal.tsx"),
    "utf8"
  );
  const googleBtn = fs.readFileSync(
    path.join(process.cwd(), "src/components/auth/google-login-button.tsx"),
    "utf8"
  );
  const roleBanner = fs.readFileSync(
    path.join(process.cwd(), "src/components/auth/role-viewpoint-banner.tsx"),
    "utf8"
  );
  const welcomeModal = fs.readFileSync(
    path.join(process.cwd(), "src/components/onboarding/welcome-modal.tsx"),
    "utf8"
  );
  const checklistWidget = fs.readFileSync(
    path.join(process.cwd(), "src/components/onboarding/onboarding-checklist-widget.tsx"),
    "utf8"
  );
  const taskTable = fs.readFileSync(
    path.join(process.cwd(), "src/components/tasks/cascading-task-table.tsx"),
    "utf8"
  );

  it("user-profile-modal.tsx addresses user with respect ('Quý Thầy/Cô') and formal role subtitles", () => {
    assert.match(userProfile, /Kính chào Quý Thầy\/Cô đến với QCET E-Office!/);
    assert.doesNotMatch(userProfile, /Chào mừng bạn đến với QCET E-Office!/);
    assert.match(userProfile, /Thực hiện nhiệm vụ & Nộp minh chứng/);
    assert.match(userProfile, /Lãnh đạo đơn vị & Phê duyệt/);
    assert.match(userProfile, /Chỉ đạo & Điều hành toàn trường/);
  });

  it("google-login-button.tsx uses formal civil-service copy and hides internal route URLs", () => {
    assert.match(googleBtn, /Đăng nhập bằng Email công vụ Nhà trường/);
    assert.match(googleBtn, /Đã sao chép/);
    assert.doesNotMatch(googleBtn, /Đã copy/);
    assert.doesNotMatch(googleBtn, /Vẫn thử tới \/api\/auth\/google/);
    assert.match(googleBtn, /Tiếp tục kết nối xác thực Google/);
    assert.match(googleBtn, /Đóng thông báo/);
  });

  it("role-viewpoint-banner.tsx eliminates tautology and uses formal title", () => {
    assert.match(roleBanner, /Nhiệm vụ trực tiếp: Các công việc được phân công cho/);
    assert.match(roleBanner, /Viên chức thực hiện/);
  });

  it("onboarding-constants.ts replaces tech jargon with official administrative terminology", () => {
    const allText = JSON.stringify(ONBOARDING_FEATURES);
    assert.doesNotMatch(allText, /Radar & Điểm Nghẽn/);
    assert.doesNotMatch(allText, /Tìm Kiếm Toàn Năng/);
    assert.doesNotMatch(allText, /tra cứu thần tốc/);
    assert.doesNotMatch(allText, /Nghị quyết can thiệp/);
    assert.match(allText, /Tiến Độ & Hồ Sơ Tồn Đọng/);
    assert.match(allText, /kịp thời đôn đốc và chỉ đạo/);
  });

  it("welcome-modal.tsx removes SaaS 45-second marketing formula", () => {
    assert.doesNotMatch(welcomeModal, /Khám phá trong 45 giây/);
    assert.match(welcomeModal, /Xem hướng dẫn sử dụng/);
  });

  it("checklist-widget.tsx removes casual 'Tour' and keeps faculty respect", () => {
    assert.doesNotMatch(checklistWidget, /Tour/);
    assert.match(checklistWidget, /Xem hướng dẫn từng bước/);
  });

  it("cascading-task-table.tsx standardizes task statuses to formal reporting terms", () => {
    assert.match(taskTable, /"Đang thực hiện"/);
    assert.match(taskTable, /"Chờ phê duyệt"/);
    assert.doesNotMatch(taskTable, /"Đang làm"/);
    assert.doesNotMatch(taskTable, /"Cần duyệt"/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/academic-microcopy.test.ts`
Expected: FAIL với assertion errors.

- [ ] **Step 3: Write minimal implementation**

1. Cập nhật `src/components/auth/user-profile-modal.tsx`:
- Dòng 145: Đổi thành `"Kính chào Quý Thầy/Cô đến với QCET E-Office!"`.
- Dòng 281: Đổi thành `"Thực hiện nhiệm vụ & Nộp minh chứng"`.
- Dòng 296: Đổi thành `"Lãnh đạo đơn vị & Phê duyệt"`.
- Dòng 311: Đổi thành `"Chỉ đạo & Điều hành toàn trường"`.

2. Cập nhật `src/components/auth/google-login-button.tsx`:
- Dòng 107: Đổi thành `"Đăng nhập bằng Email công vụ Nhà trường"`.
- Dòng 183: Đổi `"Đã copy"` thành `"Đã sao chép"`.
- Dòng 220: Đổi `"Vẫn thử tới /api/auth/google"` thành `"Tiếp tục kết nối xác thực Google"`.
- Dòng 228: Đổi `"Đã hiểu, đóng"` thành `"Đóng thông báo"`.

3. Cập nhật `src/components/auth/role-viewpoint-banner.tsx`:
- Dòng 18: Đổi thành `"Nhiệm vụ trực tiếp: Các công việc được phân công cho ${user.name}"`.
- Dòng 67: Đổi `user.role === "STAFF" ? "Cá nhân" : ...` thành `"Viên chức thực hiện"`.

4. Cập nhật `src/lib/onboarding-constants.ts`:
- Dòng 49-50: Đổi `title: "Tiến Độ & Hồ Sơ Tồn Đọng Đơn Vị"`, `description: "Theo dõi tiến độ các đơn vị trực thuộc, kịp thời đôn đốc và chỉ đạo xử lý."`.
- Dòng 57-58: Đổi `title: "Tra Cứu Nhanh"`, `description: "Hỗ trợ cán bộ tra cứu nhanh văn bản, tờ trình và hồ sơ công việc."`.
- Dòng 75-76: Đổi `title: "Phân Công & Nghiệm Thu"`, `description: "Giao nhiệm vụ cho viên chức và thẩm định hồ sơ minh chứng hoàn thành."`.
- Dòng 102-103: Đổi `description: "Tự động cấp số văn bản và lưu trữ hồ sơ theo Nghị định 30/2020/NĐ-CP."`.
- Dòng 150: Đổi `"Đã nhận vai trò"` thành `"Đã xác nhận vai trò"`.
- Dòng 156: Đổi `"Nhận Web Push tức thì..."` thành `"Nhận thông báo trực tiếp khi có nhiệm vụ hoặc chỉ đạo mới."`.

5. Cập nhật `src/components/onboarding/welcome-modal.tsx`:
- Dòng 135: Đổi `"Khám phá trong 45 giây"` thành `"Xem hướng dẫn sử dụng"`.

6. Cập nhật `src/components/onboarding/onboarding-checklist-widget.tsx`:
- Dòng 74: Đổi `"...để bạn tiếp tục."` thành `"...để Thầy/Cô tiếp tục làm việc."`.
- Dòng 270: Đổi `"Xem hướng dẫn trực quan (Tour)"` thành `"Xem hướng dẫn từng bước"`.

7. Cập nhật `src/components/tasks/cascading-task-table.tsx`:
- Dòng 162: Đổi nhãn hiển thị từ `"Đang làm"` thành `"Đang thực hiện"`.
- Dòng 170: Đổi nhãn hiển thị từ `"Cần duyệt"` thành `"Chờ phê duyệt"`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/academic-microcopy.test.ts`
Expected: PASS (7/7 passing).

- [ ] **Step 5: Commit**

```bash
git add src/components/auth/ src/lib/onboarding-constants.ts src/components/onboarding/ src/components/tasks/cascading-task-table.tsx tests/academic-microcopy.test.ts
git commit -m "fix(copy): standardize academic microcopy, respectful faculty tone, and administrative terms"
```

---

### Task 7: Full System Verification & Regression Suite

**Files:**
- Test: `tests/*.test.ts`

- [ ] **Step 1: Run complete typecheck**

Run: `npm run typecheck`
Expected: Exit code 0, no TypeScript errors.

- [ ] **Step 2: Run all unit & integration test suites**

Run: `npm test`
Expected: ALL test suites PASS.

- [ ] **Step 3: Final verification commit**

```bash
git commit --allow-empty -m "chore: verify all mobile UI/UX, anti-slop, and microcopy suites pass"
```
