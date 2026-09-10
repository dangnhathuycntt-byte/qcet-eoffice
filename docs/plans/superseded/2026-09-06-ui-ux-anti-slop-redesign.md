---
status: superseded
domain: ux
created: 2026-09-06
superseded_by: 2026-09-09-master-ux-consolidation-plan.md
---

# Kế hoạch Triển khai: Nâng cấp Toàn diện UI/UX QCET E-Office (Executive Precision & Anti-AI-Slop)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển đổi toàn diện giao diện và tương tác của QCET E-Office sang phong cách Linear-grade Executive Workstation, triệt tiêu 100% emoji trang trí và các pattern AI-slop, chuẩn hóa Lucide icons nét mảnh 1.5px và typography chuẩn xác tabular-nums.

**Architecture:** Nâng cấp từ tầng gốc (Design Tokens trong `globals.css`) đến các component giao diện chung (Header, Navigation, Micro-badges) và lần lượt chuẩn hóa từng màn hình chức năng (Hộp việc & Bảng công việc phân tầng, Kanban, Lịch công tác, Cây tổ chức). Mỗi tác vụ có kiểm thử TDD/smoke test và đảm bảo không phá vỡ logic nghiệp vụ.

**Tech Stack:** Next.js 15.2 (App Router), React 19, Tailwind CSS v4, Lucide React (`strokeWidth={1.5}`), TypeScript, Node.js Test Runner (`tsx --test`).

**Spec:** `docs/superpowers/specs/2026-09-06-ui-ux-anti-slop-redesign-design.md`

## Global Constraints

- Không sử dụng bất kỳ emoji trang trí nào (`🚀`, `📌`, `⚡`, `🎯`, `🔥`, v.v.) trong mã nguồn và giao diện người dùng.
- Chuẩn hóa toàn bộ icon Lucide với kích thước 14px–16px, `strokeWidth={1.5}` (hoặc `1.25` cho icon phụ), tone màu đơn sắc trung tính (`text-muted-foreground` hoặc `text-foreground/70`).
- Bắt buộc dùng `font-mono tabular-nums` cho toàn bộ mã định danh (`QC-NV-2026-01`), số liệu deadline (`15/09/2026`), tỷ lệ phần trăm (`85%`) và bộ đếm số lượng công việc.
- Không sử dụng gradient tím/xanh AI hoặc bóng đen mờ đục; sử dụng hệ đổ bóng khuếch tán đa tầng tinh tế.
- Tất cả các thao tác hành động nhanh (1-click action) phải có phản hồi xúc giác nhẹ (`active:scale-[0.98]`).
- Đảm bảo 100% test case hiện có (`npm run test`) tiếp tục pass và `npm run typecheck` không có lỗi.

---

### Task 1: Design Tokens & CSS Elevation Refactor (`globals.css`)

**Files:**
- Modify: `src/app/globals.css`
- Test: `tests/smoke-qcet-design-system.test.ts`

**Interfaces:**
- Consumes: Tailwind v4 theme engine, OKLCH color variables
- Produces: Chuẩn hóa `--shadow-subtle`, `--shadow-card`, `--shadow-dropdown`, biến màu nền light/dark sang trọng không chói, và các class tiện ích typography `tabular-nums`

- [ ] **Step 1: Viết test kiểm tra các token đổ bóng khuếch tán và màu trung tính mới**

Cập nhật `tests/smoke-qcet-design-system.test.ts` bổ sung test case xác thực sự hiện diện của hệ đổ bóng đa tầng không vi phạm quy tắc AI-slop:
```typescript
test("globals.css defines diffuse executive elevation tokens", () => {
  const css = fs.readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf-8");
  assert.ok(css.includes("--shadow-card"), "Must define --shadow-card");
  assert.ok(!css.includes("linear-gradient(135deg, #a855f7"), "Must not contain purple AI slop gradients");
});
```

- [ ] **Step 2: Chạy test để xác nhận**

Run: `npm run test -- tests/smoke-qcet-design-system.test.ts`

- [ ] **Step 3: Triển khai cập nhật `src/app/globals.css`**

Loại bỏ các gradient tím/xanh ngọc, tinh chỉnh lại các biến đổ bóng thành hệ thống phân tán đa tầng, điều chỉnh viền hairline:
```css
/* Executive diffuse elevation tokens */
--shadow-subtle: 0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 3px 1px rgba(0, 0, 0, 0.02);
--shadow-card: 0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 4px 12px 0 rgba(0, 0, 0, 0.03);
--shadow-dropdown: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 10px 24px -3px rgba(0, 0, 0, 0.06);
```

- [ ] **Step 4: Chạy lại test đảm bảo pass**

Run: `npm run test -- tests/smoke-qcet-design-system.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css tests/smoke-qcet-design-system.test.ts
git commit -m "refactor(theme): modernize design tokens with executive diffuse elevation and clean oklch surfaces"
```

---

### Task 2: Anti-Slop Navigation & Header Overhaul

**Files:**
- Modify: `src/components/navigation.tsx`
- Modify: `src/components/auth/role-switcher-pill.tsx`
- Test: `tests/dashboard-assembly.test.ts` / `tests/smoke-qcet-design-system.test.ts`

**Interfaces:**
- Consumes: `NAVIGATION_ITEMS`, `LiveClock`, `RoleSwitcherPill`, `useAuth`
- Produces: Header `h-14` thanh mảnh với backdrop blur, LiveClock font mono tinh tế, nút giao việc Linear-style, không có emoji

- [ ] **Step 1: Viết test kiểm tra thanh điều hướng không chứa emoji và sử dụng chuẩn Lucide**

Thêm test vào `tests/smoke-qcet-design-system.test.ts`:
```typescript
test("navigation items have no decorative emojis", () => {
  NAVIGATION_ITEMS.forEach(item => {
    assert.match(item.label, /^[\p{L}\p{N}\s\-\/]+$/u, `Item label ${item.label} must not contain emojis`);
  });
});
```

- [ ] **Step 2: Chạy test để xác minh**

Run: `npm run test -- tests/smoke-qcet-design-system.test.ts`

- [ ] **Step 3: Triển khai tinh chỉnh `src/components/navigation.tsx` & `src/components/auth/role-switcher-pill.tsx`**

- Chỉnh chiều cao header chuẩn `h-14`, border `border-border/50`, `backdrop-blur-md`.
- Logo & Text: `QCET E-Office` font-semibold `tracking-tight`, kèm micro-tag `v1.2 Enterprise`.
- Cập nhật `LiveClock`: icon `Clock` (`size={13}`, `strokeWidth={1.5}`), text mono tabular-nums tối giản, bỏ khung thô.
- Nút "Giao việc mới": Nút Primary tinh gọn, icon `Plus` (`size={14}`, `strokeWidth={1.5}`), phím tắt `⌘K` micro-badge.
- Role switcher: Bỏ emoji, hiển thị nhãn vai trò chính thức (`Ban Giám hiệu`, `Trưởng đơn vị`, `Chuyên viên`) dạng subtle pill.

- [ ] **Step 4: Chạy test kiểm tra pass 100%**

Run: `npm run test`

- [ ] **Step 5: Commit**

```bash
git add src/components/navigation.tsx src/components/auth/role-switcher-pill.tsx tests/smoke-qcet-design-system.test.ts
git commit -m "feat(nav): overhaul header with sleek h-14 executive layout and zero emoji"
```

---

### Task 3: Homepage Executive Workboxes & Stat Strip Redesign

**Files:**
- Modify: `src/components/dashboard/executive-stat-strip.tsx`
- Modify: `src/app/page.tsx`
- Test: `tests/executive-stat-strip.test.ts`

**Interfaces:**
- Consumes: `computeDashboardStats`, `DashboardStats`, `ExecutiveStatStrip`
- Produces: Thẻ tóm lược chỉ số điều hành chuẩn mực, bộ đếm số liệu font mono, không màu mè AI-slop

- [ ] **Step 1: Viết/cập nhật test cho ExecutiveStatStrip**

Kiểm tra `tests/executive-stat-strip.test.ts` đảm bảo dữ liệu hiển thị không chứa emoji trong tiêu đề và subtext.

- [ ] **Step 2: Chạy test xác nhận**

Run: `npm run test -- tests/executive-stat-strip.test.ts`

- [ ] **Step 3: Tái cấu trúc `ExecutiveStatStrip`**

- Sử dụng dải thống kê phân chia bằng viền hairline `divide-x divide-border/40`.
- Icon Lucide: `CheckCircle2`, `Clock`, `AlertTriangle`, `Layers` với `strokeWidth={1.5}`, `size={16}` màu xám thanh lịch.
- Chỉ số hiển thị: Số lớn font mono `tabular-nums tracking-tight`, kèm micro-trend hoặc tỷ lệ % nhỏ gọn phía dưới.
- Bỏ hoàn toàn các mảng màu nền lòe loẹt; dùng subtle dot indicator.

- [ ] **Step 4: Chạy test xác nhận pass**

Run: `npm run test -- tests/executive-stat-strip.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/executive-stat-strip.tsx src/app/page.tsx tests/executive-stat-strip.test.ts
git commit -m "refactor(dashboard): redesign executive stat strip with precision typography and subtle dividers"
```

---

### Task 4: Cascading Task Table Anti-Slop & Micro-Interactions

**Files:**
- Modify: `src/components/dashboard/cascading-task-table.tsx`
- Test: `tests/cascading-task-table.test.ts`

**Interfaces:**
- Consumes: `SchoolTask`, `StaffTask`, `CATEGORY_TABS`, `TaskStatus`
- Produces: Bảng công việc 2 cấp sạch sẽ, micro-badge màu dịu mắt, hover-revealed quick actions (Duyệt nhanh, Đôn đốc, Phân công)

- [ ] **Step 1: Cập nhật test xác thực không có emoji trong danh mục và trạng thái**

Cập nhật `tests/cascading-task-table.test.ts`:
```typescript
test("CATEGORY_TABS labels contain zero emojis", () => {
  CATEGORY_TABS.forEach(tab => {
    assert.match(tab.label, /^[\p{L}\p{N}\s\-\/]+$/u, `Tab ${tab.label} must not contain emojis`);
  });
});
```

- [ ] **Step 2: Chạy test xác nhận**

Run: `npm run test -- tests/cascading-task-table.test.ts`

- [ ] **Step 3: Tái thiết kế `CascadingTaskTable`**

- Loại bỏ emoji trong `CATEGORY_TABS` (thay bằng Lucide icons: `Layers`, `Building2`, `GraduationCap`, `Briefcase`, `Calendar` với `strokeWidth={1.5}`).
- Trạng thái nhiệm vụ: Chuyển sang micro-badge phẳng bo góc nhẹ:
  - Hoàn thành: Muted Emerald (`bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20`)
  - Đang làm: Slate Blue (`bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20`)
  - Chờ duyệt: Warm Amber (`bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20`)
  - Quá hạn: Terracotta / Rose (`bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20`)
- Cột Mã nhiệm vụ: font mono `tabular-nums` `text-xs text-muted-foreground`.
- Quick action buttons (Duyệt, Đôn đ���c, Giao việc): Ẩn bớt độ đậm và hiện rõ khi hover hàng (`opacity-0 group-hover:opacity-100 transition-opacity duration-150`).
- Empty State: Khung rỗng trang nhã với Lucide `Inbox` (`size={32}`, `strokeWidth={1.25}`).

- [ ] **Step 4: Chạy lại test xác nhận pass**

Run: `npm run test -- tests/cascading-task-table.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/cascading-task-table.tsx tests/cascading-task-table.test.ts
git commit -m "feat(table): redesign cascading task table with muted micro-badges and clean hover actions"
```

---

### Task 5: Task Detail Side Sheet & Create Task Modal Polish

**Files:**
- Modify: `src/components/dashboard/task-detail-side-sheet.tsx`
- Modify: `src/components/dashboard/create-task-modal.tsx`
- Test: `tests/task-detail-sheet.test.ts` / `tests/create-task-modal.test.ts`

**Interfaces:**
- Consumes: `TaskDetailSideSheet`, `CreateTaskModal`, `SchoolTask`, `StaffTask`
- Produces: Side sheet trượt êm ái với phân nhóm metadata rõ nét, modal tạo việc phong cách Linear/Raycast sạch sẽ

- [ ] **Step 1: Chạy test hiện tại của Side Sheet và Modal**

Run: `npm run test -- tests/task-detail-sheet.test.ts tests/create-task-modal.test.ts`

- [ ] **Step 2: Nâng cấp `TaskDetailSideSheet`**

- Header sạch sẽ: Tên nhiệm vụ font-semibold `tracking-tight`, mã nhiệm vụ font mono.
- Bỏ emoji trong các nhãn phân loại.
- Phân nhóm metadata (Người chủ trì, Phối hợp, Hạn chót, Tiến độ) thành grid thông tin 2 cột rõ ràng với font `tabular-nums`.
- Audit timeline: Thiết kế đường line xám mảnh với node tròn phẳng tinh tế, hiển thị thời gian chính xác.

- [ ] **Step 3: Nâng cấp `CreateTaskModal`**

- Form fields: Viền hairline `border-input/80 focus:border-primary/80 focus:ring-1`, nhãn gọn gàng, placeholder tự nhiên.
- Loại bỏ các icon màu mè trong dropdown chọn người / chọn phòng ban.
- Nút Submit: Button Primary dứt khoát với hiệu ứng nhấn vật lý nhẹ.

- [ ] **Step 4: Chạy test xác nhận pass 100%**

Run: `npm run test -- tests/task-detail-sheet.test.ts tests/create-task-modal.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/task-detail-side-sheet.tsx src/components/dashboard/create-task-modal.tsx
git commit -m "feat(modal): polish task detail side-sheet and create task modal to linear standard"
```

---

### Task 6: Kanban Board & Tasks Views Redesign

**Files:**
- Modify: `src/components/tasks/task-kanban-board.tsx`
- Modify: `src/app/tasks/page.tsx`
- Modify: `src/app/unit-tasks/page.tsx`
- Test: `tests/task-kanban.test.ts`

**Interfaces:**
- Consumes: `TaskKanbanBoard`, `KANBAN_COLUMNS`, `filterKanbanItems`
- Produces: Cột Kanban tinh giản với badge tròn nhỏ `[ 5 ]`, thẻ công việc bo góc nhẹ `rounded-lg`, thanh tiến độ 2px thanh nhã

- [ ] **Step 1: Kiểm tra test Kanban hiện có**

Run: `npm run test -- tests/task-kanban.test.ts`

- [ ] **Step 2: Triển khai tái thiết kế `TaskKanbanBoard`**

- Cột Kanban: Bỏ emoji trong tiêu đề cột, dùng Lucide icon tương ứng (`Circle`, `Clock`, `AlertCircle`, `CheckCircle2` với `size={14}`, `strokeWidth={1.5}`).
- Số lượng thẻ: Micro-pill tròn nhỏ `px-2 py-0.5 text-xs font-mono text-muted-foreground bg-muted/60`.
- Thẻ Kanban (Kanban Card):
  - Padding `p-3.5`, border `border-border/60 hover:border-primary/40 hover:shadow-subtle transition-all`.
  - Thanh tiến độ: Chiều cao `h-1` tinh tế đặt ở đáy thẻ.
  - Avatar nhân sự: Vòng tròn tối giản 22px với chữ cái đầu viết hoa sạch sẽ.
- Trang `/tasks` và `/unit-tasks`: Tích hợp filter bar gọn gàng, nút chuyển đổi Table/Kanban thanh mảnh.

- [ ] **Step 3: Chạy test xác nhận pass**

Run: `npm run test -- tests/task-kanban.test.ts`

- [ ] **Step 4: Commit**

```bash
git add src/components/tasks/task-kanban-board.tsx src/app/tasks/page.tsx src/app/unit-tasks/page.tsx
git commit -m "feat(kanban): redesign kanban board columns, cards and view switcher"
```

---

### Task 7: Calendar Month View Precision & Status Dots

**Files:**
- Modify: `src/components/calendar/calendar-month-view.tsx`
- Modify: `src/app/calendar/page.tsx`
- Test: `tests/calendar-view.test.ts`

**Interfaces:**
- Consumes: `CalendarMonthView`, `generateMonthGrid`, `getTasksForDate`
- Produces: Lưới lịch 7 cột đường kẻ siêu mỏng `border-border/40`, số ngày font mono, sự kiện lịch dùng status dot 6px

- [ ] **Step 1: Kiểm tra test Lịch công tác hiện có**

Run: `npm run test -- tests/calendar-view.test.ts`

- [ ] **Step 2: Triển khai tối ưu `CalendarMonthView` & `src/app/calendar/page.tsx`**

- Đường kẻ ô lịch: `border-border/40`, nền ô ngày khác tháng làm mờ nhẹ (`bg-muted/15`).
- Số ngày trong tháng: Căn góc trên bên phải, font mono `text-xs font-medium`. Ngày hôm nay hiển thị vòng tròn indicator sắc nét.
- Sự kiện công việc trong ngày: Bỏ các mảng màu neon to đùng; chuyển sang thanh item nền nhạt bo góc 4px kèm status dot 6px phía trước tiêu đề.
- Tooltip xem nhanh: Hiển thị thời gian và địa điểm với typography rõ ràng.

- [ ] **Step 3: Chạy test xác nhận pass**

Run: `npm run test -- tests/calendar-view.test.ts`

- [ ] **Step 4: Commit**

```bash
git add src/components/calendar/calendar-month-view.tsx src/app/calendar/page.tsx
git commit -m "feat(calendar): modernize month grid with hairline borders and subtle status dot items"
```

---

### Task 8: Organization Tree & Directory Refinement

**Files:**
- Modify: `src/components/org/organization-tree.tsx`
- Modify: `src/app/org/page.tsx`
- Test: `tests/organization-tree.test.ts`

**Interfaces:**
- Consumes: `QCET_DEPARTMENTS`, `StaffMember`, `filterStaffMembers`
- Produces: Cây cơ cấu phòng ban đường nối mảnh rõ ràng, danh bạ nhân sự chuẩn hành chính, nút giao việc 1-click thanh lịch

- [ ] **Step 1: Kiểm tra test Tổ chức hiện có**

Run: `npm run test -- tests/organization-tree.test.ts`

- [ ] **Step 2: Triển khai nâng cấp `OrganizationTree`**

- Cây tổ chức: Thay thế các icon thô bằng Lucide `Building2`, `GraduationCap`, `Briefcase` nét mảnh 1.5px.
- Đường nối cây (Tree guide lines): Nét mảnh xám thanh nhã `border-l border-border/60`.
- Thẻ nhân sự: Tên cán bộ font medium, học hàm học vị (ThS., TS., GVC.) thể hiện chuẩn mực, không có emoji.
- Nút "Giao việc": Nút micro-button với icon Lucide `UserCheck` hoặc `Send` (`size={13}`, `strokeWidth={1.5}`).

- [ ] **Step 3: Chạy test xác nhận pass**

Run: `npm run test -- tests/organization-tree.test.ts`

- [ ] **Step 4: Commit**

```bash
git add src/components/org/organization-tree.tsx src/app/org/page.tsx
git commit -m "feat(org): polish organizational directory with clean connectors and executive typography"
```

---

### Task 9: Full Anti-Slop Audit, E2E Smoke Test Suite & Build Verification

**Files:**
- Create: `tests/anti-slop-audit.test.ts`
- Modify: Tất cả các file cần tinh chỉnh sót lại
- Test: `tests/**/*.test.ts`

**Interfaces:**
- Consumes: Toàn bộ codebase `src/`
- Produces: Bộ test audit quét sạch 100% emoji trong toàn bộ mã nguồn `src/` và xác thực build Next.js thành công

- [ ] **Step 1: Viết test audit toàn diện `tests/anti-slop-audit.test.ts`**

Tạo test quét tất cả file `.tsx` và `.ts` trong `src/` để đảm bảo không còn emoji trang trí nào:
```typescript
import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

function getAllFiles(dir: string, ext: string[]): string[] {
  let files: string[] = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files = files.concat(getAllFiles(full, ext));
    else if (ext.some(e => entry.name.endsWith(e))) files.push(full);
  });
  return files;
}

test("Anti-slop audit: Zero decorative emojis in src directory", () => {
  const srcFiles = getAllFiles(path.join(process.cwd(), "src"), [".tsx", ".ts", ".css"]);
  const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  
  const violations: string[] = [];
  srcFiles.forEach(file => {
    const content = fs.readFileSync(file, "utf-8");
    const lines = content.split("\n");
    lines.forEach((line, idx) => {
      if (emojiRegex.test(line)) {
        violations.push(`${file}:${idx + 1}: ${line.trim()}`);
      }
    });
  });

  assert.strictEqual(violations.length, 0, `Found decorative emojis in:\n${violations.slice(0, 10).join("\n")}`);
});
```

- [ ] **Step 2: Chạy test audit để tìm và loại bỏ các emoji còn sót lại**

Run: `npm run test -- tests/anti-slop-audit.test.ts`

- [ ] **Step 3: Khắc phục mọi vị trí vi phạm (nếu có)**

Sửa chữa toàn bộ chuỗi ký tự emoji thành text phân cấp hoặc Lucide icons.

- [ ] **Step 4: Chạy toàn bộ test suite và Typecheck**

Run:
```bash
npm run test
npm run typecheck
npm run build
```
Kỳ vọng: 100% tests PASS, zero type errors, build Next.js thành công 100%.

- [ ] **Step 5: Commit hoàn tất**

```bash
git add tests/anti-slop-audit.test.ts src/
git commit -m "test(audit): add automated anti-slop zero-emoji audit test and verify build"
```
