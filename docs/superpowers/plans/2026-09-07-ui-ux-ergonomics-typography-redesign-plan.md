# Kế Hoạch Triển Khai: Đại Tu Công Thái Học UI/UX & Typography Tiếng Việt QCET E-Office

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đại tu toàn diện Typography tiếng Việt, nâng chuẩn sàn kích thước chữ tối thiểu 12px / nội dung 14px, chuẩn hóa chiều cao hàng bảng biểu 48px theo chuẩn IBM Carbon & Ant Design, tái cấu trúc khoang điều hành Ban Giám Hiệu theo mô hình quét Z-Pattern, và tích hợp công cụ chuyển đổi mật độ hiển thị (Density Toggle) nhằm triệt tiêu hoàn toàn hiện tượng mỏi mắt cho người dùng.

**Architecture:** Thiết lập hệ thống Font Pairing CSS-First trên Tailwind CSS v4 và Next.js 15 App Router (`Be_Vietnam_Pro` làm `--font-sans` cho Body/Data và `Plus_Jakarta_Sans` làm `--font-heading` cho Stat/Headings). Nâng cấp hệ thống design tokens trong `globals.css` (độ tương phản `--muted-foreground` đạt > 5.8:1 WCAG AA). Chuẩn hóa các linh kiện UI cơ sở (`Button`, `Badge`, `Input`), nâng cấp các widget cốt lõi của Dashboard Zone và Cascading Task Table, kèm bộ kiểm định hồi quy trực quan tự động bằng Headless Chrome trên port 3001.

**Tech Stack:** Next.js 15 (App Router), React 19, Tailwind CSS v4, `@theme inline`, OKLCH Color Space, `next/font/google` (`Be_Vietnam_Pro`, `Plus_Jakarta_Sans`, `JetBrains_Mono`), Lucide React, TypeScript 5, Node.js Test Runner (`tsx --test`), Google Chrome Headless.

**Spec:** `docs/superpowers/specs/2026-09-07-ui-ux-ergonomics-typography-redesign-spec.md`

## Global Constraints
- **Build Cache Invariant (CRITICAL per CLAUDE.md):** Tuyệt đối KHÔNG chạy `next build` đè lên `.next` khi `next dev` đang chạy trên port 3001 để tránh cache poisoning mất CSS. Kiểm thử code qua `npm run typecheck` (`tsc --noEmit`) và `npm test` (`tsx --test tests/**/*.test.ts`).
- **Tailwind CSS v4 Invariant:** Điểm vào duy nhất là `src/app/globals.css` với `@import "tailwindcss";` và `@theme inline { ... }`. Tuyệt đối không tạo `tailwind.config.js`.
- **Absolute Typography Floor:** Không sử dụng kích thước dưới 12px (`text-[8px]`, `text-[9px]`, `text-[10px]`, `text-[11px]`). Sàn tuyệt đối là 12px (`text-xs`). Nội dung bảng và văn bản chuẩn là 14px (`text-sm`).
- **Row Height Standard:** Bảng biểu dữ liệu ở chế độ Dễ nhìn (Comfortable) phải đạt chiều cao hàng tối thiểu 44px - 48px (chuẩn IBM Carbon & Ant Design). Chế độ Thu gọn (Compact) đạt 38px.
- **Tabular Numbers Invariant:** Toàn bộ số liệu đếm, số ký hiệu công văn và mã nhiệm vụ DACUM bắt buộc sử dụng `font-mono tabular-nums`.

---

## Danh Sách Các Task Triển Khai

### Task 1: Thiết Lập Cặp Đôi Phông Chữ (Font Pairing) & Tokens Độ Tương Phản trong globals.css

**Files:**
- Modify: `src/app/layout.tsx:1-58`
- Modify: `src/app/globals.css:6-73`
- Test: `tests/typography-tokens-contract.test.ts`

**Interfaces:**
- Consumes: Google Fonts API qua `next/font/google`
- Produces: CSS variables `--font-sans`, `--font-heading`, `--font-mono` và token `--muted-foreground` đạt tỷ lệ tương phản > 5.8:1

- [ ] **Step 1: Viết test kiểm tra tính toàn vẹn của Typography Tokens và Font variables**

Tạo file `tests/typography-tokens-contract.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Typography & Contrast Tokens Contract Test", () => {
  const layoutPath = path.join(process.cwd(), "src/app/layout.tsx");
  const globalsPath = path.join(process.cwd(), "src/app/globals.css");

  test("src/app/layout.tsx imports Be_Vietnam_Pro and Plus_Jakarta_Sans", () => {
    const layoutContent = fs.readFileSync(layoutPath, "utf-8");
    assert.match(layoutContent, /Be_Vietnam_Pro/, "layout.tsx must import Be_Vietnam_Pro");
    assert.match(layoutContent, /Plus_Jakarta_Sans/, "layout.tsx must import Plus_Jakarta_Sans");
    assert.match(layoutContent, /--font-sans/, "layout.tsx must define --font-sans variable");
    assert.match(layoutContent, /--font-heading/, "layout.tsx must define --font-heading variable");
    assert.match(layoutContent, /vietnamese/, "layout.tsx must include vietnamese subset for fonts");
  });

  test("src/app/globals.css binds --font-heading and high-contrast --muted-foreground", () => {
    const cssContent = fs.readFileSync(globalsPath, "utf-8");
    assert.match(cssContent, /--font-heading:\s*var\(--font-heading\)/, "globals.css @theme must map --font-heading");
    // Verify contrast: muted-foreground in light mode must be darker than 0.40 lightness
    assert.match(cssContent, /--muted-foreground:\s*oklch\(\s*0\.(?:3[0-8]|2\d)/, "Light mode --muted-foreground must have lightness <= 0.38 for WCAG AA compliance");
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại trước khi sửa mã nguồn**

Run: `npx tsx --test tests/typography-tokens-contract.test.ts`  
Expected output: FAIL (do `Plus_Jakarta_Sans` chưa được import trong `layout.tsx` và `--font-heading` chưa được ánh xạ tới `var(--font-heading)`).

- [ ] **Step 3: Cập nhật `src/app/layout.tsx` để import `Plus_Jakarta_Sans`**

Cập nhật `src/app/layout.tsx`:
```tsx
import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/lib/auth-context";
import { DisplayDensityProvider } from "@/components/density-provider";
import { AppShell } from "@/components/layout/app-shell";

const fontSans = Be_Vietnam_Pro({
  variable: "--font-sans",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700", "800"],
  fallback: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
  display: "swap",
});

const fontHeading = Plus_Jakarta_Sans({
  variable: "--font-heading",
  subsets: ["latin", "vietnamese"],
  weight: ["600", "700", "800"],
  fallback: ["system-ui", "sans-serif"],
  display: "swap",
});

const fontMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
  display: "swap",
});
```
Và cập nhật thẻ `<html>`:
```tsx
<html
  lang="vi"
  className={`${fontSans.variable} ${fontHeading.variable} ${fontMono.variable} h-full antialiased`}
  suppressHydrationWarning
>
```

- [ ] **Step 4: Cập nhật `src/app/globals.css` để ánh xạ `--font-heading`**

Cập nhật trong `@theme inline`:
```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
  --font-heading: var(--font-heading);
  ...
```
Đảm bảo `--muted-foreground: oklch(0.38 0.015 250);` ở `:root` để đạt tỷ lệ tương phản 5.8:1.

- [ ] **Step 5: Chạy lại test và kiểm tra typecheck**

Run:
```bash
npx tsx --test tests/typography-tokens-contract.test.ts
npm run typecheck
```
Expected output: Tất cả các bài test đều PASS, `typecheck` exit code 0.

- [ ] **Step 6: Commit git**

```bash
git add tests/typography-tokens-contract.test.ts src/app/layout.tsx src/app/globals.css
git commit -m "feat(ui): configure Be Vietnam Pro and Plus Jakarta Sans pairing in Tailwind v4

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: Chuẩn Hóa Kích Thước & Vùng Chạm Linh Kiện UI Cơ Sở (Button, Badge, Input)

**Files:**
- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/ui/badge.tsx`
- Modify: `src/components/ui/input.tsx`
- Test: `tests/ui-components-ergonomics.test.ts`

**Interfaces:**
- Consumes: `cva` từ `class-variance-authority`, tokens Tailwind v4
- Produces: `Button` với `h-10` (default) và `h-8.5` (sm); `Badge` tối thiểu 12px; `Input` chiều cao chuẩn 40px (`h-10`) với font 14px

- [ ] **Step 1: Viết test kiểm tra kích thước chuẩn công thái học của các linh kiện cơ sở**

Tạo file `tests/ui-components-ergonomics.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("UI Components Ergonomics Standards Test", () => {
  const buttonPath = path.join(process.cwd(), "src/components/ui/button.tsx");
  const badgePath = path.join(process.cwd(), "src/components/ui/badge.tsx");
  const inputPath = path.join(process.cwd(), "src/components/ui/input.tsx");

  test("Button component provides comfortable h-10 touch targets", () => {
    const content = fs.readFileSync(buttonPath, "utf-8");
    // Ensure default button is at least h-9.5 or h-10 and uses text-sm (14px)
    assert.match(content, /default:\s*"h-10[^"]*text-sm/, "Default button must be h-10 with text-sm");
    assert.match(content, /sm:\s*"h-8\.5[^"]*text-xs/, "Sm button must be h-8.5 with text-xs font-semibold");
  });

  test("Badge component enforces minimum font size floor of 12px", () => {
    const content = fs.readFileSync(badgePath, "utf-8");
    assert.match(content, /text-xs/, "Badge must use text-xs (12px minimum floor)");
    assert.doesNotMatch(content, /text-\[8px\]|text-\[9px\]|text-\[10px\]/, "Badge must not use micro fonts below 12px");
  });

  test("Input component enforces 40px height and 14px font size to prevent mobile auto-zoom", () => {
    const content = fs.readFileSync(inputPath, "utf-8");
    assert.match(content, /h-10/, "Input must have height h-10 (40px)");
    assert.match(content, /text-sm/, "Input must have text-sm (14px font)");
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận các điểm cần chuẩn hóa**

Run: `npx tsx --test tests/ui-components-ergonomics.test.ts`  
Expected output: Xác định xem các kích thước hiện tại có bị nhỏ hơn chuẩn không.

- [ ] **Step 3: Cập nhật `src/components/ui/button.tsx`**

Cập nhật `buttonVariants` trong `src/components/ui/button.tsx`:
```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive: "bg-destructive text-white shadow-xs hover:bg-destructive/90",
        outline: "border border-border bg-background shadow-2xs hover:bg-muted/60 hover:text-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-2xs hover:bg-secondary/80",
        ghost: "hover:bg-muted/60 hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 text-sm",
        sm: "h-8.5 rounded-lg px-3 text-xs font-semibold",
        lg: "h-11 rounded-xl px-6 text-sm font-semibold",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
```

- [ ] **Step 4: Cập nhật `src/components/ui/badge.tsx` và `src/components/ui/input.tsx`**

Đảm bảo `badge.tsx` sử dụng:
```tsx
"inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 font-mono"
```
Và `input.tsx`:
```tsx
"flex h-10 w-full rounded-xl border border-input bg-background px-3.5 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 font-sans"
```

- [ ] **Step 5: Chạy lại test và typecheck**

Run:
```bash
npx tsx --test tests/ui-components-ergonomics.test.ts
npm run typecheck
```
Expected output: PASS toàn bộ.

- [ ] **Step 6: Commit git**

```bash
git add tests/ui-components-ergonomics.test.ts src/components/ui/button.tsx src/components/ui/badge.tsx src/components/ui/input.tsx
git commit -m "refactor(ui): upgrade button, badge and input ergonomics to enterprise standards

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: Đại Tu Khoang Điều Hành BGH: Stat Strip & Strategic Action Center

**Files:**
- Modify: `src/components/dashboard/executive-stat-strip.tsx:274-335`
- Modify: `src/components/dashboard/executive-action-center.tsx`
- Test: `tests/executive-cockpit-ergonomics.test.ts`

**Interfaces:**
- Consumes: `DashboardStats`, `ExecutiveActionCenterProps`
- Produces: Stat Strip với chỉ số 32px `tabular-nums`, nhãn 14px, dòng trạng thái >= 12.5px; Action Center với thẻ nhiệm vụ cao 64px và nút bấm chuẩn 38px (`h-9.5`)

- [ ] **Step 1: Viết test kiểm tra kích thước và cấu trúc của Stat Strip & Action Center**

Tạo file `tests/executive-cockpit-ergonomics.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Executive Cockpit Ergonomics Test", () => {
  const statStripPath = path.join(process.cwd(), "src/components/dashboard/executive-stat-strip.tsx");
  const actionCenterPath = path.join(process.cwd(), "src/components/dashboard/executive-action-center.tsx");

  test("ExecutiveStatStrip uses tabular-nums and >= 12px typography floors", () => {
    const content = fs.readFileSync(statStripPath, "utf-8");
    assert.match(content, /tabular-nums/, "Stat values must use tabular-nums");
    assert.match(content, /text-2xl sm:text-3xl font-bold/, "Stat values must be text-2xl/3xl font-bold");
    assert.match(content, /text-xs sm:text-sm font-semibold/, "Card title must be text-xs/sm font-semibold");
    assert.doesNotMatch(content, /text-\[9px\]|text-\[10px\]/, "Stat strip must not contain text below 12px");
  });

  test("ExecutiveActionCenter action cards have comfortable height and accessible buttons", () => {
    const content = fs.readFileSync(actionCenterPath, "utf-8");
    assert.match(content, /h-9|h-9\.5|h-10|h-8\.5/, "Action center buttons must be at least h-8.5 or h-9.5");
    assert.doesNotMatch(content, /text-\[8px\]|text-\[9px\]/, "Action center must not contain text below 12px");
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận các vi phạm kích thước hiện tại**

Run: `npx tsx --test tests/executive-cockpit-ergonomics.test.ts`  
Expected output: FAIL trên các đoạn kiểm tra nhãn `text-xs sm:text-sm font-semibold` hoặc các đoạn chữ nhỏ.

- [ ] **Step 3: Cập nhật `src/components/dashboard/executive-stat-strip.tsx`**

Nâng cấp hiển thị tiêu đề và nhãn phụ:
* Tiêu đề card: `<span className="text-xs sm:text-sm font-semibold text-foreground/90 tracking-tight truncate">{card.title}</span>`
* Badge đếm: `<span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold font-mono shrink-0 ...">`
* Subtext dưới số đếm: `<p className="text-xs sm:text-[13px] font-medium text-muted-foreground flex items-center gap-1.5 leading-snug">`

- [ ] **Step 4: Cập nhật `src/components/dashboard/executive-action-center.tsx`**

* Nâng chiều cao thẻ hành động con lên tối thiểu 64px (`min-h-[64px] p-3.5`).
* Tiêu đề nhiệm vụ hiển thị `14px font-semibold text-foreground`.
* Metadata đơn vị, người phụ trách, thời hạn hiển thị `text-xs sm:text-[13px] text-muted-foreground`.
* Nút thao tác nhanh duyệt/nhắc nhở chuẩn hóa `size="sm"` với chiều cao `h-8.5` hoặc `h-9` (`px-3 text-xs font-semibold rounded-lg`).

- [ ] **Step 5: Chạy lại test và typecheck**

Run:
```bash
npx tsx --test tests/executive-cockpit-ergonomics.test.ts
npm run typecheck
```
Expected output: PASS toàn bộ, không có lỗi TypeScript.

- [ ] **Step 6: Commit git**

```bash
git add tests/executive-cockpit-ergonomics.test.ts src/components/dashboard/executive-stat-strip.tsx src/components/dashboard/executive-action-center.tsx
git commit -m "feat(dashboard): enhance executive stat strip and action center visual ergonomics

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: Tái Cấu Trúc Ma Trận Tiến Độ 11 Đơn Vị (Department Progress Matrix)

**Files:**
- Modify: `src/components/dashboard/department-progress-matrix.tsx`
- Test: `tests/department-progress-matrix.test.ts`

**Interfaces:**
- Consumes: `DepartmentHealth[]`, `selectedDepartment`, `onSelectDepartment`
- Produces: Lưới 3 cột rộng rãi (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`), tên đơn vị 14px font-semibold, số liệu con >= 12.5px

- [ ] **Step 1: Viết test kiểm tra lưới hiển thị và cấu trúc thẻ ma trận đơn vị**

Tạo file `tests/department-progress-matrix.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Department Progress Matrix Ergonomics Test", () => {
  const matrixPath = path.join(process.cwd(), "src/components/dashboard/department-progress-matrix.tsx");

  test("DepartmentProgressMatrix provides 3-column layout on desktop with visual breathing room", () => {
    const content = fs.readFileSync(matrixPath, "utf-8");
    assert.match(content, /lg:grid-cols-3/, "Matrix grid must support 3 columns on desktop for visual breathing room");
    assert.match(content, /tabular-nums/, "Progress percentage must use tabular-nums");
    assert.doesNotMatch(content, /text-\[8px\]|text-\[9px\]|text-\[10px\]/, "Matrix cards must not use text below 12px");
  });
});
```

- [ ] **Step 2: Chạy test để kiểm tra hiện trạng**

Run: `npx tsx --test tests/department-progress-matrix.test.ts`  
Expected output: FAIL hoặc PASS tùy thuộc vào các lớp kích thước hiện hữu.

- [ ] **Step 3: Cập nhật `src/components/dashboard/department-progress-matrix.tsx`**

* Điều chỉnh layout grid từ 4 cột sang:
  ```tsx
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-slot="department-matrix-grid">
  ```
* Tên phòng/khoa: `<span className="text-sm font-semibold text-foreground truncate">{dept.name}</span>`
* Thanh tiến độ (Progress bar): tăng chiều cao lên `h-2` (8px), bo tròn `rounded-full`.
* Tỷ lệ phần trăm: `<span className="text-xs sm:text-[13px] font-bold font-mono tabular-nums">{dept.progress}%</span>`
* Thống kê chi tiết con (Hoàn thành, Đang làm, Trễ): hiển thị `text-xs sm:text-[12.5px] font-medium`.

- [ ] **Step 4: Chạy lại test và typecheck**

Run:
```bash
npx tsx --test tests/department-progress-matrix.test.ts
npm run typecheck
```
Expected output: PASS toàn bộ.

- [ ] **Step 5: Commit git**

```bash
git add tests/department-progress-matrix.test.ts src/components/dashboard/department-progress-matrix.tsx
git commit -m "feat(dashboard): refactor department progress matrix to 3-column ergonomic layout

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: Chuẩn Hóa Bảng Dữ Liệu Nhiệm Vụ & Công Cụ Density Toggle (Cascading Task Table)

**Files:**
- Modify: `src/components/tasks/cascading-task-table.tsx`
- Modify: `src/components/density-provider.tsx`
- Test: `tests/task-table-density-ergonomics.test.ts`

**Interfaces:**
- Consumes: `useDisplayDensity()`, `tasks`
- Produces: Hàng bảng chuẩn 48px (`h-12`) ở chế độ Comfortable, 38px ở chế độ Compact; tiêu đề 14px font-medium; số ký hiệu 13px font-mono

- [ ] **Step 1: Viết test kiểm tra chiều cao hàng và mật độ hiển thị của Task Table**

Tạo file `tests/task-table-density-ergonomics.test.ts`:
```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Cascading Task Table Density Ergonomics Test", () => {
  const tablePath = path.join(process.cwd(), "src/components/tasks/cascading-task-table.tsx");

  test("CascadingTaskTable enforces 14px font for task titles and eliminates text-xs on table rows", () => {
    const content = fs.readFileSync(tablePath, "utf-8");
    assert.match(content, /text-sm font-medium/, "Task titles must use text-sm (14px) font-medium");
    assert.match(content, /tabular-nums/, "Task codes and counters must use tabular-nums");
    assert.doesNotMatch(content, /<table[^>]*class="[^"]*text-xs/, "Table wrapper must not enforce text-xs globally");
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận các điểm cần sửa**

Run: `npx tsx --test tests/task-table-density-ergonomics.test.ts`  
Expected output: FAIL nếu bảng vẫn còn bọc bởi class `text-xs`.

- [ ] **Step 3: Cập nhật `src/components/tasks/cascading-task-table.tsx`**

* Xóa class `text-xs` ở thẻ bọc ngoài bảng.
* Header bảng: `h-11 px-4 text-xs sm:text-[12.5px] font-semibold uppercase tracking-wider text-muted-foreground`.
* Hàng dữ liệu (Row):
  ```tsx
  className={cn(
    "group transition-colors border-b border-border/50 hover:bg-muted/40",
    density === "compact" ? "h-[38px] py-1.5" : "h-[48px] py-3"
  )}
  ```
* Tên công việc: `<span className="text-sm font-medium text-foreground leading-snug">{task.title}</span>`
* Mã công việc: `<span className="font-mono text-xs sm:text-[13px] tabular-nums text-muted-foreground">{task.code}</span>`

- [ ] **Step 4: Chạy lại test và typecheck**

Run:
```bash
npx tsx --test tests/task-table-density-ergonomics.test.ts
npm run typecheck
```
Expected output: PASS toàn bộ.

- [ ] **Step 5: Commit git**

```bash
git add tests/task-table-density-ergonomics.test.ts src/components/tasks/cascading-task-table.tsx
git commit -m "feat(tasks): standardize cascading task table row height and density support

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 6: Kiểm Định Hồi Quy Thị Giác Trực Quan Qua Headless Chrome Trên Port 3001

**Files:**
- Create: `scripts/verify-ui-ux-visual-regressions.sh`
- Test: Chụp lại ảnh màn hình thực tế và so sánh độ tách bạch dấu tiếng Việt

**Interfaces:**
- Consumes: Dev server đang chạy trên `http://localhost:3001`
- Produces: Bộ ảnh chụp thực tế tại `/tmp/qcet-screenshots/verified-*.png`

- [ ] **Step 1: Tạo script chụp ảnh kiểm định thực tế**

Tạo file `scripts/verify-ui-ux-visual-regressions.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail

CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUT_DIR="/tmp/qcet-screenshots"
mkdir -p "$OUT_DIR"

echo "=== 1. Checking Dev Server on Port 3001 ==="
if ! lsof -ti:3001 >/dev/null; then
  echo "Error: Dev server is not running on port 3001!"
  exit 1
fi

echo "=== 2. Capturing Verified Desktop Fold (1440x1200) ==="
"$CHROME_BIN" --headless=new --disable-gpu --window-size=1440,1200 \
  --screenshot="$OUT_DIR/verified-desktop-fold.png" \
  "http://localhost:3001/?zone=dashboard"

echo "=== 3. Capturing Verified Full Dashboard (1440x2600) ==="
"$CHROME_BIN" --headless=new --disable-gpu --window-size=1440,2600 \
  --screenshot="$OUT_DIR/verified-full-dashboard.png" \
  "http://localhost:3001/?zone=dashboard"

echo "=== 4. Capturing Verified Tasks Table (1440x2200) ==="
"$CHROME_BIN" --headless=new --disable-gpu --window-size=1440,2200 \
  --screenshot="$OUT_DIR/verified-tasks-zone.png" \
  "http://localhost:3001/?zone=tasks"

echo "=== Visual regression captures completed successfully ==="
ls -lh "$OUT_DIR"/verified-*.png
```
Cấp quyền thực thi:
```bash
chmod +x scripts/verify-ui-ux-visual-regressions.sh
```

- [ ] **Step 2: Chạy script chụp ảnh thực tế**

Run:
```bash
./scripts/verify-ui-ux-visual-regressions.sh
```
Expected output: 3 file ảnh `verified-desktop-fold.png`, `verified-full-dashboard.png`, `verified-tasks-zone.png` được tạo thành công (> 100 KB mỗi ảnh).

- [ ] **Step 3: Đọc và kiểm định trực quan ảnh đã chụp**

Dùng tool `Read` để kiểm tra trực quan các ảnh tại `/tmp/qcet-screenshots/verified-*.png`. Xác thực dấu tiếng Việt không còn bị dính cụm và hàng bảng dữ liệu đạt chuẩn thông thoáng 48px.

- [ ] **Step 4: Chạy toàn bộ test suite để xác nhận không có bất kỳ regression nào**

Run:
```bash
npm run typecheck
npm test
```
Expected output: Toàn bộ test suites xanh lá (0 errors).

- [ ] **Step 5: Commit git hoàn tất kế hoạch**

```bash
git add scripts/verify-ui-ux-visual-regressions.sh
git commit -m "test(visual): add automated visual regression verification script for port 3001

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```
