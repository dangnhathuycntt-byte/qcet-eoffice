# QCET E-Office: Twenty-Style Executive Dashboard (Phase 1) Design Spec

**Date:** 2026-09-04  
**Status:** Draft / Pending User Review  
**Reference Open-Source:** [Twenty CRM (twentyhq/twenty)](https://github.com/twentyhq/twenty)  
**Target Platform:** Next.js 15 App Router, React 19, Tailwind CSS v4, Lucide Icons, TypeScript  

---

## 1. Executive Summary & Objective

The objective is to replace the previous Warm-Paper dashboard with a high-density, performance-oriented **Clean Slate & Zinc Executive Dashboard** modeled after the open-source **Twenty CRM**.

The dashboard serves as the central cockpit for university governance at Can Tho College of Economic & Technical (QCET), implementing a strict **Two-Tier Cascading Delegation Model**:
1. **Tier 1 (School Strategic Level - HOẠT ĐỘNG):** President / Vice-Presidents (Ban Giám hiệu) assign mission-critical activities to Department Heads (Lãnh đạo đơn vị).
2. **Tier 2 (Unit / Staff Execution Level - LỊCH LÀM VIỆC):** Department Heads decompose school tasks into specific operational work items (sub-tasks linked to the parent task) and assign them to individual lecturers and staff.
3. **Rollup Progress:** The progress percentage of Tier 1 tasks is automatically derived from the completion status of their associated Tier 2 sub-tasks.

The dashboard integrates directly with existing live data from Notion via Notion REST API and supports local high-speed caching.

---

## 2. Twenty CRM Design System & Visual Language (Light-Mode Priority)

### 2.1 First-Class Light Mode & Color Tokens (Clean Slate / Zinc)

The design strictly prioritizes **Light Mode** as the primary operating interface, adopting Twenty CRM's signature crisp, high-contrast, paper-weight aesthetic:
- **Canvas Base:** High-clarity white `#FFFFFF` card/sheet surfaces over a whisper-subtle background `#FBFBFB` / `#F8F9FA`.
- **Dividers & Outlines:** 1px hairline borders (`#E4E4E7` Zinc-200 / `#E5E7EB` Gray-200), providing structure without visual clutter.
- **Micro-elevation:** Soft ambient shadows (`0 1px 2px 0 rgba(0, 0, 0, 0.04), 0 1px 1px 0 rgba(0, 0, 0, 0.02)`), avoiding heavy drop shadows.
- **Default Theme:** Locked to `light` by default with smooth dark mode capability preserved.

| Token | Light Mode Value (Priority) | Dark Mode Value | Usage |
| :--- | :--- | :--- | :--- |
| **`bg-app`** | `#FBFBFB` (Ultra-clean canvas) | `#0B0C0E` | Root application background |
| **`bg-card`** | `#FFFFFF` (Pure white) | `#16181D` | Cards, Table containers, Side sheet |
| **`bg-hover`** | `#F4F4F5` (Zinc-100) | `#22252B` | Table row hover, menu item hover |
| **`border-subtle`** | `#E4E4E7` (Zinc-200) | `#27272A` | 1px clean hairline dividers & card borders |
| **`text-primary`** | `#09090B` (Zinc-950) | `#F4F4F5` (Zinc-100) | Main headings, primary values, task titles |
| **`text-secondary`** | `#52525B` (Zinc-600) | `#A1A1AA` (Zinc-400) | Subtitles, labels, metadata |
| **`text-muted`** | `#A1A1AA` (Zinc-400) | `#71717A` (Zinc-500) | Timestamps, placeholder text, hints |
| **`accent-primary`** | `#18181B` (Zinc-900 solid) | `#FFFFFF` | Primary action buttons (high contrast) |
| **`badge-success`** | `#ECFDF5` text `#047857` border `#A7F3D0` | `#064E3B` text `#6EE7B7` | Hoàn thành 👍 |
| **`badge-progress`** | `#EFF6FF` text `#1D4ED8` border `#BFDBFE` | `#1E3A8A` text `#93C5FD` | Đang thực hiện 🔨 |
| **`badge-warning`** | `#FFFBEB` text `#B45309` border `#FDE68A` | `#78350F` text `#FCD34D` | Cần chỉnh sửa ⚠️ |
| **`badge-new`** | `#FEF2F2` text `#B91C1C` border `#FECACA` | `#7F1D1D` text `#FCA5A5` | Mới 🆕 |

### 2.2 Geometry & Typography
- **Border Radius:** `rounded-lg` (8px) for cards and modals, `rounded-md` (6px) for table cells, badges, and buttons.
- **Typography Hierarchy:**
  - Font family: `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`.
  - Metrics / Big numbers: `text-2xl` or `text-3xl` font-semibold tracking-tight.
  - Table & Item headers: `text-sm` font-medium.
  - Metadata, badges, timestamps: `text-xs` font-normal / font-medium.
- **Density:** Compact SaaS density with `py-2.5 px-3` row padding, maximizing screen real estate.

---

## 3. Data Schema & Notion Integration Mapping

### 3.1 Live Notion Mapping
The system maps directly to the active Notion workspace:
- **School Task Database (HOẠT ĐỘNG):**
  - Database ID: `6e1726a4-e693-45ec-a961-3774c3e9c582` (Data Source ID: `9b658ae94c594ee7ad059c8f3b95a4f4`)
  - Scale: 304 school-level records
  - Key fields: `Tiêu đề` (title), `Nhiệm vụ` (select: Chuyển đổi số, Truyền thông, CNTT, An toàn thông tin, Thư viện, Báo cáo, Khác), `Xử lý chính` (people), `Phối hợp` (multi-select), `Ngày giao việc` (date), `Hạn xử lý` (date), `Trạng thái` (status: Đang thực hiện 🔨, Hoàn thành 👍), `📷 LỊCH LÀM VIỆC` (relation to Tier 2).
- **Staff Task Database (LỊCH LÀM VIỆC):**
  - Database ID: `63c187f9-7c5a-49a4-a854-26e830fd44c7` (Data Source ID: `880dde7c-15af-41d2-becb-c8fe8b1396f5`)
  - Scale: 920 operational task records
  - Key fields: `Công việc` (title), `Người phụ trách` (people), `Ngày thực hiện` (date), `Trạng thái` (select: Mới 🆕, Đang thực hiện 🔨, Cần chỉnh sửa ⚠️, Hoàn thành 👍), `Hoạt động` (relation to Tier 1).

### 3.2 Unified Application Interfaces (TypeScript)

```typescript
export type TaskLevel = 'SCHOOL' | 'UNIT';

export type TaskStatus = 
  | 'NEW'          // Mới 🆕
  | 'IN_PROGRESS'  // Đang thực hiện 🔨
  | 'NEEDS_REVIEW' // Cần chỉnh sửa ⚠️
  | 'COMPLETED';   // Hoàn thành 👍

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
  dueDate: string; // ISO format
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
  // Computed Rollup metrics
  totalSubTasks: number;
  completedSubTasks: number;
  progressPercent: number; // (completedSubTasks / totalSubTasks) * 100
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
```

---

## 4. UI Layout & Component Architecture

The layout implements an **Executive Operational** structure:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ TOP BAR: [QCET Logo] Workspace: E-Office · Search (⌘K) · [Sync Status] · [Profile]   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ KPI STAT STRIP: 4 Cards across the top (Zinc borders, compact typography)             │
│ [ 304 Nhiệm vụ Trường ]  [ 920 Việc Đơn vị ]  [ 42 Cần duyệt/Trễ ]  [ 74.2% Tiến độ ] │
├──────────────────────────────────────────────────────┬─────────────────────────────────┤
│ MAIN WORKSPACE (65% width)                           │ AUXILIARY PANEL (35% width)     │
│                                                      │                                 │
│ 1. FILTER & SEARCH TOOLBAR                           │ 1. UPCOMING DEADLINES (7 DAYS)  │
│    - Quick Search Input                              │    - Grouped by Date (Hôm nay,  │
│    - Category Filter Tabs (Tất cả, CNTT, CĐS...)     │      Ngày mai, Tuần này)        │
│    - Status Filter & Lead Filter                     │    - Priority indicator dots    │
│    - [+ Giao nhiệm vụ] button                        │                                 │
│                                                      │ 2. RECENT ACTIVITY STREAM       │
│ 2. CASCADING EXPANDABLE TABLE                        │    - Real-time event cards      │
│    - Header: Nhiệm vụ, Đơn vị/Chủ trì, Hạn, Tiến độ  │    - Actor, Action, Target, Time │
│    - Tier 1 Parent Row:                              │                                 │
│      [>] 🛡️ Tiêu đề nhiệm vụ trường                  │                                 │
│          Lead: Trần Hùng | 24/09 | Progress [67%]    │                                 │
│    - Expanded Sub-tasks Container (indented 24px):   │                                 │
│      ├── [🔨] Kiểm tra các bản sao lưu (Trần Hùng)   │                                 │
│      └── [👍] Báo cáo an toàn thông tin (Trần Hùng)  │                                 │
└──────────────────────────────────────────────────────┴─────────────────────────────────┘
```

### 4.1 Component Breakdown

1. **`ExecutiveStatStrip` (`src/components/dashboard/executive-stat-strip.tsx`)**:
   - 4 metric cards styled with `border border-border/80 bg-card rounded-lg p-4`.
   - Subtle indicators showing breakdowns (e.g. `212 đang làm · 92 hoàn thành`).
   - Progress bar mini-strip inside the 4th card.

2. **`CascadingTaskTable` (`src/components/dashboard/cascading-task-table.tsx`)**:
   - Table view with collapsible rows using clean caret indicators (`ChevronRight` / `ChevronDown`).
   - Category badges with distinct subtle colors.
   - Progress bar cell showing `completed/total` and a visual bar (`bg-emerald-500` / `bg-zinc-200`).
   - Clicking on a row triggers the Slide-Over Side Sheet.

3. **`UpcomingDeadlinesWidget` (`src/components/dashboard/upcoming-deadlines-widget.tsx`)**:
   - Lists tasks due within the next 7 days.
   - Highlights overdue items with a muted red badge (`bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400`).
   - Categorizes by School task vs Unit task.

4. **`ActivityFeedWidget` (`src/components/dashboard/activity-feed-widget.tsx`)**:
   - Shows chronological stream of updates (status changes, newly created tasks, completed items).

5. **`TaskDetailSideSheet` (`src/components/dashboard/task-detail-side-sheet.tsx`)**:
   - Twenty-style right drawer slide-over (`w-full sm:max-w-xl`).
   - Displays full task metadata, associated sub-tasks list, timeline of edits, and status selector.

---

## 5. Data Fetching & Sync Architecture

1. **Server-Side API Route (`src/app/api/dashboard/overview/route.ts`):**
   - Implements data fetching from Notion REST API with in-memory / file-based cache (TTL: 60 seconds) to ensure sub-second response times on the frontend.
   - Aggregates the 304 School Tasks and 920 Staff Tasks, performing the cross-relation match (`HOẠT ĐỘNG.id <-> LỊCH LÀM VIỆC.Hoạt động`).
   - Computes stats, progress percentages, and upcoming deadlines server-side.
2. **Fallback Mock Dataset:**
   - Includes full offline fallback matching the exact schema of QCET so the dashboard remains instantly functional even in offline development or without active Notion network connectivity.

---

## 6. Error Handling & Edge Cases
- **Notion Rate Limiting (429):** Backend handles exponential backoff; caches last known good state.
- **Unlinked Sub-tasks:** Operational tasks without a parent school task are gracefully categorized under a virtual *"Công việc thường xuyên / Sự vụ"* group.
- **Empty / Completed Sub-tasks:** When a school task has 0 sub-tasks, progress is evaluated directly from its status (100% if `Hoàn thành 👍`, 0% if `Đang thực hiện 🔨`).

---

## 7. Testing & Verification Plan
- **Unit Tests:**
  - Rollup calculation: Verify `(completed / total) * 100` correctly computes across child tasks.
  - Filter logic: Verify searching by keyword and filtering by category/status correctly filters parent tasks and nested children.
- **Visual Smoke Test:**
  - Verify page loads with 4 stat cards, cascading table, upcoming deadlines, and activity stream.
  - Verify row expansion toggles sub-tasks correctly.
  - Verify clicking row opens side sheet with full details.
- **Cross-Theme Test:**
  - Verify UI elements render legibly in both Light Mode (`#FFFFFF` surface) and Dark Mode (`#16181D` surface).
