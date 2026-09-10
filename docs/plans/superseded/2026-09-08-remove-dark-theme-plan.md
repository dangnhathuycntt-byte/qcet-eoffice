---
status: superseded
domain: ux
created: 2026-09-08
superseded_by: 2026-09-09-master-ux-consolidation-plan.md
---

# Loại Bỏ Hoàn Toàn Dark Theme (Light-Only Standardization) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Loại bỏ hoàn toàn Dark theme, đưa toàn bộ hệ thống QCET E-Office sang giao diện Sáng (Light-Only) thuần khiết, gỡ bỏ ThemeProvider và dọn sạch 100% class `dark:*` trên toàn codebase.

**Architecture:** 
1. Vô hiệu hóa biến thể dark trong Tailwind v4 bằng `@custom-variant dark (&:not(*));` và dọn sạch CSS tokens `.dark` trong `globals.css`.
2. Khóa metadata viewport về `colorScheme: "light"`, `themeColor: "#fbfbfb"`, gỡ bỏ `ThemeProvider` và xóa `theme-provider.tsx`.
3. Gỡ bỏ các nút bấm đổi theme (Sun/Moon toggle) ở Topbar, Navigation, Mobile Drawer và Portal.
4. Quét sạch triệt để các tiền tố `dark:*` trong tokens và toàn bộ 59 UI files.
5. Cập nhật các test suite tương ứng để duy trì 100% test pass.

**Tech Stack:** Next.js 15 (App Router), Tailwind CSS v4, React 19, Lucide React, Node.js Test Runner (tsx --test).

**Spec:** `docs/superpowers/specs/2026-09-08-remove-dark-theme-spec.md`

## Global Constraints

- Không chạy `next build` đè lên `.next` khi dev server đang chạy (tuân thủ nguyên tắc Build Rules trong `CLAUDE.md`).
- Sử dụng `npm run typecheck` và `npm test` để kiểm tra chất lượng mã nguồn sau mỗi tác vụ.
- Không để sót bất kỳ chuỗi `dark:` nào trong thư mục `src/`.
- Giữ nguyên toàn bộ logic nghiệp vụ, layout cấu trúc và responsive design của tất cả các màn hình.

---

### Task 1: Core Styling & Root Tokens

**Files:**
- Modify: `src/app/globals.css:4-140, 180-190, 315-340`
- Modify: `tests/typography-tokens-contract.test.ts:90-96`

**Interfaces:**
- Produces: Hệ thống CSS tokens trong `globals.css` chỉ bao gồm `:root` Light mode và `@custom-variant dark (&:not(*));` để loại trừ hoàn toàn fallback sang media query hệ thống.

- [ ] **Step 1: Cập nhật failing/outdated test trong `tests/typography-tokens-contract.test.ts`**

Trong `tests/typography-tokens-contract.test.ts`, thay thế test case kiểm tra `.dark` bằng kiểm tra hợp đồng không còn rule `.dark`:

```ts
  test("src/app/globals.css enforces pure light-only tokens and has no .dark block", () => {
    assert.ok(
      !cssContent.includes(".dark {") && !cssContent.includes(".dark{"),
      "globals.css must not contain .dark theme token block"
    );
    assert.ok(
      cssContent.includes("@custom-variant dark (&:not(*));"),
      "globals.css must neutralize dark variant with (&:not(*))"
    );
  });
```

- [ ] **Step 2: Chạy test để xác nhận test đang fail**

Run: `npx tsx --test tests/typography-tokens-contract.test.ts`
Expected: FAIL vì `globals.css` hiện vẫn còn `.dark` block và `@custom-variant dark (&:is(.dark *));`.

- [ ] **Step 3: Cập nhật `src/app/globals.css`**

1. Đổi dòng 4:
   ```css
   @custom-variant dark (&:not(*));
   ```
2. Xóa hoàn toàn block `.dark { ... }` (dòng 96-135).
3. Xóa selector `.dark body::before` (dòng 183-187).
4. Xóa các selector `.dark .glass-panel` và `.dark .glass-card` (dòng 317-336).

- [ ] **Step 4: Chạy lại test để xác nhận test đã pass**

Run: `npx tsx --test tests/typography-tokens-contract.test.ts`
Expected: PASS

- [ ] **Step 5: Commit thay đổi Task 1**

```bash
git add src/app/globals.css tests/typography-tokens-contract.test.ts
git commit -m "style(tokens): neutralize dark variant and remove dark css token blocks"
```

---

### Task 2: Root Layout & Viewport Configuration

**Files:**
- Modify: `src/app/layout.tsx:4, 45-55, 90-100`
- Modify: `tests/mobile-viewport-e2e.test.ts:68-75`

**Interfaces:**
- Produces: `src/app/layout.tsx` không còn bọc `<ThemeProvider>` và xuất `viewport` định cấu hình `colorScheme: "light"`, `themeColor: "#fbfbfb"`.

- [ ] **Step 1: Cập nhật test trong `tests/mobile-viewport-e2e.test.ts`**

Sửa đổi test case kiểm tra viewport themeColor tại dòng 68-75:

```ts
  test("Viewport themeColor is configured for pure light mode", () => {
    assert.equal(viewport.colorScheme, "light", "colorScheme must be light");
    assert.equal(viewport.themeColor, "#fbfbfb", "themeColor must be #fbfbfb");
  });
```

- [ ] **Step 2: Chạy test để xác nhận test đang fail**

Run: `npx tsx --test tests/mobile-viewport-e2e.test.ts`
Expected: FAIL vì viewport hiện tại là mảng media query và `colorScheme` là `"light dark"`.

- [ ] **Step 3: Cập nhật `src/app/layout.tsx`**

1. Xóa import: `import { ThemeProvider } from "@/components/theme-provider";`
2. Cập nhật `viewport`:
   ```ts
   export const viewport: Viewport = {
     colorScheme: "light",
     themeColor: "#fbfbfb",
     width: "device-width",
     initialScale: 1,
     maximumScale: 1,
     viewportFit: "cover",
   };
   ```
3. Xóa thẻ mở `<ThemeProvider>` và thẻ đóng `</ThemeProvider>` quanh `<AppShell>`.

- [ ] **Step 4: Chạy lại test để xác nhận test đã pass**

Run: `npx tsx --test tests/mobile-viewport-e2e.test.ts`
Expected: PASS

- [ ] **Step 5: Commit thay đổi Task 2**

```bash
git add src/app/layout.tsx tests/mobile-viewport-e2e.test.ts
git commit -m "refactor(layout): lock viewport to light mode and remove ThemeProvider wrapper"
```

---

### Task 3: Retire Theme Provider & Theme Switch Controls

**Files:**
- Delete: `src/components/theme-provider.tsx`
- Modify: `src/components/layout/app-topbar.tsx`
- Modify: `src/components/navigation.tsx`
- Modify: `src/components/layout/mobile-menu-drawer.tsx`
- Modify: `src/app/portal/page.tsx`
- Modify: `tests/app-layout.test.ts:171-177`

**Interfaces:**
- Consumes: Giao diện Light thuần túy, không còn phụ thuộc vào `useTheme`.
- Produces: Header, Topbar, Mobile Drawer và Navigation sạch sẽ, loại bỏ icon Mặt trời/Mặt trăng.

- [ ] **Step 1: Cập nhật test trong `tests/app-layout.test.ts`**

Cập nhật test assertion tại dòng 171-177:

```ts
  it("integrates right utilities: notification bell, mobile install, and user profile", () => {
    const content = fs.readFileSync(topbarPath, "utf-8");
    assert.ok(content.includes("Bell"), "Must render Bell icon");
    assert.ok(content.includes("/notifications"), "Must link to /notifications");
    assert.ok(!content.includes("toggleTheme"), "Theme toggle button must be retired");
    assert.ok(content.includes("UserProfileModal"), "Must render UserProfileModal");
  });
```

- [ ] **Step 2: Chạy test để xác nhận test fail**

Run: `npx tsx --test tests/app-layout.test.ts`
Expected: FAIL vì `app-topbar.tsx` vẫn còn `toggleTheme`.

- [ ] **Step 3: Xóa `src/components/theme-provider.tsx`**

Xóa file `src/components/theme-provider.tsx`.

- [ ] **Step 4: Gỡ bỏ Theme Switcher trong các file**

1. `src/components/layout/app-topbar.tsx`:
   - Xóa `import { useTheme } from "@/components/theme-provider";`
   - Xóa `Sun, Moon` khỏi `lucide-react` import.
   - Xóa `const { resolved, toggleTheme } = useTheme();`
   - Xóa block Button Theme Switcher (dòng 299-315).
2. `src/components/navigation.tsx`:
   - Xóa `import { useTheme } from "@/components/theme-provider";`
   - Xóa `Sun, Moon` khỏi `lucide-react` import.
   - Xóa `const { resolved, toggleTheme } = useTheme();`
   - Xóa nút đổi theme tại dòng 349-361.
3. `src/components/layout/mobile-menu-drawer.tsx`:
   - Xóa `Sun, Moon` khỏi `lucide-react` import.
   - Xóa state `isDark`, `setIsDark`, hàm `toggleTheme` và các lệnh `localStorage.setItem("theme", ...)`.
   - Xóa nút đổi theme tại dòng 345-360.
4. `src/app/portal/page.tsx`:
   - Xóa `import { useTheme } from "@/components/theme-provider";`
   - Xóa `Sun, Moon` khỏi `lucide-react` import.
   - Xóa `const { resolved, toggleTheme } = useTheme();`
   - Xóa nút bấm đổi theme tại dòng 143-154.

- [ ] **Step 5: Chạy lại test `tests/app-layout.test.ts`**

Run: `npx tsx --test tests/app-layout.test.ts`
Expected: PASS

- [ ] **Step 6: Commit thay đổi Task 3**

```bash
git add src/components/layout/app-topbar.tsx src/components/navigation.tsx src/components/layout/mobile-menu-drawer.tsx src/app/portal/page.tsx tests/app-layout.test.ts
git rm src/components/theme-provider.tsx
git commit -m "feat(theme): retire ThemeProvider and remove theme switch toggles"
```

---

### Task 4: Design Tokens & System Status Colors

**Files:**
- Modify: `src/lib/tokens.ts`
- Modify: `src/components/ui/badge.tsx`
- Modify: `src/components/ui/drawer.tsx`
- Modify: `tests/smoke-qcet-design-system.test.ts`

**Interfaces:**
- Produces: `QCET_TOKENS` và badge/drawer sạch sẽ, không còn `dark:text-...` hay `dark:bg-...`.

- [ ] **Step 1: Cập nhật test trong `tests/smoke-qcet-design-system.test.ts`**

1. Cập nhật `QCET Design System Tokens`:
   - Kiểm tra `QCET_TOKENS.colors.light`
   - Bỏ kiểm tra `QCET_TOKENS.colors.dark` (hoặc kiểm tra dark được alias về light).
2. Cập nhật status colors test:
   - Sửa các chuỗi classes trong test để không còn `dark:text-...`. Ví dụ:
     - `bg-blue-500/10 text-blue-600 border-blue-500/20`
     - `bg-emerald-500/10 text-emerald-600 border-emerald-500/20`
     - `bg-rose-500/10 text-rose-600 border-rose-500/20`
     - `bg-amber-500/10 text-amber-600 border-amber-500/20`
     - `bg-violet-500/10 text-violet-600 border-violet-500/20`
3. Cập nhật kiểm tra CSS variable trong `globals.css`:
   - Xác nhận `globals.css` không còn chứa CSS variable dark mode (`--background: oklch(0.12 0.018 250);`).

- [ ] **Step 2: Chạy test để xác nhận test fail**

Run: `npx tsx --test tests/smoke-qcet-design-system.test.ts`
Expected: FAIL

- [ ] **Step 3: Cập nhật `src/lib/tokens.ts`, `badge.tsx`, `drawer.tsx`**

1. `src/lib/tokens.ts`:
   - Trong `QCET_TOKENS.statusColors`: Xóa bỏ các class `dark:text-...`.
   - Trong `QCET_TOKENS.colors.dark`: Cho trỏ về các giá trị tương đương `light` hoặc loại bỏ.
   - Trong `DESIGN_TOKENS.dark`: Trỏ về `DESIGN_TOKENS.light`.
2. `src/components/ui/badge.tsx`:
   - Xóa các class `dark:...` khỏi các variant `sapphire`, `emerald`, `amber`, `rose`, `violet`, `success`, `progress`, `warning`.
3. `src/components/ui/drawer.tsx`:
   - Xóa các class `dark:...` khỏi file.

- [ ] **Step 4: Chạy lại test `tests/smoke-qcet-design-system.test.ts`**

Run: `npx tsx --test tests/smoke-qcet-design-system.test.ts`
Expected: PASS

- [ ] **Step 5: Commit thay đổi Task 4**

```bash
git add src/lib/tokens.ts src/components/ui/badge.tsx src/components/ui/drawer.tsx tests/smoke-qcet-design-system.test.ts
git commit -m "refactor(tokens): clean dark classes from status tokens and ui components"
```

---

### Task 5: Sweep All `dark:*` Utilities from UI Components (Batch 1 - Portal & Workspaces)

**Files:**
- Modify: `src/components/portal/executive-cockpit-workspace.tsx`
- Modify: `src/components/portal/department-manager-workspace.tsx`
- Modify: `src/components/portal/lecturer-focus-workspace.tsx`
- Modify: `src/components/portal/bento-portal-hub.tsx`
- Modify: `src/components/portal/executive-briefing-modal.tsx`
- Modify: `src/components/portal/executive-unit-radar.tsx`
- Modify: `src/components/portal/executive-resolution-drawer.tsx`
- Modify: `src/components/portal/executive-bottleneck-card.tsx`
- Modify: `src/components/portal/review-action-dialog.tsx`
- Modify: `src/components/portal/submit-deliverable-modal.tsx`

- [ ] **Step 1: Dọn sạch class `dark:*` trong các component Portal**

Sử dụng regex/công cụ để loại bỏ tất cả các token `dark:[^\s"'\`]+` trong 10 files trên, đồng thời dọn sạch khoảng trắng thừa.

- [ ] **Step 2: Kiểm tra không còn `dark:` trong `src/components/portal/`**

Run: `grep -rn "dark:" src/components/portal/`
Expected: Không có output (0 kết quả).

- [ ] **Step 3: Chạy typecheck và tests liên quan đến Portal**

Run: `npm run typecheck && npx tsx --test tests/role-based-workspace-workflow.test.ts tests/executive-cockpit-ui-ux.test.ts`
Expected: PASS

- [ ] **Step 4: Commit thay đổi Task 5**

```bash
git add src/components/portal/
git commit -m "style(portal): remove all dark utility classes from portal workspaces"
```

---

### Task 6: Sweep All `dark:*` Utilities from UI Components (Batch 2 - Tasks & Dashboard Views)

**Files:**
- Modify: `src/components/dashboard/task-detail-side-sheet.tsx`
- Modify: `src/components/tasks/executive-department-command-center.tsx`
- Modify: `src/components/dashboard/roles/staff-focus-view.tsx`
- Modify: `src/components/dashboard/cascading-task-table.tsx`
- Modify: `src/components/tasks/cascading-task-table.tsx`
- Modify: `src/components/tasks/task-kanban-board.tsx`
- Modify: `src/components/dashboard/department-grouped-task-view.tsx`
- Modify: `src/components/dashboard/create-task-modal.tsx`
- Modify: `src/components/dashboard/upcoming-deadlines-widget.tsx`
- Modify: `src/components/dashboard/executive-action-center.tsx`
- Modify: `src/components/dashboard/executive-stat-strip.tsx`
- Modify: `src/components/dashboard/zones/tasks-expanded-views.tsx`
- Modify: `src/components/dashboard/delegation-management-modal.tsx`
- Modify: `src/components/dashboard/activity-feed-widget.tsx`
- Modify: `src/components/dashboard/department-progress-matrix.tsx`
- Modify: `src/components/dashboard/zones/org-zone.tsx`
- Modify: `src/components/dashboard/zones/calendar-zone.tsx`
- Modify: `tests/task-ownership-model.test.ts:544`

- [ ] **Step 1: Cập nhật assertion trong `tests/task-ownership-model.test.ts:544`**

Cập nhật chuỗi test loại bỏ `dark:border-primary/30`:

```ts
assert.ok(
  html.includes("border-l-2 border-primary/20 pl-3 sm:pl-4 ml-1 sm:ml-2 space-y-2.5"),
  "Timeline connector must use clean light primary border"
);
```

- [ ] **Step 2: Dọn sạch class `dark:*` trong các file Dashboard và Tasks**

Loại bỏ tất cả các token `dark:[^\s"'\`]+` trong danh sách files trên, giữ cấu trúc class gọn g��ng.

- [ ] **Step 3: Kiểm tra không còn `dark:` trong `src/components/dashboard/` và `src/components/tasks/`**

Run: `grep -rn "dark:" src/components/dashboard/ src/components/tasks/`
Expected: Không có output (0 kết quả).

- [ ] **Step 4: Chạy typecheck và tests liên quan đến Task**

Run: `npm run typecheck && npx tsx --test tests/task-ownership-model.test.ts`
Expected: PASS

- [ ] **Step 5: Commit thay đổi Task 6**

```bash
git add src/components/dashboard/ src/components/tasks/ tests/task-ownership-model.test.ts
git commit -m "style(tasks): clean all dark utility classes from task and dashboard views"
```

---

### Task 7: Sweep All `dark:*` Utilities from UI Components (Batch 3 - Documents, Notifications, Auth & Remaining)

**Files:**
- Modify: `src/components/documents/document-quick-entry-modal.tsx`
- Modify: `src/components/documents/directive-action-panel.tsx`
- Modify: `src/components/documents/document-detail-dialog.tsx`
- Modify: `src/components/documents/document-split-view.tsx`
- Modify: `src/components/documents/document-registry-view.tsx`
- Modify: `src/components/documents/create-document-modal.tsx`
- Modify: `src/components/documents/document-pdf-viewer.tsx`
- Modify: `src/components/notifications/notification-popover.tsx`
- Modify: `src/app/notifications/page.tsx`
- Modify: `src/components/layout/app-sidebar.tsx`
- Modify: `src/components/calendar/calendar-month-view.tsx`
- Modify: `src/app/login/page.tsx`
- Modify: `src/components/org/organization-tree.tsx`
- Modify: `src/components/pwa/mobile-app-install-modal.tsx`
- Modify: `src/components/pwa/push-onboarding-sheet.tsx`
- Modify: `src/components/auth/user-profile-modal.tsx`
- Modify: `src/components/auth/role-viewpoint-banner.tsx`
- Modify: `src/components/auth/google-login-button.tsx`
- Modify: `src/components/common/maintenance-view.tsx`
- Modify: `src/components/common/maintenance-dialog.tsx`
- Modify: `src/components/onboarding/onboarding-checklist-widget.tsx`
- Modify: `src/app/org/page.tsx`
- Modify: `src/app/unit-tasks/page.tsx`
- Modify: `src/app/tasks/page.tsx`
- Modify: `src/app/documents/page.tsx`

- [ ] **Step 1: Dọn sạch class `dark:*` trong các file còn lại**

Loại bỏ tất cả các token `dark:[^\s"'\`]+` trong danh sách files trên.

- [ ] **Step 2: Kiểm tra toàn diện thư mục `src/` không còn bất kỳ `dark:` nào**

Run: `grep -rn "dark:" src/`
Expected: Không có output (0 kết quả).

- [ ] **Step 3: Chạy typecheck và test suite**

Run: `npm run typecheck && npm test`
Expected: PASS

- [ ] **Step 4: Commit thay đổi Task 7**

```bash
git add src/
git commit -m "style(ui): clean remaining dark utility classes across all modules"
```

---

### Task 8: Full Verification, Audit & Zero-Leak Confirmation

**Files:**
- Verify: toàn bộ `src/` và `tests/`

- [ ] **Step 1: Kiểm tra zero-leak `dark:` trong `src/`**

Run: `grep -rn "dark:" src/`
Expected: 0 kết quả.

- [ ] **Step 2: Kiểm tra zero-leak `ThemeProvider` trong `src/`**

Run: `grep -rn "ThemeProvider" src/`
Expected: 0 kết quả.

- [ ] **Step 3: Kiểm tra zero-leak `useTheme` trong `src/`**

Run: `grep -rn "useTheme" src/`
Expected: 0 kết quả.

- [ ] **Step 4: Chạy `npm run typecheck`**

Run: `npm run typecheck`
Expected: Exit code 0, không có lỗi TypeScript nào.

- [ ] **Step 5: Chạy toàn bộ test suite**

Run: `npm test`
Expected: Toàn bộ 211 suites / 1069+ tests đều pass (100% green).

- [ ] **Step 6: Commit tổng kết hoàn tất**

```bash
git commit --allow-empty -m "chore: complete full verification of light-only standardization"
```
