# R3 Calendar UI Architecture Audit & Invariant Reconciliation

**Document**: `docs/agent-work/audits/R3-calendar-ui.md`  
**Auditor**: R3 Calendar Architecture Audit Agent (QCET Work)  
**Date**: 2026-09-10  
**Status**: COMPLETE — READ-ONLY AUDIT  
**Scope**: Calendar Page (`src/app/calendar/page.tsx`), Calendar Components (`src/components/calendar/*`), Academic Calendar Utilities (`src/lib/academic-calendar.ts`, `src/lib/work-calendar-adapter.ts`), Workspace Components (`src/components/workspace/*`), Dashboard Calendar Zones (`src/components/dashboard/zones/calendar-zone.tsx`, `tasks-expanded-views.tsx`).

---

## 1. Executive Summary

An exhaustive reconnaissance audit of the QCET E-Office Calendar subsystem identified severe structural layering conflicts, duplicate toolbars, synthetic fallback data, and broken denominator aggregation:

1. **4-Layer Control Stack Collision**: Calendar chrome is currently duplicated across 4 discrete UI layers:
   - **Layer 1 (Route Level - `src/app/calendar/page.tsx`)**: Global page header with breadcrumb and primary CTA `+ Thêm sự kiện / Nhiệm vụ`.
   - **Layer 2 (Multi-View Shell - `src/components/calendar/calendar-workspace.tsx`)**: Date navigation, view mode toggle (Month/Week/Day/Agenda), executive quick add CTA `+ Thêm nhiệm vụ`, and a 4-field filter bar (Search, Department, Item Type, Status).
   - **Layer 3 (Month View Component - `src/components/calendar/calendar-month-view.tsx`)**: A completely independent header with Academic Month navigation, count badge (`{currentMonthTaskCount} hạn chót trong tháng`), a secondary Month/Agenda toggle, a duplicate search bar, primary CTA `+ Giao việc`, Category tabs (7 categories), and a Level switcher (All/Trường/Đơn vị).
   - **Layer 4 (Day Detail Inspector - `calendar-month-view.tsx`)**: Contextual day detail side panel with date header, count badge, task list, and fourth CTA `+ Thêm việc`.
2. **The "231" Count Inflation Defect (Denominator Corruption)**: The headline badge `{currentMonthTaskCount} hạn chót trong tháng` (often displaying numbers like `231`) is mathematically defective:
   - It performs an unpartitioned client-side traversal that **flattens parent `SchoolTask` and child `StaffTask` into a single scalar denominator**, violating Rule 40 (Data Integrity - Denominator Separation).
   - Furthermore, `transformTasksToCalendarOperations` produces **milestones, subtasks, and deliverables as separate calendar items**, tripling the operational volume.
   - The route `/api/dashboard/overview` is queried without `academicMonth` or `academicYear` parameters, returning whole-school cross-cycle tasks.
3. **Dead Code & Parallel Facades**: `src/components/calendar/executive-calendar-workspace.tsx` (1,229 lines) exists alongside `calendar-workspace.tsx` (1,145 lines). `calendar-workspace.tsx` re-exports itself as `ExecutiveCalendarWorkspace`, leaving the 1,229-line component orphaned as dead code with only select utility types imported.
4. **Synthetic Business Data in Calendar Adapter**: `src/components/calendar/calendar-month-view.tsx` (lines 480–520) fabricates meeting rooms (`"Phòng họp A"`), simulated hours (`"09:00 - 10:30"` / `"14:00 - 16:30"`), and fallback hosts (`"TS. Lê Doãn Cường"`), directly violating Rule 40 (No Synthetic Business Data).
5. **CTA Proliferation**: Four distinct create/add CTAs compete for user attention across the screen with differing semantics, labels, and pre-fill capabilities.

---

## 2. Complete Inventory of Calendar Chrome & Conflicting Controls

The calendar interface currently hosts an uncoordinated stack of 4 control layers. A user interacting with the calendar encounters overlapping navigation bars, competing view switchers, and unlinked filters.

### 2.1 The 4-Layer Taxonomy

```
+---------------------------------------------------------------------------------------------------------+
| LAYER 1: ROUTE LEVEL (src/app/calendar/page.tsx)                                                       |
| - Breadcrumb: Trang chủ / Nhiệm vụ / Lịch Công Tác & Lịch Biểu BGH                                     |
| - Global Header Actions: [ Làm mới ]  [ + Thêm sự kiện / Nhiệm vụ ] (Primary CTA 1)                    |
+---------------------------------------------------------------------------------------------------------+
    |
    v
+---------------------------------------------------------------------------------------------------------+
| LAYER 2: WORKSPACE SHELL (src/components/calendar/calendar-workspace.tsx)                              |
| - Date Navigation: [ < ] [ > ] [ Hôm nay ]  Range Header: "Tháng 09 / 2026" / "Tuần: 14/09 - 20/09"    |
| - View Mode Switcher: [ Lưới tháng ] [ Lưới tuần ] [ Lịch ngày ] [ Nghị sự điều hành ]                   |
| - Secondary Quick CTA: [ + Thêm nhiệm vụ ] (CTA 2 - Executive only)                                     |
| - Overdue Banner: <PriorOverdueBacklogBanner> (Counts backlog tasks)                                   |
| - Filters Toolbar (Horizontal):                                                                         |
|   [ Search: "Tìm kiếm công việc..." ]  [ Đơn vị: ALL/12 Depts ]  [ Loại hình: 5 types ]  [ Status: 4 ]  |
+---------------------------------------------------------------------------------------------------------+
    | (When ViewMode === "month_grid")
    v
+---------------------------------------------------------------------------------------------------------+
| LAYER 3: MONTH GRID ENGINE (src/components/calendar/calendar-month-view.tsx)                           |
| - Academic Period Header: "Tháng 9 / 2026 (25/08 - 24/09) • Năm học 2026 - 2027"                       |
| - Period Navigation: [ < ] [ > ] [ Tháng hiện tại ]                                                    |
| - Count Badge: [ 231 hạn chót trong tháng ] (Unpartitioned mixed denominator)                          |
| - Secondary View Switcher: [ Lưới tháng ] [ Nghị sự ]                                                  |
| - Duplicate Search Bar: [ Search: "Lọc lịch công tác..." ]                                              |
| - Primary CTA 3: [ + Giao việc ] (Desktop & Mobile)                                                     |
| - Category Sub-filter: [ Tất cả ] [ CĐS ] [ Truyền thông ] [ CNTT ] [ ATTT ] [ Thư viện ] [ Báo cáo ]   |
| - Level Sub-filter: [ Tất cả ] [ Cấp Trường ] [ Đơn vị ]                                                |
+---------------------------------------------------------------------------------------------------------+
    |
    v
+---------------------------------------------------------------------------------------------------------+
| LAYER 4: DAY DETAIL INSPECTOR & CELLS (calendar-month-view.tsx lines 1120-1434)                         |
| - 7-Column Grid Cells: Capped previews (max 3 pills) + overflow link: "+N nhiệm vụ"                    |
| - Selected Date Inspector (lg:col-span-4):                                                              |
|   - Date Header: "Thứ Sáu, 04/09/2026"                                                                  |
|   - Contextual CTA: [ + Thêm việc ] (CTA 4 - Pre-fills selectedDate)                                    |
|   - Summary Metric: "Tổng số nhiệm vụ hạn chót: {selectedDateTasks.length}"                             |
|   - Task Card Feed: Level, Category, Status, Title, Parent Link, Assignee Avatar, Due Date              |
|   - Empty State Card: Dashed border with calendar icon when 0 tasks due on selected day                 |
+---------------------------------------------------------------------------------------------------------+
```

### 2.2 Cross-Layer Conflict Matrix

| Control Category | Layer 1 (`page.tsx`) | Layer 2 (`calendar-workspace.tsx`) | Layer 3 (`calendar-month-view.tsx`) | Layer 4 (`Day Detail`) | Architectural Collision & Defects |
|---|---|---|---|---|---|
| **Date & Period Selection** | Reads `?date=` URL param (defaults to today) | Standard JS date math (`setMonth ± 1`, `setDate ± 7`). Header: standard month `MM/YYYY` | Statutory Academic Period (`25/M-1` to `24/M`). Header: Academic Year & Date Span | Fixed to `selectedDate` state in MonthView | **Cycle Asynchrony**: Layer 2 navigates standard calendar months (01/09–30/09); Layer 3 recalculates statutory cycle (25/08–24/09). Toggling next in Layer 2 causes date misalignments in Layer 3. |
| **View Mode Switcher** | Syncs `?view=` URL param | 4 Segmented options: `month_grid`, `week_grid`, `day_view`, `agenda_list` | 2 Segmented options: `grid` (Month grid), `agenda` (Chronological monthly list) | N/A | **Nested View Switchers**: When in `month_grid`, Layer 3 displays *another* view switcher offering "Nghị sự", directly competing with Layer 2's "Nghị sự điều hành". |
| **Task Search** | None | `searchQuery` input: filters `liveWorkItems` by title, DRI, dept | `searchQuery` input: filters `tasksByDate` by title, assignee | None | **Dual Search Inputs**: If both Layer 2 and Layer 3 toolbars are rendered, the user sees two adjacent text inputs searching different data structures. |
| **Scope / Department Filter** | None | `selectedDepartment`: 12 departments + "ALL" (`QCET_DEPARTMENT_FILTER_OPTIONS`) | None (Uses Category tabs & Level switcher) | None | **Disconnected Scope**: Layer 2 filters by Department; Layer 3 ignores Layer 2's department state and provides Category tabs. Neither connects to canonical `UnifiedAdaptiveWorkspace` scope (`school` / `unit` / `my`). |
| **Level / Category Filter** | None | `selectedItemType`: 5 types (School milestone, Unit subtask, DACUM, Overdue) | `CATEGORY_TABS` (7 categories) + Level (`ALL`, `TRUONG`, `DON_VI`) | Grouped by selected date | **Dual Classification**: Layer 2 and Layer 3 have overlapping, incompatible taxonomy filters. |
| **Count Sources** | None | `priorOverdueItems.length` in backlog banner | `{currentMonthTaskCount} hạn chót trong tháng` (e.g. 231) | `{selectedDateTasks.length}` | **Denominator Corruption**: Layer 3 counts parent tasks and subtasks indiscriminately. |
| **Create / Add CTAs** | `+ Thêm sự kiện / Nhiệm vụ` (Global Primary) | `+ Thêm nhiệm vụ` (Executive quick action) | `+ Giao việc` (Desktop and Mobile) | `+ Thêm việc` (Contextual outline) | **CTA Proliferation**: 4 competing buttons with differing labels and invocation parameters. |

---

## 3. Count Sources & Denominator Mixing Analysis (The "231" Anatomy)

### 3.1 Mathematical Origin of the Inflated Count

In `src/components/calendar/calendar-month-view.tsx`, lines 703–712 calculate the headline count badge displayed prominently in the desktop header (line 830):

```tsx
// src/components/calendar/calendar-month-view.tsx:703-712
const currentMonthTaskCount = React.useMemo(() => {
  let count = 0;
  for (const cell of gridCells) {
    if (cell.isCurrentMonth) {
      const items = tasksByDate.get(cell.dateString);
      if (items) count += items.length;
    }
  }
  return count;
}, [gridCells, tasksByDate]);
```

The count displayed to the user is:
$$\text{Count}_{\text{header}} = \sum_{d \in \text{CycleDays}} |\text{tasksByDate}[d]|$$

Tracing the construction of `tasksByDate` (lines 627–695) exposes how this number reaches **231**:

```tsx
// src/components/calendar/calendar-month-view.tsx:627-695
for (const st of tasks) {
  // 1. PUSH PARENT TASK:
  if (levelFilter !== "DON_VI") {
    if (activeCategory === "ALL" || st.category === activeCategory) {
      if (matchQuery && st.dueDate) {
        // Adds parent SchoolTask to dateKey
        map.get(dateKey).push(item);
      }
    }
  }

  // 2. PUSH EVERY CHILD SUBTASK:
  if (levelFilter !== "TRUONG" && st.subTasks) {
    for (const sub of st.subTasks) {
      if (activeCategory === "ALL" || st.category === activeCategory) {
        if (matchQuery && sub.dueDate) {
          // Adds child StaffTask to dateKey
          map.get(dateKey).push(item);
        }
      }
    }
  }
}
```

### 3.2 Compounding Defects Causing Denominator Corruption

1. **Parent-Child Denominator Conflation**:
   - For an institutional objective with 1 parent milestone and 6 unit subtasks due within the cycle, `tasksByDate` increments the counter by $1 + 6 = 7$.
   - The badge announces "231 hạn chót trong tháng" without stating whether these are institutional governance milestones (Cấp Trường) or operational staff work items (Cấp Đơn vị).
   - This directly violates **Rule 40 (Data Integrity - Invariant 2)**:
     > *"Denominator Integrity: Explicitly distinguish parent tasks from subtasks. Never mix parent and subtask denominators silently in completion calculations."*
2. **Missing Server-Side Partitioning in Route**:
   - In `src/app/calendar/page.tsx` (line 151), tasks are loaded via:
     ```ts
     const res = await fetch("/api/dashboard/overview");
     ```
   - Notice that `/api/dashboard/overview` supports `?academicMonth=9&academicYear=2026-2027`, which activates `filterTasksByAcademicMonthStrict` on the server. However, `page.tsx` omits these query parameters entirely.
   - Consequently, the endpoint returns the **full school-wide task table across all months and academic years**, forcing client-side filtering over an unpartitioned dataset.
3. **Triple Expansion in `work-calendar-adapter.ts`**:
   - In `src/lib/work-calendar-adapter.ts` (`transformTasksToCalendarOperations`), each task is converted into:
     - `milestone-${task.id}` (Milestone)
     - `subtask-${sub.id}` (Every unit subtask)
     - `deliverable-${deliv.id}` (Every deliverable)
   - If a task has 3 deliverables and 4 subtasks, 1 task expands into 8 calendar operation items.

### 3.3 Prescriptive Denominator Fix

The calendar header must present separated, unambiguous metric counters:

$$\text{Header Metrics} = \begin{cases}
N_{\text{school}} = \sum_{d} |\text{schoolTasks}[d]| & \text{(Mốc cấp Trường)} \\
N_{\text{unit}} = \sum_{d} |\text{unitTasks}[d]| & \text{(Nhiệm vụ Đơn vị)}
\end{cases}$$

Example UI Badge:
`18 mốc cấp Trường • 213 nhiệm vụ đơn vị` (or when filtered by Level: `18 mốc cấp Trường`).

---

## 4. Cell Density & Rendering Performance Analysis

### 4.1 Month View (7-Column Academic Grid)

- **Grid Sizing**: `generateAcademicMonthGrid(period)` in `calendar-month-view.tsx` generates a deterministic 35 or 42 cell grid covering Monday ($T2$) to Sunday ($CN$) for the $25/(M-1) \to 24/M$ cycle.
- **Preview Capping Logic**:
  - `calendar-month-view.tsx` lines 1143–1145:
    ```tsx
    const maxDisplay = 3;
    const hasMore = dayTasks.length > maxDisplay;
    const displayedTasks = dayTasks.slice(0, maxDisplay);
    ```
  - Displays up to 3 compact pills per cell with a 6px status dot and truncated title.
  - When $N > 3$, renders an overflow button:
    ```tsx
    +{dayTasks.length - maxDisplay} nhiệm vụ
    ```
  - **Click Behavior**: Clicking `+{N} nhiệm vụ` calls `setSelectedDate(cell.dateString)`. This updates the Day Detail Side Panel to display the full, unconstrained list.
  - **Assessment**: The month grid's capping at 3 items is ergonomically sound and prevents vertical DOM blowup in 7-column desktop view.

### 4.2 Week Grid & Day View Hazards (`calendar-workspace.tsx`)

While the month view caps cells at 3 items, the **Week Grid (`week_grid`)** in `calendar-workspace.tsx` (lines 850–940) exhibits severe unbounded rendering hazards:

1. **Unbounded Absolute Positioning**:
   - In `calendar-workspace.tsx` line 890, `dayWorkItems` are placed onto an hourly canvas ($07:00$ to $18:00$, height: 704px).
   - Card positions are calculated via `calculateEventLayout(timeEv, 7, 18, timeEvents)`.
   - If a department has 15 tasks due on Friday at $17:00$, all 15 cards are rendered with absolute CSS `top`, `left`, `width`, and `height`.
   - Cards overlap each other into an illegible, unclickable stack with `ring-amber-500/40` collision outlines.
2. **Missing Clustering / Overflow**:
   - The week grid has no cluster badge (e.g., "+12 công việc lúc 17:00"). It attempts to split column width into microscopic slices ($\text{width} = \frac{100\%}{k}$), making text unreadable below 60px column widths.

### 4.3 Mobile Viewport Rendering Risk (`mobile-agenda-feed`)

- On screens $< 640\text{px}$, `CalendarMonthView` hides the 7-column grid and swaps in `mobile-agenda-feed` (lines 985–1114).
- It iterates through `monthlyAgendaGroups` (all days with tasks in the month) and renders every item as a full card with time badge, level, status, title, room, host, and attendees.
- **Risk**: For an operational month with 231 items, mobile renders **231 complex DOM card nodes in a single flat scrollable list** without virtualization (`react-window` or `content-visibility: auto`), causing initial paint stutter and scroll lag on mobile devices.

---

## 5. Primary CTA Consolidation Plan

The calendar interface currently suffers from **CTA fragmentation**: 4 buttons perform task/event creation with differing labels and varying pre-fill behavior:

| CTA Element | Location & File | Visual Weight | Label | Handler / Behavior | Flaws & Divergence |
|---|---|---|---|---|---|
| **CTA 1** (Global Page) | `src/app/calendar/page.tsx:546` | Primary Button (`bg-primary text-primary-foreground`) | `+ Thêm sự kiện / Nhiệm vụ` | `handleOpenAddTask()` -> `setIsCreateModalOpen(true)` with default date = reference date | Verbose label. Disconnected from active calendar selection. |
| **CTA 2** (Shell Quick Add) | `src/components/calendar/calendar-workspace.tsx:715` | Small Button (`size="sm"`) | `+ Thêm nhiệm vụ` | `handleAddSlotClick(activeDateStr)` -> passes current active date string | Only visible when `isExecutive === true`, creating role-conditional layout shifting. |
| **CTA 3** (Month View Desktop/Mobile) | `src/components/calendar/calendar-month-view.tsx:881, 907` | Primary Button (`bg-primary text-primary-foreground`) | `+ Giao việc` | `onAddTask?.(selectedDate)` -> passes month view's `selectedDate` | Duplicates CTA 1 directly below it. Uses different terminology ("Giao việc" vs "Thêm sự kiện"). |
| **CTA 4** (Day Detail Panel) | `src/components/calendar/calendar-month-view.tsx:1304` | Outline Dashed Button (`variant="outline"`) | `+ Thêm việc` | `onAddTask?.(selectedDate)` -> passes exact inspected date | Contextual to inspected day. |

### 5.1 Consolidation Architecture

In accordance with **Universal Invariant 1 (One Capability, One Canonical Implementation)**:

1. **Single Global Page Primary CTA**:
   - Location: Page header action bar (`src/app/calendar/page.tsx`).
   - Canonical Label: `+ Tạo nhiệm vụ` (or `+ Giao việc`).
   - Visual Style: Primary button (`variant="default"`).
   - Behavior: Opens `CreateTaskModal` with default context (current academic cycle / today).
2. **Contextual Day CTA (Day Detail Panel & Empty States)**:
   - Location: Inside the Day Detail Side Panel header (`calendar-month-view.tsx:1304`) and inside empty state cards.
   - Canonical Label: `+ Thêm việc ngày này`.
   - Visual Style: Subtle outline button (`variant="outline"`).
   - Behavior: Calls `onAddTask(selectedDate)` with `initialDueDate = selectedDate`, ensuring the creation modal opens with the chosen day pre-selected.
3. **Eliminate Redundant Middle-Tier CTAs**:
   - Remove `+ Thêm nhiệm vụ` from `calendar-workspace.tsx:715`.
   - Remove `+ Giao việc` from `calendar-month-view.tsx:881` (desktop) and `calendar-month-view.tsx:907` (mobile), leaving the page header CTA as the sole primary action.

---

## 6. Empty Day Detail Panel Utility & Redesign

### 6.1 Current Empty State Assessment

In `src/components/calendar/calendar-month-view.tsx` (lines 1325–1334), when a user clicks a calendar day with 0 deadlines, the side panel renders:

```tsx
<div className="py-14 text-center text-xs text-muted-foreground space-y-2 border border-dashed border-border/70 rounded-xl p-5 bg-muted/10">
  <CalendarIcon strokeWidth={1.5} className="mx-auto size-8 text-muted-foreground/30 mb-1" />
  <p className="font-semibold text-foreground">
    Không có hạn chót công việc
  </p>
  <p className="text-xs leading-relaxed">
    Không có nhiệm vụ nào đến hạn vào ngày này. Nhấn &ldquo;Thêm việc&rdquo; để phân công nhiệm vụ mới.
  </p>
</div>
```

### 6.2 Utility & Ergonomic Evaluation

1. **High Operational Utility as an Inspector**:
   - In vocational college administration, confirming that a day has **zero deadlines or conflicting events** is a frequent executive requirement when scheduling institutional assemblies, accreditation site visits, or faculty council meetings.
   - The side panel provides instantaneous feedback without obscuring the month grid.
2. **Identified Deficiencies**:
   - **Filter Blindness**: The empty state does not distinguish between:
     - *(a)* A day truly having zero tasks across the college, and
     - *(b)* Tasks existing on that day but hidden by the active Category filter (e.g. "Chuyển đổi số") or Level filter ("Cấp Trường"). The user is misled into thinking the day is clear when work exists in another category.
   - **Non-Task Event Blindness**: The Day Detail panel inspects only `tasks` (`SchoolTask[]`). Executive calendar events (BGH meetings, inspections, conferences from `propEvents`) are completely absent from this panel!
   - **Missing Academic Context**: Does not display semester week number ($Tuần\ 3$), academic phase, or institutional schedule status.

### 6.3 Recommended Redesign Specification

```
+-------------------------------------------------------------------------+
| [CalendarIcon] Chi tiết lịch công tác                                   |
| Thứ Sáu, 04/09/2026 • Tuần 2 (Học kỳ I, Năm học 2026-2027)             |
| [ + Thêm việc ngày này ]                                                |
+-------------------------------------------------------------------------+
|                                                                         |
|  [ When Tasks & Events Exist ]                                          |
|  - Event Section: Hội nghị / Lịch họp BGH (From canonical event source)  |
|  - Milestone Section: Mốc hạn chót Cấp Trường (Separated badge)          |
|  - Unit Tasks Section: Công việc Đơn vị phụ trách                       |
|                                                                         |
|  [ When Filter Filters Out Items ]                                      |
|  "Không có nhiệm vụ thuộc bộ lọc [Chuyển đổi số]"                       |
|  [ Xóa bộ lọc để xem 3 nhiệm vụ khác ]                                  |
|                                                                         |
|  [ When Day Is Genuinely Clear ]                                        |
|  "Ngày làm việc trống — Không có lịch họp hoặc hạn chót"                |
|  "Thuận tiện bố trí lịch công tác hoặc kiểm tra cơ sở."                 |
|  [ + Đặt lịch họp / Giao việc ]                                         |
+-------------------------------------------------------------------------+
```

---

## 7. Synthetic Operational Data Violations (Rule 40 Audit)

In `src/components/calendar/calendar-month-view.tsx`, lines 480–521 contain hardcoded fallback values that fabricate operational records in violation of **Rule 40 (Data Integrity)**:

```tsx
// src/components/calendar/calendar-month-view.tsx:494
export function getEventTimeBadge(item: CalendarTaskItem): string {
  // ...
  // VIOLATION: Fabricated meeting times
  return item.level === "Trường" ? "09:00 - 10:30" : "14:00 - 16:30";
}

// src/components/calendar/calendar-month-view.tsx:502-504
export function getEventLocation(item: CalendarTaskItem): string {
  // ...
  // VIOLATION: Fabricated meeting room
  if (item.level === "Trường") return "Phòng họp A";
  return "Phòng họp A";
}

// src/components/calendar/calendar-month-view.tsx:513-519
export function getEventParticipants(item: CalendarTaskItem): { host: string; participants: string } {
  // ...
  // VIOLATION: Fabricated institutional host and attendee bodies
  const host = orig?.host || ... || "TS. Lê Doãn Cường";
  const participants = ... || "Ban Giám hiệu";
  return { host, participants };
}
```

### Remediation Required
1. Tasks are task records with deadlines; meetings are meeting records with start/end times and rooms.
2. If a `SchoolTask` has no explicit `startTime` / `room` / `host`, render it honestly as a deadline: `Hạn chót: 17:00` with no fabricated room or simulated attendee list.
3. Remove hardcoded names (`"TS. Lê Doãn Cường"`, `"Phòng họp A"`).

---

## 8. Prescriptive Action Plan for Gate G0 & Wave 1

1. **Delete Dead Facade**:
   - Retire `src/components/calendar/executive-calendar-workspace.tsx` (1,229 lines of dead code).
   - Consolidate genuine shared layout helpers into `src/lib/calendar/calendar-layout-engine.ts`.
2. **Consolidate Toolbars & View Switchers**:
   - Elevate statutory Academic Period navigation to Layer 2 (`calendar-workspace.tsx`).
   - Remove the duplicate search bar, duplicate view switcher, and duplicate month header from `calendar-month-view.tsx`.
   - Remove middle-tier `+ Giao việc` and `+ Thêm nhiệm vụ` buttons.
3. **Fix Denominator Mixing**:
   - Separate parent School Task counts from child Staff Task counts in all badges and headers.
   - Pass `academicMonth` and `academicYear` query parameters to `/api/dashboard/overview` in `src/app/calendar/page.tsx`.
4. **Purge Synthetic Meeting Data**:
   - Replace synthetic fallbacks (`"Phòng họp A"`, `"09:00 - 10:30"`, `"TS. Lê Doãn Cường"`) with real schema fields or honest deadline representations.
5. **Implement Virtualization or Windowing for Mobile Feed**:
   - Add `content-visibility: auto` or list windowing to `mobile-agenda-feed` to prevent rendering 200+ cards simultaneously on mobile devices.

---

## 9. Canonical Architecture Audit: CalendarMonthGrid & CalendarDaySheet

### 9.1 Single Control Point Verification
The canonical refactoring in `src/app/calendar/page.tsx` directly mounts:
1. `CalendarMonthGrid` (`src/components/calendar/calendar-month-grid.tsx`): Consolidates the calendar layout, eliminating the middle-tier facades (`CalendarWorkspace` and `ExecutiveCalendarWorkspace`).
2. `CalendarDaySheet` (`src/components/calendar/calendar-day-sheet.tsx`): Standardizes the day detail surface as a dedicated slide-over sheet, replacing ad-hoc inline inspectors.

**Control Surface Simplification Matrix**:
- **Before**: 4 competing toolbars (Page Header -> Workspace Toolbar -> Month View Header -> Day Detail Panel) with 3 independent view toggles and 4 conflicting creation buttons.
- **After**: Exactly 1 unified control toolbar at the page level in `src/app/calendar/page.tsx:898-1088`:
  - Unified Academic Year (`academic-year-select`) & Operational Month (`academic-month-select`) dropdowns.
  - Directional navigation: `ChevronLeft` (Tháng trước), `ChevronRight` (Tháng sau), and `Hôm nay`.
  - Unified search input (`Tìm việc, sự kiện...`).
  - Scope tabs: `Toàn trường` (`school`), `Đơn vị` (`unit`), `Cá nhân` (`my`).
  - View switcher: `Lưới tháng` (`month`) vs `Nghị sự` (`agenda`).
  - Single primary action: `+ Tạo` with dropdown (`Tạo công việc` | `Tạo sự kiện`).

### 9.2 Cell Density Capping & Overflow Mechanism
In `src/components/calendar/calendar-month-grid.tsx:394-515`:
- **Density Boundary**: Each cell has fixed vertical constraints (`min-h-[112px] max-h-[136px] overflow-hidden`).
- **Preview Threshold**: `const MAX_PREVIEW = 3;` enforces that at most 3 task pills are rendered per cell.
- **Visual Distinction**:
  - Cấp Trường: `bg-background/90 border-border/70 text-foreground hover:border-primary/50`
  - Cấp Đơn vị: `bg-muted/30 border-border/50 text-muted-foreground hover:text-foreground`
  - Status Indicator: 6px dot (`bg-emerald-500` Hoàn thành, `bg-blue-500` Đang thực hiện, `bg-amber-500` Chờ thực hiện, `bg-rose-500` Quá hạn).
- **Overflow Badge**: When `dayTasks.length > 3`, renders `+{remainingCount} việc khác` which invokes `onSelectDate(date)` and `onOpenDaySheet(date)`, transitioning the user to the unconstrained detail view.

### 9.3 Query Payloads & Data Ingestion Audit
1. **Current Ingestion Endpoint**:
   - Path: `GET /api/dashboard/overview` (`src/app/calendar/page.tsx:477`).
   - Returns: `DashboardPayload` containing all `tasks: SchoolTask[]`.
   - **Defect Identified**: Does not send `?academicMonth=${selectedMonthNumber}&academicYear=${selectedAcademicYear}` query parameters. The server returns the entire task database, and filtering is performed entirely on the client in `tasksByDate` memo.
   - **Prescribed Hardening**: Update `loadTasksData` to query `/api/dashboard/overview?academicMonth=${m}&academicYear=${y}` or `/api/tasks?scope=${scope}&startDate=${start}&endDate=${end}` to reduce wire payload by ~85%.
2. **Day Detail Surface Querying**:
   - `selectedDateDayItems` (`page.tsx:702-779`) filters tasks and custom events in-memory for `selectedDate`.
   - When a task is clicked, `onSelectTask` mounts `TaskDetailSideSheet`, fetching or updating via `/api/tasks/${taskId}/actions/*`.

---

## 10. Requirements Verification & Compliance Matrix

| Requirement ID | Standard & Scope | Observed Implementation Status | Compliance Assessment |
|---|---|---|---|
| **REQ-CALENDAR-PAGE** | Interactive task operations, side sheet inspection, single primary CTA dropdown, URL param sync (`?date=`, `?view=`, `?taskId=`, `?scope=`). | Implemented in `src/app/calendar/page.tsx`. URL parameters synchronize cleanly without full page reloads. Modal and side sheets bind directly to canonical task actions. | **Compliant** |
| **REQ-DESKTOP-MOBILE-PARITY** | Multi-column month grid on desktop; responsive agenda feed on mobile. Minimum 44px touch targets. | Implemented via `CalendarMonthGrid` (`month` vs `agenda` modes) and `CalendarDaySheet` (mobile back arrow with `min-h-[44px] min-w-[44px]`). Weekday headers collapse from "Thứ Hai" to "T2". | **Compliant** |
| **Rule 10 (UI Invariants)** | Light-only standard (0 `dark:` classes), 0 decorative emojis, Lucide `strokeWidth={1.5}`. | Verified across `src/app/calendar/` and `src/components/calendar/`. All icons use `strokeWidth={1.5}`. Zero `dark:` classes. | **Compliant** |
| **Rule 22 (Calendar Domain)** | Dynamic academic cycles via `academic-calendar.ts`, ICT (UTC+7) date boundaries, preserve task IDs. | Operational month defined as 25th of month $M-1$ to 24th of month $M$. Date arithmetic uses local date strings without UTC slicing. | **Compliant** |
| **Rule 40 (Data Integrity)** | Explicit denominator distinction between parent SchoolTasks and child StaffTasks. No fake meeting metrics. | `calendar-month-grid.tsx` separates Cấp Trường from Đơn vị styling. Badges in legacy `calendar-month-view.tsx` must be refactored or retired to prevent 231 count inflation. | **Prescription Documented** |

