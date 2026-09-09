---
status: superseded
domain: ux
created: 2026-09-07
superseded_by: 2026-09-09-master-ux-consolidation-plan.md
---

# KẾ HOẠCH TRIỂN KHAI: ĐẠI TU TYPOGRAPHY, CÔNG THÁI HỌC GIAO DIỆN & HỆ THỐNG MẬT ĐỘ HIỂN THỊ (UI/UX TYPOGRAPHY & ERGONOMICS)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển đổi toàn diện hệ thống typography sang font Be Vietnam Pro, thiết lập hệ thống mật độ hiển thị 2 chế độ (Comfortable 48px / Compact 38px), chuẩn hóa công thái học Base Components và quét sạch hoàn toàn 405 vị trí chữ siêu nhỏ (< 12px) trên toàn bộ dự án QCET E-Office.

**Architecture:** 
- Font chữ Be Vietnam Pro hỗ trợ đầy đủ 6 weights tiếng Việt (`300` -> `800`), font mono JetBrains Mono.
- Hệ thống quản lý mật độ hiển thị `DisplayDensityProvider` lưu trữ `localStorage`, đồng bộ thời gian thực qua `window.addEventListener('storage')`, ngăn FOUC bằng script đầu `<head>` và điều khiển bằng biến CSS tokens `--table-cell-py`, `--table-font-size`, `--table-lh`.
- Chuẩn hóa Base Components (`Button`, `Badge`, `Input`) với kích thước phím bấm công thái học SGDS/Carbon và chống phóng to Safari iOS (`text-base md:text-sm`).
- Bộ kiểm thử tự động `tests/typography-micro-classes.test.ts` và `tests/display-density.test.ts` đảm bảo 100% tuân thủ quy chuẩn không hồi quy.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind CSS v4, Node.js Test Runner (`node:test`, `node:assert/strict`), TypeScript 5.

**Spec:** `docs/superpowers/specs/2026-09-07-uiux-typography-ergonomics-design.md`

## Global Constraints

- **Build Rule (CLAUDE.md):** Tuyệt đối KHÔNG chạy `next build` khi dev server đang chạy trên cổng 3001. Chỉ sử dụng `npm run typecheck` (`tsc --noEmit`) và `npm test` (`tsx --test tests/**/*.test.ts`).
- **Typography Floor:** Không được phép tồn tại bất kỳ class font nào dưới 12px (`text-[8px]`, `text-[9px]`, `text-[10px]`, `text-[11px]`) trong toàn bộ thư mục `src/`.
- **Contrast Standard:** Nâng `--muted-foreground` ở Light Mode lên `oklch(0.38 0.015 250)` để vượt ngưỡng tối thiểu 4.5:1 của chuẩn WCAG 2.1 AA.
- **No Layout Thrashing:** Tuyệt đối không thêm `transition` cho `padding` hoặc `font-size` của các ô bảng khi chuyển đổi mật độ.

---

### Task 1: Automated Linter Test for Micro-typography

**Files:**
- Create: `tests/typography-micro-classes.test.ts`
- Test: `tests/typography-micro-classes.test.ts`

**Interfaces:**
- Consumes: Thư mục `src/` trên hệ thống tệp.
- Produces: Test suite quét đệ quy các tệp `.tsx`, `.ts`, `.css` và khẳng định 0 vị trí chứa các class `text-[8px]`, `text-[9px]`, `text-[10px]`, `text-[11px]`.

- [ ] **Step 1: Viết test quét lỗi micro-typography**

Tạo tệp `tests/typography-micro-classes.test.ts`:
```typescript
import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SRC_DIR = path.resolve(process.cwd(), "src");
const FORBIDDEN_CLASS_REGEX = /\btext-\[(8|9|10|11)px\]/g;

function getSourceFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getSourceFiles(fullPath, fileList);
    } else if (/\.(tsx|ts|jsx|js|css)$/.test(file)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

describe("Typography Floor Linter Test Suite (WCAG & Ergonomics)", () => {
  test("Codebase must have zero occurrences of forbidden micro-typography classes (< 12px)", () => {
    const files = getSourceFiles(SRC_DIR);
    const violations: Array<{ file: string; line: number; match: string }> = [];

    for (const filePath of files) {
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      lines.forEach((lineText, lineIdx) => {
        const matches = lineText.match(FORBIDDEN_CLASS_REGEX);
        if (matches) {
          matches.forEach((m) => {
            violations.push({
              file: path.relative(process.cwd(), filePath),
              line: lineIdx + 1,
              match: m,
            });
          });
        }
      });
    }

    if (violations.length > 0) {
      const summary = violations
        .slice(0, 20)
        .map((v) => `  - ${v.file}:${v.line} uses forbidden class "${v.match}"`)
        .join("\n");
      const extra = violations.length > 20 ? `\n  ... and ${violations.length - 20} more.` : "";
      assert.fail(
        `Found ${violations.length} forbidden micro-typography violations (< 12px):\n${summary}${extra}`
      );
    }

    assert.strictEqual(violations.length, 0);
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại vì hiện tại có 405 vi phạm**

Run: `npx tsx --test tests/typography-micro-classes.test.ts`
Expected: FAIL với thông báo `Found 405 forbidden micro-typography violations (< 12px)`.

- [ ] **Step 3: Commit tệp test**

```bash
git add tests/typography-micro-classes.test.ts
git commit -m "test(typography): add automated linter test for micro-typography floor violations"
```

---

### Task 2: Font System & Global Theme Tokens

**Files:**
- Modify: `src/app/layout.tsx:1-50`
- Modify: `src/app/globals.css:6-140`

**Interfaces:**
- Consumes: Google Fonts (`Be_Vietnam_Pro`, `JetBrains_Mono`).
- Produces: CSS variables `--font-sans`, `--font-mono`, `--font-heading`, `--muted-foreground` đã nâng tương phản, và các biến density token (`--table-cell-py`, `--table-font-size`, `--table-lh`, `--table-header-py`).

- [ ] **Step 1: Cập nhật `src/app/layout.tsx` với Be Vietnam Pro**

Thay thế import `Plus_Jakarta_Sans` bằng `Be_Vietnam_Pro` với weights `300`, `400`, `500`, `600`, `700`, `800`:
```tsx
import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/lib/auth-context";
import { AppShell } from "@/components/layout/app-shell";

const fontSans = Be_Vietnam_Pro({
  variable: "--font-sans",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700", "800"],
  fallback: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
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

- [ ] **Step 2: Bổ sung Anti-FOUC script vào `<head>` trong `src/app/layout.tsx`**

Bổ sung thẻ `<head>` và script vào trước thẻ `<body>`:
```tsx
    <html
      lang="vi"
      className={`${fontSans.variable} ${fontMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var density = localStorage.getItem('qcet-display-density');
                  if (density === 'compact') {
                    document.documentElement.setAttribute('data-density', 'compact');
                  } else {
                    document.documentElement.setAttribute('data-density', 'comfortable');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full overflow-x-hidden bg-background text-foreground font-sans">
```

- [ ] **Step 3: Cập nhật CSS variables trong `src/app/globals.css`**

1. Nâng `--muted-foreground` ở Light Mode:
```css
  --muted-foreground: oklch(0.38 0.015 250);
```
2. Thêm các token density và utility classes vào `src/app/globals.css`:
```css
:root,
[data-density="comfortable"] {
  --table-cell-py: 0.8125rem;
  --table-font-size: 0.875rem;
  --table-lh: 1.375rem;
  --table-header-py: 0.75rem;
}

[data-density="compact"] {
  --table-cell-py: 0.4375rem;
  --table-font-size: 0.8125rem;
  --table-lh: 1.125rem;
  --table-header-py: 0.5rem;
}

.table-row-dense {
  font-size: var(--table-font-size);
  line-height: var(--table-lh);
}

.table-cell-dense {
  padding-top: var(--table-cell-py);
  padding-bottom: var(--table-cell-py);
}
```

- [ ] **Step 4: Kiểm tra typecheck**

Run: `npm run typecheck`
Expected: PASS (0 errors)

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "feat(typography): adopt Be Vietnam Pro, WCAG contrast tokens, and density variables"
```

---

### Task 3: Display Density Context & Anti-FOUC Provider

**Files:**
- Create: `src/components/density-provider.tsx`
- Modify: `src/app/layout.tsx` (wrap with `DisplayDensityProvider`)
- Create: `tests/display-density.test.ts`

**Interfaces:**
- Produces: 
  - `type DisplayDensity = "comfortable" | "compact"`
  - `function DisplayDensityProvider({ children }: { children: React.ReactNode })`
  - `function useDisplayDensity(): { density: DisplayDensity; setDensity: (d: DisplayDensity) => void; toggleDensity: () => void }`
- Consumes: `localStorage`, `window.addEventListener('storage')`, `document.documentElement`.

- [ ] **Step 1: Viết test cho logic của DisplayDensityProvider**

Tạo tệp `tests/display-density.test.ts`:
```typescript
import test, { describe } from "node:test";
import assert from "node:assert/strict";

describe("Display Density State Management Contract", () => {
  const STORAGE_KEY = "qcet-display-density";

  test("Defaults to comfortable if localStorage is empty", () => {
    let stored: string | null = null;
    const resolveDensity = (val: string | null) => (val === "compact" ? "compact" : "comfortable");
    assert.strictEqual(resolveDensity(stored), "comfortable");
  });

  test("Resolves compact if localStorage contains compact", () => {
    let stored = "compact";
    const resolveDensity = (val: string | null) => (val === "compact" ? "compact" : "comfortable");
    assert.strictEqual(resolveDensity(stored), "compact");
  });

  test("Toggle switches between comfortable and compact", () => {
    let density = "comfortable";
    const toggle = (current: string) => (current === "comfortable" ? "compact" : "comfortable");
    density = toggle(density);
    assert.strictEqual(density, "compact");
    density = toggle(density);
    assert.strictEqual(density, "comfortable");
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận logic**

Run: `npx tsx --test tests/display-density.test.ts`
Expected: PASS

- [ ] **Step 3: Cài đặt `src/components/density-provider.tsx`**

```tsx
"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export type DisplayDensity = "comfortable" | "compact";

export interface DisplayDensityContextValue {
  density: DisplayDensity;
  setDensity: (density: DisplayDensity) => void;
  toggleDensity: () => void;
}

const STORAGE_KEY = "qcet-display-density";

const DisplayDensityContext = createContext<DisplayDensityContextValue>({
  density: "comfortable",
  setDensity: () => {},
  toggleDensity: () => {},
});

export function useDisplayDensity() {
  return useContext(DisplayDensityContext);
}

export function DisplayDensityProvider({ children }: { children: React.ReactNode }) {
  const [density, setDensityState] = useState<DisplayDensity>("comfortable");

  // Sync state on mount from DOM attribute (set by anti-FOUC head script) or localStorage
  useEffect(() => {
    const fromAttr = document.documentElement.getAttribute("data-density") as DisplayDensity | null;
    const fromStorage = localStorage.getItem(STORAGE_KEY) as DisplayDensity | null;
    const initial: DisplayDensity = fromAttr === "compact" || fromStorage === "compact" ? "compact" : "comfortable";
    
    setDensityState(initial);
    document.documentElement.setAttribute("data-density", initial);
  }, []);

  // Listen to cross-tab storage events
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const nextDensity: DisplayDensity = e.newValue === "compact" ? "compact" : "comfortable";
        setDensityState(nextDensity);
        document.documentElement.setAttribute("data-density", nextDensity);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const setDensity = useCallback((newDensity: DisplayDensity) => {
    setDensityState(newDensity);
    try {
      localStorage.setItem(STORAGE_KEY, newDensity);
      document.documentElement.setAttribute("data-density", newDensity);
      window.dispatchEvent(new CustomEvent("qcet:density-change", { detail: { density: newDensity } }));
    } catch {
      // Ignore private browsing storage errors
    }
  }, []);

  const toggleDensity = useCallback(() => {
    setDensity(density === "comfortable" ? "compact" : "comfortable");
  }, [density, setDensity]);

  return (
    <DisplayDensityContext.Provider value={{ density, setDensity, toggleDensity }}>
      {children}
    </DisplayDensityContext.Provider>
  );
}
```

- [ ] **Step 4: Tích hợp `DisplayDensityProvider` vào `src/app/layout.tsx`**

Bọc `children` bên trong `ThemeProvider`:
```tsx
import { DisplayDensityProvider } from "@/components/density-provider";
...
        <AuthProvider>
          <ThemeProvider>
            <DisplayDensityProvider>
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground shadow-lg"
              >
                Chuyển đến nội dung chính
              </a>
              <AppShell>{children}</AppShell>
            </DisplayDensityProvider>
          </ThemeProvider>
        </AuthProvider>
```

- [ ] **Step 5: Kiểm tra typecheck và tests**

Run: `npm run typecheck && npx tsx --test tests/display-density.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/density-provider.tsx src/app/layout.tsx tests/display-density.test.ts
git commit -m "feat(density): add DisplayDensityProvider with cross-tab sync and anti-FOUC support"
```

---

### Task 4: Toolbar Density Toggle Component

**Files:**
- Create: `src/components/ui/density-toggle.tsx`
- Test: `tests/display-density.test.ts` (extend tests)

**Interfaces:**
- Consumes: `useDisplayDensity` from `@/components/density-provider`, `Button`, `Tooltip`
- Produces: `export function DensityToggle({ className }: { className?: string }): JSX.Element`

- [ ] **Step 1: Viết test cho DensityToggle contract**

Bổ sung test vào `tests/display-density.test.ts`:
```typescript
  test("Density labels and icons mapping", () => {
    const config = {
      comfortable: { label: "Thoải mái (48px)", next: "compact" },
      compact: { label: "Thu gọn (38px)", next: "comfortable" },
    };
    assert.strictEqual(config.comfortable.label, "Thoải mái (48px)");
    assert.strictEqual(config.compact.label, "Thu gọn (38px)");
  });
```

- [ ] **Step 2: Cài đặt `src/components/ui/density-toggle.tsx`**

```tsx
"use client";

import * as React from "react";
import { Rows3, Rows4 } from "lucide-react";
import { useDisplayDensity } from "@/components/density-provider";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface DensityToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function DensityToggle({ className, showLabel = false }: DensityToggleProps) {
  const { density, toggleDensity } = useDisplayDensity();
  const isCompact = density === "compact";

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleDensity}
            className={cn(
              "h-9 px-3 gap-2 border-border/80 text-xs font-medium cursor-pointer transition-colors",
              isCompact && "bg-secondary/80 text-foreground",
              className
            )}
            aria-label={`Chuyển sang mật độ ${isCompact ? "Thoải mái (48px)" : "Thu gọn (38px)"}`}
          >
            {isCompact ? (
              <Rows4 className="size-4 shrink-0 text-primary" />
            ) : (
              <Rows3 className="size-4 shrink-0 text-muted-foreground" />
            )}
            {showLabel && (
              <span>{isCompact ? "Thu gọn (38px)" : "Thoải mái (48px)"}</span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end" className="text-xs">
          <p className="font-medium">
            {isCompact ? "Đang ở chế độ Thu gọn (38px)" : "Đang ở chế độ Thoải mái (48px)"}
          </p>
          <p className="text-muted-foreground text-[11px]">
            Bấm để chuyển sang {isCompact ? "Thoải mái (48px)" : "Thu gọn (38px)"}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```
*Lưu ý:* Chữ trong TooltipContent dùng `text-xs` (12px) và `text-[12px]`, không dùng class < 12px.

- [ ] **Step 3: Kiểm tra typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/density-toggle.tsx tests/display-density.test.ts
git commit -m "feat(density): create DensityToggle toolbar component"
```

---

### Task 5: Base Components Ergonomics & Standards

**Files:**
- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/ui/badge.tsx`
- Create: `src/components/ui/input.tsx`

**Interfaces:**
- Produces: 
  - `buttonVariants` với `default: h-10 px-4 text-sm font-medium`, `sm: h-8.5 px-3 text-xs font-medium`, `lg: h-11 px-6 text-base font-semibold`, `icon: size-10`, `icon-sm: size-8.5`.
  - `badgeVariants` với sàn `text-xs font-semibold`, padding `px-2.5 py-0.75`.
  - `Input` component với `h-10 text-base md:text-sm` (chống zoom Safari iOS).

- [ ] **Step 1: Cập nhật `src/components/ui/button.tsx`**

Cập nhật variant sizes:
```tsx
      size: {
        default:
          "h-10 gap-2 px-4 text-sm font-medium rounded-lg has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-7 gap-1 px-2.5 text-xs rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-8.5 gap-1.5 px-3 text-xs font-medium rounded-lg has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 px-6 text-base font-semibold rounded-lg has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-10 rounded-lg",
        "icon-xs": "size-7 rounded-md [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-8.5 rounded-lg",
        "icon-lg": "size-11 rounded-lg",
      },
```

- [ ] **Step 2: Cập nhật `src/components/ui/badge.tsx`**

Nâng padding và kích thước cơ sở:
```tsx
const badgeVariants = cva(
  "group/badge inline-flex h-5.5 w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-md border border-transparent px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&>svg]:pointer-events-none [&>svg]:size-3.5",
```

- [ ] **Step 3: Cài đặt `src/components/ui/input.tsx`**

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border border-input bg-card px-3 py-2 text-base md:text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
```

- [ ] **Step 4: Kiểm tra typecheck và unit tests**

Run: `npm run typecheck && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/button.tsx src/components/ui/badge.tsx src/components/ui/input.tsx
git commit -m "feat(ui): standardize button, badge, and input typography and ergonomic sizes"
```

---

### Task 6: Task Table & Toolbar Ergonomics Overhaul

**Files:**
- Modify: `src/components/dashboard/cascading-task-table.tsx`
- Modify: `src/components/dashboard/unified-task-toolbar.tsx`

**Interfaces:**
- Consumes: `.table-row-dense`, `.table-cell-dense`, `DensityToggle`
- Produces: Bảng phân cấp công việc sạch micro-typography, thích ứng hai chế độ Comfortable/Compact, tiêu đề 14px font-medium, header 12px uppercase font-semibold.

- [ ] **Step 1: Tích hợp `DensityToggle` vào `unified-task-toolbar.tsx`**

Import `DensityToggle` và đặt trên thanh công cụ bên cạnh các nút lọc và tìm kiếm. Thay thế các class `text-[10px]`, `text-[11px]` trong `unified-task-toolbar.tsx` thành `text-xs font-semibold`.

- [ ] **Step 2: Cập nhật `cascading-task-table.tsx`**

1. Thay `<table className="w-full text-left text-xs">` thành:
   `<table className="w-full text-left table-row-dense">`
2. Thay các thẻ `<th>` padding `py-2.5 text-[11px]` thành `py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground`.
3. Thay các thẻ `<td>` bằng class `table-cell-dense px-4`.
4. Nâng tiêu đề công việc lên `text-sm font-medium text-foreground leading-snug`.
5. Nâng mã công việc từ `text-[10px]` thành `font-mono text-xs tabular-nums text-muted-foreground font-semibold`.
6. Thay thế toàn bộ 18 vị trí `text-[9px]`, `text-[10px]`, `text-[11px]` trong `cascading-task-table.tsx` sang `text-xs`.

- [ ] **Step 3: Kiểm tra typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/cascading-task-table.tsx src/components/dashboard/unified-task-toolbar.tsx
git commit -m "feat(tasks): overhaul cascading task table and toolbar with density and typography tokens"
```

---

### Task 7: Document Registry Sổ Văn Bản Overhaul

**Files:**
- Modify: `src/components/documents/document-registry-view.tsx`
- Modify: `src/components/documents/document-detail-dialog.tsx`
- Modify: `src/components/documents/create-document-modal.tsx`

**Interfaces:**
- Consumes: `DensityToggle`, `.table-row-dense`, `.table-cell-dense`
- Produces: Sổ theo dõi văn bản đi/đến đạt chuẩn thể thức 14px, mã số văn bản 13px tabular-nums, tích hợp toggle mật độ.

- [ ] **Step 1: Cập nhật `document-registry-view.tsx`**

1. Tích hợp `DensityToggle` vào toolbar của Sổ văn bản.
2. Cập nhật `table` sang `.table-row-dense`, các ô `<td>` sang `.table-cell-dense`.
3. Trích yếu văn bản hiển thị `text-sm font-medium text-foreground line-clamp-2 leading-relaxed`.
4. Số / Ký hiệu công văn hiển thị `font-mono text-xs md:text-[13px] font-semibold text-primary`.
5. Thay thế toàn bộ 19 vị trí class micro-typography (`text-[10px]`, `text-[11px]`) sang `text-xs` hoặc `text-[13px]`.

- [ ] **Step 2: Dọn dẹp micro-typography trong `document-detail-dialog.tsx` và `create-document-modal.tsx`**

Nâng các nhãn, badge trạng thái và mã đính kèm lên tối thiểu `text-xs` (12px).

- [ ] **Step 3: Kiểm tra typecheck và integration tests**

Run: `npm run typecheck && npx tsx --test tests/documents-roadmap-page.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/documents/
git commit -m "feat(documents): overhaul document registry view and dialogs with density and typography standards"
```

---

### Task 8: Navigation, Sidebars & Topbar Ergonomics

**Files:**
- Modify: `src/components/layout/app-sidebar.tsx`
- Modify: `src/components/layout/app-topbar.tsx`
- Modify: `src/components/layout/app-primary-rail.tsx`
- Modify: `src/components/navigation.tsx`

**Interfaces:**
- Produces: Sidebar và Topbar với cỡ chữ `text-[13.5px]` hoặc `text-sm font-medium`, icon `size-[18px]`, badge `text-xs font-semibold`, vùng bấm `min-h-10`.

- [ ] **Step 1: Cập nhật `app-sidebar.tsx`**

1. Thay thế các class `text-xs` của navigation item thành `text-[13.5px] font-medium` hoặc `text-sm`.
2. Thay các badge đếm số `text-[10px]` thành `text-xs font-semibold px-2 py-0.5`.
3. Đảm bảo chiều cao tối thiểu của mục menu là `min-h-10` (40px) hoặc `h-10`.
4. Xóa bỏ toàn bộ 17 vị trí class micro-typography trong `app-sidebar.tsx`.

- [ ] **Step 2: Cập nhật `app-topbar.tsx` và `app-primary-rail.tsx`**

Chuẩn hóa các nút bấm, avatar và icon trên thanh điều hướng đầu trang.

- [ ] **Step 3: Kiểm tra regression test cho Dual-Rail Navigation**

Run: `npx tsx --test tests/dual-rail-navigation.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/ src/components/navigation.tsx
git commit -m "feat(nav): modernize sidebar and topbar typography and ergonomic hit targets"
```

---

### Task 9: Codebase-Wide Micro-typography Elimination & QA Verification

**Files:**
- Modify: Các tệp còn lại trong danh sách vi phạm:
  - `src/components/dashboard/task-detail-side-sheet.tsx` (40 vi phạm)
  - `src/components/portal/lecturer-focus-workspace.tsx` (26 vi phạm)
  - `src/components/org/organization-tree.tsx` (25 vi phạm)
  - `src/components/tasks/executive-department-command-center.tsx` (23 vi phạm)
  - `src/components/portal/department-manager-workspace.tsx` (22 vi phạm)
  - `src/components/portal/bento-portal-hub.tsx` (22 vi phạm)
  - `src/components/portal/executive-cockpit-workspace.tsx` (19 vi phạm)
  - `src/components/calendar/calendar-month-view.tsx` (19 vi phạm)
  - `src/components/dashboard/create-task-modal.tsx` (15 vi phạm)
  - `src/components/dashboard/delegation-management-modal.tsx` (13 vi phạm)
  - Và các tệp portal/dashboard còn lại (mỗi tệp từ 1 đến 9 vi phạm).

- [ ] **Step 1: Chạy linter test để lấy danh sách chi tiết các vi phạm còn lại**

Run: `npx tsx --test tests/typography-micro-classes.test.ts`
Xác nhận danh sách các tệp cần xử lý.

- [ ] **Step 2: Thay thế toàn bộ class micro-typography sang `text-xs` (12px) hoặc `text-[13px]`**

Sử dụng regex surgical edit:
- `text-[8px]`, `text-[9px]`, `text-[10px]` -> `text-xs` (kèm `font-medium` / `font-semibold` nếu là badge/mã số).
- `text-[11px]` -> `text-xs` (hoặc `text-[13px]`).

- [ ] **Step 3: Chạy linter test để khẳng định 0 vi phạm**

Run: `npx tsx --test tests/typography-micro-classes.test.ts`
Expected: PASS (0 violations across entire `src/`)

- [ ] **Step 4: Chạy toàn bộ test suite và typecheck**

Run: `npm run typecheck`
Run: `npm test`
Expected: 100% PASS trên tất cả các file test.

- [ ] **Step 5: Commit hoàn thiện**

```bash
git add src/ tests/
git commit -m "refactor(typography): eradicate all micro-typography violations and pass automated typography QA"
```
