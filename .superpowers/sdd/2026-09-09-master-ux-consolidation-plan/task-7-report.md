# Task 7 Report: Role-Aware Home Workbench ("What Needs My Attention?") (Phase 7)

## Status
DONE

## Summary of Accomplishments

1. **Role-Aware Content Architecture (`PersonalWorkbench` & `buildRoleAttentionQueue`)**:
   - Standardized `/` as the personal "What needs my attention?" hub, directly aligned with the Linear/Plane 'Your Work' model.
   - **Unified Architecture Principle**: The role (Staff, Manager, Executive) only changes *priority, order, and data*, avoiding three divergent UI architectures.
   - **Staff Priorities**: Prioritizes overdue tasks first, then tasks due today, followed by submissions awaiting review, upcoming deadlines, and live activity feeds.
   - **Manager Priorities**: Prioritizes pending unit approvals (L1 sign-off), at-risk unit tasks, unit progress breakdowns, and staff workload distribution (`computeStaffWorkloadDistribution`).
   - **Executive Priorities**: Prioritizes school-wide approvals (L2 sign-off), critical roadblocks, executive KPIs, and subordinate unit progress rankings.

2. **Smart Workbox Integration (`SmartWorkbox`)**:
   - Implemented 4 quick filter counter cards:
     - `Của tôi (N)`: Active tasks assigned to the user or within their role scope (`/tasks?scope=my` or `/tasks?scope=unit`).
     - `Chờ tôi duyệt (N)`: Tasks waiting for review/approval (`/tasks?status=review` or `/tasks?scope=unit&status=review`).
     - `Chờ nộp báo cáo (N)`: Active assigned tasks in progress needing deliverable submission (`/tasks?scope=my&status=in_progress`).
     - `Quá hạn (N)`: Tasks past their due date (`/tasks?scope=my&status=overdue` or `/tasks?scope=unit&status=overdue`).
   - Each card is interactive and links directly to `/tasks` pre-filtered with semantic URL query parameters.
   - Tabular numerals (`font-mono tabular-nums`) with clear authority and status badges.

3. **Clean Desktop Height & Viewport Discipline**:
   - Capped the "Việc cần xử lý ngay" (Attention Stream) to 5–7 actionable cards with a clear "Xem tất cả &rarr;" link to `/tasks`.
   - Desktop view fits cleanly within 1–2 viewports, permanently eliminating infinite vertical scrolling.

4. **DashboardZone Integration (`DashboardZone`)**:
   - Mounted `PersonalWorkbench` seamlessly into `src/components/dashboard/zones/dashboard-zone.tsx` with `hideHeader={true}` to reuse the contextual action bar containing Spotlight Tour anchor IDs (`#tour-scope-switcher` and `#tour-month-selector`).
   - Maintained full reactivity with `reactiveTasks` and `ExecutiveStatStrip`.
   - Adheres strictly to the `< 150 lines` file size budget constraint.

5. **Anti-Slop & Light-Only Standard Compliance**:
   - Strictly 0 `dark:` classes across all workbench components.
   - Strictly 0 decorative emojis; semantic Lucide icons used consistently.
   - All interactive touch targets >= 44px on mobile and >= 36px on desktop.
   - Minimum font size >= 12px (`text-xs`).

## Verification & Test Results
- **Unit & Integration Tests**: `tests/role-aware-workbench.test.ts` with 5 suites and 11 tests verifying:
  - Smart Workbox count calculations across Staff, Manager, and Executive roles.
  - Pre-filtered navigation URL generation.
  - Role-adapted attention queue priority ordering.
  - Staff workload distribution calculations for Manager view.
  - SSR component rendering and anti-slop/light-only invariants.
- **Related Test Suites**:
  - `tests/dashboard-zone.test.ts`: PASS (adheres to < 150 lines budget).
  - `tests/dashboard-zone-dynamic-units.test.ts`: PASS.
  - `tests/dashboard-zone-reactivity.test.ts`: PASS.
  - `tests/mobile-workbench-feed.test.ts`: PASS.
  - `tests/smart-workbox-interaction.test.ts`: PASS.
- **Full Test Suite**: `npm test` runs 344 tests across 115 suites: **344 passed, 0 failed**.
- **TypeScript Check**: `src/` has 0 errors.

## Modified & Created Files
- `src/components/dashboard/personal-workbench.tsx` (Enhanced with `hideHeader` prop, 1-2 viewport layout, and role-adaptive insights)
- `src/components/workspace/smart-workbox.tsx` (Smart Workbox 4-counter card component with `/tasks` pre-filtered navigation)
- `src/components/dashboard/zones/dashboard-zone.tsx` (Mounted `PersonalWorkbench`, under 150 lines, reactive to filter changes)
- `tests/role-aware-workbench.test.ts` (Comprehensive test suite for Phase 7)
