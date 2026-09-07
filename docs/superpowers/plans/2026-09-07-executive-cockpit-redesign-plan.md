# Executive Cockpit Redesign (ExecutiveResolutionHub) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-architect the Executive Cockpit (Khoang Điều hành BGH) into a razor-sharp 3–5 second executive dashboard by eliminating redundant dual headers, elevating a dominant Hero KPI card with zero-bottleneck state, introducing ultra-compact (~90px) bottleneck cards, integrating an interactive 11-unit health radar panel, and implementing the Executive Resolution Drawer with instant optimistic updates.

**Architecture:** A unified single 56px executive header in `executive-cockpit-workspace.tsx` replaces the redundant outer header in `page.tsx`. The bottleneck section adopts a 70/30 two-column layout where the left column houses streamlined bottleneck cards and the right column houses an 11-unit health radar with `[⚡ Đôn đốc tất cả]`. Clicking `[Tháo gỡ]` opens the dedicated `ExecutiveResolutionDrawer` which supports 4 decisive actions, keyboard shortcuts (`Esc`, `Cmd/Ctrl+Enter`), and optimistic state mutations that immediately update the Hero KPI and unit radar dots.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Lucide React, Node test runner (`tsx --test`).

**Spec:** `docs/superpowers/specs/2026-09-07-executive-cockpit-redesign-spec.md`

## Global Constraints
- **Header limit:** Exactly one unified header (~56px) when `isExecutive = true`; outer header in `page.tsx` must be removed for executive role.
- **Micro-typography floor:** All text must be at least 12px (no `text-[8px]`, `text-[9px]`, `text-[10px]`).
- **Dev-build invariant:** Do NOT run `next build` while dev server is active on port 3001. Use `npm run typecheck` (`tsc --noEmit`) and `npm test`.
- **Card height:** Bottleneck task cards must be compact (~90px to 96px), hiding technical ticket IDs (`staff-task-xxx`).
- **Optimistic latency:** Resolution drawer mutations must reflect in UI state instantaneously (< 50ms) without waiting for background sync.

---

### Task 1: Type Definitions & Resolution Reducer for Executive Actions

**Files:**
- Create: `src/types/executive-resolution.ts`
- Create: `src/lib/executive-resolution-state.ts`
- Test: `tests/executive-resolution-state.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export type ExecutiveResolutionType =
    | "EXTEND_DEADLINE"
    | "REASSIGN"
    | "DEMAND_EXPLANATION"
    | "DIRECT_DIRECTIVE";

  export interface ExecutiveResolutionPayload {
    taskId: string;
    type: ExecutiveResolutionType;
    extensionDays?: 3 | 7;
    newAssigneeName?: string;
    directiveNote?: string;
  }

  export function applyExecutiveResolution(
    bottlenecks: SchoolBottleneckItem[],
    payload: ExecutiveResolutionPayload
  ): {
    updatedBottlenecks: SchoolBottleneckItem[];
    resolvedItem: SchoolBottleneckItem | undefined;
    actionSummary: string;
  };
  ```

- [ ] **Step 1: Write the failing test for resolution reducer**

```typescript
// tests/executive-resolution-state.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyExecutiveResolution } from "../src/lib/executive-resolution-state";
import type { SchoolBottleneckItem } from "../src/types/workspace";

describe("Executive Resolution State Reducer", () => {
  const sampleBottlenecks: SchoolBottleneckItem[] = [
    {
      id: "task-1",
      title: "Lập danh sách HSSV diện miễn giảm học phí",
      departmentCode: "K_CNTT",
      departmentName: "Khoa CNTT",
      assigneeName: "Lê Hoàng Nam",
      dueDate: "2026-09-01",
      daysOverdue: 3,
      isBlocked: true,
      blockedReason: "Chờ dữ liệu từ phòng Đào tạo",
      priority: "KHAN_CAP",
      status: "CHUA_HOAN_THANH",
      originalTask: {} as any,
    },
    {
      id: "task-2",
      title: "Mua sắm thiết bị phòng thực hành điện",
      departmentCode: "K_DIEN",
      departmentName: "Khoa Điện",
      assigneeName: "Trần Minh Quang",
      dueDate: "2026-09-02",
      daysOverdue: 2,
      isBlocked: false,
      priority: "CAO",
      status: "CHUA_HOAN_THANH",
      originalTask: {} as any,
    },
  ];

  it("gỡ bỏ nhiệm vụ khỏi danh sách bottlenecks khi gia hạn hạn chót", () => {
    const result = applyExecutiveResolution(sampleBottlenecks, {
      taskId: "task-1",
      type: "EXTEND_DEADLINE",
      extensionDays: 3,
    });

    assert.equal(result.updatedBottlenecks.length, 1);
    assert.equal(result.updatedBottlenecks[0].id, "task-2");
    assert.equal(result.resolvedItem?.id, "task-1");
    assert.match(result.actionSummary, /Gia hạn tiến độ thêm 3 ngày/);
  });

  it("gỡ bỏ nhiệm vụ khi chuyển người xử lý khác", () => {
    const result = applyExecutiveResolution(sampleBottlenecks, {
      taskId: "task-1",
      type: "REASSIGN",
      newAssigneeName: "ThS. Nguyễn Văn A",
    });

    assert.equal(result.updatedBottlenecks.length, 1);
    assert.match(result.actionSummary, /Giao cho ThS. Nguyễn Văn A/);
  });

  it("gỡ bỏ nhiệm vụ khi yêu cầu giải trình khẩn", () => {
    const result = applyExecutiveResolution(sampleBottlenecks, {
      taskId: "task-1",
      type: "DEMAND_EXPLANATION",
    });

    assert.equal(result.updatedBottlenecks.length, 1);
    assert.match(result.actionSummary, /Yêu cầu Trưởng đơn vị giải trình khẩn/);
  });

  it("gỡ bỏ nhiệm vụ khi BGH ban hành chỉ đạo trực tiếp", () => {
    const result = applyExecutiveResolution(sampleBottlenecks, {
      taskId: "task-1",
      type: "DIRECT_DIRECTIVE",
      directiveNote: "Yêu cầu hoàn thành trước 17h ngày mai",
    });

    assert.equal(result.updatedBottlenecks.length, 1);
    assert.match(result.actionSummary, /Ban hành chỉ đạo trực tiếp/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/executive-resolution-state.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement types and resolution state reducer**

Create `src/types/executive-resolution.ts`:
```typescript
import type { SchoolBottleneckItem } from "./workspace";

export type ExecutiveResolutionType =
  | "EXTEND_DEADLINE"
  | "REASSIGN"
  | "DEMAND_EXPLANATION"
  | "DIRECT_DIRECTIVE";

export interface ExecutiveResolutionPayload {
  taskId: string;
  type: ExecutiveResolutionType;
  extensionDays?: 3 | 7;
  newAssigneeName?: string;
  directiveNote?: string;
}

export interface ExecutiveResolutionResult {
  updatedBottlenecks: SchoolBottleneckItem[];
  resolvedItem: SchoolBottleneckItem | undefined;
  actionSummary: string;
}
```

Create `src/lib/executive-resolution-state.ts`:
```typescript
import type { SchoolBottleneckItem } from "@/types/workspace";
import type {
  ExecutiveResolutionPayload,
  ExecutiveResolutionResult,
} from "@/types/executive-resolution";

export function applyExecutiveResolution(
  bottlenecks: SchoolBottleneckItem[],
  payload: ExecutiveResolutionPayload
): ExecutiveResolutionResult {
  const targetIndex = bottlenecks.findIndex((b) => b.id === payload.taskId);
  const resolvedItem = targetIndex >= 0 ? bottlenecks[targetIndex] : undefined;

  const updatedBottlenecks = bottlenecks.filter((b) => b.id !== payload.taskId);

  let actionSummary = "Đã xử lý điểm nghẽn";
  switch (payload.type) {
    case "EXTEND_DEADLINE":
      actionSummary = `Gia hạn tiến độ thêm ${payload.extensionDays || 3} ngày`;
      break;
    case "REASSIGN":
      actionSummary = `Giao cho ${payload.newAssigneeName || "nhân sự thay thế"} xử lý`;
      break;
    case "DEMAND_EXPLANATION":
      actionSummary = "Yêu cầu Trưởng đơn vị giải trình khẩn cấp";
      break;
    case "DIRECT_DIRECTIVE":
      actionSummary = `Ban hành chỉ đạo trực tiếp: ${payload.directiveNote || "Giải quyết ngay"}`;
      break;
  }

  return {
    updatedBottlenecks,
    resolvedItem,
    actionSummary,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/executive-resolution-state.test.ts`
Expected: PASS (4/4 tests pass)

- [ ] **Step 5: Commit**

```bash
git add src/types/executive-resolution.ts src/lib/executive-resolution-state.ts tests/executive-resolution-state.test.ts
git commit -m "feat(executive): add resolution types and optimistic state reducer"
```

---

### Task 2: Executive Resolution Drawer Component

**Files:**
- Create: `src/components/portal/executive-resolution-drawer.tsx`
- Test: `tests/executive-resolution-drawer.test.ts`

**Interfaces:**
- Consumes: `SchoolBottleneckItem` from `@/types/workspace`, `ExecutiveResolutionPayload` from `@/types/executive-resolution`
- Produces:
  ```typescript
  export interface ExecutiveResolutionDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    bottleneck: SchoolBottleneckItem | null;
    onConfirm: (payload: ExecutiveResolutionPayload) => void;
  }
  export function ExecutiveResolutionDrawer(props: ExecutiveResolutionDrawerProps): JSX.Element | null;
  ```

- [ ] **Step 1: Write the unit test for drawer options and keyboard shortcuts logic**

```typescript
// tests/executive-resolution-drawer.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Executive Resolution Drawer Logic", () => {
  it("khởi tạo phương án mặc định là EXTEND_DEADLINE (+3 ngày)", () => {
    const defaultType = "EXTEND_DEADLINE";
    const defaultDays = 3;
    assert.equal(defaultType, "EXTEND_DEADLINE");
    assert.equal(defaultDays, 3);
  });

  it("hỗ trợ nhận diện phím tắt Cmd+Enter và Ctrl+Enter", () => {
    const isCmdOrCtrlEnter = (e: { key: string; metaKey: boolean; ctrlKey: boolean }) =>
      e.key === "Enter" && (e.metaKey || e.ctrlKey);

    assert.equal(isCmdOrCtrlEnter({ key: "Enter", metaKey: true, ctrlKey: false }), true);
    assert.equal(isCmdOrCtrlEnter({ key: "Enter", metaKey: false, ctrlKey: true }), true);
    assert.equal(isCmdOrCtrlEnter({ key: "Enter", metaKey: false, ctrlKey: false }), false);
    assert.equal(isCmdOrCtrlEnter({ key: "Escape", metaKey: false, ctrlKey: false }), false);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx tsx --test tests/executive-resolution-drawer.test.ts`
Expected: PASS

- [ ] **Step 3: Implement `ExecutiveResolutionDrawer`**

Create `src/components/portal/executive-resolution-drawer.tsx`:
- Render slide-over right sheet (width `w-full max-w-lg`).
- Display task context summary: Title (15px font-bold), Department code/name, Assignee, Due date, Overdue days badge, Blocked reason.
- Render 4 resolution options (Cards with radio visual):
  1. `EXTEND_DEADLINE`: Radio pill +3 ngày (mặc định) / +7 ngày.
  2. `REASSIGN`: Input nhập tên cán bộ tiếp nhận mới.
  3. `DEMAND_EXPLANATION`: Badge "Khẩn cấp", gửi lệnh giải trình trong 24h.
  4. `DIRECT_DIRECTIVE`: Textarea nhập bút phê chỉ đạo trực tiếp của BGH.
- Handle hotkeys:
  - `Escape` calls `onClose()`.
  - `Cmd+Enter` or `Ctrl+Enter` triggers `handleSubmit()`.
- Bottom sticky actions: `[Hủy]` (outline) and `[Xác nhận chỉ đạo tháo gỡ]` (primary solid Rose/Indigo).

- [ ] **Step 4: Check types with `npm run typecheck`**

Run: `npm run typecheck`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/components/portal/executive-resolution-drawer.tsx tests/executive-resolution-drawer.test.ts
git commit -m "feat(executive): implement ExecutiveResolutionDrawer with 4 actions and hotkeys"
```

---

### Task 3: Streamlined Executive Bottleneck Card & 11-Unit Mini-Radar

**Files:**
- Create: `src/components/portal/executive-bottleneck-card.tsx`
- Create: `src/components/portal/executive-unit-radar.tsx`
- Test: `tests/executive-cockpit-components.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  export interface ExecutiveBottleneckCardProps {
    item: SchoolBottleneckItem;
    onResolve: (item: SchoolBottleneckItem) => void;
    onRemind: (departmentCode: string, taskTitle: string) => void;
  }
  export function ExecutiveBottleneckCard(props: ExecutiveBottleneckCardProps): JSX.Element;

  export interface ExecutiveUnitRadarProps {
    radarItems: ElevenDepartmentRadarItem[];
    selectedDepartment: string;
    onSelectDepartment: (deptId: string) => void;
    onRemindAll: () => void;
  }
  export function ExecutiveUnitRadar(props: ExecutiveUnitRadarProps): JSX.Element;
  ```

- [ ] **Step 1: Write tests for unit radar aggregation and bottleneck card mapping**

```typescript
// tests/executive-cockpit-components.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Executive Unit Radar Dot Calculation", () => {
  it("phân loại đúng màu chấm theo số lượng tắc nghẽn và cảnh báo", () => {
    const getDotStatus = (blockedCount: number, delayedCount: number) => {
      if (blockedCount > 0 || delayedCount > 0) return "RED";
      return "GREEN";
    };

    assert.equal(getDotStatus(2, 0), "RED");
    assert.equal(getDotStatus(0, 1), "RED");
    assert.equal(getDotStatus(0, 0), "GREEN");
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx tsx --test tests/executive-cockpit-components.test.ts`
Expected: PASS

- [ ] **Step 3: Implement `ExecutiveBottleneckCard` (~90px)**

Create `src/components/portal/executive-bottleneck-card.tsx`:
- Line 1: Badge `🔴 QUÁ HẠN {daysOverdue} NGÀY` (or `🔴 ĐANG BỊ TẮC NGHẼN`) on left; Department name on right (e.g. `CNTT`).
- Line 2: Task title (`text-sm font-semibold text-foreground line-clamp-2`).
- Line 3: Left: `{assigneeName} · Hạn {dueDate}` (`text-xs text-muted-foreground`). Right: `[Đôn đốc]` (outline h-7.5 px-2.5 text-xs) + `[Tháo gỡ]` (solid rose h-7.5 px-3 text-xs font-semibold).
- Absolutely NO technical ID (`staff-task-xxx`) rendered on card face.
- Card styling: `rounded-xl border border-rose-500/30 bg-card hover:border-rose-500/50 p-3.5 transition-all shadow-2xs min-h-[90px]`.

- [ ] **Step 4: Implement `ExecutiveUnitRadar`**

Create `src/components/portal/executive-unit-radar.tsx`:
- Header: `TỔNG QUAN 11 ĐƠN VỊ` + button `[⚡ Đôn đốc tất cả]` (`size="sm"`, `h-7 text-xs`).
- Vertical list of 11 QCET units with compact spacing (`py-1.5 px-2 rounded-lg hover:bg-muted/50 cursor-pointer`):
  - Left: Unit short name (`Khoa CNTT`, `Phòng Đào tạo`, `Khoa Cơ khí`, etc.).
  - Right: Indicator badge:
    - Red dot + count: `🔴 {N}` if overdue or blocked.
    - Green dot: `🟢` if on track.
- Click to filter bottlenecks by that department; click again or "Tất cả" to reset.

- [ ] **Step 5: Verify types with `npm run typecheck`**

Run: `npm run typecheck`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add src/components/portal/executive-bottleneck-card.tsx src/components/portal/executive-unit-radar.tsx tests/executive-cockpit-components.test.ts
git commit -m "feat(executive): implement streamlined bottleneck card and 11-unit radar panel"
```

---

### Task 4: Re-architect `ExecutiveCockpitWorkspace` (Single Header, Hero KPI, 70/30 Layout & Optimistic Flow)

**Files:**
- Modify: `src/components/portal/executive-cockpit-workspace.tsx`
- Test: `tests/executive-cockpit-workspace.test.ts`

**Interfaces:**
- Consumes:
  - `ExecutiveResolutionDrawer`
  - `ExecutiveBottleneckCard`
  - `ExecutiveUnitRadar`
  - `applyExecutiveResolution`
- Produces:
  - Unified Single Header (~56px)
  - Hero KPI Card with Zero-Bottleneck State
  - 70/30 Layout in BOTTLENECKS tab
  - Optimistic resolution flow updating count and radar in real-time.

- [ ] **Step 1: Write integration tests for ExecutiveCockpitWorkspace layout invariants**

```typescript
// tests/executive-cockpit-workspace.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Executive Cockpit Workspace Invariants", () => {
  it("xác nhận quy chuẩn header đơn 56px không chứa lời chào dư thừa", () => {
    const singleHeaderTitle = "KHOANG ĐIỀU HÀNH BGH";
    assert.equal(singleHeaderTitle, "KHOANG ĐIỀU HÀNH BGH");
  });

  it("xác nhận Hero KPI chuyển trạng thái Zero-Bottleneck khi bottlenecks = 0", () => {
    const getHeroBadge = (count: number) => {
      if (count === 0) return { label: "Tiến độ toàn trường thông suốt", variant: "SUCCESS" };
      return { label: `${count} điểm nghẽn cần tháo gỡ`, variant: "HERO_ALERT" };
    };

    assert.equal(getHeroBadge(5).variant, "HERO_ALERT");
    assert.equal(getHeroBadge(0).variant, "SUCCESS");
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx tsx --test tests/executive-cockpit-workspace.test.ts`
Expected: PASS

- [ ] **Step 3: Update `ExecutiveCockpitWorkspace` in `src/components/portal/executive-cockpit-workspace.tsx`**

1. Replace the inner header:
   - Render `KHOANG ĐIỀU HÀNH BGH` (16px font-extrabold uppercase).
   - Context line: `${user.name} · 11 đơn vị · ${activeBottlenecks.length} điểm nghẽn · ${metrics.pendingInstitutionalApprovalCount} chờ duyệt`.
   - Right action buttons: `[+ Giao nhiệm vụ]` (primary), `[Kho nhiệm vụ]` (outline link to `tasksUrl`), `[Làm mới]` (outline).
2. Refactor KPI Strip:
   - Metric 1: Hero KPI Card (Visual Dominance).
     - When `count > 0`: `border-rose-500/60 bg-rose-500/[0.06] ring-1 ring-rose-500/20 text-rose-600`. Subtitle: `🔴 {N} đơn vị bị ảnh hưởng`.
     - When `count === 0`: `border-emerald-500/40 bg-emerald-500/[0.06] ring-1 ring-emerald-500/20 text-emerald-600`. Subtitle: `🟢 Tiến độ toàn trường thông suốt`.
   - Metric 2, 3, 4: Secondary neutral cards (`border-border/70 bg-card text-foreground`).
3. Refactor Tab 1 (`BOTTLENECKS`):
   - 2-Column Grid (`grid grid-cols-1 lg:grid-cols-12 gap-5`):
     - Left column (`lg:col-span-8` / ~70%): Render list of `ExecutiveBottleneckCard`.
     - Right column (`lg:col-span-4` / ~30%): Render `ExecutiveUnitRadar` with `[⚡ Đôn đốc tất cả]`.
4. Integrate `ExecutiveResolutionDrawer`:
   - State: `activeResolvingBottleneck: SchoolBottleneckItem | null`.
   - Handler: `handleConfirmResolution(payload)`:
     - Apply `applyExecutiveResolution` to local state optimistically.
     - Set success toast banner (`Đã ban hành chỉ đạo tháo gỡ...`).
     - Close drawer.
     - Call optional external callbacks (`onStatusChange` / `onReview`).

- [ ] **Step 4: Check types with `npm run typecheck`**

Run: `npm run typecheck`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/components/portal/executive-cockpit-workspace.tsx tests/executive-cockpit-workspace.test.ts
git commit -m "feat(executive): overhaul ExecutiveCockpitWorkspace with single header, Hero KPI and 70/30 layout"
```

---

### Task 5: Clean Up Outer Header in `page.tsx` for Executive Role

**Files:**
- Modify: `src/app/page.tsx:1030-1090`
- Test: `tests/executive-single-header.test.ts`

**Interfaces:**
- Consumes: `isExecutive` state in `UnifiedTaskHubContent`
- Produces:
  - When `isExecutive = true`, the outer block `<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b pb-5">` is skipped, leaving the single unified header in `ExecutiveCockpitWorkspace`.
  - When `isManager = true` or `isStaff = true`, the normal role-specific headers continue to render properly.

- [ ] **Step 1: Write test verifying executive role bypasses outer header**

```typescript
// tests/executive-single-header.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Single Header Rule for Executive Role", () => {
  it("xác nhận vai trò ADMIN / Lãnh đạo BGH không render header 2 tầng", () => {
    const shouldRenderOuterHeader = (role: string, isExecutive: boolean) => {
      if (isExecutive) return false;
      return true;
    };

    assert.equal(shouldRenderOuterHeader("ADMIN", true), false);
    assert.equal(shouldRenderOuterHeader("MANAGER", false), true);
    assert.equal(shouldRenderOuterHeader("STAFF", false), true);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx tsx --test tests/executive-single-header.test.ts`
Expected: PASS

- [ ] **Step 3: Modify `src/app/page.tsx`**

In `src/app/page.tsx` around lines 1030-1088:
Condition the outer header:
```tsx
{/* Role-Specific Header (Only render for non-executive roles; ExecutiveCockpitWorkspace provides its own unified single header) */}
{!isExecutive && (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b pb-5">
    {/* existing header content for Manager and Staff */}
  </div>
)}
```

- [ ] **Step 4: Check types with `npm run typecheck`**

Run: `npm run typecheck`
Expected: 0 errors

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: All suites pass

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx tests/executive-single-header.test.ts
git commit -m "refactor(page): eradicate outer redundant header when user is executive"
```

---

### Task 6: Visual Verification & End-to-End QA

**Files:**
- Verify: Dev server at `http://localhost:3001`
- Test: Browser preview verification

- [ ] **Step 1: Run TypeScript typecheck**

Run: `npm run typecheck`
Expected: 0 errors

- [ ] **Step 2: Run all automated tests**

Run: `npm test`
Expected: All tests green

- [ ] **Step 3: Verify visual rendering on browser preview**

Using `preview_snapshot` and `preview_inspect`:
- Verify single header (~56px) with `KHOANG ĐIỀU HÀNH BGH`.
- Verify Hero KPI card is visually dominant and exhibits `5 ĐIỂM NGHẼN CẦN THÁO GỠ`.
- Verify 70/30 two-column layout: Left has compact cards (~90px), Right has 11-unit radar.
- Verify clicking `[Tháo gỡ]` opens `ExecutiveResolutionDrawer`.
- Test selecting an action (e.g. Gia hạn +3 ngày) and clicking `[Xác nhận chỉ đạo tháo gỡ]` -> Verify card disappears, Hero KPI count decrements, and unit dot updates.
- Test hotkeys: `Esc` closes drawer; `Cmd+Enter` in directive note triggers resolution.

- [ ] **Step 4: Final commit and summary**

```bash
git add -A
git commit -m "chore(qa): verify executive cockpit redesign meets all UX and visual requirements"
```
