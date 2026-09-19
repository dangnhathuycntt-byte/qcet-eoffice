# QCET E-Office — Dashboard & Workspace Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the QCET E-Office executive and personal dashboard architecture into a single canonical, accessible, server-authoritative cockpit adhering strictly to "Role Is Not Scope", eliminating duplicate metric strips and action queues, eradicating synthetic business literals, and enforcing WCAG 2.2 AA standards with 44px touch targets and mathematical denominator safety.

**Architecture:** A single canonical `DashboardOverview` component deployed on the root route (`/` and `zone=dashboard`) composed of:
1. Header IA with institutional title, period selector, and refresh CTA.
2. Canonical `ScopeSwitcher` bounded by server-verified `userContext.viewScopes` (`['PERSONAL', 'UNIT', 'SCHOOL']`).
3. Band 1: Single 4-card `AdaptiveMetricStrip` across all scopes with zero-denominator safety (`"—"` instead of false `"0%"`).
4. Band 2 (Asymmetric Grid):
   - Left Rail (7/12): Canonical `ActionInboxQueue` powered directly by `ActionInboxService.getActionInbox` prioritizing 5 institutional entity types (max 7 actionable items).
   - Right Rail (5/12): Operational context via `DepartmentAttentionSummary` (top 5 units sorted by overdue/blocked with zero-task neutral states), upcoming deadlines, and activity feed.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5, Tailwind CSS with Light-Only OKLCH tokens, Lucide React (strokeWidth 1.5, zero emojis), Node.js native test runner (`node:test`, `node:assert/strict`), Prisma ORM.

**Spec:** `docs/plans/active/2026-09-11-dashboard-workspace-consolidation.md`

## Global Constraints

- **One Capability, One Canonical Implementation:** Never render parallel metric strips, duplicate action queues, or secondary facades.
- **Role Is Not Scope:** Role defines statutory authority; Scope defines dataset display and aggregation filters. Never gate visual scope on boolean role checks (`isExecutive`, `isManager`). Always check `userContext.viewScopes`.
- **Server Truth Wins:** Direct in-process server service invocation (`ActionInboxService`, `getLiveDashboardData`) inside `src/app/page.tsx`, avoiding client-side HTTP waterfall round-trips.
- **Never Invent Operational Data (Rule 40):** Zero synthetic strings (eradicate `"Verified Clear"`, `"Hàng đợi điều hành thông suốt"`). Zero fake metrics. When `totalTasks === 0`, render `"—"` or `"Chưa có dữ liệu"`.
- **Light-Only Palette Compliance:** Strictly light tokens; zero `dark:` utility classes.
- **Zero-Emoji Policy:** Zero emojis in code, markup, or logs.
- **WCAG 2.2 AA Ergonomics:** Minimum 44x44px touch targets on mobile/tablet (`min-h-[44px] sm:min-h-[36px]`). Minimum 12px typography floor (`text-xs`).
- **Git Safety & Attribution:** Focused atomic commits. End commit messages with:
  `Co-Authored-By: Claude Code <noreply@anthropic.com>`

---

## Task Breakdown

### Task 1: Phase 0 — Regression & Composition Invariant Test Suite

- **Files:**
  - Create: `tests/dashboard-composition-invariants.test.ts`
  - Create: `tests/dashboard-scope-invariants.test.ts`
  - Create: `src/domain/workspace/scope-policy.ts` (minimal baseline)
- **Interfaces:**
  - Consumes: `node:test`, `node:assert/strict`, `fs`, `path`, React, ReactDOMServer
  - Produces: Executable invariant test suites asserting the 8 core composition invariants and canonical scope policy mappings
- **Steps:**
  - [ ] **Step 1: Write the failing test**
    Create `tests/dashboard-scope-invariants.test.ts`:
    ```typescript
    import { test, describe } from "node:test";
    import assert from "node:assert/strict";
    import {
      resolveWorkspaceScope,
      normalizeWorkspaceScope,
      toWorkspaceScope,
      toCanonicalViewScope,
    } from "../src/domain/workspace/scope-policy";
    import type { LiveDashboardOptions } from "../src/lib/server/dashboard-service";

    describe("Dashboard Scope Invariants & Policy", () => {
      describe("Canonical Mapping Invariants", () => {
        test("maps 1:1 between CanonicalViewScope and WorkspaceScope", () => {
          assert.equal(toWorkspaceScope("PERSONAL"), "my");
          assert.equal(toWorkspaceScope("UNIT"), "unit");
          assert.equal(toWorkspaceScope("SCHOOL"), "school");

          assert.equal(toCanonicalViewScope("my"), "PERSONAL");
          assert.equal(toCanonicalViewScope("unit"), "UNIT");
          assert.equal(toCanonicalViewScope("school"), "SCHOOL");
        });

        test("normalizes external query strings and legacy tokens", () => {
          assert.equal(normalizeWorkspaceScope("all"), "school");
          assert.equal(normalizeWorkspaceScope("school"), "school");
          assert.equal(normalizeWorkspaceScope("SCHOOL_TASKS"), "school");

          assert.equal(normalizeWorkspaceScope("unit"), "unit");
          assert.equal(normalizeWorkspaceScope("department"), "unit");
          assert.equal(normalizeWorkspaceScope("UNIT_TASKS"), "unit");

          assert.equal(normalizeWorkspaceScope("personal"), "my");
          assert.equal(normalizeWorkspaceScope("my"), "my");
          assert.equal(normalizeWorkspaceScope("MY_TASKS"), "my");

          assert.equal(normalizeWorkspaceScope("invalid_scope"), null);
          assert.equal(normalizeWorkspaceScope(null), null);
          assert.equal(normalizeWorkspaceScope(undefined), null);
        });
      });

      describe("Hierarchical Scope Fallback Resolution", () => {
        test("honors requested scope when permitted by user viewScopes", () => {
          const result = resolveWorkspaceScope({
            requestedScope: "unit",
            allowedViewScopes: ["PERSONAL", "UNIT"],
          });
          assert.equal(result.scope, "unit");
          assert.equal(result.canonicalViewScope, "UNIT");
          assert.equal(result.isFallback, false);
        });

        test("falls back to 'unit' when non-school user requests 'school'", () => {
          const result = resolveWorkspaceScope({
            requestedScope: "school",
            allowedViewScopes: ["PERSONAL", "UNIT"],
          });
          assert.equal(result.scope, "unit");
          assert.equal(result.canonicalViewScope, "UNIT");
          assert.equal(result.isFallback, true);
        });

        test("falls back to 'my' when individual staff user requests 'school'", () => {
          const result = resolveWorkspaceScope({
            requestedScope: "school",
            allowedViewScopes: ["PERSONAL"],
          });
          assert.equal(result.scope, "my");
          assert.equal(result.canonicalViewScope, "PERSONAL");
          assert.equal(result.isFallback, true);
        });

        test("defaults to 'school' for users possessing SCHOOL viewScope when no scope requested", () => {
          const result = resolveWorkspaceScope({
            requestedScope: null,
            allowedViewScopes: ["PERSONAL", "UNIT", "SCHOOL"],
          });
          assert.equal(result.scope, "school");
          assert.equal(result.isFallback, false);
        });

        test("defaults to 'unit' for managers possessing UNIT viewScope when no scope requested", () => {
          const result = resolveWorkspaceScope({
            requestedScope: undefined,
            allowedViewScopes: ["PERSONAL", "UNIT"],
          });
          assert.equal(result.scope, "unit");
          assert.equal(result.isFallback, false);
        });
      });

      describe("Server Query Criteria Symmetry", () => {
        test("LiveDashboardOptions must support optional scope", () => {
          const options: LiveDashboardOptions & { scope?: "my" | "unit" | "school" } = {
            scope: "school",
            departmentId: undefined,
          };
          assert.equal(options.scope, "school");
        });

        test("school scope query criteria must not bind userId to assignees", () => {
          const buildWhereTask = (options: { scope?: string; userId?: string; departmentId?: string }) => {
            const where: Record<string, unknown> = {};
            if (options.scope === "my" && options.userId) {
              where.assignees = { some: { userId: options.userId } };
            }
            if (options.scope === "unit" && options.departmentId) {
              where.departmentId = options.departmentId;
            }
            return where;
          };

          const schoolWhere = buildWhereTask({ scope: "school", userId: "user-123" });
          assert.equal(schoolWhere.assignees, undefined, "School query must not filter by assignee userId");
          assert.equal(schoolWhere.departmentId, undefined, "School query must not restrict departmentId");

          const myWhere = buildWhereTask({ scope: "my", userId: "user-123" });
          assert.deepEqual(myWhere.assignees, { some: { userId: "user-123" } });
        });
      });
    });
    ```
  - [ ] **Step 2: Run test to verify it fails**
    Command:
    `npx tsx --test tests/dashboard-scope-invariants.test.ts`
    Expected Error:
    `Cannot find module '../src/domain/workspace/scope-policy'`
  - [ ] **Step 3: Write minimal implementation**
    Create `src/domain/workspace/scope-policy.ts`:
    ```typescript
    import { TaskScope as PrismaTaskScope } from "@prisma/client";

    export type CanonicalViewScope = "PERSONAL" | "UNIT" | "SCHOOL";
    export type WorkspaceScope = "my" | "unit" | "school";
    export type LegacyTaskScope = "MY_TASKS" | "UNIT_TASKS" | "SCHOOL_TASKS";

    export interface ScopeResolutionContext {
      requestedScope?: string | null;
      allowedViewScopes: CanonicalViewScope[];
      preferredDefault?: WorkspaceScope;
    }

    export interface ScopeResolutionResult {
      scope: WorkspaceScope;
      canonicalViewScope: CanonicalViewScope;
      prismaTaskScope: PrismaTaskScope;
      isFallback: boolean;
      effectiveDepartmentId?: string;
    }

    export const CANONICAL_TO_WORKSPACE_MAP: Record<CanonicalViewScope, WorkspaceScope> = {
      PERSONAL: "my",
      UNIT: "unit",
      SCHOOL: "school",
    };

    export const WORKSPACE_TO_CANONICAL_MAP: Record<WorkspaceScope, CanonicalViewScope> = {
      my: "PERSONAL",
      unit: "UNIT",
      school: "SCHOOL",
    };

    export const WORKSPACE_TO_PRISMA_MAP: Record<WorkspaceScope, PrismaTaskScope> = {
      my: PrismaTaskScope.INDIVIDUAL,
      unit: PrismaTaskScope.DEPARTMENT,
      school: PrismaTaskScope.SCHOOL,
    };

    export function normalizeWorkspaceScope(raw?: string | null): WorkspaceScope | null {
      if (!raw) return null;
      const normalized = raw.trim().toLowerCase();

      if (normalized === "my" || normalized === "personal" || normalized === "my_tasks") {
        return "my";
      }
      if (normalized === "unit" || normalized === "unit_tasks" || normalized === "department") {
        return "unit";
      }
      if (normalized === "school" || normalized === "all" || normalized === "school_tasks") {
        return "school";
      }
      return null;
    }

    export function toWorkspaceScope(canonical: CanonicalViewScope): WorkspaceScope {
      return CANONICAL_TO_WORKSPACE_MAP[canonical];
    }

    export function toCanonicalViewScope(workspace: WorkspaceScope): CanonicalViewScope {
      return WORKSPACE_TO_CANONICAL_MAP[workspace];
    }

    export function resolveWorkspaceScope(context: ScopeResolutionContext): ScopeResolutionResult {
      const { requestedScope, allowedViewScopes, preferredDefault } = context;

      const allowedWorkspaceScopes = new Set<WorkspaceScope>(
        allowedViewScopes.map(toWorkspaceScope)
      );

      if (!allowedWorkspaceScopes.has("my")) {
        allowedWorkspaceScopes.add("my");
      }

      const requested = normalizeWorkspaceScope(requestedScope);

      if (requested && allowedWorkspaceScopes.has(requested)) {
        return {
          scope: requested,
          canonicalViewScope: toCanonicalViewScope(requested),
          prismaTaskScope: WORKSPACE_TO_PRISMA_MAP[requested],
          isFallback: false,
        };
      }

      if (preferredDefault && allowedWorkspaceScopes.has(preferredDefault)) {
        return {
          scope: preferredDefault,
          canonicalViewScope: toCanonicalViewScope(preferredDefault),
          prismaTaskScope: WORKSPACE_TO_PRISMA_MAP[preferredDefault],
          isFallback: requested !== null,
        };
      }

      let fallbackScope: WorkspaceScope = "my";
      if (allowedWorkspaceScopes.has("school")) {
        fallbackScope = "school";
      } else if (allowedWorkspaceScopes.has("unit")) {
        fallbackScope = "unit";
      }

      return {
        scope: fallbackScope,
        canonicalViewScope: toCanonicalViewScope(fallbackScope),
        prismaTaskScope: WORKSPACE_TO_PRISMA_MAP[fallbackScope],
        isFallback: requested !== null,
      };
    }
    ```
  - [ ] **Step 4: Run test to verify it passes**
    Command:
    `npx tsx --test tests/dashboard-scope-invariants.test.ts`
    Expected Output:
    `pass 9, fail 0`
  - [ ] **Step 5: Commit**
    Command:
    `git add src/domain/workspace/scope-policy.ts tests/dashboard-scope-invariants.test.ts && git commit -m "test(workspace): establish dashboard scope invariants and canonical policy"`

---

### Task 2: Phase 1 — Canonical Workspace Scope Policy & Server Context Binding

- **Files:**
  - Modify: `src/lib/server/dashboard-service.ts`
  - Modify: `src/app/page.tsx`
  - Test: `tests/dashboard-scope-invariants.test.ts`
- **Interfaces:**
  - Consumes: `LiveDashboardOptions`, `resolveWorkspaceScope`, `cookies()`, `verifySessionToken`
  - Produces: Symmetric server query filtering where `scope === 'school'` does not constrain assignees to `userId`
- **Steps:**
  - [ ] **Step 1: Write the failing test**
    Add server query criteria validation to `tests/dashboard-scope-invariants.test.ts`:
    ```typescript
    test("getLiveDashboardData accepts scope and does not restrict userId on school scope", async () => {
      const options: LiveDashboardOptions = {
        userId: "user-exec-1",
        scope: "school",
      };
      assert.equal(options.scope, "school");
    });
    ```
  - [ ] **Step 2: Run test to verify it fails**
    Command:
    `npx tsx --test tests/dashboard-scope-invariants.test.ts`
    Expected Error:
    `Type '{ userId: string; scope: string; }' is not assignable to type 'LiveDashboardOptions'`
  - [ ] **Step 3: Write minimal implementation**
    In `src/lib/server/dashboard-service.ts`:
    Update `LiveDashboardOptions` to include `scope?: "my" | "unit" | "school";`.
    Update query building around line 46:
    ```typescript
    export interface LiveDashboardOptions {
      userId?: string;
      departmentId?: string;
      academicMonth?: number;
      academicYear?: string;
      scope?: "my" | "unit" | "school";
    }
    ```
    In `getLiveDashboardData`:
    ```typescript
    if (options?.scope === "my" && options?.userId) {
      whereTask.assignees = {
        some: { userId: options.userId },
      };
    } else if (!options?.scope && options?.userId && options?.departmentId) {
      whereTask.assignees = {
        some: { userId: options.userId },
      };
    }

    if (options?.scope === "unit" && options?.departmentId) {
      whereTask.departmentId = options.departmentId;
    } else if (!options?.scope && options?.departmentId) {
      whereTask.departmentId = options.departmentId;
    }
    ```
    In `src/app/page.tsx`:
    Parse `searchParams` for `scope` and `dept`, compute authorized `viewScopes` from session, resolve effective scope via `resolveWorkspaceScope`, and invoke `getLiveDashboardData`:
    ```typescript
    const resolvedSearchParams = searchParams ? await searchParams : {};
    const requestedScope = typeof resolvedSearchParams.scope === "string" ? resolvedSearchParams.scope : null;
    const requestedDept = typeof resolvedSearchParams.dept === "string" ? resolvedSearchParams.dept : undefined;

    const allowedViewScopes: ("PERSONAL" | "UNIT" | "SCHOOL")[] = ["PERSONAL"];
    if (session?.departmentId || session?.role === "MANAGER" || session?.role === "ADMIN") {
      allowedViewScopes.push("UNIT");
    }
    if (isExec || session?.role === "ADMIN") {
      allowedViewScopes.push("SCHOOL");
    }

    const { scope: activeScope } = resolveWorkspaceScope({
      requestedScope,
      allowedViewScopes,
    });

    initialData = await getLiveDashboardData({
      userId: session.id,
      departmentId: activeScope === "school" ? undefined : requestedDept || session.departmentId || undefined,
      scope: activeScope,
    });
    ```
  - [ ] **Step 4: Run test to verify it passes**
    Command:
    `npx tsx --test tests/dashboard-scope-invariants.test.ts && npm run typecheck`
    Expected Output:
    `pass 10, fail 0` with zero TypeScript errors.
  - [ ] **Step 5: Commit**
    Command:
    `git add src/lib/server/dashboard-service.ts src/app/page.tsx tests/dashboard-scope-invariants.test.ts && git commit -m "feat(dashboard): bind server query criteria to canonical workspace scope policy"`

---

### Task 3: Phase 3 — Consolidated 4-Metric Macro Strip with Accessible Semantics & Zero-Denominator Safety

- **Files:**
  - Modify: `src/components/workspace/components/adaptive-metric-strip.tsx`
  - Modify: `tests/workspace-real-data-flow.test.ts`
  - Modify: `tests/adaptive-metric-strip.test.ts`
  - Test: `tests/adaptive-metric-strip.test.ts`
- **Interfaces:**
  - Consumes: `AdaptiveWorkspaceMetrics`, `WorkspaceScope`
  - Produces: Canonical 4-metric strip, `formatRate` zero-denominator protection, native semantic `<button type="button">`
- **Steps:**
  - [ ] **Step 1: Write the failing test**
    Update `tests/adaptive-metric-strip.test.ts` with assertions for denominator safety and semantic buttons:
    ```typescript
    import { test, describe } from "node:test";
    import assert from "node:assert/strict";
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import {
      AdaptiveMetricStrip,
      formatRate,
    } from "../src/components/workspace/components/adaptive-metric-strip";

    describe("AdaptiveMetricStrip 4-Card & Denominator Safety Invariants", () => {
      test("displays '—' when total tasks denominator is 0", () => {
        assert.equal(formatRate(0, 0), "—");
        assert.equal(formatRate(undefined, 0), "—");
        assert.equal(formatRate(50, 0), "—");

        const html = renderToStaticMarkup(
          React.createElement(AdaptiveMetricStrip, {
            metrics: {
              totalTasks: 0,
              urgentOverdueCount: 0,
              waitingApprovalCount: 0,
              completedRate: 0,
              labelScope: "Khoa CNTT",
            },
            scope: "unit",
          })
        );
        assert.ok(html.includes(">—<"), "Renders em-dash for 0/0 denominator");
        assert.ok(!html.includes(">0%<"), "Must not display 0% for zero tasks");
      });

      test("displays '0%' when total tasks > 0 but completion rate is 0", () => {
        assert.equal(formatRate(0, 5), "0%");
        const html = renderToStaticMarkup(
          React.createElement(AdaptiveMetricStrip, {
            metrics: {
              totalTasks: 5,
              urgentOverdueCount: 1,
              waitingApprovalCount: 1,
              completedRate: 0,
              labelScope: "Khoa CNTT",
            },
            scope: "unit",
          })
        );
        assert.ok(html.includes(">0%<"), "Renders authentic 0% when tasks exist but none completed");
      });

      test("renders semantic button elements with type='button' when onMetricClick is provided", () => {
        const html = renderToStaticMarkup(
          React.createElement(AdaptiveMetricStrip, {
            metrics: {
              totalTasks: 10,
              urgentOverdueCount: 1,
              waitingApprovalCount: 2,
              completedRate: 50,
              labelScope: "Toàn trường",
            },
            scope: "school",
            onMetricClick: () => {},
          })
        );
        assert.ok(html.includes('<button type="button"'), "Must render native button element");
      });

      test("enforces responsive grid classes grid-cols-2 and lg:grid-cols-4", () => {
        const html = renderToStaticMarkup(
          React.createElement(AdaptiveMetricStrip, {
            metrics: {
              totalTasks: 10,
              urgentOverdueCount: 0,
              waitingApprovalCount: 0,
              completedRate: 80,
              labelScope: "Toàn trường",
            },
            scope: "school",
          })
        );
        assert.ok(html.includes("grid-cols-2"), "Must support 2-column mobile/tablet layout");
        assert.ok(html.includes("lg:grid-cols-4"), "Must support 4-column desktop layout");
      });
    });
    ```
  - [ ] **Step 2: Run test to verify it fails**
    Command:
    `npx tsx --test tests/adaptive-metric-strip.test.ts`
    Expected Error:
    `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: formatRate(0, 0) => '0%' !== '—'`
  - [ ] **Step 3: Write minimal implementation**
    In `src/components/workspace/components/adaptive-metric-strip.tsx`:
    Export `formatRate`:
    ```typescript
    export function formatRate(rate: number | undefined | null, total: number = 1): string {
      if (total === 0 || rate === undefined || rate === null || !Number.isFinite(rate)) {
        return "—";
      }
      return `${Math.round(rate)}%`;
    }
    ```
    Implement 4 cards per scope (`school`, `unit`, `my`), native `<button type="button">` when `onMetricClick` is provided, `<div>` with `role="region"` when non-interactive, and responsive grid `grid grid-cols-2 lg:grid-cols-4 gap-2.5 p-1.5 rounded-xl bg-muted/40 border border-border/70 shadow-2xs w-full`.
    Update `tests/workspace-real-data-flow.test.ts` line 71 to assert `assert.ok(html.includes(">—<"))` for zero-task fixtures.
  - [ ] **Step 4: Run test to verify it passes**
    Command:
    `npx tsx --test tests/adaptive-metric-strip.test.ts && npx tsx --test tests/workspace-real-data-flow.test.ts`
    Expected Output:
    `pass` on both suites.
  - [ ] **Step 5: Commit**
    Command:
    `git add src/components/workspace/components/adaptive-metric-strip.tsx tests/adaptive-metric-strip.test.ts tests/workspace-real-data-flow.test.ts && git commit -m "fix(workspace): enforce 4-card metric strip with zero-denominator safety and semantic buttons"`

---

### Task 4: Phase 4 — Canonical Action Inbox Queue Component & Server Data Ingestion

- **Files:**
  - Create: `src/components/workspace/components/action-inbox-queue.tsx`
  - Modify: `src/app/page.tsx`
  - Create: `tests/action-inbox-queue.test.ts`
- **Interfaces:**
  - Consumes: `ActionInboxItem`, `ActionInboxResponse` from `@/contracts/me`, `ActionInboxService`
  - Produces: `ActionInboxQueue` component, server-side `actionInbox` prop delivery
- **Steps:**
  - [ ] **Step 1: Write the failing test**
    Create `tests/action-inbox-queue.test.ts`:
    ```typescript
    import test, { describe } from "node:test";
    import assert from "node:assert/strict";
    import { ActionInboxItemSchema, ActionInboxResponseSchema, type ActionInboxItem } from "../src/contracts/me";

    describe("Phase 4: Action Inbox Queue Contracts and Invariants", () => {
      const mockItems: ActionInboxItem[] = [
        {
          id: "inbox-doc-in-pres-1",
          resourceType: "INCOMING_DOCUMENT",
          resourceId: "doc-1",
          resourceCode: "102/UBND",
          title: "Chỉ đạo phối hợp đào tạo nghề năm 2026",
          requiredAction: "Ban hành chỉ đạo giao đơn vị chủ trì",
          reasonWhyMe: "Văn bản đến đang chờ Ban Giám hiệu chỉ đạo xử lý",
          priority: "URGENT",
          deadline: "2026-09-15T08:00:00.000Z",
          createdAt: "2026-09-10T02:00:00.000Z",
          linkUrl: "/documents/incoming/doc-1",
        },
        {
          id: "inbox-task-rev-2",
          resourceType: "TASK",
          resourceId: "task-2",
          resourceCode: "NV-2026-004",
          title: "Báo cáo kiểm định chất lượng chương trình đào tạo CNTT",
          requiredAction: "Đánh giá / Phê duyệt kết quả nhiệm vụ",
          reasonWhyMe: "Báo cáo kết quả nhiệm vụ đang chờ bạn phê duyệt",
          priority: "HIGH",
          deadline: "2026-09-20T17:00:00.000Z",
          createdAt: "2026-09-08T04:00:00.000Z",
          linkUrl: "/tasks/task-2",
        },
      ];

      test("Validates ActionInboxItem schema integrity", () => {
        for (const item of mockItems) {
          const parsed = ActionInboxItemSchema.safeParse(item);
          assert.strictEqual(parsed.success, true);
        }
      });

      test("Enforces canonical empty state semantics when no items exist", () => {
        const expectedTitle = "Không có việc cần xử lý ngay";
        const expectedDescription =
          "Hiện tại đồng chí không có nhiệm vụ, văn bản hoặc hồ sơ nào yêu cầu xử lý khẩn cấp.";

        assert.strictEqual(expectedTitle, "Không có việc cần xử lý ngay");
        assert.ok(expectedDescription.includes("không có nhiệm vụ"));
      });

      test("Validates ActionInboxResponse payload envelope", () => {
        const responsePayload = {
          total: mockItems.length,
          urgentCount: mockItems.filter((i) => i.priority === "URGENT").length,
          items: mockItems,
        };

        const parsed = ActionInboxResponseSchema.safeParse(responsePayload);
        assert.strictEqual(parsed.success, true);
      });
    });
    ```
  - [ ] **Step 2: Run test to verify it fails**
    Command:
    `npx tsx --test tests/action-inbox-queue.test.ts`
    Expected Output: Initial contract passes; proceed to scaffold component.
  - [ ] **Step 3: Write minimal implementation**
    Create `src/components/workspace/components/action-inbox-queue.tsx` implementing:
    - 5 institutional resource types: `TASK`, `INCOMING_DOCUMENT`, `OUTGOING_DOCUMENT`, `DOSSIER`, `DELEGATION`
    - Badges for priority: `URGENT` (`destructive`), `HIGH` (`amber`), `NORMAL` (`sapphire`), `LOW` (`outline`)
    - Max items clamp defaulting to 7
    - Canonical empty state: `"Không có việc cần xử lý ngay"` / `"Hiện tại đồng chí không có nhiệm vụ, văn bản hoặc hồ sơ nào yêu cầu xử lý khẩn cấp."`
    - Action button: native `<Button asChild>` wrapping Next.js `<Link href={item.linkUrl}>` with `min-h-[44px] sm:min-h-0` touch compliance
    In `src/app/page.tsx`:
    Import `ActionInboxService` and call `ActionInboxService.getActionInbox(session.id)`, passing `actionInbox` down into the client props.
  - [ ] **Step 4: Run test to verify it passes**
    Command:
    `npx tsx --test tests/action-inbox-queue.test.ts && npm run typecheck`
    Expected Output:
    `pass 3, fail 0` with zero TypeScript errors.
  - [ ] **Step 5: Commit**
    Command:
    `git add src/components/workspace/components/action-inbox-queue.tsx src/app/page.tsx tests/action-inbox-queue.test.ts && git commit -m "feat(workspace): create canonical ActionInboxQueue and bind direct server data ingestion"`

---

### Task 5: Phase 5 — Operational Context: Department Attention Summary & Scope Adaptivity

- **Files:**
  - Create: `src/components/workspace/components/department-attention-summary.tsx`
  - Create: `tests/department-attention-summary.test.ts`
- **Interfaces:**
  - Consumes: `DepartmentHealthSummary`, `SchoolTask`, `AuthUser`, `UpcomingItem`, `ActivityEvent`
  - Produces: `DepartmentAttentionSummary` adapting across `school`, `unit`, `my`
- **Steps:**
  - [ ] **Step 1: Write the failing test**
    Create `tests/department-attention-summary.test.ts`:
    ```typescript
    import { test, describe } from "node:test";
    import assert from "node:assert/strict";
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import {
      DepartmentAttentionSummary,
      sortUnitsNeedingAttention,
      getDepartmentTasksUrl,
    } from "../src/components/workspace/components/department-attention-summary";
    import type { DepartmentHealthSummary } from "../src/lib/executive-matrix-aggregator";

    const mockDepartments: DepartmentHealthSummary[] = [
      {
        departmentId: "CNTT",
        departmentName: "Khoa CNTT",
        leadName: "TS. Nguyễn Ngọc Vịnh",
        totalTasksCount: 10,
        completedTasksCount: 8,
        inProgressTasksCount: 2,
        blockedTasksCount: 0,
        overdueTasksCount: 0,
        averageProgressPercent: 80,
      },
      {
        departmentId: "DIEN",
        departmentName: "Khoa Điện",
        leadName: "ThS. Trần Văn Ba",
        totalTasksCount: 12,
        completedTasksCount: 3,
        inProgressTasksCount: 4,
        blockedTasksCount: 1,
        overdueTasksCount: 4,
        averageProgressPercent: 35,
      },
      {
        departmentId: "EMPTY_DEPT",
        departmentName: "Đơn vị mới",
        leadName: "Chưa phân công",
        totalTasksCount: 0,
        completedTasksCount: 0,
        inProgressTasksCount: 0,
        blockedTasksCount: 0,
        overdueTasksCount: 0,
        averageProgressPercent: 0,
      },
    ];

    describe("DepartmentAttentionSummary Invariants", () => {
      test("prioritizes overdue tasks first", () => {
        const sorted = sortUnitsNeedingAttention(mockDepartments);
        assert.equal(sorted[0].departmentId, "DIEN", "Unit with highest overdue must rank first");
      });

      test("ranks units with 0 tasks after active units", () => {
        const sorted = sortUnitsNeedingAttention(mockDepartments);
        const lastUnit = sorted[sorted.length - 1];
        assert.equal(lastUnit.departmentId, "EMPTY_DEPT");
      });

      test("displays 'Chưa có dữ liệu' in neutral badge instead of red 0%", () => {
        const html = renderToStaticMarkup(
          React.createElement(DepartmentAttentionSummary, {
            scope: "school",
            departments: [mockDepartments[2]],
          })
        );
        assert.match(html, /Chưa có dữ liệu/);
        assert.doesNotMatch(html, />0%</);
      });

      test("generates correct canonical URL for department filter", () => {
        const url = getDepartmentTasksUrl("CNTT");
        assert.equal(url, "/tasks?scope=school&dept=CNTT");
      });
    });
    ```
  - [ ] **Step 2: Run test to verify it fails**
    Command:
    `npx tsx --test tests/department-attention-summary.test.ts`
    Expected Error:
    `Cannot find module '../src/components/workspace/components/department-attention-summary'`
  - [ ] **Step 3: Write minimal implementation**
    Create `src/components/workspace/components/department-attention-summary.tsx` implementing:
    - `sortUnitsNeedingAttention`: `overdue` DESC, `blocked` DESC, `progress` ASC, 0-task units last
    - Zero-task units: badge `"Chưa có dữ liệu"`, track `bg-muted/40`, dash for overdue/blocked
    - Top 5 units display for `school` scope with deep link `/tasks?scope=school&dept=${encodeURIComponent(deptId)}`
    - Upcoming deadlines & workload distribution for `unit` scope
    - Personal deadlines & recent activity for `my` scope
  - [ ] **Step 4: Run test to verify it passes**
    Command:
    `npx tsx --test tests/department-attention-summary.test.ts`
    Expected Output:
    `pass 4, fail 0`
  - [ ] **Step 5: Commit**
    Command:
    `git add src/components/workspace/components/department-attention-summary.tsx tests/department-attention-summary.test.ts && git commit -m "feat(workspace): implement scope-adaptive DepartmentAttentionSummary with zero-task safety"`

---

### Task 6: Phase 2 & 6 — Canonical DashboardOverview Composition & Header IA

- **Files:**
  - Create: `src/components/workspace/dashboard-overview.tsx`
  - Modify: `src/components/dashboard/zones/dashboard-zone.tsx`
  - Modify: `src/components/dashboard/unified-task-hub-client.tsx`
  - Create: `tests/dashboard-composition-invariants.test.ts`
- **Interfaces:**
  - Consumes: `DashboardPayload`, `UserContextResponse`, `AdaptiveMetricStrip`, `ActionInboxQueue`, `DepartmentAttentionSummary`
  - Produces: Canonical `DashboardOverview` component, zone delegation adapter, viewScopes validation in navigation
- **Steps:**
  - [ ] **Step 1: Write the failing test**
    Create `tests/dashboard-composition-invariants.test.ts`:
    ```typescript
    import { describe, test } from "node:test";
    import assert from "node:assert/strict";
    import * as fs from "node:fs";
    import * as path from "node:path";
    import React from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import { DashboardOverview } from "../src/components/workspace/dashboard-overview";
    import type { DashboardPayload } from "../src/types/dashboard";
    import type { UserContextResponse } from "../src/contracts/me";

    const ROOT_DIR = process.cwd();

    describe("Dashboard Composition Invariants Suite", () => {
      const dummyUserContext: UserContextResponse = {
        identity: {
          id: "usr-01",
          name: "Nguyễn Văn A",
          email: "nva@qcet.edu.vn",
          provider: "credentials",
          title: "Trưởng phòng Đào tạo",
        },
        activeAssignments: [],
        viewScopes: ["PERSONAL", "UNIT"],
        responsibilityAreas: [],
        technicalCapabilities: [],
        delegations: [],
      };

      const dummyDashboardData: DashboardPayload = {
        stats: {
          totalSchoolTasks: 120,
          schoolTasksInProgress: 45,
          schoolTasksCompleted: 60,
          schoolTasksNotStarted: 15,
          totalStaffTasks: 80,
          staffTasksInProgress: 30,
          staffTasksCompleted: 40,
          staffTasksNotStarted: 10,
          needsReviewTasksCount: 8,
          overdueTasksCount: 4,
          averageSchoolProgressPercent: 72,
          completionRate: 50,
        },
        schoolTasks: [],
        staffTasks: [],
        notifications: [],
        activities: [],
        upcomingDeadlines: [],
        departmentHealth: Array.from({ length: 12 }, (_, i) => ({
          departmentId: `dept-${i + 1}`,
          departmentName: `Khoa / Phòng ${i + 1}`,
          totalTasks: 20,
          inProgressTasks: 10,
          completedTasks: 8,
          overdueTasks: i % 2 === 0 ? 2 : 0,
          averageProgressPercent: 65,
        })),
      };

      test("Invariant 1: Exactly 1 primary metric strip rendered on dashboard", () => {
        const html = renderToStaticMarkup(
          <DashboardOverview
            data={dummyDashboardData}
            userContext={dummyUserContext}
            activeScope="unit"
            onScopeChange={() => {}}
          />
        );

        const metricStripMatches = html.match(/data-slot="adaptive-metric-strip"/g) || [];
        assert.equal(
          metricStripMatches.length,
          1,
          `Expected exactly 1 metric strip, found ${metricStripMatches.length}`
        );
      });

      test("Invariant 2: Exactly 1 primary action queue rendered on dashboard", () => {
        const html = renderToStaticMarkup(
          <DashboardOverview
            data={dummyDashboardData}
            userContext={dummyUserContext}
            activeScope="unit"
            onScopeChange={() => {}}
          />
        );

        const actionQueueMatches = html.match(/data-slot="primary-action-queue"/g) || [];
        assert.equal(
          actionQueueMatches.length,
          1,
          `Expected exactly 1 primary action queue, found ${actionQueueMatches.length}`
        );
      });

      test("Invariant 3: No SmartWorkbox rendered on dashboard overview", () => {
        const overviewFilePath = path.resolve(ROOT_DIR, "src/components/workspace/dashboard-overview.tsx");
        const overviewContent = fs.readFileSync(overviewFilePath, "utf-8");

        assert.ok(
          !overviewContent.includes("SmartWorkbox"),
          "DashboardOverview must not import or render SmartWorkbox (belongs exclusively to /tasks)"
        );
      });

      test("Invariant 6: Role does not directly determine active scope", () => {
        const overviewFilePath = path.resolve(ROOT_DIR, "src/components/workspace/dashboard-overview.tsx");
        const overviewContent = fs.readFileSync(overviewFilePath, "utf-8");

        assert.ok(
          !overviewContent.includes("role === 'ADMIN' ? 'school'"),
          "DashboardOverview must not equate role directly with scope"
        );
      });

      test("Invariant 8: Department summary table renders at most 5 rows", () => {
        const html = renderToStaticMarkup(
          <DashboardOverview
            data={dummyDashboardData}
            userContext={{ ...dummyUserContext, viewScopes: ["PERSONAL", "UNIT", "SCHOOL"] }}
            activeScope="school"
            onScopeChange={() => {}}
          />
        );

        const cardMatches = html.match(/data-slot="attention-unit-card"/g) || [];
        assert.ok(
          cardMatches.length <= 5,
          `Department summary cards must be capped at 5 in overview rail, found ${cardMatches.length}`
        );
      });
    });
    ```
  - [ ] **Step 2: Run test to verify it fails**
    Command:
    `npx tsx --test tests/dashboard-composition-invariants.test.ts`
    Expected Error:
    `Cannot find module '../src/components/workspace/dashboard-overview'`
  - [ ] **Step 3: Write minimal implementation**
    Create `src/components/workspace/dashboard-overview.tsx`:
    - Composes Header IA, `ScopeSwitcher` (gated by `userContext.viewScopes`), `PeriodSelector`, single `AdaptiveMetricStrip`, `ActionInboxQueue` (7/12), and Operational Context rail (5/12).
    In `src/components/dashboard/zones/dashboard-zone.tsx`:
    - Delegate rendering to `DashboardOverview`, eliminating `ExecutiveStatStrip` + `ExecutiveActionCenter` + `PersonalWorkbench` co-render.
    In `src/components/dashboard/unified-task-hub-client.tsx`:
    - Replace `if (scope === "SCHOOL_TASKS" && !isExecutive)` with check against `userContext?.viewScopes.includes("SCHOOL")`.
  - [ ] **Step 4: Run test to verify it passes**
    Command:
    `npx tsx --test tests/dashboard-composition-invariants.test.ts`
    Expected Output:
    `pass 5, fail 0`
  - [ ] **Step 5: Commit**
    Command:
    `git add src/components/workspace/dashboard-overview.tsx src/components/dashboard/zones/dashboard-zone.tsx src/components/dashboard/unified-task-hub-client.tsx tests/dashboard-composition-invariants.test.ts && git commit -m "feat(dashboard): assemble canonical DashboardOverview and delegate zone rendering"`

---

### Task 7: Phase 7 & 8 — Empty State System & WCAG 2.2 AA / Touch Target Hardening

- **Files:**
  - Modify: `src/components/dashboard/executive-action-center.tsx`
  - Create: `tests/dashboard-a11y-and-empty-states.test.ts`
- **Interfaces:**
  - Consumes: WCAG 2.2 AA standards, Rule 10, Rule 40
  - Produces: Eradication of synthetic literals, 44px touch targets across all mobile controls, clean institutional empty states
- **Steps:**
  - [ ] **Step 1: Write the failing test**
    Create `tests/dashboard-a11y-and-empty-states.test.ts`:
    ```typescript
    import { describe, test } from "node:test";
    import assert from "node:assert/strict";
    import * as fs from "node:fs";
    import * as path from "node:path";

    const ROOT_DIR = process.cwd();

    describe("Phase 7 & 8: Empty States & WCAG 2.2 AA Hardening", () => {
      test("Zero occurrence of 'Verified Clear' or 'Hàng đợi điều hành thông suốt' literals", () => {
        const filesToAudit = [
          "src/components/workspace/dashboard-overview.tsx",
          "src/components/dashboard/zones/dashboard-zone.tsx",
          "src/components/dashboard/executive-action-center.tsx",
        ];

        for (const relPath of filesToAudit) {
          const fullPath = path.resolve(ROOT_DIR, relPath);
          if (!fs.existsSync(fullPath)) continue;
          const content = fs.readFileSync(fullPath, "utf-8");

          assert.ok(
            !content.includes("Verified Clear"),
            `${relPath} must not contain synthetic 'Verified Clear' literal`
          );
          assert.ok(
            !content.includes("Hàng đợi điều hành thông suốt"),
            `${relPath} must not contain synthetic 'Hàng đợi điều hành thông suốt' literal`
          );
        }
      });

      test("Enforces minimum 44px touch targets on interactive buttons", () => {
        const overviewPath = path.resolve(ROOT_DIR, "src/components/workspace/dashboard-overview.tsx");
        const content = fs.readFileSync(overviewPath, "utf-8");
        assert.ok(content.includes("min-h-[44px]"), "Dashboard buttons must enforce min-h-[44px]");
        assert.ok(content.includes("touch-manipulation"), "Interactive elements must declare touch-manipulation");
      });

      test("Enforces typography floor >= 12px (text-xs minimum)", () => {
        const files = [
          "src/components/workspace/dashboard-overview.tsx",
          "src/components/workspace/components/action-inbox-queue.tsx",
          "src/components/workspace/components/department-attention-summary.tsx",
        ];

        for (const relPath of files) {
          const fullPath = path.resolve(ROOT_DIR, relPath);
          if (!fs.existsSync(fullPath)) continue;
          const content = fs.readFileSync(fullPath, "utf-8");
          assert.doesNotMatch(content, /text-\[10px\]/, `${relPath} must not contain text-[10px]`);
          assert.doesNotMatch(content, /text-\[9px\]/, `${relPath} must not contain text-[9px]`);
        }
      });
    });
    ```
  - [ ] **Step 2: Run test to verify it fails**
    Command:
    `npx tsx --test tests/dashboard-a11y-and-empty-states.test.ts`
    Expected Error:
    `src/components/dashboard/executive-action-center.tsx must not contain synthetic 'Verified Clear' literal`
  - [ ] **Step 3: Write minimal implementation**
    In `src/components/dashboard/executive-action-center.tsx`:
    Replace `"Hàng đợi điều hành thông suốt"` with `"Không có việc cần xử lý ngay"`.
    Replace `"Verified Clear"` with `"Tất cả nhiệm vụ và hồ sơ thẩm định đã được xử lý hoàn tất."`.
  - [ ] **Step 4: Run test to verify it passes**
    Command:
    `npx tsx --test tests/dashboard-a11y-and-empty-states.test.ts`
    Expected Output:
    `pass 3, fail 0`
  - [ ] **Step 5: Commit**
    Command:
    `git add src/components/dashboard/executive-action-center.tsx tests/dashboard-a11y-and-empty-states.test.ts && git commit -m "fix(a11y): eradicate synthetic literals and harden touch target standards"`

---

### Task 8: Phase 10 & 11 — Legacy Dashboard Decommissioning & Documentation Invariants

- **Files:**
  - Modify: `DESIGN.md`
  - Modify: `docs/plans/active/2026-09-11-dashboard-workspace-consolidation.md`
  - Test: Run full verification suite
- **Interfaces:**
  - Consumes: Architectural documentation, system invariants
  - Produces: Updated design contracts, completed status transition in active plan
- **Steps:**
  - [ ] **Step 1: Write the failing test**
    Add documentation invariant check to `tests/dashboard-composition-invariants.test.ts`:
    ```typescript
    test("DESIGN.md documents the canonical 4-metric strip and ActionInboxQueue architecture", () => {
      const designPath = path.resolve(ROOT_DIR, "DESIGN.md");
      const designContent = fs.readFileSync(designPath, "utf-8");
      assert.ok(
        designContent.includes("AdaptiveMetricStrip") || designContent.includes("DashboardOverview"),
        "DESIGN.md must document canonical DashboardOverview and 4-metric strip"
      );
    });
    ```
  - [ ] **Step 2: Run test to verify it fails**
    Command:
    `npx tsx --test tests/dashboard-composition-invariants.test.ts`
    Expected Error:
    `DESIGN.md must document canonical DashboardOverview and 4-metric strip`
  - [ ] **Step 3: Write minimal implementation**
    Update `DESIGN.md` with:
    ```markdown
    ### Canonical Dashboard & Workspace Architecture
    - **DashboardOverview**: Single canonical cockpit at `/` and `zone=dashboard`.
    - **AdaptiveMetricStrip**: Strictly 4 macro metrics per scope (`ALL`, `OVERDUE`, `NEEDS_REVIEW`, `COMPLETED`). Displays em-dash `"—"` on zero denominator (`totalTasks === 0`).
    - **ActionInboxQueue**: Action-first queue displaying up to 7 priority-weighted items spanning `TASK`, `INCOMING_DOCUMENT`, `OUTGOING_DOCUMENT`, `DOSSIER`, and `DELEGATION`.
    - **DepartmentAttentionSummary**: Contextual summary displaying top 5 units needing attention in `school` scope, with neutral `"Chưa có dữ liệu"` badge for zero-task units.
    - **Scope Policy**: Governed by `userContext.viewScopes` with hierarchical fallback (`SCHOOL -> UNIT -> PERSONAL`).
    ```
    Update status in `docs/plans/active/2026-09-11-dashboard-workspace-consolidation.md` to indicate plan execution readiness.
  - [ ] **Step 4: Run test to verify it passes**
    Command:
    `npm run typecheck && npx tsx --test tests/dashboard-composition-invariants.test.ts && npx tsx --test tests/dashboard-scope-invariants.test.ts && npx tsx --test tests/adaptive-metric-strip.test.ts && npx tsx --test tests/action-inbox-queue.test.ts && npx tsx --test tests/department-attention-summary.test.ts && npx tsx --test tests/dashboard-a11y-and-empty-states.test.ts`
    Expected Output:
    All tests pass; 0 TypeScript errors.
  - [ ] **Step 5: Commit**
    Command:
    `git add DESIGN.md docs/plans/active/2026-09-11-dashboard-workspace-consolidation.md tests/dashboard-composition-invariants.test.ts && git commit -m "docs(architecture): update DESIGN.md and consolidate dashboard workspace invariants"`
