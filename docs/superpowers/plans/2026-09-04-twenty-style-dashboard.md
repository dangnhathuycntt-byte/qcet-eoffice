# QCET E-Office: Twenty-Style Executive Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the QCET E-Office Dashboard from scratch adopting Twenty CRM's signature Light-Mode-first, Clean Slate & Zinc aesthetic, implementing a Two-Tier Cascading Delegation Model (School Tasks ➔ Unit/Staff Sub-Tasks) integrated with live Notion workspace data.

**Architecture:** Next.js 15 App Router with TypeScript and Tailwind CSS v4. Data layer features a cached Notion REST API client reading from 304 School Tasks (HOẠT ĐỘNG) and 920 Staff Tasks (LỊCH LÀM VIỆC) with high-fidelity mock fallback. UI layer consists of Twenty-style micro-elevated card containers, hairline 1px borders, collapsible cascading table rows, 4-metric executive stat strip, right-hand slide-over side sheet, upcoming deadlines widget, and activity feed.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Tailwind CSS v4, Lucide React (`lucide-react`), Node.js test runner (`tsx --test`), Notion REST API (`@notionhq/client` / native fetch).

**Spec:** `docs/superpowers/specs/2026-09-04-twenty-style-dashboard-design.md`

## Global Constraints

- **Light Mode Priority:** Canvas background `#FBFBFB`, Cards/Sheets `#FFFFFF`, Text primary `#09090B`, Text secondary `#52525B`, Border `#E4E4E7` (1px hairline).
- **Solid Action Surface:** Pure charcoal/black `#18181B` with crisp white text is the only solid button fill (Twenty signature rule).
- **Geometry:** `rounded-lg` (8px) for cards/sheets; `rounded-md` (6px) for table rows, badges, and controls (no pill-shaped rounded-2xl).
- **Two-Tier Model:** Tier 1 (School Task / BGH giao) ➔ Tier 2 (Unit Sub-Task / Giao nhân viên). Progress % is computed via rollup: `(completedSubTasks / totalSubTasks) * 100`.
- **Status Badges:** Pastel soft fills (10% tint) with bold text: `Hoàn thành 👍` (`#ECFDF5`/`#047857`), `Đang thực hiện 🔨` (`#EFF6FF`/`#1D4ED8`), `Cần chỉnh sửa ⚠️` (`#FFFBEB`/`#B45309`), `Mới 🆕` (`#FEF2F2`/`#B91C1C`).
- **All copy in Vietnamese (Tiếng Việt)** conforming to QCET vocational college governance terminology.

---

### Task 1: Design Tokens & CSS Variables Migration to Twenty Clean Slate (Light-Mode Prioritized)

**Files:**
- Modify: `src/lib/tokens.ts`
- Modify: `src/app/globals.css`
- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/ui/badge.tsx`
- Modify: `src/components/ui/card.tsx`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Consumes: None
- Produces: `twentyTokens` in `src/lib/tokens.ts`, CSS custom properties in `src/app/globals.css`, updated component variants in `src/components/ui/` with 8px/6px radii and hairline borders.

- [ ] **Step 1: Update `tests/smoke.test.ts` to assert Twenty Clean Slate design tokens**

```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { cn } from "../src/lib/utils";
import { twentyTokens } from "../src/lib/tokens";

describe("Twenty Design System Tokens (Light Mode Priority)", () => {
  test("defines clean canvas and card background tokens", () => {
    assert.equal(twentyTokens.colors.light.appBg, "#FBFBFB");
    assert.equal(twentyTokens.colors.light.cardBg, "#FFFFFF");
    assert.equal(twentyTokens.colors.light.border, "#E4E4E7");
    assert.equal(twentyTokens.colors.light.textPrimary, "#09090B");
  });

  test("defines Twenty signature solid action surface (charcoal/black)", () => {
    assert.equal(twentyTokens.colors.light.accentPrimary, "#18181B");
    assert.equal(twentyTokens.colors.light.accentForeground, "#FFFFFF");
  });

  test("defines status badge palette", () => {
    assert.ok(twentyTokens.statusColors.completed.bg.includes("#ECFDF5"));
    assert.ok(twentyTokens.statusColors.inProgress.bg.includes("#EFF6FF"));
    assert.ok(twentyTokens.statusColors.needsReview.bg.includes("#FFFBEB"));
    assert.ok(twentyTokens.statusColors.new.bg.includes("#FEF2F2"));
  });

  test("defines 8px card and 6px control radius", () => {
    assert.equal(twentyTokens.radius.card, "0.5rem"); // 8px
    assert.equal(twentyTokens.radius.control, "0.375rem"); // 6px
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm run test`
Expected: FAIL with "twentyTokens is not defined"

- [ ] **Step 3: Update `src/lib/tokens.ts` with Twenty CRM tokens**

```typescript
export const twentyTokens = {
  colors: {
    light: {
      appBg: "#FBFBFB",
      cardBg: "#FFFFFF",
      sidebarBg: "#FAFAFA",
      hoverBg: "#F4F4F5",
      border: "#E4E4E7",
      borderHover: "#D4D4D8",
      textPrimary: "#09090B",
      textSecondary: "#52525B",
      textMuted: "#A1A1AA",
      accentPrimary: "#18181B",
      accentForeground: "#FFFFFF",
    },
    dark: {
      appBg: "#0B0C0E",
      cardBg: "#16181D",
      sidebarBg: "#111215",
      hoverBg: "#22252B",
      border: "#27272A",
      borderHover: "#3F3F46",
      textPrimary: "#F4F4F5",
      textSecondary: "#A1A1AA",
      textMuted: "#71717A",
      accentPrimary: "#FFFFFF",
      accentForeground: "#09090B",
    },
  },
  statusColors: {
    completed: { bg: "#ECFDF5", text: "#047857", border: "#A7F3D0", label: "Hoàn thành 👍" },
    inProgress: { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE", label: "Đang thực hiện 🔨" },
    needsReview: { bg: "#FFFBEB", text: "#B45309", border: "#FDE68A", label: "Cần chỉnh sửa ⚠️" },
    new: { bg: "#FEF2F2", text: "#B91C1C", border: "#FECACA", label: "Mới 🆕" },
  },
  radius: {
    card: "0.5rem",    // 8px
    control: "0.375rem",// 6px
    full: "9999px",
  },
  typography: {
    fontSans: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontMono: "'JetBrains Mono', monospace",
  },
};
```

- [ ] **Step 4: Update `src/app/globals.css` and base UI components**

Update `src/app/globals.css` to use Twenty Light values by default (`--background: #FBFBFB; --card: #FFFFFF; --border: #E4E4E7; --primary: #18181B; --radius: 0.5rem;`).
Update `src/components/ui/button.tsx`, `card.tsx`, `badge.tsx` with `rounded-md` and `rounded-lg` classes.

- [ ] **Step 5: Run tests to verify pass**

Run: `npm run test`
Expected: PASS (All tests passing)

- [ ] **Step 6: Commit**

```bash
git add src/lib/tokens.ts src/app/globals.css src/components/ui/ tests/smoke.test.ts
git commit -m "feat(design-system): migrate tokens to Twenty Clean Slate with light-mode priority"
```

---

### Task 2: Dashboard Domain Types & Aggregator Utility

**Files:**
- Create: `src/types/dashboard.ts`
- Create: `src/lib/dashboard-aggregator.ts`
- Test: `tests/dashboard-aggregator.test.ts`

**Interfaces:**
- Consumes: None
- Produces: TypeScript types `SchoolTask`, `StaffTask`, `DashboardStats`, `ActivityEvent`, and helper functions `computeSchoolTaskRollup`, `computeDashboardStats`, `filterSchoolTasks`.

- [ ] **Step 1: Write test for rollup calculations and task filtering in `tests/dashboard-aggregator.test.ts`**

```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  computeSchoolTaskRollup,
  computeDashboardStats,
  filterSchoolTasks,
} from "../src/lib/dashboard-aggregator";
import type { SchoolTask, StaffTask } from "../src/types/dashboard";

describe("Dashboard Aggregator & Rollup Engine", () => {
  const sampleStaffTasks: StaffTask[] = [
    {
      id: "sub-1",
      title: "Kiểm tra bản sao lưu",
      assigneeName: "Trần Hùng",
      status: "COMPLETED",
      dueDate: "2026-09-24",
      parentSchoolTaskId: "school-1",
      updatedAt: "2026-09-03T10:00:00Z",
    },
    {
      id: "sub-2",
      title: "Cập nhật log an ninh",
      assigneeName: "Trần Hùng",
      status: "IN_PROGRESS",
      dueDate: "2026-09-24",
      parentSchoolTaskId: "school-1",
      updatedAt: "2026-09-03T11:00:00Z",
    },
  ];

  const sampleSchoolTask: SchoolTask = {
    id: "school-1",
    title: "Sao lưu, giám sát an ninh mạng",
    category: "ATTT",
    categoryLabel: "An toàn thông tin",
    leadAssigneeName: "Trần Hùng",
    coAssignees: [],
    assignedDate: "2026-09-03",
    dueDate: "2026-09-24",
    status: "IN_PROGRESS",
    subTasks: sampleStaffTasks,
    totalSubTasks: 0,
    completedSubTasks: 0,
    progressPercent: 0,
  };

  test("computeSchoolTaskRollup calculates exact completion ratio and percentage", () => {
    const computed = computeSchoolTaskRollup(sampleSchoolTask);
    assert.equal(computed.totalSubTasks, 2);
    assert.equal(computed.completedSubTasks, 1);
    assert.equal(computed.progressPercent, 50);
  });

  test("computeDashboardStats aggregates school and staff level statistics", () => {
    const computedTask = computeSchoolTaskRollup(sampleSchoolTask);
    const stats = computeDashboardStats([computedTask]);
    assert.equal(stats.totalSchoolTasks, 1);
    assert.equal(stats.schoolTasksInProgress, 1);
    assert.equal(stats.totalStaffTasks, 2);
    assert.equal(stats.staffTasksCompleted, 1);
    assert.equal(stats.staffTasksInProgress, 1);
    assert.equal(stats.averageSchoolProgressPercent, 50);
  });

  test("filterSchoolTasks filters by search query and category", () => {
    const computedTask = computeSchoolTaskRollup(sampleSchoolTask);
    const results = filterSchoolTasks([computedTask], {
      query: "sao lưu",
      category: "ATTT",
    });
    assert.equal(results.length, 1);

    const emptyResults = filterSchoolTasks([computedTask], {
      query: "không tồn tại",
    });
    assert.equal(emptyResults.length, 0);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx tsx --test tests/dashboard-aggregator.test.ts`
Expected: FAIL with module not found

- [ ] **Step 3: Create `src/types/dashboard.ts`**

```typescript
export type TaskStatus = 'NEW' | 'IN_PROGRESS' | 'NEEDS_REVIEW' | 'COMPLETED';

export type TaskCategory =
  | 'CHUYEN_DOI_SO'
  | 'TRUYEN_THONG'
  | 'CNTT'
  | 'ATTT'
  | 'THU_VIEN'
  | 'BAO_CAO'
  | 'KHAC';

export interface StaffTask {
  id: string;
  title: string;
  assigneeName: string;
  assigneeAvatar?: string;
  status: TaskStatus;
  dueDate: string;
  parentSchoolTaskId: string;
  updatedAt: string;
}

export interface SchoolTask {
  id: string;
  title: string;
  category: TaskCategory;
  categoryLabel: string;
  leadAssigneeName: string;
  leadAssigneeAvatar?: string;
  coAssignees: string[];
  assignedDate: string;
  dueDate: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  subTasks: StaffTask[];
  totalSubTasks: number;
  completedSubTasks: number;
  progressPercent: number;
}

export interface DashboardStats {
  totalSchoolTasks: number;
  schoolTasksInProgress: number;
  schoolTasksCompleted: number;
  totalStaffTasks: number;
  staffTasksInProgress: number;
  staffTasksCompleted: number;
  needsReviewTasksCount: number;
  overdueTasksCount: number;
  averageSchoolProgressPercent: number;
}

export interface ActivityEvent {
  id: string;
  actorName: string;
  action: string;
  targetTitle: string;
  timestamp: string;
  category: TaskCategory;
}
```

- [ ] **Step 4: Create `src/lib/dashboard-aggregator.ts`**

Implement `computeSchoolTaskRollup`, `computeDashboardStats`, and `filterSchoolTasks`.

```typescript
import { SchoolTask, DashboardStats, TaskCategory } from "../types/dashboard";

export function computeSchoolTaskRollup(task: SchoolTask): SchoolTask {
  const totalSubTasks = task.subTasks.length;
  const completedSubTasks = task.subTasks.filter((st) => st.status === "COMPLETED").length;
  const progressPercent = totalSubTasks > 0
    ? Math.round((completedSubTasks / totalSubTasks) * 100)
    : task.status === "COMPLETED" ? 100 : 0;

  return {
    ...task,
    totalSubTasks,
    completedSubTasks,
    progressPercent,
  };
}

export function computeDashboardStats(tasks: SchoolTask[]): DashboardStats {
  const totalSchoolTasks = tasks.length;
  const schoolTasksCompleted = tasks.filter((t) => t.status === "COMPLETED").length;
  const schoolTasksInProgress = totalSchoolTasks - schoolTasksCompleted;

  let totalStaffTasks = 0;
  let staffTasksCompleted = 0;
  let staffTasksInProgress = 0;
  let needsReviewTasksCount = 0;
  let overdueTasksCount = 0;
  let totalProgress = 0;

  const now = new Date();

  for (const t of tasks) {
    totalProgress += t.progressPercent;
    for (const sub of t.subTasks) {
      totalStaffTasks++;
      if (sub.status === "COMPLETED") staffTasksCompleted++;
      if (sub.status === "IN_PROGRESS") staffTasksInProgress++;
      if (sub.status === "NEEDS_REVIEW") needsReviewTasksCount++;
      if (new Date(sub.dueDate) < now && sub.status !== "COMPLETED") {
        overdueTasksCount++;
      }
    }
  }

  const averageSchoolProgressPercent = totalSchoolTasks > 0
    ? Math.round(totalProgress / totalSchoolTasks)
    : 0;

  return {
    totalSchoolTasks,
    schoolTasksInProgress,
    schoolTasksCompleted,
    totalStaffTasks,
    staffTasksInProgress,
    staffTasksCompleted,
    needsReviewTasksCount,
    overdueTasksCount,
    averageSchoolProgressPercent,
  };
}

export function filterSchoolTasks(
  tasks: SchoolTask[],
  filter: { query?: string; category?: TaskCategory | "ALL"; lead?: string }
): SchoolTask[] {
  return tasks.filter((t) => {
    if (filter.category && filter.category !== "ALL" && t.category !== filter.category) {
      return false;
    }
    if (filter.lead && filter.lead !== "ALL" && t.leadAssigneeName !== filter.lead) {
      return false;
    }
    if (filter.query && filter.query.trim() !== "") {
      const q = filter.query.toLowerCase().trim();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchLead = t.leadAssigneeName.toLowerCase().includes(q);
      const matchSub = t.subTasks.some((sub) => sub.title.toLowerCase().includes(q) || sub.assigneeName.toLowerCase().includes(q));
      if (!matchTitle && !matchLead && !matchSub) return false;
    }
    return true;
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx tsx --test tests/dashboard-aggregator.test.ts`
Expected: PASS (All tests pass)

- [ ] **Step 6: Commit**

```bash
git add src/types/dashboard.ts src/lib/dashboard-aggregator.ts tests/dashboard-aggregator.test.ts
git commit -m "feat(dashboard): add domain types and rollup aggregation engine"
```

---

### Task 3: Live Notion Client & High-Fidelity Dataset

**Files:**
- Create: `src/lib/notion-client.ts`
- Create: `src/lib/mock-dashboard-data.ts`
- Create: `src/app/api/dashboard/overview/route.ts`
- Test: `tests/dashboard-api.test.ts`

**Interfaces:**
- Consumes: Notion API token and Database IDs from environment or default constants; domain types from Task 2.
- Produces: Server-side API endpoint `GET /api/dashboard/overview` returning `{ stats, tasks, upcoming, activities, source }`.

- [ ] **Step 1: Write test for API response format in `tests/dashboard-api.test.ts`**

```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getMockDashboardPayload } from "../src/lib/mock-dashboard-data";

describe("Dashboard Data Provider", () => {
  test("generates full dashboard overview payload with 2-tier tasks", () => {
    const data = getMockDashboardPayload();
    assert.ok(data.stats.totalSchoolTasks > 0);
    assert.ok(data.stats.totalStaffTasks > 0);
    assert.ok(data.tasks.length > 0);
    assert.ok(data.upcoming.length > 0);
    assert.ok(data.activities.length > 0);

    // Verify rollup integrity
    const firstTask = data.tasks[0];
    assert.ok(firstTask.subTasks.length >= 0);
    assert.equal(typeof firstTask.progressPercent, "number");
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx tsx --test tests/dashboard-api.test.ts`
Expected: FAIL with module not found

- [ ] **Step 3: Create `src/lib/mock-dashboard-data.ts`**

Populate realistic QCET data reflecting the 304 School Tasks and 920 Unit/Staff tasks discovered from Notion:
- Roles & assignees: Trần Hùng (CNTT / ATTT), Nguyễn Ngọc Vinh (Chuyển đổi số), Mai Đinh Thị Xuân (Truyền thông).
- Real tasks: *"Sao lưu, giám sát an ninh mạng"*, *"Theo dõi kênh theo dõi chỉ đạo của UBND Tỉnh"*, *"Bài viết MỚI VÀO QCET – NHỮNG NGÀY ĐẦU TIÊN SẼ CÓ GÌ?"*, *"Rà soát hệ thống mạng và wifi các giảng đường"*.

- [ ] **Step 4: Create `src/lib/notion-client.ts`**

Implement Notion query handler with in-memory 60s cache. If Notion credentials fail or offline, seamlessly return mock data.

- [ ] **Step 5: Create `src/app/api/dashboard/overview/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { fetchNotionDashboardData } from "@/lib/notion-client";
import { getMockDashboardPayload } from "@/lib/mock-dashboard-data";

export async function GET() {
  try {
    const data = await fetchNotionDashboardData();
    return NextResponse.json(data);
  } catch (err) {
    const fallback = getMockDashboardPayload();
    return NextResponse.json({ ...fallback, source: "mock-fallback" });
  }
}
```

- [ ] **Step 6: Run tests to verify pass**

Run: `npx tsx --test tests/dashboard-api.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/notion-client.ts src/lib/mock-dashboard-data.ts src/app/api/dashboard/overview/route.ts tests/dashboard-api.test.ts
git commit -m "feat(api): add Notion client with high-fidelity fallback dataset"
```

---

### Task 4: Executive KPI Stat Strip Component

**Files:**
- Create: `src/components/dashboard/executive-stat-strip.tsx`
- Test: `tests/executive-stat-strip.test.ts`

**Interfaces:**
- Consumes: `DashboardStats` from `src/types/dashboard.ts`
- Produces: `ExecutiveStatStrip` React component rendering 4 Zinc-styled KPI cards with Twenty geometry.

- [ ] **Step 1: Write test for stat strip component rendering in `tests/executive-stat-strip.test.ts`**

```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatNumber, getStatCardData } from "../src/components/dashboard/executive-stat-strip";
import type { DashboardStats } from "../src/types/dashboard";

describe("ExecutiveStatStrip Helpers", () => {
  const mockStats: DashboardStats = {
    totalSchoolTasks: 304,
    schoolTasksInProgress: 212,
    schoolTasksCompleted: 92,
    totalStaffTasks: 920,
    staffTasksInProgress: 580,
    staffTasksCompleted: 290,
    needsReviewTasksCount: 42,
    overdueTasksCount: 5,
    averageSchoolProgressPercent: 74,
  };

  test("getStatCardData returns 4 formatted cards with proper metadata", () => {
    const cards = getStatCardData(mockStats);
    assert.equal(cards.length, 4);
    assert.equal(cards[0].value, "304");
    assert.equal(cards[1].value, "920");
    assert.equal(cards[2].value, "47"); // 42 needs review + 5 overdue
    assert.equal(cards[3].value, "74%");
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx tsx --test tests/executive-stat-strip.test.ts`
Expected: FAIL with module not found

- [ ] **Step 3: Implement `src/components/dashboard/executive-stat-strip.tsx`**

Build the 4-card KPI strip:
1. Nhiệm vụ cấp Trường (`totalSchoolTasks`, `schoolTasksInProgress đang làm · schoolTasksCompleted xong`).
2. Công việc Đơn vị (`totalStaffTasks`, `staffTasksInProgress đang làm · staffTasksCompleted xong`).
3. Cần xử lý & Trễ hạn (`needsReviewTasksCount + overdueTasksCount`, warning badge).
4. Tỷ lệ hoàn thành toàn trường (`averageSchoolProgressPercent%` with mini horizontal progress bar).
Styled with `border border-border/80 bg-card rounded-lg p-4 shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]`.

- [ ] **Step 4: Run test to verify pass**

Run: `npx tsx --test tests/executive-stat-strip.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/executive-stat-strip.tsx tests/executive-stat-strip.test.ts
git commit -m "feat(ui): implement Twenty-style ExecutiveStatStrip component"
```

---

### Task 5: Cascading 2-Tier Task Table Component

**Files:**
- Create: `src/components/dashboard/cascading-task-table.tsx`
- Test: `tests/cascading-task-table.test.ts`

**Interfaces:**
- Consumes: `SchoolTask`, `StaffTask`, `TaskCategory`
- Produces: `CascadingTaskTable` component with search, category tabs, accordion expansion, and row click selection.

- [ ] **Step 1: Write test for table category helper and search matcher in `tests/cascading-task-table.test.ts`**

```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getCategoryBadgeConfig } from "../src/components/dashboard/cascading-task-table";

describe("CascadingTaskTable Helpers", () => {
  test("provides distinct subtle badge styling for categories", () => {
    const attt = getCategoryBadgeConfig("ATTT");
    assert.equal(attt.label, "An toàn thông tin");
    assert.ok(attt.className.includes("text-"));

    const cds = getCategoryBadgeConfig("CHUYEN_DOI_SO");
    assert.equal(cds.label, "Chuyển đổi số");
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx tsx --test tests/cascading-task-table.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `src/components/dashboard/cascading-task-table.tsx`**

Implement:
- Top filter bar: Search input (`⌘K`), category pills (`Tất cả`, `Chuyển đổi số`, `Truyền thông`, `CNTT`, `An toàn thông tin`), and `+ Giao việc` primary button (`bg-[#18181B] text-white rounded-md`).
- Table rows:
  - Parent row (Tier 1): Expand/collapse caret button (`ChevronRight` / `ChevronDown`), category badge, task title, lead assignee avatar/name, due date, progress bar (`completed/total` + percentage).
  - Nested container (Tier 2): Indented 28px with left connecting hairline guide, displaying sub-tasks with status badge (`Mới 🆕`, `Đang thực hiện 🔨`, `Cần chỉnh sửa ⚠️`, `Hoàn thành 👍`), staff assignee, and due date.
- Emits `onSelectTask(task: SchoolTask | StaffTask)` when row is clicked.

- [ ] **Step 4: Run test to verify pass**

Run: `npx tsx --test tests/cascading-task-table.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/cascading-task-table.tsx tests/cascading-task-table.test.ts
git commit -m "feat(ui): implement CascadingTaskTable with 2-tier accordion hierarchy"
```

---

### Task 6: Upcoming Deadlines & Live Activity Feed Widgets

**Files:**
- Create: `src/components/dashboard/upcoming-deadlines-widget.tsx`
- Create: `src/components/dashboard/activity-feed-widget.tsx`
- Test: `tests/dashboard-widgets.test.ts`

**Interfaces:**
- Consumes: Tasks with due dates and `ActivityEvent` records.
- Produces: `UpcomingDeadlinesWidget` and `ActivityFeedWidget` React components.

- [ ] **Step 1: Write test for date grouping in `tests/dashboard-widgets.test.ts`**

```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatDeadlineDistance } from "../src/components/dashboard/upcoming-deadlines-widget";

describe("UpcomingDeadlinesWidget Helpers", () => {
  test("formats relative due date correctly", () => {
    const today = new Date().toISOString().split("T")[0];
    assert.equal(formatDeadlineDistance(today), "Hôm nay");
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx tsx --test tests/dashboard-widgets.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `src/components/dashboard/upcoming-deadlines-widget.tsx`**

Build:
- Card with header: Calendar icon, Title "Hạn chót 7 ngày tới", count badge.
- List items: Date tag, task name, assignee, level indicator (Trường vs Đơn vị), and overdue warning if past due.

- [ ] **Step 4: Implement `src/components/dashboard/activity-feed-widget.tsx`**

Build:
- Card with header: Activity/Zap icon, Title "Hoạt động vừa cập nhật".
- Real-time updates list: Actor avatar, bold name, action ("vừa hoàn thành công việc", "vừa phân công..."), relative time ("10 phút trước").

- [ ] **Step 5: Run test to verify pass**

Run: `npx tsx --test tests/dashboard-widgets.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/upcoming-deadlines-widget.tsx src/components/dashboard/activity-feed-widget.tsx tests/dashboard-widgets.test.ts
git commit -m "feat(ui): add UpcomingDeadlinesWidget and ActivityFeedWidget"
```

---

### Task 7: Twenty Slide-Over Task Detail Side Sheet

**Files:**
- Create: `src/components/dashboard/task-detail-side-sheet.tsx`
- Test: `tests/task-detail-sheet.test.ts`

**Interfaces:**
- Consumes: Selected `SchoolTask | StaffTask | null` and `onClose: () => void`.
- Produces: Slide-over drawer component mounting on root without page reload.

- [ ] **Step 1: Write test for detail sheet helper in `tests/task-detail-sheet.test.ts`**

```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isSchoolTask } from "../src/components/dashboard/task-detail-side-sheet";
import type { SchoolTask, StaffTask } from "../src/types/dashboard";

describe("TaskDetailSideSheet Type Guard", () => {
  test("distinguishes SchoolTask from StaffTask", () => {
    const schoolTask: SchoolTask = {
      id: "s1",
      title: "Test School",
      category: "CNTT",
      categoryLabel: "CNTT",
      leadAssigneeName: "Hùng",
      coAssignees: [],
      assignedDate: "2026-09-01",
      dueDate: "2026-09-20",
      status: "IN_PROGRESS",
      subTasks: [],
      totalSubTasks: 0,
      completedSubTasks: 0,
      progressPercent: 0,
    };
    assert.equal(isSchoolTask(schoolTask), true);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx tsx --test tests/task-detail-sheet.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `src/components/dashboard/task-detail-side-sheet.tsx`**

Build:
- Overlay backdrop with smooth fade.
- Right drawer (`w-full sm:max-w-xl bg-card border-l border-border h-full flex flex-col`).
- Header: Task level badge (🏛️ Nhiệm vụ cấp Trường / 📋 Công việc Đơn vị), Close button (Esc / click outside).
- Content:
  - Title, Category, Lead / Assignee, Due date.
  - Quick status dropdown selector.
  - If School Task: Embedded list of linked sub-tasks with checkmarks and "+ Thêm việc con".
  - Timeline & Activity notes.

- [ ] **Step 4: Run test to verify pass**

Run: `npx tsx --test tests/task-detail-sheet.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/task-detail-side-sheet.tsx tests/task-detail-sheet.test.ts
git commit -m "feat(ui): implement Twenty-style TaskDetailSideSheet slide-over"
```

---

### Task 8: Twenty Layout Shell & Dashboard Page Assembly

**Files:**
- Modify: `src/components/navigation.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/layout.tsx`
- Test: `tests/dashboard-integration.test.ts`

**Interfaces:**
- Consumes: Components from Tasks 4, 5, 6, 7 and data API from Task 3.
- Produces: Complete, interactive Executive Operational Dashboard running on `/`.

- [ ] **Step 1: Write integration test in `tests/dashboard-integration.test.ts`**

```typescript
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getMockDashboardPayload } from "../src/lib/mock-dashboard-data";

describe("Dashboard Assembly Integration", () => {
  test("full dashboard state mounts with all required sections", () => {
    const payload = getMockDashboardPayload();
    assert.ok(payload.stats.totalSchoolTasks >= 300);
    assert.ok(payload.stats.totalStaffTasks >= 900);
    assert.ok(payload.tasks.length > 0);
  });
});
```

- [x] **Step 2: Run test to verify initial state**

Run: `npx tsx --test tests/dashboard-integration.test.ts`
Expected: PASS

- [x] **Step 3: Update `src/components/navigation.tsx` to Twenty Topbar style**

Transform navigation into Twenty's sleek top header:
- Left: QCET Logo + Workspace dropdown pill ("QCET E-Office / Ban Giám hiệu").
- Center: Quick Search Command trigger (`⌘K Tìm kiếm nhanh...`).
- Right: Live Notion Sync status indicator (Green dot "Đã đồng bộ"), Notifications bell, User Avatar ("Admin QCET").
- Sub-bar / Navigation links: `Dashboard`, `Nhiệm vụ cấp Trường`, `Công việc Đơn vị`, `Lịch công tác`, `Cơ cấu tổ chức`.

- [x] **Step 4: Rebuild `src/app/page.tsx` with full Executive Operational Layout**

Assemble:
1. `ExecutiveStatStrip` across the top.
2. Two-column grid (`grid grid-cols-1 lg:grid-cols-12 gap-6`):
   - Left (8 cols / ~65%): `CascadingTaskTable`.
   - Right (4 cols / ~35%): `UpcomingDeadlinesWidget` and `ActivityFeedWidget`.
3. Render `TaskDetailSideSheet` controlled by `selectedTask` state.
4. Support Client-side live data fetching from `/api/dashboard/overview` with optimistic fallback so there is 0ms blank screen.

- [x] **Step 5: Update `src/app/layout.tsx`**

Ensure `class="light"` on `html` tag by default, with smooth dark mode capability preserved.

- [x] **Step 6: Commit**

```bash
git add src/components/navigation.tsx src/app/page.tsx src/app/layout.tsx tests/dashboard-integration.test.ts
git commit -m "feat(dashboard): assemble complete Twenty-style Executive Operational Dashboard"
```

---

### Task 9: End-to-End Build & Visual Verification

**Files:**
- Modify: `package.json` (if any scripts needed)
- Verify: All tests pass, typecheck passes, next build succeeds.

**Interfaces:**
- Consumes: All project files.
- Produces: Clean zero-error production build.

- [x] **Step 1: Run complete test suite**

Run: `npm run test`
Expected: PASS (All test suites passing)

- [x] **Step 2: Run TypeScript typecheck**

Run: `npm run typecheck`
Expected: Exit code 0 with no diagnostic errors

- [x] **Step 3: Run Next.js production build**

Run: `npm run build`
Expected: Build successfully completes with static/dynamic route generation

- [x] **Step 4: Start local dev server and test live dashboard rendering**

Run: `curl -I http://localhost:3000` (or preview server)
Expected: HTTP 200 OK

- [x] **Step 5: Final commit**

```bash
git add .
git commit -m "chore: verify clean build and passing tests for Twenty-style executive dashboard"
```
