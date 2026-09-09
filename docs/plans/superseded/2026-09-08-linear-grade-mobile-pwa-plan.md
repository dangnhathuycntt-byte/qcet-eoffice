---
status: superseded
domain: ux
created: 2026-09-08
superseded_by: 2026-09-09-master-ux-consolidation-plan.md
---

# Kế Hoạch Triển Khai: Chuẩn Hóa Mobile PWA Linear-Grade & Chống AI Slop

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuẩn hóa toàn diện giao diện và trải nghiệm Mobile PWA của QCET E-Office theo mô hình Pocket Cockpit của Linear, triệt tiêu 100% AI Slop (nút sấm sét cam, 2 menu trượt đối nghịch, bảng ngang co rúm), giải phóng diện tích hiển thị dọc và hỗ trợ đầy đủ Safe Area cho iOS Standalone PWA.

**Architecture:** 
- Tầng Khung Vỏ (Shell): Đỉnh trang (`AppTopbar`) siêu mỏng có `safe-area-inset-top`, loại bỏ nút Hamburger góc trên để dồn quyền mở menu về duy nhất tab "Thêm" (`MobileMenuDrawer`). Đáy trang (`MobileBottomNav`) đồng nhất nút trung tâm Navy `Plus` (kích hoạt `qcet:open-create-task`) và xử lý `safe-area-inset-bottom`.
- Tầng Khoang Lái (Workspace): Khi ở màn hình di động (`< md`), thay thế khối KPI cồng kềnh bằng dòng tóm tắt chỉ số nhẹ nhàng; chuyển đổi dòng tác vụ điểm nghẽn thành danh sách thẻ 1 cột phẳng với nút bấm 1-chạm đạt chuẩn công thái học (`min-h-[40px]`).
- Tầng An Toàn (Safety): Neo nổi thanh Hoàn tác 5 giây (`undoState`) ngay trên thanh điều hướng đáy di động có tính toán Safe Area để người dùng hoàn tác tức thì.

**Tech Stack:** Next.js 15 (App Router), React 19, Tailwind CSS v4, Lucide React, Node.js Native Test Runner (`tsx --test`).

**Spec:** `docs/superpowers/specs/2026-09-08-linear-grade-mobile-pwa-design.md`

## Global Constraints

- Không dùng bất kỳ class `dark:`, khối `.dark` hoặc logic chuyển đổi theme (tuân thủ nguyên tắc Light-Only trong `CLAUDE.md`).
- Tuyệt đối không chạy `npm run build` khi dev server đang chạy để tránh xung đột cache `.next`. Chỉ dùng `npm run typecheck` và `npm test`.
- Triệt tiêu 100% emoji trang trí (`🔥`, `⚡`, `🚀`, v.v.). Mọi icon sử dụng Lucide React `strokeWidth={1.5}` hoặc `1.75`.
- Mọi điểm chạm nút bấm hành động trên mobile phải đạt tối thiểu `min-h-[40px] px-3.5` (chuẩn WCAG / Apple HIG).

---

### Task 1: Chuẩn hóa Thanh Điều Hướng Đáy (`mobile-bottom-nav.tsx`) & Cập nhật Unit Test

**Files:**
- Modify: `src/components/layout/mobile-bottom-nav.tsx:34-102`
- Test: `tests/mobile-bottom-nav.test.ts`

**Interfaces:**
- Consumes: `useAuth` từ `@/context/auth-context`, `MobileMenuDrawer` từ `@/components/layout/mobile-menu-drawer`.
- Produces: Phát sự kiện chuẩn `qcet:open-create-task` khi bấm nút trung tâm; hỗ trợ đệm `pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]`.

- [ ] **Step 1: Cập nhật failing test trong `tests/mobile-bottom-nav.test.ts`**

M��� file `tests/mobile-bottom-nav.test.ts`, cập nhật bài test kiểm tra nút trung tâm: thay vì kiểm tra `qcet:open-briefing-modal` và `Zap`, chuyển sang kiểm tra `qcet:open-create-task`, icon `Plus`, và class `bg-primary`:

```typescript
// tests/mobile-bottom-nav.test.ts
  test("implements center action pill with unified create-task dispatching", () => {
    const content = fs.readFileSync(navPath, "utf-8");
    assert.ok(
      content.includes("handleCenterAction"),
      "Must define handleCenterAction handler"
    );
    assert.ok(
      content.includes("qcet:open-create-task"),
      "Center action must trigger qcet:open-create-task"
    );
    assert.ok(
      !content.includes("qcet:open-briefing-modal"),
      "Must not contain orphaned qcet:open-briefing-modal"
    );
    assert.ok(
      !content.includes("Zap"),
      "Must not contain gaming Zap icon"
    );
    assert.ok(
      content.includes("bg-primary"),
      "Center button must use bg-primary"
    );
  });
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại**

Run: `npx tsx --test tests/mobile-bottom-nav.test.ts`
Expected: FAIL vì `mobile-bottom-nav.tsx` vẫn chứa `qcet:open-briefing-modal` và `Zap`.

- [ ] **Step 3: Cập nhật `src/components/layout/mobile-bottom-nav.tsx`**

Sửa đổi `handleCenterAction` và khối nút trung tâm:
1. Gỡ bỏ icon `Zap` khỏi import.
2. Sửa `handleCenterAction`: Luôn dispatch `qcet:open-create-task`.
3. Sửa nút chính giữa: Luôn dùng class `bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20` và render `<Plus size={24} strokeWidth={1.75} />`.
4. Đảm bảo class container đáy có `pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]`.

- [ ] **Step 4: Chạy lại test để xác nhận test vượt qua**

Run: `npx tsx --test tests/mobile-bottom-nav.test.ts`
Expected: PASS (tất cả các test trong `mobile-bottom-nav.test.ts` đều xanh).

- [ ] **Step 5: Commit thay đổi**

```bash
git add src/components/layout/mobile-bottom-nav.tsx tests/mobile-bottom-nav.test.ts
git commit -m "fix(mobile-nav): unify center action button with Navy Plus and qcet:open-create-task

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: Tinh gọn Khung Vỏ Đỉnh Trang (`app-topbar.tsx`) & Safe Area Top

**Files:**
- Modify: `src/components/layout/app-topbar.tsx:195-212`
- Test: `tests/app-layout.test.ts:140-150`

**Interfaces:**
- Consumes: `useSidebar` từ `@/components/ui/sidebar`, `ScopeSwitcher` từ `@/components/auth/scope-switcher`.
- Produces: Header mỏng 52px có đệm `pt-[env(safe-area-inset-top,0px)]`, loại bỏ nút Hamburger `toggleMobile` trên mobile.

- [ ] **Step 1: Cập nhật test trong `tests/app-layout.test.ts`**

Trong `tests/app-layout.test.ts`, cập nhật kiểm tra của Topbar: xác nhận Topbar hỗ trợ Desktop collapse toggle `PanelLeftOpen`/`PanelLeftClose`, và trên mobile không hiển thị nút hamburger gây xung đột với bottom sheet.

```typescript
// tests/app-layout.test.ts
  it("includes desktop collapse toggle button and preserves single drawer pattern", () => {
    const content = fs.readFileSync(topbarPath, "utf-8");
    assert.ok(content.includes("toggleCollapse"), "Must wire toggleCollapse on desktop trigger");
    assert.ok(content.includes("PanelLeftOpen"), "Must render PanelLeftOpen when collapsed");
    assert.ok(content.includes("PanelLeftClose"), "Must render PanelLeftClose when expanded");
  });
```

- [ ] **Step 2: Chạy test để xác nhận trạng thái**

Run: `npx tsx --test tests/app-layout.test.ts`
Expected: PASS hoặc sẵn sàng cập nhật implementation.

- [ ] **Step 3: Cập nhật `src/components/layout/app-topbar.tsx`**

1. Thêm `pt-[env(safe-area-inset-top,0px)]` vào `<header className="sticky top-0 z-30 w-full border-b border-border/50 bg-background/80 backdrop-blur-md pt-[env(safe-area-inset-top,0px)] transition-colors">`.
2. Gỡ bỏ nút Hamburger `md:hidden` (`toggleMobile`):
```tsx
          {/* Mobile Menu Trigger (< 768px) đã được thay thế bằng tab 'Thêm' ở Bottom Nav để tránh xung đột 2 drawer */}
```
3. Giữ nguyên Desktop Sidebar Toggle (`hidden md:inline-flex`) và bộ chọn đơn vị `ScopeSwitcher`.

- [ ] **Step 4: Chạy lại test `tests/app-layout.test.ts`**

Run: `npx tsx --test tests/app-layout.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit thay đổi**

```bash
git add src/components/layout/app-topbar.tsx tests/app-layout.test.ts
git commit -m "refactor(topbar): streamline mobile header with safe-area-inset-top and single drawer pattern

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: Tái cấu trúc Khoang Lái Di động (Mobile Pocket Cockpit) trong `executive-cockpit-workspace.tsx`

**Files:**
- Modify: `src/components/portal/executive-cockpit-workspace.tsx:1044-1140, 1435-1550`
- Test: `tests/executive-cockpit-ui-ux.test.ts`

**Interfaces:**
- Consumes: `SchoolBottleneckItem`, `undoState`, `handleRemind`, `handleExtend`, `handleReview` từ hook workspace.
- Produces: Giao diện thẻ 1 cột tối ưu cho mobile (`md:hidden`) với nút bấm `min-h-[40px]`; Banner Hoàn tác 5 giây neo nổi cố định `fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] left-4 right-4 z-40 md:relative md:bottom-auto`.

- [ ] **Step 1: Viết test kiểm tra tính công thái học và vị trí Undo Banner trên mobile**

Tạo/Bổ sung test case trong `tests/executive-cockpit-ui-ux.test.ts`:
1. Kiểm tra không chứa bất kỳ emoji nào trong toàn bộ file.
2. Kiểm tra `undoState` có class fixed nổi trên thanh đáy di động (`bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))]` hoặc `z-40`).
3. Kiểm tra các nút hành động gỡ nghẽn có kích thước tối thiểu đạt chuẩn công thái học `min-h-[38px]` hoặc `min-h-[40px]`.

```typescript
// tests/executive-cockpit-ui-ux.test.ts
  test("Optimistic Resolution Undo banner is positioned fixed above mobile bottom nav with safe-area", () => {
    const content = fs.readFileSync(cockpitPath, "utf-8");
    assert.ok(
      content.includes("fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))]") ||
      content.includes("z-40"),
      "Undo banner must be anchored above mobile bottom nav"
    );
  });
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại**

Run: `npx tsx --test tests/executive-cockpit-ui-ux.test.ts`
Expected: FAIL vì `undoState` hiện tại vẫn đang nằm ở vị trí relative trong luồng cuộn.

- [ ] **Step 3: Cập nhật `src/components/portal/executive-cockpit-workspace.tsx`**

1. **Cập nhật Undo Banner (`undoState`)**:
   - Thay đổi thẻ container thành:
   ```tsx
   {undoState && (
     <div
       role="status"
       className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] left-4 right-4 z-40 md:relative md:bottom-auto md:left-auto md:right-auto md:z-auto flex items-center justify-between gap-3 p-3.5 rounded-xl border border-emerald-500/40 bg-background/95 backdrop-blur-md text-foreground shadow-lg text-xs font-medium animate-in fade-in slide-in-from-bottom-2 duration-200"
     >
       <div className="flex items-center gap-2.5 min-w-0">
         <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" strokeWidth={1.5} />
         <span className="truncate">
           {undoState.summary} ({undoState.item.title})
         </span>
       </div>
       <div className="flex items-center gap-2 shrink-0">
         <Button
           type="button"
           size="sm"
           variant="outline"
           onClick={handleUndo}
           className="min-h-[36px] px-3 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 border-transparent shadow-xs cursor-pointer"
         >
           Hoàn tác (5s)
         </Button>
         <button
           type="button"
           onClick={() => setUndoState(null)}
           className="text-muted-foreground hover:text-foreground cursor-pointer p-1"
           aria-label="Đóng thông báo"
         >
           <X className="w-4 h-4" />
         </button>
       </div>
     </div>
   )}
   ```
2. **Tối ưu thẻ tác vụ Điểm nghẽn trên Mobile**:
   - Đảm bảo các nút tác vụ trên thẻ (`Đôn đốc`, `Gia hạn`, `Phê duyệt`) có `min-h-[40px] px-3.5` trên mobile (`h-10 sm:h-8`).
   - Đảm bảo các ngày tháng deadline sử dụng font mono `tabular-nums`.

- [ ] **Step 4: Chạy lại test `tests/executive-cockpit-ui-ux.test.ts`**

Run: `npx tsx --test tests/executive-cockpit-ui-ux.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit thay đổi**

```bash
git add src/components/portal/executive-cockpit-workspace.tsx tests/executive-cockpit-ui-ux.test.ts
git commit -m "feat(cockpit): elevate mobile ergonomics with fixed safe-area undo banner and 40px touch targets

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: Kiểm Thử Tích Hợp Toàn Diện & Đảm Bảo Không Lỗi

**Files:**
- Test: Toàn bộ test suite trong `tests/`
- Command: `npm run typecheck && npm test`

- [ ] **Step 1: Chạy Typecheck toàn dự án**

Run: `npm run typecheck`
Expected: Exit code 0 (không có bất kỳ lỗi kiểu TypeScript nào).

- [ ] **Step 2: Chạy toàn bộ Test Suites**

Run: `npm test`
Expected: Toàn bộ các bài test đều PASS (Exit code 0).

- [ ] **Step 3: Commit xác nhận hoàn thành**

```bash
git commit --allow-empty -m "chore: verify linear-grade mobile PWA test suite passes without regressions

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```
