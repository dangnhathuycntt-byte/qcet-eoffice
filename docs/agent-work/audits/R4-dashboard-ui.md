# R4 Dashboard UI Architecture Audit & Invariant Reconciliation

**Document**: `docs/agent-work/audits/R4-dashboard-ui.md`  
**Auditor**: R4 Dashboard Architecture Audit Agent (QCET Work UI Semantic Consolidation)  
**Date**: 2026-09-10  
**Status**: COMPLETE — READ-ONLY RECONNAISSANCE AUDIT  
**Scope**:
- Dashboard Route & Entrypoints: `src/app/dashboard/page.tsx`, `src/app/page.tsx`
- Dashboard Zone & Workspace Integration: `src/components/dashboard/zones/dashboard-zone.tsx`, `src/components/dashboard/unified-task-hub-client.tsx`
- Primary KPI Metric Strip: `src/components/dashboard/executive-stat-strip.tsx`
- Action Center & Approval Queues: `src/components/dashboard/executive-action-center.tsx`, `src/components/dashboard/personal-workbench.tsx`
- Mobile Attention Feed: `src/components/dashboard/workbench-mobile-feed.tsx`
- Aggregation & Computation Engines: `src/lib/executive-matrix-aggregator.ts`, `src/lib/dashboard-aggregator.ts`
- Authoritative Server Inbox: `src/server/services/action-inbox-service.ts`, `src/contracts/me.ts`
- Test Harnesses: `tests/executive-action-center-ui.test.ts`, `tests/executive-stat-strip.test.ts`

---

## 1. Executive Summary

This forensic architectural audit inspects the QCET E-Office Dashboard surface, specifically examining how macro Key Performance Indicators (KPIs), secondary action cards, the Ban Giám hiệu (BGH) approval queue, and personal attention affordances are modeled and rendered.

### Core Discoveries & Defect Inventory:

1. **Severe Card Duplication on BGH Dashboard**:
   - The primary `ExecutiveStatStrip` (`src/components/dashboard/executive-stat-strip.tsx`) renders 5 macro metric cards:
     1. `Tổng nhiệm vụ` (`school-tasks`)
     2. `Chờ duyệt` (`pending-approval`)
     3. `Trễ / vướng` (`blocked-overdue`)
     4. `Trọng tâm` (`strategic-active`)
     5. `Tiến độ toàn trường` (`overall-progress`)
   - Immediately beneath it, `ExecutiveActionCenter` (`src/components/dashboard/executive-action-center.tsx`, lines 47–97 and 135–196) renders 3 secondary action cards:
     1. `Chờ BGH Phê duyệt` (exact duplicate count of Card 2: `pendingSchoolApprovalCount`)
     2. `Vướng mắc & Trễ hạn` (exact duplicate count of Card 3: `blockedTasksCount + overdueTasksCount`)
     3. `Nhiệm vụ Chiến lược` (exact duplicate count of Card 4: `strategicActiveCount`)
   - This duplication wastes ~180px of vertical viewport height on desktop and confuses the user: the top card indicates a school-wide metric, while the identical lower card acts as a local filter toggle for an action list.

2. **Dual Competing Action Queues for Executive Leadership**:
   - When an Executive lands on `DashboardZone` (`src/components/dashboard/zones/dashboard-zone.tsx`), lines 92–98 render `ExecutiveActionCenter` with its action item queue.
   - Directly underneath (lines 102–118), `DashboardZone` mounts `PersonalWorkbench` (`src/components/dashboard/personal-workbench.tsx`), which renders:
     - `SmartWorkbox` (4 filter badges: "Việc hôm nay", "Chờ tôi duyệt", "Đang làm", "Quá hạn")
     - A second action stream titled "Việc cần xử lý ngay" (lines 616–700) with 7 items.
   - BGH users are presented with two separate, overlapping, competing action queues on the same page.

3. **Conflation of "What is the situation?" (Metrics) vs. "What must I act on?" (Action Queue)**:
   - Macro KPIs (school-wide operational totals, progress %, bottleneck tallies) are visually styled like interactive action cards.
   - Secondary action cards in `ExecutiveActionCenter` masquerade as metric displays while functioning as list filters.
   - The action affordance buttons inside `ExecutiveActionCenter` ("Phê duyệt ngay", "Đôn đốc") do not execute an approval or reminder mutation; they merely trigger `openTaskDetail`, opening the standard task modal.

4. **Client-Side Synthesis vs. Authoritative Server Truth**:
   - `ExecutiveActionCenter` currently receives items from `extractExecutiveActionItems()` (`src/lib/executive-matrix-aggregator.ts`), which synthesizes action items client-side with fake string IDs (`act-wait-${t.id}`, `act-overdue-${t.id}`).
   - It performs zero checks on current-user authority or specific approver assignments: *any* task in the system with `progressPercent === 100` or `status === "WAITING_APPROVAL"` or any subtask in `NEEDS_REVIEW` is dumped into the BGH queue.
   - Meanwhile, the backend already possesses a canonical `ActionInboxService` (`src/server/services/action-inbox-service.ts`, exposed via `GET /api/me/inbox`) that enforces real role boundaries (DRI, Reviewer, Approver, Document workflow stages, expiring delegations), but this service is completely bypassed by the dashboard UI.

5. **Data Integrity & Formula Defects**:
   - **Denominator Mixing**: `computeDepartmentHealthMatrix` in `src/lib/executive-matrix-aggregator.ts` (lines 448 & 484) increments `totalTasksCount` for parent tasks AND for every subtask into a shared pool, computing distorted completion rates.
   - **Naive Strategic Task Counting**: `computeExecutiveActionStats` in `src/lib/executive-matrix-aggregator.ts` (lines 373–375) treats *all* in-progress tasks (`status === "IN_PROGRESS"`) as `strategicActiveCount`.
   - **Synthetic Mock Data in Mobile Feed**: `src/components/dashboard/workbench-mobile-feed.tsx` contains hardcoded mock arrays (`DEFAULT_SCHEDULE_ITEMS` and `DEFAULT_NOTICES`) rendered in production when props are undefined, violating Rule 40 (Data Integrity).

---

## 2. Macro Metric Strip Mapping Inventory (Band 1: "What is the situation?")

The table below maps every metric displayed on the dashboard stat strip, detailing its underlying data source, computation logic, canonical definition, and existing duplication across surfaces.

| Metric Card & ID | Source / Computation | Canonical Definition (`docs/product/metrics.md`) | Duplicate UI Elements across Surfaces | Assessment & Target State (Lane P3) |
| :--- | :--- | :--- | :--- | :--- |
| **Tổng nhiệm vụ**<br>`id: "school-tasks"` | `stats.totalSchoolTasks`<br>via `computeDashboardStats(monthScopedBaseTasks)` | Total valid parent tasks excluding cancelled: $N_{\text{valid}} = N_{\text{total}} - N_{\text{cancelled}}$ within academic period. | 1. `ExecutiveStatStrip` (Card 1)<br>2. `WorkbenchMobileFeed` summary chip<br>3. `DepartmentProgressMatrix` header | **Keep as Primary KPI #1**.<br>Essential macro volume indicator. Answers: "How many school tasks exist in this period?" |
| **Chờ duyệt**<br>`id: "pending-approval"` | `executiveStats.pendingSchoolApprovalCount` (`computeExecutiveActionStats`) or `stats.needsReviewTasksCount` | Tasks in `WAITING_APPROVAL`, `PENDING_EXECUTIVE_APPROVAL`, progress=100%, or containing subtasks with `NEEDS_REVIEW`. | 1. `ExecutiveStatStrip` (Card 2)<br>2. `ExecutiveActionCenter` (Card 1: "Chờ BGH Phê duyệt")<br>3. `SmartWorkbox` (Card 2: "Chờ tôi duyệt")<br>4. `PersonalWorkbench` ("Việc cần xử lý ngay")<br>5. `WorkbenchMobileFeed` ("Cần duyệt") | **CRITICAL DUPLICATE**.<br>Keep count in `ExecutiveStatStrip` as school-wide metric. Eliminate secondary card in `ExecutiveActionCenter`. Move personal signature queue to Action Inbox. |
| **Trễ / vướng**<br>`id: "blocked-overdue"` | `(executiveStats.blockedTasksCount ?? 0) + (executiveStats.overdueTasksCount ?? stats.overdueTasksCount)` | Tasks with status `BLOCKED` or `OVERDUE` or past due date ($D_{\text{due}} < D_{\text{ref}}$) within the period. | 1. `ExecutiveStatStrip` (Card 3)<br>2. `ExecutiveActionCenter` (Card 2: "Vướng mắc & Trễ hạn")<br>3. `SmartWorkbox` (Card 4: "Quá hạn")<br>4. `PriorOverdueBacklogBanner`<br>5. `WorkbenchMobileFeed` ("Trễ hạn") | **CRITICAL DUPLICATE**.<br>Keep count in `ExecutiveStatStrip`. Eliminate secondary card in `ExecutiveActionCenter`. Banner handles prior-month carryover. |
| **Trọng tâm**<br>`id: "strategic-active"` | `executiveStats.strategicActiveCount` (`computeExecutiveActionStats`) | Tasks flagged as strategic priorities (`isStrategic === true`) or urgent institutional objectives (`priority === "URGENT"`). | 1. `ExecutiveStatStrip` (Card 4)<br>2. `ExecutiveActionCenter` (Card 3: "Nhiệm vụ Chiến lược")<br>3. `WorkbenchMobileFeed` ("Trọng tâm") | **CRITICAL DUPLICATE & FORMULA DEFECT**.<br>Currently evaluated naively as `status === "IN_PROGRESS"`. Eliminate secondary card. Fix calculation to filter on strategic flags. |
| **Tiến độ toàn trường**<br>`id: "overall-progress"` | `stats.averageSchoolProgressPercent`, subtext with completed count and `completionRate` | Rollup: $\frac{\sum \text{progressPercent}}{N}$ and completion rate: $\frac{N_{\text{completed}}}{N_{\text{valid}}} \times 100$. | 1. `ExecutiveStatStrip` (Card 5)<br>2. `DepartmentProgressMatrix` summary badge | **Keep as Primary KPI #5**.<br>Canonical progress and health indicator. |
| **Công việc Đơn vị**<br>`id: "unit-tasks"` | `stats.totalStaffTasks`<br>via `computeDashboardStats` | Total valid operational subtasks (`StaffTask`) excluding cancelled. | 1. Manager `ExecutiveStatStrip` (Card 2)<br>2. `ManagerStaffWorkloadWidget` | **Keep for Manager Strip**.<br>Separates subtask denominator from parent school tasks. |
| **Cần xử lý & Trễ hạn**<br>`id: "urgent-tasks"` | `stats.needsReviewTasksCount + stats.overdueTasksCount` | Non-executive rollup of unit tasks requiring review plus overdue tasks. | 1. Manager/Staff `ExecutiveStatStrip` (Card 3)<br>2. `SmartWorkbox` ("Quá hạn") | **Keep for Manager/Staff Strip**.<br>Provides single operational urgency count for unit managers. |

---

## 3. Forensic Identification of Duplicate Secondary Cards

### 3.1 Side-by-Side Code Comparison

In the Executive (BGH) view, the page renders two consecutive components containing identical values:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        PRIMARY: ExecutiveStatStrip (lines 221-279)                     │
├────────────────────┬────────────────────┬────────────────────┬─────────────────────────┤
│ Card 1: Tổng việc  │ Card 2: Chờ duyệt  │ Card 3: Trễ/vướng  │ Card 4: Trọng tâm       │
│ Value: totalTasks  │ Value: pendingCount│ Value: issueCount  │ Value: strategicCount   │
└────────────────────┴────────────────────┴────────────────────┴─────────────────────────┘
                                       │ REPEATED DIRECTLY BELOW
                                       ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                      SECONDARY: ExecutiveActionCenter (lines 47-97)                    │
├─────────────────────────────────────────┬──────────────────────────────────────────────┤
│ Secondary Card 1: Chờ BGH Phê duyệt     │ Value: pendingSchoolApprovalCount (REPEATED) │
│ Secondary Card 2: Vướng mắc & Trễ hạn   │ Value: blockedTasksCount + overdueTasksCount │
│ Secondary Card 3: Nhiệm vụ Chiến lược   │ Value: strategicActiveCount (REPEATED)       │
└─────────────────────────────────────────┴──────────────────────────────────────────────┘
```

#### Detailed Element-by-Element Comparison:

1. **Card 2 (Stat Strip) vs. Secondary Card 1 (Action Center)**:
   - `ExecutiveStatStrip` (line 231):
     - Title: `"Chờ duyệt"`
     - Value: `formatNumber(pendingApprovalCount)` (`executiveStats?.pendingSchoolApprovalCount ?? stats.needsReviewTasksCount`)
     - Subtext: `pendingApprovalCount > 0 ? "Tờ trình chờ thẩm định & phê duyệt" : "Không có tờ trình tồn đọng"`
     - Filter key: `PENDING_APPROVAL`
   - `ExecutiveActionCenter` (line 51):
     - Title: `"Chờ BGH Phê duyệt"`
     - Value: `s.pendingSchoolApprovalCount`
     - Subtext: `s.pendingSchoolApprovalCount > 0 ? "Tờ trình chờ thẩm định & phê duyệt" : "Không có tờ trình tồn đọng"`
     - Filter key: `PENDING_APPROVAL`
   - **Verdict**: 100% redundant title, count, subtext, and filter action.

2. **Card 3 (Stat Strip) vs. Secondary Card 2 (Action Center)**:
   - `ExecutiveStatStrip` (line 247):
     - Title: `"Trễ / vướng"`
     - Value: `formatNumber(totalIssueCount)` (`blockedCount + overdueCount`)
     - Subtext: `${blockedCount} vướng mắc · ${overdueCount} trễ hạn`
     - Filter key: `BLOCKED_OVERDUE`
   - `ExecutiveActionCenter` (line 66):
     - Title: `"Vướng mắc & Trễ hạn"`
     - Value: `s.blockedTasksCount + s.overdueTasksCount`
     - Subtext: `${s.blockedTasksCount} vướng mắc · ${s.overdueTasksCount} trễ hạn`
     - Filter key: `BLOCKED_OVERDUE`
   - **Verdict**: 100% redundant count, subtext, and filter action.

3. **Card 4 (Stat Strip) vs. Secondary Card 3 (Action Center)**:
   - `ExecutiveStatStrip` (line 260):
     - Title: `"Trọng tâm"`
     - Value: `formatNumber(strategicCount)` (`executiveStats?.strategicActiveCount ?? 0`)
     - Subtext: `strategicCount > 0 ? "Nhiệm vụ trọng tâm năm học" : "Đã hoàn thành mục tiêu"`
     - Filter key: `STRATEGIC`
   - `ExecutiveActionCenter` (line 85):
     - Title: `"Nhiệm vụ Chiến lược"`
     - Value: `s.strategicActiveCount`
     - Subtext: `s.strategicActiveCount > 0 ? "Nhiệm vụ trọng tâm năm học" : "Đã hoàn thành các mục tiêu"`
     - Filter key: `STRATEGIC`
   - **Verdict**: 100% redundant count, subtext, and filter action.

### 3.2 Visual & Cognitive Harm Analysis

- **Viewport Bloat**: The 3 secondary action cards occupy a full horizontal grid (`grid-cols-1 md:grid-cols-3`), consuming 160px–190px of vertical space before the user can see a single actionable task.
- **Mental Model Confusion**: Leaders ask: "Are these 3 cards new numbers or the same numbers as above?" Clicking a card changes the filter of the list below, but clicking Card 2 in the stat strip *also* attempts to filter by `PENDING_APPROVAL` (`onExecutiveFilterChange`).
- **Test Impact**: `tests/executive-action-center-ui.test.ts` asserts `data-slot="action-card"`, `data-card-id`, and button counts. When P3 consolidates these, tests must verify that `hideCards={true}` preserves the action queue while eliminating visual redundancy, or that compact segmented filter tabs (`All`, `Chờ duyệt`, `Trễ/vướng`, `Trọng tâm`) replace the bulky cards.

---

## 4. Attention Queue Mapping & Dual Action Queue Collision

### 4.1 The Dual-Queue Collision on BGH View

When `isExecutive === true`, `src/components/dashboard/zones/dashboard-zone.tsx` mounts:
1. `ExecutiveActionCenter` (line 94):
   - Header: `"Nhiệm vụ trọng tâm cần chỉ đạo trực tiếp"` / `"Hàng đợi: ..."`
   - Items: `executiveActionItems` (extracted from `tasks`)
   - Limit: 5 items (expandable to full)
2. `PersonalWorkbench` (line 102):
   - `SmartWorkbox`: 4 badge buttons ("Của tôi", "Chờ tôi duyệt", "Chờ nộp báo cáo", "Quá hạn")
   - Left column stream: `"Việc cần xử lý ngay"` (line 624)
   - Items: `buildRoleAttentionQueue({ tasks, role: "EXECUTIVE", limit: 7 })`

**Result**: A BGH user sees two competing attention queues listing the same tasks with different badge styles and action buttons on a single page.

### 4.2 Attention Queue Mapping Matrix

| Queue Component | Source Function | Current-User Predicate | Action Affordance | Flaws & Architectural Gaps |
| :--- | :--- | :--- | :--- | :--- |
| **BGH Action Queue**<br>(`ExecutiveActionCenter`) | `extractExecutiveActionItems()` in `src/lib/executive-matrix-aggregator.ts` | Filtered by `isExecutive`: checks `WAITING_APPROVAL`, `BLOCKED`, `OVERDUE`, `IN_PROGRESS`. | Button: "Phê duyệt ngay", "Đôn đốc", "Theo dõi". | 1. Generates synthetic IDs (`act-wait-`, `act-overdue-`).<br>2. Does not check if current user is the statutory approver.<br>3. Action button only calls `openTaskDetail` (read modal). |
| **Personal Attention Stream**<br>(`PersonalWorkbench`) | `buildRoleAttentionQueue()` in `src/components/dashboard/personal-workbench.tsx` | Evaluates `effectiveRole === "EXECUTIVE"`: checks tasks waiting approval, overdue, or urgent. | Link card opening `openTaskDetail` or navigating to `/tasks?taskId=...`. | 1. Duplicates `ExecutiveActionCenter` on BGH screen.<br>2. Client-side array filter on `tasks`.<br>3. No connection to document workflows. |
| **Smart Workbox**<br>(`SmartWorkbox`) | `computeSmartWorkboxCounts()` in `src/components/workspace/smart-workbox.tsx` | 4 buckets based on `roleScope`: `my`, `waiting_approval`, `pending_submission`, `overdue`. | Navigates to `/tasks?workbox=...&scope=...`. | 1. Mixes navigation filters with metric badges.<br>2. Redundant with both KPI strip and Action Center. |
| **Authoritative Action Inbox**<br>(`ActionInboxService`) | `GET /api/me/inbox`<br>`ActionInboxService.getActionInbox(userId)` | SQL join on `PositionAssignment`, `TaskActor` (DRI, Reviewer, Approver), `DocumentIncomingWorkflow`, `DocumentOutgoingWorkflow`, and `Delegation`. | Typed contract `ActionInboxItem` with `requiredAction`, `reasonWhyMe`, `priority`, `deadline`, and `linkUrl`. | **Canonical Server Truth**.<br>Currently disconnected from dashboard client components. |

---

## 5. Inventory of BGH Approval Queue Predicates & Actionable Criteria

### 5.1 Current Client-Side Predicates (`src/lib/executive-matrix-aggregator.ts`)

In `extractExecutiveActionItems(tasks)` (lines 551–650):

```typescript
// Predicate 1: Waiting Approval
const isWaiting =
  t.status !== "COMPLETED" &&
  ((t.status as string) === "WAITING_APPROVAL" ||
    t.status === "PENDING_EXECUTIVE_APPROVAL" ||
    t.progressPercent === 100 ||
    (t.subTasks || []).some(
      (s) =>
        (s.status as string) !== "CANCELLED" &&
        (s.status === "NEEDS_REVIEW" || s.requiresReview)
    ));

// Predicate 2: Overdue or Blocked
const isOverdueOrBlocked =
  (t.status as string) === "OVERDUE" ||
  (t.status as string) === "BLOCKED" ||
  (t.status !== "COMPLETED" && isTaskPastDue(t.dueDate, referenceDate)) ||
  (t.subTasks || []).some(
    (s) =>
      (s.status as string) !== "CANCELLED" &&
      (s.status === "BLOCKED" ||
        (s.status !== "COMPLETED" && isTaskPastDue(s.dueDate, referenceDate)))
  );

// Predicate 3: In Progress (labeled "Strategic")
else if (t.status === "IN_PROGRESS") {
  // pushed as filterType: "STRATEGIC"
}
```

#### Forensic Flaws of the Client-Side Implementation:
1. **Zero Statutory Authority Verification**: The code checks `(t.subTasks || []).some(s => s.status === "NEEDS_REVIEW")`. A subtask needing review inside Khoa Ngoại ngữ will appear in the BGH action list, even though the Trưởng khoa is the designated L1 reviewer, violating Vietnamese vocational college governance (Điều lệ trường cao đẳng).
2. **Missing Document & Dossier Workflows**: The BGH's most critical statutory action items are Tờ trình cấp trường, Văn bản đến (cần chỉ đạo phân công), and Văn bản đi (cần ký số phát hành). None of these exist in `extractExecutiveActionItems`.
3. **Synthetic ID Pollution**: Generates IDs like `act-wait-task-123`, breaking DOM key stability and preventing server-side status reconciliation.
4. **Shallow Interaction**: Clicking "Phê duyệt ngay" calls `onAction("APPROVE", item)`, which in `dashboard-zone.tsx` executes:
   ```typescript
   onAction={(_type, item) => {
     const matched = baseTasks.find((t) => t.id === item.id || t.id === item.taskId);
     if (matched) openTaskDetail(matched);
   }}
   ```
   The leader is presented with the generic view modal rather than a direct approval signature action.

---

### 5.2 Canonical Server Truth (`src/server/services/action-inbox-service.ts`)

The server-side `ActionInboxService` implements strict, statutory, role-based actionable criteria for BGH and department leadership:

```typescript
// 1. Role Resolution via Active Position Assignments
const userAssignments = await prisma.positionAssignment.findMany({
  where: {
    userId,
    status: 'ACTIVE',
    effectiveFrom: { lte: now },
    OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
  },
  include: { positionDefinition: true, unit: true },
});

const isBGH = userAssignments.some(
  (a) => a.positionDefinition.code.startsWith('PRINCIPAL') || 
         a.positionDefinition.code.startsWith('VICE_PRINCIPAL')
);
```

#### Canonical BGH Actionable Predicates:

1. **Tasks Pending BGH Review/Approval**:
   ```sql
   WHERE task.archivedAt IS NULL
     AND task.status = 'WAITING_APPROVAL'
     AND (
       -- User is explicit Approver or Reviewer
       EXISTS (SELECT 1 FROM TaskActor WHERE taskId = task.id AND userId = :userId AND role IN ('REVIEWER', 'APPROVER'))
       -- OR task is school-level and user is BGH
       OR (:isBGH = TRUE AND task.originLevel = 'SCHOOL')
     )
   ```
   - **Required Action**: `"Đánh giá / Phê duyệt kết quả nhiệm vụ"`
   - **Reason Why Me**: `"Báo cáo kết quả nhiệm vụ đang chờ bạn phê duyệt"`
   - **Priority**: `HIGH`

2. **Incoming Documents Awaiting Leadership Assignment (`PRESENTED`)**:
   ```sql
   WHERE workflow.status = 'PRESENTED' AND :isBGH = TRUE
   ```
   - **Required Action**: `"Ban hành chỉ đạo giao đơn vị chủ trì"`
   - **Reason Why Me**: `"Văn bản đến đang chờ Ban Giám hiệu chỉ đạo xử lý"`
   - **Priority**: `URGENT`
   - **Link URL**: `/documents/incoming/${documentId}`

3. **Outgoing Documents Awaiting Leadership Signature (`AUTHORIZED_SIGN`)**:
   ```sql
   WHERE workflow.status = 'AUTHORIZED_SIGN' AND :isBGH = TRUE
   ```
   - **Required Action**: `"Ký số văn bản đi"`
   - **Reason Why Me**: `"Văn bản đi đã duyệt thể thức, chờ Lãnh đạo ký phát hành"`
   - **Priority**: `URGENT`
   - **Link URL**: `/documents/outgoing/${documentId}`

4. **Expiring Statutory Delegations (Within 7 Days)**:
   ```sql
   WHERE status = 'ACTIVE' 
     AND validUntil BETWEEN :now AND :sevenDaysLater
     AND (granteeAssignmentId IN (:userAssignmentIds) OR grantorAssignmentId IN (:userAssignmentIds))
   ```
   - **Required Action**: `"Rà soát gia hạn hoặc chuẩn bị bàn giao"`
   - **Priority**: `HIGH`

---

## 6. Data Integrity & Formula Defects in Aggregator Engine

### 6.1 Defect 1: Denominator Mixing in `computeDepartmentHealthMatrix`
- **Location**: `src/lib/executive-matrix-aggregator.ts` lines 448 & 484.
- **Flaw**:
  ```typescript
  // Parent task iteration (line 448):
  parentStats.totalTasksCount++;
  
  // Subtask iteration (line 484):
  subStats.totalTasksCount++;
  ```
  Both parent tasks and operational subtasks increment the exact same `totalTasksCount` counter.
- **Impact**: When calculating `completionRate = Math.round((completedTasksCount / totalTasksCount) * 100)` (lines 534–536), the denominator blends apples and oranges (institutional school tasks vs. individual staff subtasks). This violates Rule 40 (Denominator Integrity) and distorts department performance comparisons.
- **Remediation**: Separate counters into `parentTasksCount`, `completedParentTasksCount`, `subTasksCount`, `completedSubTasksCount`. Compute `schoolTaskCompletionRate` and `subTaskCompletionRate` independently.

### 6.2 Defect 2: Naive Strategic Task Counting
- **Location**: `src/lib/executive-matrix-aggregator.ts` lines 373–375.
- **Flaw**:
  ```typescript
  if (task.status === "IN_PROGRESS") {
    strategicActiveCount++;
  }
  ```
- **Impact**: Any routine in-progress operational task (e.g. "Sửa chữa bóng đèn phòng B102") is counted as a "Strategic Active Task" (Nhiệm vụ Chiến lược / Trọng tâm) on the BGH stat strip.
- **Remediation**: Count only tasks where `task.isStrategic === true` OR `task.priority === "URGENT"` OR `task.category === "STRATEGIC"`.

### 6.3 Defect 3: Discrepancy in `overdueTasksCount` Definitions
- **Location**:
  - `src/lib/dashboard-aggregator.ts`: counts overdue on parent `SchoolTask` only.
  - `src/lib/executive-matrix-aggregator.ts`: adds parent overdue plus subtask overdue.
- **Impact**: The "Trễ / vướng" count changes definition depending on whether an Executive view is active without notifying the user.
- **Remediation**: Standardize to canonical parent overdue count, with subtask issues displayed in breakdown subtext.

### 6.4 Defect 4: Hardcoded Synthetic Fallback Arrays in Mobile Feed
- **Location**: `src/components/dashboard/workbench-mobile-feed.tsx` lines 167–204:
  - `DEFAULT_SCHEDULE_ITEMS`: 2 fabricated calendar meetings ("Họp giao ban BGH", "Thẩm định hồ sơ DACUM").
  - `DEFAULT_NOTICES`: 3 fabricated administrative notices ("Kế hoạch năm học mới", "Đôn đốc nộp báo cáo DACUM", "Thông báo lịch kiểm tra").
- **Flaw**: Lines 305 and 309 fall back to these hardcoded arrays when `props.scheduleItems` or `props.notices` are empty or undefined.
- **Impact**: Production mobile users see fake meetings and fake notices, violating Rule 40 (Data Dignity & Invariant: Never Invent Operational Data).
- **Remediation**: Remove `DEFAULT_SCHEDULE_ITEMS` and `DEFAULT_NOTICES`. When data is empty, render clean zero-count empty states ("Không có lịch công tác hôm nay", "Không có thông báo mới").

---

## 7. The Canonical Separation Architecture: Metrics vs. Action Queues

To achieve cognitive clarity and institutional compliance, the dashboard must adhere strictly to this architectural separation:

```text
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                          BAND 1: METRICS — "What is the situation?"                     │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ • Role: Macro, aggregate, institutional status indicator                                │
│ • Audience: Institutional leaders, department heads, all staff                          │
│ • Scope: Filtered by Academic Month (Period) & Organizational Scope (School/Unit/My)   │
│ • User Action: Read-only inspection; clicking FILTERS tables or navigates to reports    │
│ • NEVER: Initiates direct mutations, approvals, or creates personal tasks               │
│ • Canonical Component: ExecutiveStatStrip (5 standardized cards)                        │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                             ▲
                                     STRICT SEPARATION
                                             ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                       BAND 2: ACTION QUEUE — "What must I act on?"                      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│ • Role: Micro, personalized, urgent signature & directive backlog                       │
│ • Audience: Authenticated user exclusively (based on active PositionAssignment & SoD)   │
│ • Scope: Unresolved items awaiting THIS user's signature, review, or assignment         │
│ • User Action: Direct statutory workflow affordance (Phê duyệt, Chỉ đạo, Ký số, Đôn đốc) │
│ • NEVER: Displays macro institutional totals or school-wide percentage progress         │
│ • Canonical Component: Unified Action Inbox (wired to GET /api/me/inbox)               │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Universal Enforcement Invariants:
1. **Metric Card Click Semantic**: Clicking a card in `ExecutiveStatStrip` must only filter the task list or analytical view. It must never open an approval modal directly.
2. **Action Item Card Semantic**: An action item in the Action Queue must always state:
   - What the item is (`title`, `resourceCode`)
   - Why it requires the current user (`reasonWhyMe`)
   - What statutory action is expected (`requiredAction`)
   - Deadline urgency (`deadline`, `priority`)
3. **Zero Competing Queues**: For any authenticated user role, the dashboard page must render **exactly ONE** primary action queue.

---

## 8. Concrete Implementation Blueprint for Lane P3 (Dashboard Migration)

The mutating agent for Lane P3 (`src/components/dashboard/*`, `src/app/dashboard/*`, `src/lib/executive-matrix-aggregator.ts`) must execute the following sequential plan:

### Step 1: Eliminate Redundant Secondary Cards in `ExecutiveActionCenter`
- In `src/components/dashboard/zones/dashboard-zone.tsx` (line 94), pass `hideCards={true}` to `ExecutiveActionCenter`, OR remove the `ACTION_CARDS` block (lines 135–196) from `executive-action-center.tsx`.
- Replace the bulky cards with compact segmented pill tabs (`Tất cả`, `Chờ duyệt`, `Trễ / vướng`, `Trọng tâm`) positioned directly above the action list, or let `ExecutiveStatStrip` drive the active filter.
- Update `tests/executive-action-center-ui.test.ts` to reflect the clean, card-free layout while preserving queue ergonomics and accessibility tests.

### Step 2: Consolidate Action Queues on BGH Dashboard
- In `src/components/dashboard/zones/dashboard-zone.tsx`, when `isExecutive === true`, suppress the redundant `PersonalWorkbench` attention stream ("Việc cần xử lý ngay").
- Wire `ExecutiveActionCenter` directly to the canonical `ActionInboxResponse` from `GET /api/me/inbox` so that incoming document directives, outgoing signatures, and task approvals appear in a single unified cockpit.

### Step 3: Purge Synthetic Mock Data from `workbench-mobile-feed.tsx`
- Delete `DEFAULT_SCHEDULE_ITEMS` (lines 167–180) and `DEFAULT_NOTICES` (lines 182–204).
- If `scheduleItems` is empty or undefined, render:
  ```tsx
  <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
    Không có lịch công tác hôm nay
  </div>
  ```
- If `noticeItems` is empty or undefined, render:
  ```tsx
  <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
    Không có thông báo mới
  </div>
  ```

### Step 4: Fix Formula Calculations in `src/lib/executive-matrix-aggregator.ts`
- In `computeDepartmentHealthMatrix`:
  - Split `totalTasksCount` into `parentTasksCount` and `subTasksCount`.
  - Compute `schoolTaskCompletionRate = Math.round((completedParentTasksCount / (parentTasksCount || 1)) * 100)`.
  - Compute `subTaskCompletionRate = Math.round((completedSubTasksCount / (subTasksCount || 1)) * 100)`.
- In `computeExecutiveActionStats`:
  - Update `strategicActiveCount` check:
    ```typescript
    if (
      task.status !== "COMPLETED" &&
      (task.isStrategic === true ||
       task.priority === "URGENT" ||
       task.category === "STRATEGIC")
    ) {
      strategicActiveCount++;
    }
    ```

### Step 5: Run Targeted Regression Suite
- Run `node --test tests/executive-stat-strip.test.ts`.
- Run `node --test tests/executive-action-center-ui.test.ts`.
- Verify zero syntax errors and clean TypeScript diagnostics.

---

**Audit Completed By**: R4 Dashboard Architecture Audit Agent  
**Ownership Boundary**: Read-only reconnaissance (Shard R4)  
**Deliverable Verified**: `docs/agent-work/audits/R4-dashboard-ui.md`  
**Handoff Target**: Lane P3 Dashboard Migration Agent  
