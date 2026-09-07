# QCET E-Office: Kế Hoạch Triển Khai Mobile-First & PWA

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển đổi toàn diện hệ thống QCET E-Office sang kiến trúc Mobile-First PWA với Bottom Navigation Bar 5 điểm chạm, Vaul Bottom Sheets vuốt kéo, tối ưu vùng ngón cái và an toàn tai thỏ/Home Indicator.

**Architecture:** Sử dụng mô hình Unified AppShell chiếu 1 nguồn định tuyến sang 2 bề mặt hiển thị theo CSS breakpoint. Trên Mobile (`< md`), kích hoạt `MobileBottomNav` cố định đáy, thay thế Modal bằng `vaul` Bottom Sheet mượt mà; trên Desktop (`>= md`), bảo toàn 100% Sidebar và Cockpit Grid.

**Tech Stack:** Next.js 15.2, React 19, Tailwind CSS v4, `vaul` (drawer/bottom sheet), Lucide React, TypeScript 5.

**Spec:** [`docs/superpowers/specs/2026-09-07-mobile-first-design.md`](docs/superpowers/specs/2026-09-07-mobile-first-design.md)

## Global Constraints

- Không chạy `next build` khi `next dev` đang chạy (tuân thủ Engineering Rules trong CLAUDE.md).
- Dùng `npm run typecheck` và `npm test` để kiểm tra chất lượng trước mỗi lần commit.
- Mọi điểm tương tác trên mobile phải đạt tối thiểu 44×44px touch target.
- Xử lý safe areas triệt để: `viewportFit: "cover"`, `env(safe-area-inset-bottom)`, `env(safe-area-inset-top)`.
- Không phụ thuộc vào Framer Motion; sử dụng `vaul` native gestures và CSS transitions.

---

### Task 1: Cài Đặt Thư Viện `vaul` & Cấu Hình PWA Manifest + Safe Areas

**Files:**
- Modify: `package.json`
- Create: `src/app/manifest.ts`
- Modify: `src/app/layout.tsx`
- Create: `tests/pwa-manifest.test.ts`

**Interfaces:**
- Produces: `src/app/manifest.ts` export default function manifest(): MetadataRoute.Manifest
- Produces: `viewport` metadata with `viewportFit: "cover"`, `themeColor`, `appleWebApp`

- [ ] **Step 1: Viết test kiểm tra PWA Manifest**

Tạo file `tests/pwa-manifest.test.ts`:
```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import manifest from "../src/app/manifest";

test("PWA manifest exports required standalone metadata", () => {
  const data = manifest();
  assert.equal(data.name, "QCET E-Office - Hệ thống Điều hành Văn phòng Điện tử");
  assert.equal(data.short_name, "QCET E-Office");
  assert.equal(data.display, "standalone");
  assert.equal(data.start_url, "/");
  assert.ok(Array.isArray(data.icons) && data.icons.length >= 2);
  const maskable = data.icons?.find((icon) => icon.purpose === "maskable");
  assert.ok(maskable, "Phải có ít nhất 1 maskable icon cho Android");
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx tsx --test tests/pwa-manifest.test.ts`
Expected: FAIL (Cannot find module `../src/app/manifest`)

- [ ] **Step 3: Cài đặt `vaul` và viết code manifest.ts + layout.tsx**

Cài đặt `vaul`:
```bash
npm install vaul
```

Tạo file `src/app/manifest.ts`:
```typescript
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "QCET E-Office - Hệ thống Điều hành Văn phòng Điện tử",
    short_name: "QCET E-Office",
    description: "Hệ thống quản lý công việc và điều hành văn phòng điện tử Trường CĐ Kỹ thuật Cao Thắng",
    start_url: "/",
    display: "standalone",
    background_color: "#0B0C0E",
    theme_color: "#18181B",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/logo-qcet.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/logo-qcet.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/logo-qcet.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
```

Cập nhật `src/app/layout.tsx`: Thêm `viewportFit: "cover"` vào viewport export:
```typescript
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0c0e" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};
```

- [ ] **Step 4: Chạy test xác nhận thành công**

Run: `npx tsx --test tests/pwa-manifest.test.ts`
Expected: PASS

- [ ] **Step 5: Kiểm tra typecheck và commit**

Run: `npm run typecheck`
```bash
git add package.json package-lock.json src/app/manifest.ts src/app/layout.tsx tests/pwa-manifest.test.ts
git commit -m "feat(pwa): install vaul, configure PWA manifest and viewport safe areas"
```

---

### Task 2: Xây Dựng Component `BottomSheet` Tái Sử Dụng Trên Nền `vaul`

**Files:**
- Create: `src/components/ui/bottom-sheet.tsx`
- Create: `tests/bottom-sheet.test.ts`

**Interfaces:**
- Produces: `BottomSheet`, `BottomSheetTrigger`, `BottomSheetContent`, `BottomSheetHeader`, `BottomSheetTitle`, `BottomSheetDescription`, `BottomSheetFooter`, `BottomSheetClose`

- [ ] **Step 1: Viết test cho BottomSheet props & render structure**

Tạo `tests/bottom-sheet.test.ts`:
```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import * as BottomSheetModule from "../src/components/ui/bottom-sheet";

test("BottomSheet exports all expected primitive components", () => {
  assert.ok(BottomSheetModule.BottomSheet, "Must export BottomSheet");
  assert.ok(BottomSheetModule.BottomSheetTrigger, "Must export BottomSheetTrigger");
  assert.ok(BottomSheetModule.BottomSheetContent, "Must export BottomSheetContent");
  assert.ok(BottomSheetModule.BottomSheetHeader, "Must export BottomSheetHeader");
  assert.ok(BottomSheetModule.BottomSheetTitle, "Must export BottomSheetTitle");
  assert.ok(BottomSheetModule.BottomSheetFooter, "Must export BottomSheetFooter");
  assert.ok(BottomSheetModule.BottomSheetClose, "Must export BottomSheetClose");
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx tsx --test tests/bottom-sheet.test.ts`
Expected: FAIL (Cannot find module)

- [ ] **Step 3: Triển khai `src/components/ui/bottom-sheet.tsx`**

```tsx
"use client";

import * as React from "react";
import { Drawer as VaulDrawer } from "vaul";
import { cn } from "@/lib/utils";

export const BottomSheet = ({
  shouldScaleBackground = false,
  ...props
}: React.ComponentProps<typeof VaulDrawer.Root>) => (
  <VaulDrawer.Root
    shouldScaleBackground={shouldScaleBackground}
    {...props}
  />
);
BottomSheet.displayName = "BottomSheet";

export const BottomSheetTrigger = VaulDrawer.Trigger;
export const BottomSheetPortal = VaulDrawer.Portal;
export const BottomSheetClose = VaulDrawer.Close;

export const BottomSheetOverlay = React.forwardRef<
  React.ElementRef<typeof VaulDrawer.Overlay>,
  React.ComponentPropsWithoutRef<typeof VaulDrawer.Overlay>
>(({ className, ...props }, ref) => (
  <VaulDrawer.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity duration-200",
      className
    )}
    {...props}
  />
));
BottomSheetOverlay.displayName = "BottomSheetOverlay";

export const BottomSheetContent = React.forwardRef<
  React.ElementRef<typeof VaulDrawer.Content>,
  React.ComponentPropsWithoutRef<typeof VaulDrawer.Content> & {
    hideHandle?: boolean;
  }
>(({ className, children, hideHandle = false, ...props }, ref) => (
  <BottomSheetPortal>
    <BottomSheetOverlay />
    <VaulDrawer.Content
      ref={ref}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 flex max-h-[90vh] flex-col rounded-t-[28px] border-t border-border/80 bg-card text-card-foreground shadow-2xl focus:outline-none",
        "pb-[max(1rem,env(safe-area-inset-bottom))]",
        className
      )}
      {...props}
    >
      {!hideHandle && (
        <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-muted-foreground/30 active:bg-muted-foreground/50" />
      )}
      {children}
    </VaulDrawer.Content>
  </BottomSheetPortal>
));
BottomSheetContent.displayName = "BottomSheetContent";

export const BottomSheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col gap-1 px-5 pt-3 pb-2 text-left shrink-0",
      className
    )}
    {...props}
  />
);
BottomSheetHeader.displayName = "BottomSheetHeader";

export const BottomSheetTitle = React.forwardRef<
  React.ElementRef<typeof VaulDrawer.Title>,
  React.ComponentPropsWithoutRef<typeof VaulDrawer.Title>
>(({ className, ...props }, ref) => (
  <VaulDrawer.Title
    ref={ref}
    className={cn("text-base font-bold tracking-tight text-foreground", className)}
    {...props}
  />
));
BottomSheetTitle.displayName = "BottomSheetTitle";

export const BottomSheetDescription = React.forwardRef<
  React.ElementRef<typeof VaulDrawer.Description>,
  React.ComponentPropsWithoutRef<typeof VaulDrawer.Description>
>(({ className, ...props }, ref) => (
  <VaulDrawer.Description
    ref={ref}
    className={cn("text-xs text-muted-foreground", className)}
    {...props}
  />
));
BottomSheetDescription.displayName = "BottomSheetDescription";

export const BottomSheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "mt-auto flex flex-col gap-2 p-5 pt-2 shrink-0 border-t border-border/40",
      className
    )}
    {...props}
  />
);
BottomSheetFooter.displayName = "BottomSheetFooter";
```

- [ ] **Step 4: Chạy test xác nhận thành công**

Run: `npx tsx --test tests/bottom-sheet.test.ts`
Expected: PASS

- [ ] **Step 5: Kiểm tra typecheck và commit**

Run: `npm run typecheck`
```bash
git add src/components/ui/bottom-sheet.tsx tests/bottom-sheet.test.ts
git commit -m "feat(ui): create reusable BottomSheet primitives based on vaul"
```

---

### Task 3: Xây Dựng `MobileMenuDrawer` (Menu Tổng Hợp Cho Điểm Chạm Số 5)

**Files:**
- Create: `src/components/layout/mobile-menu-drawer.tsx`
- Create: `tests/mobile-menu-drawer.test.ts`

**Interfaces:**
- Consumes: `useAuth` from `@/context/auth-context`, `useSidebar` from `@/components/layout/sidebar-context`, `BottomSheet`
- Produces: `MobileMenuDrawer` component with Role Demo switcher, quick links, theme toggle, and logout

- [ ] **Step 1: Viết test cho MobileMenuDrawer**

Tạo `tests/mobile-menu-drawer.test.ts`:
```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { MobileMenuDrawer } from "../src/components/layout/mobile-menu-drawer";

test("MobileMenuDrawer is defined and is a valid React component", () => {
  assert.equal(typeof MobileMenuDrawer, "function");
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx tsx --test tests/mobile-menu-drawer.test.ts`
Expected: FAIL (Cannot find module)

- [ ] **Step 3: Triển khai `src/components/layout/mobile-menu-drawer.tsx`**

```tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  User,
  Building2,
  Calendar,
  FileText,
  Settings,
  Moon,
  Sun,
  LogOut,
  X,
  Layers,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetDescription,
  BottomSheetClose,
} from "@/components/ui/bottom-sheet";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";
import { DEMO_USERS } from "@/lib/auth/roles";

interface MobileMenuDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileMenuDrawer({ open, onOpenChange }: MobileMenuDrawerProps) {
  const { user, switchUser, logout } = useAuth();
  const pathname = usePathname();
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent className="max-h-[85vh] overflow-y-auto">
        <BottomSheetHeader className="border-b border-border/50 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-10 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                {user?.name?.slice(0, 2).toUpperCase() || "ND"}
              </div>
              <div className="min-w-0">
                <BottomSheetTitle className="text-sm font-semibold truncate">
                  {user?.name || "Người dùng QCET"}
                </BottomSheetTitle>
                <BottomSheetDescription className="text-xs truncate">
                  {user?.title || "Cán bộ giảng viên"} • {user?.department || "Trường CĐ Kỹ thuật Cao Thắng"}
                </BottomSheetDescription>
              </div>
            </div>
            <BottomSheetClose className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
              <X size={18} />
            </BottomSheetClose>
          </div>
        </BottomSheetHeader>

        <div className="p-4 space-y-4">
          {/* Quick Demo Role Switcher */}
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-primary" />
              CHUYỂN VAI TRÒ TRẢI NGHIỆM
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {DEMO_USERS.map((demo) => {
                const isCurrent = user?.id === demo.id;
                return (
                  <button
                    key={demo.id}
                    type="button"
                    onClick={() => {
                      switchUser(demo.id);
                      onOpenChange(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs transition-colors border",
                      isCurrent
                        ? "bg-primary/10 border-primary/40 text-primary font-semibold"
                        : "bg-muted/30 hover:bg-muted/60 border-border/40 text-foreground"
                    )}
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{demo.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {demo.title} • {demo.department}
                      </div>
                    </div>
                    {isCurrent && (
                      <span className="size-2 rounded-full bg-primary shrink-0 ml-2" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Core App Navigation Shortcuts */}
          <div className="space-y-1 pt-1 border-t border-border/40">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1 pb-1">
              LỐI TẮT HỆ THỐNG
            </div>
            <Link
              href="/schedule"
              onClick={() => onOpenChange(false)}
              className="flex items-center justify-between p-3 rounded-xl hover:bg-muted text-xs font-medium text-foreground transition-colors"
            >
              <div className="flex items-center gap-3">
                <Calendar size={17} className="text-primary" />
                <span>Lịch công tác tuần</span>
              </div>
              <ChevronRight size={14} className="text-muted-foreground" />
            </Link>
            <Link
              href="/organization"
              onClick={() => onOpenChange(false)}
              className="flex items-center justify-between p-3 rounded-xl hover:bg-muted text-xs font-medium text-foreground transition-colors"
            >
              <div className="flex items-center gap-3">
                <Building2 size={17} className="text-primary" />
                <span>Cơ cấu tổ chức & Đơn vị</span>
              </div>
              <ChevronRight size={14} className="text-muted-foreground" />
            </Link>
            <Link
              href="/documents"
              onClick={() => onOpenChange(false)}
              className="flex items-center justify-between p-3 rounded-xl hover:bg-muted text-xs font-medium text-foreground transition-colors"
            >
              <div className="flex items-center gap-3">
                <FileText size={17} className="text-primary" />
                <span>Văn bản & Điều hành</span>
              </div>
              <ChevronRight size={14} className="text-muted-foreground" />
            </Link>
            <Link
              href="/settings"
              onClick={() => onOpenChange(false)}
              className="flex items-center justify-between p-3 rounded-xl hover:bg-muted text-xs font-medium text-foreground transition-colors"
            >
              <div className="flex items-center gap-3">
                <Settings size={17} className="text-primary" />
                <span>Cài đặt hệ thống</span>
              </div>
              <ChevronRight size={14} className="text-muted-foreground" />
            </Link>
          </div>

          {/* Preferences & Actions */}
          <div className="space-y-2 pt-2 border-t border-border/40">
            <button
              type="button"
              onClick={toggleTheme}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-muted/40 hover:bg-muted/70 text-xs font-medium text-foreground transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                {isDark ? (
                  <Sun size={17} className="text-amber-500" />
                ) : (
                  <Moon size={17} className="text-indigo-500" />
                )}
                <span>Giao diện: {isDark ? "Tối (Dark Mode)" : "Sáng (Light Mode)"}</span>
              </div>
              <span className="text-[11px] text-muted-foreground font-mono">Đổi</span>
            </button>

            <button
              type="button"
              onClick={() => {
                logout();
                onOpenChange(false);
              }}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 text-xs font-semibold transition-colors cursor-pointer"
            >
              <LogOut size={16} />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      </BottomSheetContent>
    </BottomSheet>
  );
}
```

- [ ] **Step 4: Chạy test xác nhận thành công**

Run: `npx tsx --test tests/mobile-menu-drawer.test.ts`
Expected: PASS

- [ ] **Step 5: Kiểm tra typecheck và commit**

Run: `npm run typecheck`
```bash
git add src/components/layout/mobile-menu-drawer.tsx tests/mobile-menu-drawer.test.ts
git commit -m "feat(layout): implement MobileMenuDrawer with role switcher and quick links"
```

---

### Task 4: Xây Dựng `MobileBottomNav` (Thanh Điều Hướng Đáy 5 Điểm Chạm)

**Files:**
- Create: `src/components/layout/mobile-bottom-nav.tsx`
- Create: `tests/mobile-bottom-nav.test.ts`

**Interfaces:**
- Consumes: `useAuth`, `usePathname`, `useSearchParams`, `MobileMenuDrawer`
- Produces: `MobileBottomNav` component fixed at viewport bottom with safe area padding

- [ ] **Step 1: Viết test cho MobileBottomNav**

Tạo `tests/mobile-bottom-nav.test.ts`:
```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { MobileBottomNav } from "../src/components/layout/mobile-bottom-nav";

test("MobileBottomNav is defined and exports correctly", () => {
  assert.equal(typeof MobileBottomNav, "function");
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `npx tsx --test tests/mobile-bottom-nav.test.ts`
Expected: FAIL (Cannot find module)

- [ ] **Step 3: Triển khai `src/components/layout/mobile-bottom-nav.tsx`**

```tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Home,
  CheckSquare,
  Zap,
  Bell,
  Menu,
  Plus,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { isExecutiveUser, isManagerUser } from "@/lib/auth/roles";
import { MobileMenuDrawer } from "@/components/layout/mobile-menu-drawer";
import { cn } from "@/lib/utils";

export function MobileBottomNav({ className }: { className?: string }) {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const isExecutive = isExecutiveUser(user);
  const isManager = isManagerUser(user);
  const isApprover = isExecutive || isManager;

  const zoneParam = searchParams?.get("zone");
  const isHomeActive = pathname === "/" && !zoneParam;
  const isTasksActive = pathname === "/" && zoneParam === "tasks";
  const isNotificationsActive = pathname.startsWith("/notifications");

  const handleCenterAction = () => {
    if (isApprover) {
      // BGH / Trưởng đơn vị: mở Hàng đợi duyệt nhanh
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("qcet:open-briefing-modal"));
      }
    } else {
      // Giảng viên: Tạo việc / báo cáo nhanh
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("qcet:open-submit-deliverable"));
      }
    }
  };

  return (
    <>
      <nav
        aria-label="Thanh điều hướng di động"
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 bg-card/95 backdrop-blur-lg border-t border-border/70 shadow-lg",
          "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          className
        )}
      >
        <div className="grid grid-cols-5 items-center h-14 px-2 max-w-lg mx-auto">
          {/* 1. Tổng quan */}
          <Link
            href="/"
            aria-label="Trang tổng quan"
            aria-current={isHomeActive ? "page" : undefined}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 h-full transition-colors active:scale-95 touch-manipulation",
              isHomeActive ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Home size={20} strokeWidth={isHomeActive ? 2.2 : 1.7} />
            <span className="text-[10px] tracking-tight">Tổng quan</span>
          </Link>

          {/* 2. Công việc */}
          <Link
            href="/?zone=tasks"
            aria-label="Danh sách công việc"
            aria-current={isTasksActive ? "page" : undefined}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 h-full transition-colors active:scale-95 touch-manipulation",
              isTasksActive ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <CheckSquare size={20} strokeWidth={isTasksActive ? 2.2 : 1.7} />
            <span className="text-[10px] tracking-tight">Công việc</span>
          </Link>

          {/* 3. Center Action Pill (Duyệt nhanh / Tạo việc) */}
          <div className="flex items-center justify-center -mt-4">
            <button
              type="button"
              onClick={handleCenterAction}
              aria-label={isApprover ? "Phê duyệt nhanh" : "Tạo việc mới"}
              className={cn(
                "size-12 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-90 cursor-pointer touch-manipulation",
                isApprover
                  ? "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/25"
                  : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/25"
              )}
            >
              {isApprover ? <Zap size={22} className="fill-current" /> : <Plus size={24} />}
            </button>
          </div>

          {/* 4. Thông báo */}
          <Link
            href="/notifications"
            aria-label="Thông báo hệ thống"
            aria-current={isNotificationsActive ? "page" : undefined}
            className={cn(
              "relative flex flex-col items-center justify-center gap-0.5 h-full transition-colors active:scale-95 touch-manipulation",
              isNotificationsActive ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="relative">
              <Bell size={20} strokeWidth={isNotificationsActive ? 2.2 : 1.7} />
              <span className="absolute -top-1 -right-1 size-2 rounded-full bg-rose-500" />
            </div>
            <span className="text-[10px] tracking-tight">Thông báo</span>
          </Link>

          {/* 5. Menu mở rộng */}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Menu mở rộng và tài khoản"
            className="flex flex-col items-center justify-center gap-0.5 h-full text-muted-foreground hover:text-foreground transition-colors active:scale-95 touch-manipulation cursor-pointer"
          >
            <Menu size={20} strokeWidth={1.7} />
            <span className="text-[10px] tracking-tight">Thêm</span>
          </button>
        </div>
      </nav>

      {/* Mobile Menu Drawer Sheet */}
      <MobileMenuDrawer open={menuOpen} onOpenChange={setMenuOpen} />
    </>
  );
}
```

- [ ] **Step 4: Chạy test xác nhận thành công**

Run: `npx tsx --test tests/mobile-bottom-nav.test.ts`
Expected: PASS

- [ ] **Step 5: Kiểm tra typecheck và commit**

Run: `npm run typecheck`
```bash
git add src/components/layout/mobile-bottom-nav.tsx tests/mobile-bottom-nav.test.ts
git commit -m "feat(layout): implement MobileBottomNav with 5-point thumb navigation and safe areas"
```

---

### Task 5: Chuyển Đổi Scope Switcher Sang Mobile Bottom Sheet & Tích Hợp AppShell

**Files:**
- Modify: `src/components/layout/scope-switcher.tsx`
- Modify: `src/components/layout/app-shell.tsx`
- Modify: `src/components/layout/app-topbar.tsx`
- Create: `tests/scope-switcher-mobile.test.ts`

**Interfaces:**
- Consumes: `BottomSheet`, `MobileBottomNav`
- Produces: Seamless responsive layout in `AppShell` with bottom padding `pb-28 md:pb-8`

- [ ] **Step 1: Viết test cho Scope Switcher trên mobile**

Tạo `tests/scope-switcher-mobile.test.ts`:
```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveScopeDetails } from "../src/components/layout/scope-switcher";

test("resolveScopeDetails correctly formats short label for mobile view", () => {
  const mockUser = {
    id: "user_gv_1",
    name: "ThS. Lê Văn Phó",
    email: "lvpho@caothang.edu.vn",
    role: "LECTURER" as const,
    title: "Giảng viên",
    department: "Khoa Công nghệ Thông tin",
    departmentCode: "K_CNTT",
  };

  const details = resolveScopeDetails("unit", "K_CNTT", mockUser);
  assert.equal(details.scope, "unit");
  assert.ok(details.triggerLabel.includes("Khoa CNTT"));
});
```

- [ ] **Step 2: Chạy test để xác nhận**

Run: `npx tsx --test tests/scope-switcher-mobile.test.ts`
Expected: PASS

- [ ] **Step 3: Tích hợp BottomSheet vào `ScopeSwitcher` cho màn hình nhỏ**

Trong `src/components/layout/scope-switcher.tsx`:
- Sử dụng Hook hoặc MediaQuery `< md` để khi chạm trên di động, kích hoạt `BottomSheet` thay vì popover tuyệt đối bị tràn màn hình.
- Giữ nguyên popover trên `>= md`.

- [ ] **Step 4: Cập nhật `src/components/layout/app-shell.tsx`**

Cập nhật `AppShell` để tích hợp `MobileBottomNav` và đệm khoảng trống đáy:
```tsx
// Cập nhật thẻ <main>:
<main id="main-content" className="flex-1 py-4 md:py-8 pb-28 md:pb-8" tabIndex={-1}>
  <div className="max-w-[1440px] w-full mx-auto px-3.5 sm:px-6">
    {children}
  </div>
</main>

{/* Thêm MobileBottomNav: */}
<React.Suspense fallback={null}>
  <MobileBottomNav className="flex md:hidden" />
</React.Suspense>
```

- [ ] **Step 5: Kiểm tra typecheck và toàn bộ test suite**

Run: `npm run typecheck && npm test`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/scope-switcher.tsx src/components/layout/app-shell.tsx tests/scope-switcher-mobile.test.ts
git commit -m "feat(layout): integrate MobileBottomNav and responsive BottomSheet for ScopeSwitcher"
```

---

### Task 6: Kiểm Thử Toàn Diện Trên Viewport Di Động (E2E & Verification)

**Files:**
- Create: `tests/mobile-viewport-e2e.test.ts`

- [ ] **Step 1: Viết test kiểm tra kích thước và bố cục Mobile-First**

Tạo `tests/mobile-viewport-e2e.test.ts`:
```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import manifest from "../src/app/manifest";
import { viewport } from "../src/app/layout";

test("Mobile configuration meets Apple HIG and PWA standards", () => {
  const pwa = manifest();
  assert.equal(pwa.display, "standalone");
  assert.equal(viewport.viewportFit, "cover");
  assert.equal(viewport.initialScale, 1);
  assert.equal(viewport.maximumScale, 1);
});
```

- [ ] **Step 2: Chạy toàn bộ test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Chạy typecheck nghiệm thu**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 4: Commit hoàn tất**

```bash
git add tests/mobile-viewport-e2e.test.ts
git commit -m "test(mobile): verify PWA standards and mobile viewport constraints"
```
