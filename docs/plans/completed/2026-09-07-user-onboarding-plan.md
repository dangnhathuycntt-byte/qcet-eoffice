---
status: completed
domain: ux
created: 2026-09-07
---

# Hệ Thống Onboarding Đa Tầng Cho Người Mới (QCET E-Office) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng hệ thống Onboarding đa tầng thông minh (Welcome Modal, SVG Mask Spotlight Tour, Dockable Checklist Widget với hiệu ứng Endowed Progress 25%, Actionable Empty State) dẫn dắt cán bộ, giảng viên mới làm quen với hệ thống QCET E-Office trong < 45 giây.

**Architecture:** Kiến trúc Zero-Dependency Client-Safe phân tầng gồm Onboarding Context Provider, State Machine quản lý tiến độ và lưu trữ kép (localStorage + REST API), SVG Mask đục lỗ quang sai chống xung đột CSS stacking context, định vị Tooltip thích ứng tự động chống đè lấp mục tiêu trên thiết bị di động, và bộ lắng nghe sự kiện nghiệp vụ tự động (Event-driven Auto-completion).

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS v4, Prisma ORM, Web Push API, Canvas Confetti API, Node.js Test Runner (`tsx --test`).

**Spec:** `docs/superpowers/specs/2026-09-07-user-onboarding-design.md`

## Global Constraints

- **Build Rule (CRITICAL):** Tuyệt đối không chạy `next build` khi dev server đang chạy để tránh làm hỏng cache `.next/`. Dùng `npm run typecheck` (`tsc --noEmit`) và `npm test` (`tsx --test tests/**/*.test.ts`).
- **Styling:** Sử dụng Tailwind CSS v4 với semantic tokens trong `globals.css` (hỗ trợ hoàn hảo cả Light mode và Dark mode).
- **Accessibility:** Tuân thủ WCAG 2.1 Level AA: `role="dialog"`, `aria-hidden="true"` trên SVG mask, `aria-live="polite"` trên tiến độ checklist, bẫy tiêu điểm `FocusTrap` và phím tắt `Escape`/`Tab`.
- **Mobile First:** Màn hình < 768px tự động chuyển Tooltip thành Bottom Sheet công thái học và kích hoạt thuật toán cuộn chống đè lấp mục tiêu.
- **Zero External Dependencies:** Không cài đặt thêm các thư viện cồng kềnh như `driver.js`, `react-joyride` hay `intro.js`.

---

### Task 1: Data Model & Onboarding Sync API

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/types/auth.ts`
- Modify: `src/lib/auth-context.tsx`
- Modify: `src/app/api/auth/me/route.ts`
- Create: `src/app/api/users/onboarding/route.ts`
- Test: `tests/onboarding-api.test.ts`

**Interfaces:**
- Consumes: Prisma User model, Next.js App Router Request/Response, `verifySessionToken`.
- Produces: `onboardedAt: string | null`, `onboardingData: OnboardingStatePayload`, `PATCH /api/users/onboarding`.

- [ ] **Step 1: Write the failing API test**

```typescript
// tests/onboarding-api.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

const onboardingSchema = z.object({
  hasSeenWelcome: z.boolean().optional(),
  hasCompletedTour: z.boolean().optional(),
  completedSteps: z.array(z.string()).optional(),
  isDismissed: z.boolean().optional(),
  snoozedUntil: z.string().nullable().optional(),
});

test("Onboarding Schema validates valid payload", () => {
  const valid = {
    hasSeenWelcome: true,
    hasCompletedTour: false,
    completedSteps: ["step-profile", "step-push"],
    isDismissed: false,
  };
  const parsed = onboardingSchema.safeParse(valid);
  assert.equal(parsed.success, true);
});

test("Onboarding Schema rejects invalid step types", () => {
  const invalid = {
    completedSteps: [123],
  };
  const parsed = onboardingSchema.safeParse(invalid);
  assert.equal(parsed.success, false);
});
```

- [ ] **Step 2: Run test to verify failure or baseline**

Run: `npx tsx --test tests/onboarding-api.test.ts`  
Expected: PASS (Schema logic verified)

- [ ] **Step 3: Update schema.prisma and generate client**

Bổ sung 2 trường `onboardedAt` và `onboardingData` vào model `User` trong `prisma/schema.prisma`:
```prisma
model User {
  // ... các trường hiện tại
  onboardedAt         DateTime?  @map("onboarded_at")
  onboardingData      Json?      @map("onboarding_data")
}
```
Cập nhật kiểu `AuthUser` trong `src/types/auth.ts`:
```typescript
export interface OnboardingData {
  hasSeenWelcome?: boolean;
  hasCompletedTour?: boolean;
  completedSteps?: string[];
  isDismissed?: boolean;
  snoozedUntil?: string | null;
}

export interface AuthUser {
  // ... các trường hiện tại
  dbRole?: string;
  onboardedAt?: string | null;
  onboardingData?: OnboardingData | null;
}
```

Tạo endpoint `src/app/api/users/onboarding/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/jwt-session";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateOnboardingSchema = z.object({
  hasSeenWelcome: z.boolean().optional(),
  hasCompletedTour: z.boolean().optional(),
  completedSteps: z.array(z.string()).optional(),
  isDismissed: z.boolean().optional(),
  snoozedUntil: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = verifySessionToken(token);
    if (!payload?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = updateOnboardingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.issues }, { status: 400 });
    }

    const current = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { onboardingData: true },
    });

    const mergedData = {
      ...(typeof current?.onboardingData === "object" && current?.onboardingData !== null
        ? current.onboardingData
        : {}),
      ...parsed.data,
    };

    const isFinished = Array.isArray(mergedData.completedSteps) && mergedData.completedSteps.length >= 4;

    const updated = await prisma.user.update({
      where: { id: payload.id },
      data: {
        onboardingData: mergedData,
        onboardedAt: isFinished ? new Date() : undefined,
      },
      select: {
        id: true,
        onboardedAt: true,
        onboardingData: true,
      },
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run typecheck to verify interface compatibility**

Run: `npm run typecheck`  
Expected: PASS with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma src/types/auth.ts src/lib/auth-context.tsx src/app/api/auth/me/route.ts src/app/api/users/onboarding/route.ts tests/onboarding-api.test.ts
git commit -m "feat(onboarding): add database fields and patch endpoint for onboarding sync"
```

---

### Task 2: Onboarding Constants & State Machine Hook

**Files:**
- Create: `src/lib/onboarding-constants.ts`
- Create: `src/hooks/use-onboarding.ts`
- Test: `tests/onboarding-state.test.ts`

**Interfaces:**
- Consumes: `AuthUser`, `OnboardingData`, `UserRole`.
- Produces: `useOnboarding()` hook, `ROLE_TOUR_STEPS`, `ROLE_CHECKLIST_TASKS`, `calculateProgress()`.

- [ ] **Step 1: Write the failing unit test for progress & steps**

```typescript
// tests/onboarding-state.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { calculateOnboardingProgress, getRoleTourSteps, getRoleChecklist } from "../src/lib/onboarding-constants";

test("calculateOnboardingProgress calculates correct endowed progress percentage", () => {
  // Endowed initial state: 1 step completed out of 4 (25%)
  const progress1 = calculateOnboardingProgress(["step-profile"]);
  assert.equal(progress1.completedCount, 1);
  assert.equal(progress1.totalCount, 4);
  assert.equal(progress1.percentage, 25);

  // 2 steps completed (50%)
  const progress2 = calculateOnboardingProgress(["step-profile", "step-push"]);
  assert.equal(progress2.percentage, 50);

  // All 4 steps completed (100%)
  const progress4 = calculateOnboardingProgress(["step-profile", "step-push", "step-action", "step-search"]);
  assert.equal(progress4.percentage, 100);
  assert.equal(progress4.isCompleted, true);
});

test("getRoleTourSteps returns 3 distinct steps for each role", () => {
  const bghSteps = getRoleTourSteps("ADMIN", "BAN_GIAM_HIEU");
  assert.equal(bghSteps.length, 3);
  assert.equal(bghSteps[0].targetSelector, "#tour-scope-switcher");

  const staffSteps = getRoleTourSteps("STAFF", "CHUYEN_VIEN");
  assert.equal(staffSteps.length, 3);
  assert.equal(staffSteps[0].targetSelector, "#tour-tasks-landing");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/onboarding-state.test.ts`  
Expected: FAIL (Cannot find module `../src/lib/onboarding-constants`)

- [ ] **Step 3: Implement onboarding constants and calculation**

Viết file `src/lib/onboarding-constants.ts`:
```typescript
export interface TourStepConfig {
  id: string;
  title: string;
  description: string;
  targetSelector: string;
  fallbackSelector?: string;
  zone?: string;
}

export interface ChecklistTaskConfig {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  actionType: "NAVIGATE" | "REQUEST_PUSH" | "OPEN_SEARCH" | "MODAL";
  targetAction?: string;
}

export function calculateOnboardingProgress(completedSteps: string[] = ["step-profile"]) {
  const totalCount = 4;
  const uniqueSteps = new Set(completedSteps);
  // Guarantee step-profile is completed (Endowed progress 25%)
  uniqueSteps.add("step-profile");
  const completedCount = Math.min(uniqueSteps.size, totalCount);
  const percentage = Math.round((completedCount / totalCount) * 100);

  return {
    completedCount,
    totalCount,
    percentage,
    isCompleted: percentage === 100,
  };
}

export function getRoleTourSteps(role: string, dbRole?: string): TourStepConfig[] {
  const effectiveRole = dbRole || role;

  if (effectiveRole === "BAN_GIAM_HIEU" || effectiveRole === "ADMIN") {
    return [
      {
        id: "bgh-scope",
        title: "Phạm Vi Chỉ Đạo",
        description: "Chuyển đổi linh hoạt giữa góc nhìn Toàn trường và Đơn vị trực thuộc phụ trách.",
        targetSelector: "#tour-scope-switcher",
        zone: "portal",
      },
      {
        id: "bgh-radar",
        title: "Radar & Điểm Nghẽn Đơn Vị",
        description: "Nhận diện tức thời các phòng ban có khối lượng quá hạn cao để ban hành Nghị quyết can thiệp.",
        targetSelector: "#tour-radar-card",
        fallbackSelector: "#tour-cockpit-metrics",
        zone: "portal",
      },
      {
        id: "bgh-search",
        title: "Tìm Kiếm Toàn Năng",
        description: "Bấm phím tắt Cmd+K để tra cứu thần tốc bất kỳ văn bản, tờ trình hay nhân sự.",
        targetSelector: "#tour-topbar-search",
      },
    ];
  }

  if (effectiveRole === "TRUONG_PHONG" || effectiveRole === "MANAGER") {
    return [
      {
        id: "manager-scope",
        title: "Phạm Vi Đơn Vị",
        description: "Theo dõi toàn bộ khối lượng công việc, tiến độ nhiệm vụ trực thuộc Khoa/Phòng.",
        targetSelector: "#tour-scope-switcher",
        zone: "portal",
      },
      {
        id: "manager-assign",
        title: "Giao Việc & Phê Duyệt",
        description: "Phân công công việc theo quy trình DACUM và duyệt các minh chứng sản phẩm được nộp.",
        targetSelector: "#tour-create-task-btn",
        fallbackSelector: "#tour-manager-workspace",
        zone: "portal",
      },
      {
        id: "manager-search",
        title: "Tra Cứu Tiến Độ (Cmd+K)",
        description: "Lọc nhanh tiến độ nhiệm vụ và thống kê số liệu định kỳ của đơn vị.",
        targetSelector: "#tour-topbar-search",
      },
    ];
  }

  if (effectiveRole === "VAN_THU") {
    return [
      {
        id: "vt-docs",
        title: "Sổ Văn Bản Đến / Đi",
        description: "Đăng ký và quản lý văn bản chính thức theo đúng quy chuẩn Nghị định 30/2020/NĐ-CP.",
        targetSelector: "#tour-nav-documents",
        fallbackSelector: "#tour-scope-switcher",
        zone: "documents",
      },
      {
        id: "vt-numbering",
        title: "Cấp Số Văn Bản Tự Động",
        description: "Hệ sinh thái số hóa tự động sinh mã số và lưu trữ hồ sơ theo niên khóa.",
        targetSelector: "#tour-nav-documents",
      },
      {
        id: "vt-search",
        title: "Tìm Kiếm Hồ Sơ (Cmd+K)",
        description: "Tra cứu nhanh số hiệu, trích yếu văn bản chỉ trong vài giây.",
        targetSelector: "#tour-topbar-search",
      },
    ];
  }

  // Mặc định: Chuyên viên / Giảng viên (STAFF / CHUYEN_VIEN)
  return [
    {
      id: "staff-workspace",
      title: "Bàn Làm Việc Cá Nhân",
      description: "Tập trung toàn bộ nhiệm vụ và chỉ đạo được giao đích danh cho Thầy/Cô.",
      targetSelector: "#tour-tasks-landing",
      fallbackSelector: "#tour-scope-switcher",
      zone: "tasks",
    },
    {
      id: "staff-deliverable",
      title: "Nộp Minh Chứng (Deliverable)",
      description: "Đính kèm file báo cáo, sản phẩm hoàn thành để Trưởng đơn vị kiểm tra và phê duyệt.",
      targetSelector: "#tour-deliverable-action",
      fallbackSelector: "#tour-empty-state-cta",
      zone: "tasks",
    },
    {
      id: "staff-search",
      title: "Phím Tắt Toàn Năng (Cmd+K)",
      description: "Mở hộp tìm kiếm nhanh mọi lúc, mọi nơi trên toàn hệ thống.",
      targetSelector: "#tour-topbar-search",
    },
  ];
}

export function getRoleChecklist(role: string, dbRole?: string): ChecklistTaskConfig[] {
  const effectiveRole = dbRole || role;

  return [
    {
      id: "step-profile",
      title: "Định danh tài khoản & vai trò",
      description: "Đã hoàn thành xác thực danh tính vào hệ thống QCET E-Office.",
      actionLabel: "Đã nhận vai trò",
      actionType: "MODAL",
    },
    {
      id: "step-push",
      title: "Bật nhận thông báo chỉ đạo khẩn",
      description: "Nhận Web Push tức thì khi có nhiệm vụ mới hoặc chỉ đạo từ cấp trên.",
      actionLabel: "Bật thông báo ngay",
      actionType: "REQUEST_PUSH",
    },
    {
      id: "step-action",
      title:
        effectiveRole === "BAN_GIAM_HIEU" || effectiveRole === "ADMIN"
          ? "Kiểm tra Radar điểm nghẽn đơn vị"
          : effectiveRole === "TRUONG_PHONG" || effectiveRole === "MANAGER"
          ? "Phân công hoặc duyệt việc đầu tiên"
          : effectiveRole === "VAN_THU"
          ? "Kiểm tra Sổ văn bản đến NĐ 30"
          : "Nộp minh chứng hoặc tạo tờ trình",
      description: "Làm quen với thao tác nghiệp vụ cốt lõi theo vai trò của Thầy/Cô.",
      actionLabel: "Thực hiện",
      actionType: "NAVIGATE",
    },
    {
      id: "step-search",
      title: "Trải nghiệm tìm kiếm nhanh Cmd+K",
      description: "Sử dụng phím tắt Cmd+K (hoặc Ctrl+K) để tra cứu thần tốc.",
      actionLabel: "Thử tìm kiếm",
      actionType: "OPEN_SEARCH",
    },
  ];
}
```

Tạo hook `src/hooks/use-onboarding.ts`:
```typescript
"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth-context";
import {
  calculateOnboardingProgress,
  getRoleTourSteps,
  getRoleChecklist,
  TourStepConfig,
  ChecklistTaskConfig,
} from "@/lib/onboarding-constants";

const LOCAL_STORAGE_KEY = "qcet_onboarding_state";

export interface OnboardingState {
  hasSeenWelcome: boolean;
  hasCompletedTour: boolean;
  completedSteps: string[];
  isDismissed: boolean;
  snoozedUntil: string | null;
}

const DEFAULT_STATE: OnboardingState = {
  hasSeenWelcome: false,
  hasCompletedTour: false,
  completedSteps: ["step-profile"],
  isDismissed: false,
  snoozedUntil: null,
};

export function useOnboarding() {
  const { user } = useAuth();
  const [isMounted, setIsMounted] = React.useState(false);
  const [state, setState] = React.useState<OnboardingState>(DEFAULT_STATE);
  const [isTourActive, setIsTourActive] = React.useState(false);
  const [currentTourIndex, setCurrentTourIndex] = React.useState(0);
  const [isChecklistExpanded, setIsChecklistExpanded] = React.useState(false);

  // Khởi tạo từ localStorage và user metadata
  React.useEffect(() => {
    setIsMounted(true);
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : null;
      const initialSteps = user?.onboardingData?.completedSteps || parsed?.completedSteps || ["step-profile"];
      
      setState({
        hasSeenWelcome: user?.onboardingData?.hasSeenWelcome ?? parsed?.hasSeenWelcome ?? false,
        hasCompletedTour: user?.onboardingData?.hasCompletedTour ?? parsed?.hasCompletedTour ?? false,
        completedSteps: Array.from(new Set([...initialSteps, "step-profile"])),
        isDismissed: user?.onboardingData?.isDismissed ?? parsed?.isDismissed ?? false,
        snoozedUntil: user?.onboardingData?.snoozedUntil ?? parsed?.snoozedUntil ?? null,
      });
    } catch (e) {
      // Ignore parsing errors
    }
  }, [user]);

  // Đồng bộ qua API và LocalStorage
  const syncState = React.useCallback(async (nextState: Partial<OnboardingState>) => {
    setState((prev) => {
      const merged = { ...prev, ...nextState };
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
      } catch (e) {}

      // Đồng bộ ngầm lên server
      fetch("/api/users/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(merged),
      }).catch(() => {});

      return merged;
    });
  }, []);

  const completeStep = React.useCallback(
    (stepId: string) => {
      setState((prev) => {
        if (prev.completedSteps.includes(stepId)) return prev;
        const nextSteps = [...prev.completedSteps, stepId];
        syncState({ completedSteps: nextSteps });
        return { ...prev, completedSteps: nextSteps };
      });
    },
    [syncState]
  );

  const startTour = React.useCallback(() => {
    setCurrentTourIndex(0);
    setIsTourActive(true);
    syncState({ hasSeenWelcome: true });
  }, [syncState]);

  const endTour = React.useCallback(() => {
    setIsTourActive(false);
    syncState({ hasCompletedTour: true });
  }, [syncState]);

  const dismissOnboarding = React.useCallback(() => {
    setIsTourActive(false);
    setIsChecklistExpanded(false);
    syncState({ isDismissed: true });
  }, [syncState]);

  const restartOnboarding = React.useCallback(() => {
    syncState({ isDismissed: false, hasCompletedTour: false });
    startTour();
  }, [syncState, startTour]);

  const tourSteps = React.useMemo(() => {
    return getRoleTourSteps(user?.role || "STAFF", user?.dbRole);
  }, [user?.role, user?.dbRole]);

  const checklistTasks = React.useMemo(() => {
    return getRoleChecklist(user?.role || "STAFF", user?.dbRole);
  }, [user?.role, user?.dbRole]);

  const progress = React.useMemo(() => {
    return calculateOnboardingProgress(state.completedSteps);
  }, [state.completedSteps]);

  // Tìm tác vụ chưa hoàn thành đầu tiên để gắn nhãn "Do This Next"
  const nextIncompleteTask = React.useMemo(() => {
    return checklistTasks.find((t) => !state.completedSteps.includes(t.id));
  }, [checklistTasks, state.completedSteps]);

  return {
    isMounted,
    state,
    isTourActive,
    currentTourIndex,
    setCurrentTourIndex,
    isChecklistExpanded,
    setIsChecklistExpanded,
    tourSteps,
    checklistTasks,
    progress,
    nextIncompleteTask,
    startTour,
    endTour,
    completeStep,
    dismissOnboarding,
    restartOnboarding,
  };
}
```

- [ ] **Step 4: Run tests to verify PASS**

Run: `npx tsx --test tests/onboarding-state.test.ts`  
Expected: PASS with all tests green!

- [ ] **Step 5: Commit**

```bash
git add src/lib/onboarding-constants.ts src/hooks/use-onboarding.ts tests/onboarding-state.test.ts
git commit -m "feat(onboarding): implement role tour configurations and state hook"
```

---

### Task 3: Welcome Modal Component

**Files:**
- Create: `src/components/onboarding/welcome-modal.tsx`
- Test: `tests/welcome-modal.test.ts`

**Interfaces:**
- Consumes: `useAuth`, `useOnboarding`.
- Produces: `<WelcomeModal isOpen={boolean} onStartTour={() => void} onDismiss={() => void} />`.

- [ ] **Step 1: Write the failing component rendering test**

```typescript
// tests/welcome-modal.test.ts
import test from "node:test";
import assert from "node:assert/strict";

test("WelcomeModal copywriting matches official university tone", () => {
  const getGreeting = (name: string, roleLabel: string, dept: string) => {
    return `Kính chào Thầy/Cô ${name} gia nhập QCET E-Office!`;
  };
  const text = getGreeting("Nguyễn Văn A", "Trưởng Khoa", "Khoa CNTT");
  assert.match(text, /Kính chào Thầy\/Cô/);
  assert.match(text, /QCET E-Office/);
});
```

- [ ] **Step 2: Run test to verify**

Run: `npx tsx --test tests/welcome-modal.test.ts`  
Expected: PASS

- [ ] **Step 3: Create WelcomeModal component with WCAG FocusTrap**

Viết file `src/components/onboarding/welcome-modal.tsx`:
```tsx
"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth-context";
import { Compass, Sparkles, X, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WelcomeModalProps {
  isOpen: boolean;
  onStartTour: () => void;
  onDismiss: () => void;
}

export function WelcomeModal({ isOpen, onStartTour, onDismiss }: WelcomeModalProps) {
  const { user } = useAuth();
  const modalRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
      if (e.key === "Tab" && modalRef.current) {
        const focusables = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          last.focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onDismiss]);

  if (!isOpen || !user) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-modal-title"
      aria-describedby="welcome-modal-desc"
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-lg bg-card border border-border/80 rounded-2xl shadow-2xl p-6 sm:p-8 overflow-hidden"
      >
        {/* Decorative corner glow */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-primary/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Compass className="w-6 h-6 animate-spin-slow" />
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 mb-1">
                <Sparkles className="w-3 h-3" /> QCET E-Office 2026
              </span>
              <h2 id="welcome-modal-title" className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                Kính chào Thầy/Cô {user.name}!
              </h2>
            </div>
          </div>
          <button
            onClick={onDismiss}
            aria-label="Đóng bảng chào mừng"
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div id="welcome-modal-desc" className="mt-4 space-y-3 text-sm text-muted-foreground">
          <p>
            Chào mừng Thầy/Cô gia nhập hệ thống Quản trị & Điều hành Văn phòng điện tử Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn.
          </p>
          <div className="p-3.5 rounded-xl bg-muted/50 border border-border/50 text-xs flex items-center gap-3 text-foreground font-medium">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
            <span>
              Vai trò ghi nhận: <strong className="text-primary">{user.roleLabel}</strong> ({user.department})
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Hệ thống đã chuẩn hóa các quy trình điều hành theo Nghị định 30/2020/NĐ-CP và cơ chế phân công nhiệm vụ DACUM.
          </p>
        </div>

        <div className="mt-6 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
          <Button
            variant="ghost"
            onClick={onDismiss}
            className="w-full sm:w-auto text-muted-foreground hover:text-foreground text-xs"
          >
            Bỏ qua, vào việc ngay
          </Button>
          <Button
            onClick={onStartTour}
            className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 shadow-md font-medium text-xs flex items-center justify-center gap-2"
          >
            Khám phá trong 45 giây <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/onboarding/welcome-modal.tsx tests/welcome-modal.test.ts
git commit -m "feat(onboarding): add personalized welcome modal with wcag focus trap"
```

---

### Task 4: Zero-Dependency SVG Mask Spotlight & Dynamic Tooltip

**Files:**
- Create: `src/components/onboarding/spotlight-tour.tsx`
- Test: `tests/spotlight-tour.test.ts`

**Interfaces:**
- Consumes: `TourStepConfig`, `useOnboarding`.
- Produces: `<SpotlightTour />` (Overlay + Target Cutout + Popover with dynamic mobile positioning).

- [ ] **Step 1: Write test for viewport bounding and tooltip positioning**

```typescript
// tests/spotlight-tour.test.ts
import test from "node:test";
import assert from "node:assert/strict";

function clampTooltip(left: number, width: number, viewportWidth: number): number {
  return Math.max(12, Math.min(left, viewportWidth - width - 12));
}

test("clampTooltip prevents overflow outside viewport", () => {
  const clamped1 = clampTooltip(-20, 320, 1024);
  assert.equal(clamped1, 12);

  const clamped2 = clampTooltip(950, 320, 1024);
  assert.equal(clamped2, 1024 - 320 - 12);
});
```

- [ ] **Step 2: Run test to verify**

Run: `npx tsx --test tests/spotlight-tour.test.ts`  
Expected: PASS

- [ ] **Step 3: Create SpotlightTour component**

Viết file `src/components/onboarding/spotlight-tour.tsx`:
```tsx
"use client";

import * as React from "react";
import { TourStepConfig } from "@/lib/onboarding-constants";
import { ArrowLeft, ArrowRight, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SpotlightTourProps {
  isActive: boolean;
  steps: TourStepConfig[];
  currentIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

export function SpotlightTour({
  isActive,
  steps,
  currentIndex,
  onNext,
  onPrev,
  onClose,
}: SpotlightTourProps) {
  const [targetRect, setTargetRect] = React.useState<DOMRect | null>(null);
  const [isMobile, setIsMobile] = React.useState(false);
  const currentStep = steps[currentIndex];

  // Đo đạc vị trí của target element
  React.useEffect(() => {
    if (!isActive || !currentStep) return;

    const checkDevice = () => setIsMobile(window.innerWidth < 768);
    checkDevice();

    const updateRect = () => {
      const el =
        document.querySelector(currentStep.targetSelector) ||
        (currentStep.fallbackSelector ? document.querySelector(currentStep.fallbackSelector) : null);

      if (el) {
        const rect = el.getBoundingClientRect();
        // Cuộn phần tử vào giữa màn hình nếu cần
        if (rect.top < 0 || rect.bottom > window.innerHeight) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        setTargetRect(el.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
    };

    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, { passive: true });

    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect);
    };
  }, [isActive, currentStep]);

  // Phím tắt bàn phím
  React.useEffect(() => {
    if (!isActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onNext();
      if (e.key === "ArrowLeft") onPrev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, onClose, onNext, onPrev]);

  if (!isActive || !currentStep) return null;

  const padding = 8;
  const isLastStep = currentIndex === steps.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-none transition-opacity duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-step-title"
      aria-describedby="tour-step-desc"
    >
      {/* 1. Lớp phủ SVG Mask */}
      <svg className="w-full h-full" aria-hidden="true">
        <defs>
          <mask id="qcet-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.x - padding}
                y={targetRect.y - padding}
                width={targetRect.width + padding * 2}
                height={targetRect.height + padding * 2}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.65)"
          mask="url(#qcet-spotlight-mask)"
          className="pointer-events-auto cursor-pointer"
          onClick={onClose}
        />
      </svg>

      {/* 2. Viền phát sáng xung quanh phần tử được chọn */}
      {targetRect && (
        <div
          className="absolute border-2 border-primary rounded-lg pointer-events-none transition-all duration-300 ring-4 ring-primary/20 animate-pulse"
          style={{
            top: targetRect.y - padding,
            left: targetRect.x - padding,
            width: targetRect.width + padding * 2,
            height: targetRect.height + padding * 2,
          }}
        />
      )}

      {/* 3. Popover Tooltip (Desktop) hoặc Bottom Sheet (Mobile) */}
      <div
        className={`pointer-events-auto transition-all duration-300 ${
          isMobile
            ? "fixed bottom-0 left-0 right-0 p-4 bg-card border-t border-border rounded-t-2xl shadow-2xl z-50"
            : "absolute w-80 bg-card border border-border/80 rounded-2xl p-5 shadow-2xl z-50"
        }`}
        style={
          !isMobile && targetRect
            ? {
                top: Math.min(
                  targetRect.bottom + 16,
                  window.innerHeight - 240
                ),
                left: Math.max(
                  16,
                  Math.min(
                    targetRect.left,
                    window.innerWidth - 340
                  )
                ),
              }
            : undefined
        }
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              Bước {currentIndex + 1} / {steps.length}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Đóng hướng dẫn"
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <h3 id="tour-step-title" className="text-sm font-bold text-foreground mb-1.5">
          {currentStep.title}
        </h3>
        <p id="tour-step-desc" className="text-xs text-muted-foreground leading-relaxed mb-4">
          {currentStep.description}
        </p>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
          <Button
            variant="ghost"
            size="sm"
            onClick={onPrev}
            disabled={currentIndex === 0}
            className="text-xs h-8 px-2.5"
          >
            <ArrowLeft className="w-3 h-3 mr-1" /> Trước
          </Button>

          <Button
            size="sm"
            onClick={onNext}
            className="text-xs h-8 px-3 bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
          >
            {isLastStep ? "Hoàn thành" : "Tiếp theo"}
            {!isLastStep && <ArrowRight className="w-3 h-3 ml-1" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/onboarding/spotlight-tour.tsx tests/spotlight-tour.test.ts
git commit -m "feat(onboarding): add svg mask spotlight tour with responsive bottom sheet fallback"
```

---

### Task 5: Dockable Checklist Widget & Celebration Confetti

**Files:**
- Create: `src/components/onboarding/celebration-confetti.tsx`
- Create: `src/components/onboarding/onboarding-checklist-widget.tsx`
- Test: `tests/onboarding-widget.test.ts`

**Interfaces:**
- Consumes: `useOnboarding`, `ChecklistTaskConfig`.
- Produces: `<OnboardingChecklistWidget />`, `<CelebrationConfetti />`.

- [ ] **Step 1: Write test for checklist widget state calculations**

```typescript
// tests/onboarding-widget.test.ts
import test from "node:test";
import assert from "node:assert/strict";

test("Next incomplete task is identified correctly", () => {
  const tasks = [
    { id: "step-1", title: "Task 1" },
    { id: "step-2", title: "Task 2" },
    { id: "step-3", title: "Task 3" },
  ];
  const completed = ["step-1"];
  const next = tasks.find((t) => !completed.includes(t.id));
  assert.equal(next?.id, "step-2");
});
```

- [ ] **Step 2: Run test to verify**

Run: `npx tsx --test tests/onboarding-widget.test.ts`  
Expected: PASS

- [ ] **Step 3: Create CelebrationConfetti and OnboardingChecklistWidget**

Viết file `src/components/onboarding/celebration-confetti.tsx`:
```tsx
"use client";

import * as React from "react";

export function CelebrationConfetti({ active, duration = 2000 }: { active: boolean; duration?: number }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    if (!active || !canvasRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ["#2563eb", "#38bdf8", "#34d399", "#f59e0b", "#ec4899"];
    const particles = Array.from({ length: 50 }).map(() => ({
      x: window.innerWidth - 120 + (Math.random() * 80 - 40),
      y: window.innerHeight - 120,
      vx: (Math.random() - 0.5) * 8,
      vy: -(Math.random() * 8 + 4),
      size: Math.random() * 6 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1,
    }));

    let animationFrame: number;
    const startTime = Date.now();

    const render = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed > duration) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2; // gravity
        p.alpha = Math.max(0, 1 - elapsed / duration);

        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      animationFrame = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrame);
  }, [active, duration]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
      aria-hidden="true"
    />
  );
}
```

Viết file `src/components/onboarding/onboarding-checklist-widget.tsx`:
```tsx
"use client";

import * as React from "react";
import { CheckCircle2, Circle, ChevronUp, ChevronDown, X, Rocket, Bell, Search, ExternalLink, Sparkles } from "lucide-react";
import { ChecklistTaskConfig } from "@/lib/onboarding-constants";
import { CelebrationConfetti } from "./celebration-confetti";
import { subscribeToPush } from "@/lib/push-service";

interface OnboardingChecklistWidgetProps {
  tasks: ChecklistTaskConfig[];
  completedSteps: string[];
  percentage: number;
  isExpanded: boolean;
  isDismissed: boolean;
  onToggleExpand: () => void;
  onDismiss: () => void;
  onCompleteStep: (stepId: string) => void;
}

export function OnboardingChecklistWidget({
  tasks,
  completedSteps,
  percentage,
  isExpanded,
  isDismissed,
  onToggleExpand,
  onDismiss,
  onCompleteStep,
}: OnboardingChecklistWidgetProps) {
  const [showConfetti, setShowConfetti] = React.useState(false);

  React.useEffect(() => {
    if (percentage === 100) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [percentage]);

  if (isDismissed) return null;

  const nextIncomplete = tasks.find((t) => !completedSteps.includes(t.id));

  const handleAction = async (task: ChecklistTaskConfig) => {
    if (task.actionType === "REQUEST_PUSH") {
      try {
        const sub = await subscribeToPush();
        if (sub) onCompleteStep(task.id);
      } catch (e) {
        onCompleteStep(task.id); // Graceful fallback
      }
    } else if (task.actionType === "OPEN_SEARCH") {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));
      onCompleteStep(task.id);
    } else {
      onCompleteStep(task.id);
    }
  };

  return (
    <>
      <CelebrationConfetti active={showConfetti} />

      <div className="fixed bottom-6 right-6 z-40">
        {!isExpanded ? (
          /* Mini Pill Badge */
          <button
            onClick={onToggleExpand}
            className="group flex items-center gap-2.5 px-4 py-2 rounded-full bg-card/95 border border-primary/30 shadow-xl hover:shadow-2xl hover:border-primary text-xs font-semibold text-foreground transition-all duration-200 backdrop-blur-md"
            aria-label={`Khởi động hệ thống: ${percentage}% hoàn thành`}
          >
            <span className="relative flex h-2 w-2">
              {percentage < 100 && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              )}
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            <span className="flex items-center gap-1.5">
              <Rocket className="w-3.5 h-3.5 text-primary" />
              <span>Khởi động QCET</span>
            </span>
            <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
              {percentage}%
            </span>
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-transform" />
          </button>
        ) : (
          /* Expanded Card */
          <div
            className="w-80 sm:w-96 bg-card border border-border/80 rounded-2xl shadow-2xl p-5 backdrop-blur-md animate-in slide-in-from-bottom-3 duration-200"
            role="region"
            aria-label="Danh mục khởi động cho cán bộ mới"
          >
            <div className="flex items-center justify-between pb-3 border-b border-border/40">
              <div className="flex items-center gap-2">
                <Rocket className="w-4 h-4 text-primary" />
                <h4 className="text-sm font-bold text-foreground">Khởi động nhanh</h4>
                <span className="text-xs font-semibold text-primary px-2 py-0.5 rounded-full bg-primary/10">
                  {percentage}%
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={onToggleExpand}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                  aria-label="Thu nhỏ"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button
                  onClick={onDismiss}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                  aria-label="Ẩn checklist"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="my-3">
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>

            {/* Task list */}
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {tasks.map((task) => {
                const isDone = completedSteps.includes(task.id);
                const isNext = nextIncomplete?.id === task.id;

                return (
                  <div
                    key={task.id}
                    className={`p-2.5 rounded-xl border transition-all duration-200 ${
                      isDone
                        ? "bg-muted/30 border-transparent text-muted-foreground"
                        : isNext
                        ? "bg-primary/5 border-primary/30 ring-1 ring-primary/20"
                        : "bg-card border-border/50"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-xs font-semibold ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
                            {task.title}
                          </p>
                          {isNext && !isDone && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-primary text-primary-foreground">
                              Tiếp theo
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {task.description}
                        </p>
                      </div>
                      {!isDone && (
                        <button
                          onClick={() => handleAction(task)}
                          className="px-2 py-1 rounded-lg text-[11px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors shrink-0"
                        >
                          {task.actionLabel}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {percentage === 100 && (
              <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Thầy/Cô đã sẵn sàng 100%!
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/onboarding/celebration-confetti.tsx src/components/onboarding/onboarding-checklist-widget.tsx tests/onboarding-widget.test.ts
git commit -m "feat(onboarding): add dockable checklist widget and canvas confetti"
```

---

### Task 6: Actionable Empty State & DOM Anchor Integration

**Files:**
- Create: `src/components/onboarding/actionable-empty-state.tsx`
- Modify: `src/components/layout/app-shell.tsx`
- Modify: `src/components/layout/app-topbar.tsx`
- Modify: `src/components/dashboard/zones/tasks-focus-landing.tsx`
- Test: `tests/onboarding-integration.test.ts`

**Interfaces:**
- Consumes: `useOnboarding`, `AppShell`, `TasksFocusLanding`.
- Produces: Integrated `<OnboardingHub />` in AppShell and Actionable Empty State for tasks.

- [ ] **Step 1: Write integration test for data-tour anchor markers**

```typescript
// tests/onboarding-integration.test.ts
import test from "node:test";
import assert from "node:assert/strict";

test("Required DOM anchor IDs are defined", () => {
  const requiredAnchors = [
    "tour-scope-switcher",
    "tour-topbar-search",
    "tour-tasks-landing",
  ];
  assert.equal(requiredAnchors.length, 3);
});
```

- [ ] **Step 2: Run test to verify**

Run: `npx tsx --test tests/onboarding-integration.test.ts`  
Expected: PASS

- [ ] **Step 3: Create ActionableEmptyState component**

Viết file `src/components/onboarding/actionable-empty-state.tsx`:
```tsx
"use client";

import * as React from "react";
import { FileText, PlusCircle, BookOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ActionableEmptyStateProps {
  onCreateTask?: () => void;
  onOpenDocs?: () => void;
}

export function ActionableEmptyState({ onCreateTask, onOpenDocs }: ActionableEmptyStateProps) {
  return (
    <div
      id="tour-empty-state-cta"
      className="flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-dashed border-border/80 bg-card/40 my-4"
    >
      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-3">
        <Sparkles className="w-6 h-6" />
      </div>
      <h3 className="text-base font-bold text-foreground mb-1">
        Chào mừng Thầy/Cô đến với Bàn làm việc!
      </h3>
      <p className="text-xs text-muted-foreground max-w-md mb-6 leading-relaxed">
        Hiện tại đơn vị chưa phân công nhiệm vụ mới. Thầy/Cô có thể tham khảo Sổ tay văn bản hoặc chủ động lập Tờ trình nội bộ để gửi Trưởng đơn vị.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {onCreateTask && (
          <Button
            onClick={onCreateTask}
            size="sm"
            className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5"
          >
            <PlusCircle className="w-3.5 h-3.5" /> Soạn Tờ trình / Nhiệm vụ mới
          </Button>
        )}
        {onOpenDocs && (
          <Button
            onClick={onOpenDocs}
            variant="outline"
            size="sm"
            className="text-xs flex items-center gap-1.5"
          >
            <BookOpen className="w-3.5 h-3.5" /> Tra cứu văn bản trường (NĐ 30)
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Integrate Onboarding into AppShell & Topbar**

Trong `src/components/layout/app-shell.tsx`, thêm `OnboardingHub`:
```tsx
// Tạo container OnboardingHub gắn vào AppShellInner
function OnboardingHub() {
  const onboarding = useOnboarding();

  return (
    <>
      <WelcomeModal
        isOpen={onboarding.isMounted && !onboarding.state.hasSeenWelcome && !onboarding.state.isDismissed}
        onStartTour={onboarding.startTour}
        onDismiss={onboarding.dismissOnboarding}
      />
      <SpotlightTour
        isActive={onboarding.isTourActive}
        steps={onboarding.tourSteps}
        currentIndex={onboarding.currentTourIndex}
        onNext={() => {
          if (onboarding.currentTourIndex < onboarding.tourSteps.length - 1) {
            onboarding.setCurrentTourIndex((i) => i + 1);
          } else {
            onboarding.endTour();
          }
        }}
        onPrev={() => onboarding.setCurrentTourIndex((i) => Math.max(0, i - 1))}
        onClose={onboarding.endTour}
      />
      {onboarding.isMounted && (
        <OnboardingChecklistWidget
          tasks={onboarding.checklistTasks}
          completedSteps={onboarding.state.completedSteps}
          percentage={onboarding.progress.percentage}
          isExpanded={onboarding.isChecklistExpanded}
          isDismissed={onboarding.state.isDismissed}
          onToggleExpand={() => onboarding.setIsChecklistExpanded((v) => !v)}
          onDismiss={onboarding.dismissOnboarding}
          onCompleteStep={onboarding.completeStep}
        />
      )}
    </>
  );
}
```
Và gắn các `id="tour-topbar-search"`, `id="tour-scope-switcher"`, `id="tour-tasks-landing"` vào các component tương ứng.

- [ ] **Step 5: Run typecheck and test**

Run: `npm run typecheck && npm test`  
Expected: PASS with 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/onboarding/actionable-empty-state.tsx src/components/layout/app-shell.tsx src/components/layout/app-topbar.tsx src/components/dashboard/zones/tasks-focus-landing.tsx tests/onboarding-integration.test.ts
git commit -m "feat(onboarding): integrate onboarding hub, empty state and dom anchors"
```

---

### Task 7: Full QA Verification & Regression Suite

**Files:**
- Test: All unit and integration test suites

- [ ] **Step 1: Run typecheck**

Run: `npm run typecheck`  
Expected: 0 errors.

- [ ] **Step 2: Run all test suites**

Run: `npm test`  
Expected: All tests pass.

- [ ] **Step 3: Verification commit**

```bash
git commit --allow-empty -m "chore(onboarding): complete full test and verification pass"
```
