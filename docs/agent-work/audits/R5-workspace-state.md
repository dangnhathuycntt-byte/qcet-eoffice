# R5 Workspace State, Routing, & Authorization Audit

**Document**: `docs/agent-work/audits/R5-workspace-state.md`  
**Auditor**: R5 Workspace State & Navigation Audit Agent (QCET Work UI Semantic Consolidation)  
**Date**: 2026-09-10  
**Status**: COMPLETE — READ-ONLY AUDIT & VERIFICATION  
**Scope**: Dashboard (`/` & `/dashboard`), Tasks (`/tasks` & `/unit-tasks`), Calendar (`/calendar`), Workspace Components (`src/components/workspace/*`), State Synchronization Hooks (`src/hooks/use-url-params-sync.ts`, `src/hooks/use-task-filters.ts`, `src/hooks/use-workspace-query.ts`, `src/lib/workspace-query.ts`), Server Authorization & Route Guards (`src/middleware.ts`, `src/server/tasks/task-query-service.ts`, `src/server/authorization/*`, `src/server/services/user-context-service.ts`).

---

## 1. Executive Summary

An exhaustive audit of workspace routing, query parameters, state synchronization, client-side hooks, local storage, and server authorization boundaries was conducted across the three primary QCET E-Office surfaces (`Dashboard`, `Tasks`, and `Calendar`).

### 1.1. Key Audit Discoveries
1. **Dual Competing URL Synchronizers (Race Condition & Route Hardcoding)**:
   - `src/hooks/use-url-params-sync.ts` manages query parameters on the Dashboard using `all | unit | personal` for `scope`, and hardcodes navigation targets via `router.replace(`/?${qs}`)`.
   - In parallel, `src/hooks/use-task-filters.ts` (`syncTaskUrlParams`) and `src/components/workspace/unified-adaptive-workspace.tsx` serialize scope as `school | unit | my`, targeting `window.location.pathname` or `/tasks`.
   - When transitioning between surfaces or updating filters, the two synchronizers overwrite query parameters with conflicting vocabulary (e.g., `scope=all` vs `scope=school`, `scope=personal` vs `scope=my`).
2. **Double Routing & Hydration Mismatch in Tasks**:
   - `src/app/tasks/tasks-page-client.tsx` listens to `useSearchParams()` and independently fires `router.replace('/tasks?scope=' + s)` on scope change.
   - Concurrently, `UnifiedAdaptiveWorkspace` mounts an internal `useEffect` that calls `syncTaskUrlParams`, issuing a second `router.replace` with `dept`, `status`, `month`, `q`, `view`, and `taskId`.
   - In `tasks-page-client.tsx`, fallback scope is determined via legacy SaaS role checks: `user?.role === "ADMIN" ? "school" : user?.role === "MANAGER" ? "unit" : "my"`, directly violating Rule 05 (Domain Freeze) and Rule 00 (Role Is Not Scope).
3. **Domain Freeze Violations in Attention Hubs (`forcedRole`)**:
   - `src/components/workspace/components/attention-hubs.tsx` mounts `ExecutiveAttentionHub`, `DepartmentAttentionHub`, and `StaffAttentionHub` passing hardcoded `forcedRole="ADMIN"`, `forcedRole="MANAGER"`, and `forcedRole="STAFF"` into `UnifiedAdaptiveWorkspace`.
   - This violates Rule 05 Section 1 ("Strictly prohibit creating new viewpoint facades, simulated role selectors, or client-side masquerading components (`forcedRole`, role switcher pills, viewpoint banners)").
4. **URL Deep-Linking Asymmetry across Surfaces**:
   - `/tasks` supports rich deep-linking (`scope`, `dept`, `status`, `month`, `q`, `view`, `taskId`, `viewId`).
   - `/calendar` supports `date`, `view`, and `taskId`, but completely ignores `scope`, `dept`, and `q`, meaning departmental or search filter context is lost when navigating to the calendar.
   - `/` (Dashboard) supports `scope`, `view`, `dept`, `month`, but fails to sync search query `q` or `taskId` to the URL.
5. **Route Redundancy & Canonical Routing**:
   - Permanent redirects in `next.config.ts` map `/dashboard` -> `/` and `/unit-tasks` -> `/tasks?scope=unit`.
   - `src/middleware.ts` intercepts legacy query parameter `?zone=*` and issues a 308 permanent redirect to canonical top-level routes (`/tasks`, `/calendar`, `/documents`, `/org`).
   - However, client components in `src/app/calendar/page.tsx` and `src/components/dashboard/unified-task-hub-client.tsx` retain redundant client-side `zone` check effects and fallbacks.
6. **Server Truth & Authorization Safety**:
   - Server-side task listing in `src/server/tasks/task-query-service.ts` unconditionally appends `buildTaskReadWhere(authTarget)` to the Prisma `where.AND` query array.
   - Manipulation of URL parameters (such as forging `?scope=school` or `?dept=OTHER`) by unauthorized users cannot bypass server authorization. Prisma evaluates the conjunction (AND) of client filters and server RBAC rules, returning an empty set or strictly permitted subsets.

---

## 2. Current State Mapping Matrix

The matrix below maps the sources of truth, storage tiers, serialization formats, and synchronization risks for all 8 operational dimensions defined in `REQ-WORKSPACE-STATE` and `src/contracts/workspace-semantic.ts`, plus statutory permissions.

| State Dimension | Surface | Source of Truth | Storage Tier | Current Serialization / Values | Desynchronization Risks & Flaws |
|---|---|---|---|---|---|
| **1. Scope** | **Tasks** (`/tasks`) | URL query parameter `scope` | Tier 1: URL State -> React State | `school` \| `unit` \| `my` | Fallback in `tasks-page-client.tsx` checks `user.role === "ADMIN"`. Accepts legacy `all`, `personal`, `SCHOOL_TASKS`, `UNIT_TASKS`, `MY_TASKS`. |
| | **Dashboard** (`/`) | `useUrlParamsSync` | Tier 1: URL State -> React State | `all` \| `unit` \| `personal` (maps internally to `SCHOOL_TASKS` \| `UNIT_TASKS` \| `MY_TASKS`) | **Vocabulary Conflict**: Serializes `all` and `personal` to URL, conflicting with `/tasks` which writes `school` and `my`. |
| | **Calendar** (`/calendar`) | Absent from URL | Implicit / Server Overview | None (fetches all tasks from `/api/dashboard/overview`) | **Missing State**: User cannot deep-link to unit-specific or personal calendar schedules. |
| | **Server Authority** | `UserContextService` (`GET /api/me/context`) | Tier 2: Server DB Truth (Positions, Units, Delegations) | `PERSONAL` \| `UNIT` \| `SCHOOL` in `viewScopes` array | Client does not validate requested scope against server `viewScopes` prior to query dispatch. |
| **2. Unit / Dept** | **Tasks** (`/tasks`) | URL query parameter `dept` | Tier 1: URL State -> React State | Code or ID (e.g., `CNTT`, `DT`, `ALL`) | Cleared if `ALL` or user department in some codepaths. Inconsistent case sensitivity (`toUpperCase()` vs lowercase). |
| | **Dashboard** (`/`) | URL query parameter `dept` | Tier 1: URL State -> React State | Code or ID (`ALL` deletes param) | Executive can filter by any department; non-executive client UI hides selector, but URL parameter is not guarded. |
| | **Calendar** (`/calendar`) | Absent from URL | React State (Component Internal) | Not in URL | Cannot share a filtered departmental calendar view via URL. |
| **3. Period / Date** | **Tasks** (`/tasks`) | URL query parameter `month` | Tier 1: URL State -> React State | Academic month integer `1..12` or `ALL` | Academic calendar maps month integer according to Vietnamese vocational higher-ed year (Sept = month 9). Omitted when `ALL`. |
| | **Dashboard** (`/`) | URL query parameter `month` | Tier 1: URL State -> React State | `1..12` or `ALL` | Sourced via `useUrlParamsSync`, but uses `academicMonth` in `useTaskFilters`. |
| | **Calendar** (`/calendar`) | URL query parameter `date` | Tier 1: URL State -> React State | ISO Date `YYYY-MM-DD` (e.g. `2026-09-06`) | Uses `date`, completely disconnected from `month` in Tasks and Dashboard. No unified period contract. |
| **4. Search Query (`q`)** | **Tasks** (`/tasks`) | URL query parameter `q` | Tier 1: URL State -> React State (`useDeferredValue`) | Encoded string (e.g., `?q=ki%E1%BB%83m+tra`) | Handled by `syncTaskUrlParams`. Omitted when empty. |
| | **Dashboard** (`/`) | React State (`searchQuery` in `useTaskFilters`) | Tier 3: React State ONLY | Not synced to URL | **Loss on Reload**: Searching in Dashboard is lost on page refresh or browser back navigation. |
| | **Calendar** (`/calendar`) | React State (Calendar search bar) | Tier 3: React State ONLY | Not synced to URL | Search state cannot be shared or bookmarked. |
| | **Global Palette** | `localStorage` (`qcet_recent_searches_v1`) | Tier 4: Browser localStorage | JSON array of strings: `["q1", "q2"]` | Transient convenience search history, correctly kept out of URL. |
| **5. Filters: Status** | **Tasks** (`/tasks`) | URL query parameter `status` | Tier 1: URL State -> React State | `IN_PROGRESS` \| `COMPLETED` \| `WAITING_APPROVAL` \| `PENDING_EXECUTIVE_APPROVAL` \| `BLOCKED` \| `OVERDUE` \| `ALL` | Legacy param `tab` is auto-migrated to `status`. Omitted when `ALL`. |
| | **Dashboard** (`/`) | React State (`activeStatus` / Filter Chips) | Tier 3: React State ONLY | Not synced to URL | Status pill clicks on Dashboard do not reflect in URL. |
| **Filters: Attention** | **Tasks** (`/tasks`) | URL query parameter `attention` | Tier 1: URL State -> React State | `requires_my_approval` \| `requires_my_action` \| `blocked` \| `overdue` \| `due_soon` | Subjective user attention backlog filter. Kept distinct from objective lifecycle status. |
| | **Dashboard** (`/`) | React State | Tier 3: React State ONLY | Not in URL | Attention card clicks do not update query parameters. |
| **Filters: Workbox** | **Tasks** (`/tasks`) | URL query parameter `workbox` | Tier 1: URL State -> React State | `urgent` \| `waiting_approval` \| `pending` \| `overdue` \| `ALL` | Synced via `syncTaskUrlParams`. |
| | **Dashboard** (`/`) | React State (`activeWorkbox` in `DashboardDataContext`) | Tier 3: React State ONLY | Not synced to URL in `useUrlParamsSync` | Clicking a stat card in `ExecutiveStatStrip` sets React state; does not create a bookmarkable URL. |
| **6. View Mode** | **Tasks** (`/tasks`) | URL query parameter `view` | Tier 1: URL State -> React State | `table` \| `kanban` (default `table` is omitted) | Default in `TaskManagementWorkspaceProps` was `kanban`, but `UnifiedAdaptiveWorkspace` default is `table`, causing flip-flop. |
| | **Calendar** (`/calendar`) | URL query parameter `view` | Tier 1: URL State -> React State | `month` \| `week` \| `day` \| `agenda` (default `month`) | Updated via `window.history.replaceState` instead of Next.js router. |
| | **Dashboard** (`/`) | URL query parameter `view` | Tier 1: URL State -> React State | `focus` \| `table` \| `calendar` \| `department` \| `executive` | Overloaded name: `view` means dashboard zone layout on `/`, but layout format on `/tasks` and time scale on `/calendar`. |
| **7. Selection: Task** | **Tasks** (`/tasks`) | URL query parameter `taskId` | Tier 1: URL State -> React State | Task ID, Task Code, or subtask ID | Deep link opens `TaskDetailSideSheet`. Sourced via `syncTaskUrlParams` and popstate listener. |
| | **Calendar** (`/calendar`) | URL query parameter `taskId` | Tier 1: URL State -> React State | Task ID string | Handled via `searchParams.get("taskId")`. Opens side sheet. |
| | **Dashboard** (`/`) | React State (`selectedTask` in `DashboardModalContext`) | Tier 3: React State ONLY | Not in URL | Clicking a task on Dashboard opens modal, but does NOT update URL. Reload closes modal. |
| **Selection: Saved View** | **Tasks** (`/tasks`) | URL query parameter `viewId` + `localStorage` | Tier 1: URL -> Tier 4: `localStorage` -> React State | Preset ID (`exec-pending-approval`, etc.) or Custom UUID | Custom views stored in `localStorage` under `qcet_saved_task_views_v1_${userId}`. Not synced to server DB. |
| **8. Permissions / Authority** | **All Routes** | Server Session Cookie (`qcet_session`) & Authorization Header | Tier 2: Server Session -> Live DB | Authenticated JWT containing `sessionId`, `userId` | `resolveCurrentSession` validates active user in DB. `AuthorizationContext` resolves positions, units, and delegations. |

---

## 3. Deep-Dive: Code Inconsistencies, Flaws & Vulnerabilities

### 3.1. The Dual URL Synchronizer Battle (`useUrlParamsSync` vs `syncTaskUrlParams`)

In `src/hooks/use-url-params-sync.ts`:
```typescript
// Lines 34-45
export function workspaceScopeToUrlParam(scope: TaskScope): "all" | "unit" | "personal" {
  switch (scope) {
    case "SCHOOL_TASKS":
      return "all";
    case "UNIT_TASKS":
      return "unit";
    case "MY_TASKS":
      return "personal";
  }
}
```
And inside `pushUrlState`:
```typescript
// Lines 179-183
const queryString = searchParams.toString();
const targetUrl = queryString ? `/?${queryString}` : "/";
router.replace(targetUrl, { scroll: false });
```

Conversely, in `src/hooks/use-task-filters.ts`:
```typescript
// Lines 69-79
export function buildTaskUrlQuery(params: TaskUrlParams, existingSearchParams?: URLSearchParams): string {
  // ...
  if (params.scope) {
    searchParams.set("scope", params.scope); // "school" | "unit" | "my"
  }
  // ...
}
```
And in `syncTaskUrlParams`:
```typescript
// Lines 86-98
export function syncTaskUrlParams(params: Partial<TaskUrlParams>, router?: { replace: ... }): void {
  // ...
  const basePath = typeof window !== "undefined" ? window.location.pathname : "/tasks";
  const newUrl = queryString ? `${basePath}?${queryString}` : basePath;
  router.replace(newUrl, { scroll: false });
}
```

**Architectural Defects**:
1. **Vocabulary Conflict**: If a user is on the Tasks surface embedded in the Dashboard or navigates between them, the scope query flips between `scope=all` / `scope=personal` and `scope=school` / `scope=my`.
2. **Clobbered Pathnames**: `useUrlParamsSync` forcefully writes to `/?...`, clobbering `/tasks` if ever invoked on that route.
3. **SSR Inconsistency**: `syncTaskUrlParams` uses `window.location.pathname`, creating non-deterministic SSR vs client hydration outcomes.

### 3.2. Domain Freeze Violations in Attention Hubs (`forcedRole`)

In `src/components/workspace/components/attention-hubs.tsx`:
```typescript
// Line 60: ExecutiveAttentionHub
<UnifiedAdaptiveWorkspace
  user={user}
  tasks={tasks}
  initialScope="school"
  forcedRole="ADMIN"
  contextTitle="Khoang điều hành Ban Giám hiệu"
  // ...
/>

// Line 98: DepartmentAttentionHub
<UnifiedAdaptiveWorkspace
  user={user}
  tasks={tasks}
  initialScope="unit"
  forcedRole="MANAGER"
  contextTitle="Không gian làm việc Trưởng đơn vị - Khoa / Phòng"
  // ...
/>

// Line 134: StaffAttentionHub
<UnifiedAdaptiveWorkspace
  user={user}
  tasks={tasks}
  initialScope="my"
  forcedRole="STAFF"
  contextTitle="Không gian công việc Giảng viên / Chuyên viên"
  // ...
/>
```

**Architectural Defects**:
1. **Rule 05 Violation**: Rule 05 explicitly bans `forcedRole` and client-side masquerading facades.
2. **Statutory Governance Mismatch**: Authority in QCET E-Office is grounded in statutory institutional positions (Hiệu trưởng, Phó Hiệu trưởng, Trưởng phòng, Trưởng khoa) resolved from `AuthorizationContextService`, NOT hardcoded synthetic roles (`ADMIN | MANAGER | STAFF`).
3. **Parallel Engines**: These wrappers artificially simulate different roles by passing `forcedRole`, creating parallel execution branches inside `UnifiedAdaptiveWorkspace`.

### 3.3. Client-Side Role Fallback in `TasksPageClient`

In `src/app/tasks/tasks-page-client.tsx`:
```typescript
// Lines 24-30
const fallback: WorkspaceScope =
  user?.role === "ADMIN" ? "school" : user?.role === "MANAGER" ? "unit" : "my";
const scope: WorkspaceScope =
  raw === "school" || raw === "unit" || raw === "my"
    ? raw
    : initialScope || fallback;
```

**Architectural Defects**:
1. **Rule 00 ("Role Is Not Scope") Violation**: Having an administrative role does not mean the user's default filter must always be school-wide; having a staff role does not preclude viewing school-wide tasks if authorized.
2. **Rule 05 Section 1 Violation**: Prohibits authoring ad-hoc client-side `user.role` conditionals.
3. **Fix**: Scope fallback must be derived from `userContext.viewScopes` (e.g. if `viewScopes.includes("SCHOOL")`, default to `school`; otherwise `unit` or `my`).

### 3.4. LocalStorage Usage Audit

A comprehensive codebase audit mapped all active `localStorage` keys:

| Storage Key | Location | Content / Type | Purpose | Invariant Compliance |
|---|---|---|---|---|
| `qcet_saved_task_views_v1_${userId}` | `src/lib/saved-views/saved-views-store.ts` | JSON array of `SavedTaskView` objects | Custom user-created task filter views | **Tier 4 Browser Preference**: Compliant, but lacks server sync across devices. |
| `qcet_recent_searches_v1` | `src/components/layout/command-search-modal.tsx` | JSON array of search strings | Recent global search history | **Tier 4 Browser Preference**: Compliant convenience cache. |
| `qcet-display-density` | `src/components/density-provider.tsx` | `"compact"` \| `"comfortable"` | UI spacing preference | **Tier 4 Browser Preference**: Compliant visual presentation setting. |
| `qcet_ui_zoom` | `src/components/navigation.tsx` | Numeric zoom string (e.g., `"1"`) | Accessibility UI scale | **Tier 4 Browser Preference**: Compliant accessibility preference. |
| `qcet_sidebar_collapsed` | `src/components/layout/sidebar-context.tsx` | Boolean string (`"true"` / `"false"`) | Sidebar collapse state | **Tier 4 Browser Preference**: Compliant layout persistence. |
| `qcet_onboarding_${userId}` | `src/hooks/use-onboarding.ts` | JSON onboarding checklist state | Tour / Onboarding completion | **Hybrid**: Cached locally, synced to `User.onboardingData` in DB. Server truth wins. |
| `qcet_active_user` | `src/lib/auth-context.tsx` | Serialized user identity | Offline PWA authentication fallback | **Read-Only Offline Cache**: Compliant as long as server session remains authoritative. |

---

### 3.5. Verification That URL Parameter State Cannot Bypass Server Authorization Checks

A fundamental invariant of QCET E-Office (Rule 00, Rule 05, Rule 30) is that client state, including manipulated URL query parameters, must **never** be trusted by the server for authorization or data filtering.

We conducted a complete trace of `src/server/tasks/task-query-service.ts` and `src/server/authorization/authorization-engine.ts` to mathematically and architecturally verify that URL tampering cannot bypass server RBAC.

#### Code Trace: `TaskQueryService.queryTasks`
In `src/server/tasks/task-query-service.ts` (lines 425–444):
```typescript
// Task list authorization at database level (F02 / Canonical Task Read)
let authTarget: AuthorizationContext | AuthenticatedUser | null = null;
if (isAuthorizationContext(ctx)) {
  authTarget = ctx;
} else if ((ctx as any).authorizationContext) {
  authTarget = (ctx as any).authorizationContext;
} else if (ctx.user) {
  authTarget = ctx.user;
}

if (authTarget) {
  const authWhere = buildTaskReadWhere(authTarget);
  if (authWhere && Object.keys(authWhere).length > 0) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      authWhere,
    ];
  }
}
```

And in `buildTaskReadWhere(context)` (lines 190–302):
- **System Admin**: returns `{}` (school-wide read).
- **Institutional Leadership** (HIEU_TRUONG, PHO_HIEU_TRUONG, BGH, or BOARD/SCHOOL unit oversight): returns `{}` (school-wide read).
- **Non-Executive (Unit Manager, Staff, Faculty)**:
  ```typescript
  const authConditions: Prisma.TaskWhereInput[] = [
    { assignees: { some: { userId } } },
    { actors: { some: { userId } } },
  ];

  if (unitIds.length === 1) {
    authConditions.push({ departmentId: unitIds[0] });
  } else if (unitIds.length > 1) {
    authConditions.push({ departmentId: { in: unitIds } });
  }

  return {
    OR: authConditions,
  };
  ```

#### Adversarial Tampering Verification Scenarios

1. **Adversarial Scenario 1: Non-Executive Tampering with `?scope=school`**:
   - **Attacker Action**: A faculty member in Department A (CNTT) manually edits their browser URL to `https://eoffice.qcet.edu.vn/tasks?scope=school`.
   - **Client Request**: Client sends `GET /api/tasks?scope=SCHOOL`.
   - **Prisma Where Execution**:
     ```typescript
     where = {
       AND: [
         { scope: "SCHOOL" }, // Client filter
         {
           OR: [
             { assignees: { some: { userId: "faculty_user_id" } } },
             { actors: { some: { userId: "faculty_user_id" } } },
             { departmentId: "dept_cntt_id" }
           ]
         } // Server RBAC filter (buildTaskReadWhere)
       ]
     }
     ```
   - **Verification Result**: The server executes the logical conjunction `ClientFilter AND ServerAuthFilter`. The query returns **only** school-level tasks that this specific user is assigned to, is an actor in, or that involve their department. All other institutional school-level tasks are strictly excluded by the database query engine. Zero unauthorized records are exposed.

2. **Adversarial Scenario 2: Cross-Department Data Exfiltration via `?dept=KHTV`**:
   - **Attacker Action**: An employee of the IT Department (`CNTT`) attempts to spy on Finance (`KHTV`) by setting `?scope=unit&dept=KHTV`.
   - **Client Request**: Client sends `GET /api/tasks?scope=UNIT&departmentId=dept_khtv_id`.
   - **Prisma Where Execution**:
     ```typescript
     where = {
       AND: [
         { departmentId: "dept_khtv_id" }, // Client filter
         {
           OR: [
             { assignees: { some: { userId: "employee_user_id" } } },
             { actors: { some: { userId: "employee_user_id" } } },
             { departmentId: "dept_cntt_id" }
           ]
         } // Server RBAC filter
       ]
     }
     ```
   - **Verification Result**: Since `{ departmentId: "dept_khtv_id" } AND { departmentId: "dept_cntt_id" }` is impossible (empty intersection), the query returns **only** tasks in `KHTV` where the employee is explicitly assigned as an assignee or actor. If they are not assigned, the query returns **0 records**. Cross-department data isolation is rigorously preserved.

3. **Adversarial Scenario 3: Unauthorized Deep-Link Access via `?taskId=TSK-EXECUTIVE-SECRET`**:
   - **Attacker Action**: A staff user types a known confidential executive task ID into the URL: `/tasks?taskId=TSK-SECRET-001`.
   - **Client Behavior**: UI loads side sheet and dispatches `GET /api/tasks/TSK-SECRET-001`.
   - **Server Execution**: Single task lookups in `taskCommandService` / `taskQueryService.getTaskById` and `canReadTask(user, task)` in `authorization-engine.ts` evaluate:
     - Is the user an assignee? No.
     - Is the user an actor? No.
     - Is the task in the user's unit? No.
     - Does the user possess `SCHOOL` viewScope or institutional leadership? No.
   - **Verification Result**: API responds with HTTP 403 Forbidden or HTTP 404 Not Found. The client side sheet displays an authorization error. Client URL state cannot bypass single-entity access gates.

4. **Adversarial Scenario 4: Mutation Tampering (State Transition / Approval via URL/API)**:
   - **Attacker Action**: An attacker sends an approval mutation for a task via `/api/tasks/[id]/approve` pretending to hold executive authority.
   - **Server Execution**: `TaskCommandService` delegates to `AuthorizationEngine.assertAuthorized` using the server's cryptographic JWT session (`ctx.user.id`) and live database positions from `UserContextService`.
   - **Verification Result**: Mutation is rejected with HTTP 403 Forbidden. Client-side URL parameters, headers, or simulated roles play zero role in mutation authorization.

---

### 3.6. Canonical Workspace Query Engine Verification (`workspace-query.ts` & `use-workspace-query.ts`)

To resolve the dual synchronizer race conditions and standardize parameter serialization, the canonical workspace query library and hook were inspected and verified.

#### 1. Implementation Architecture
- `src/lib/workspace-query.ts`:
  - Implements `parseWorkspaceQuery(rawParams, options)`: parses `URLSearchParams`, query strings, or plain objects into strongly-typed `WorkspaceFilterState`.
  - Implements `serializeWorkspaceQuery(state, options)`: serializes `WorkspaceFilterState` into URL query parameters while cleanly omitting default values (`scope=school`, `month=ALL`, `status=ALL`, `view=table`).
  - Implements `isWorkspaceQueryEqual(a, b)`: performs semantic equality comparison across all 8 dimensions, preventing redundant route replacements.
  - Implements `buildWorkspaceUrl(pathname, state, options)`: constructs clean, normalized URLs.
  - Implements legacy alias normalization:
    - `personal`, `MY_TASKS`, `individual`, `cua_toi` -> `my`
    - `all`, `SCHOOL_TASKS`, `toan_truong` -> `school`
    - `department`, `dept`, `don_vi` -> `unit`
    - `tab=completed` -> `status=COMPLETED`
    - `academicMonth=9` -> `month=9`
    - `savedView=xyz` -> `viewId=xyz`
- `src/hooks/use-workspace-query.ts`:
  - Implements `useWorkspaceQuery(options)`: React hook integrating with Next.js `useRouter`, `useSearchParams`, and `usePathname`.
  - Implements native `popstate` listener: handles browser Back and Forward navigation reliably without desynchronizing state.
  - Implements atomic setters: `setScope`, `setUnit`, `setDept`, `setPeriod`, `setStatus`, `setView`, `setSearchQuery`, `setSelectedTask`, `resetFilters`, `updateWorkspaceQuery`.
  - Supports `preserveParams`: ensures non-workspace query parameters (e.g., tracking tags, analytics, dialog states) are retained across filter updates.

#### 2. Test Suite Verification (72 Passing Tests)
Targeted verification of `tests/workspace-query.test.ts` via `tsx --test tests/workspace-query.test.ts` confirmed:
- **72 out of 72 tests passed** (12 suites, 0 failures, duration ~95ms).
- Verified suites:
  1. `parseWorkspaceQuery defaults and empty inputs` (6 tests)
  2. `Scope parsing and legacy migrations` (8 tests)
  3. `Department and unit identifier resolution` (5 tests)
  4. `Academic Month, Period, and Date parsing` (7 tests)
  5. `Task Lifecycle Status parsing and legacy 'tab' migration` (7 tests)
  6. `View Mode, Attention, Query, and Deep Linking parsing` (8 tests)
  7. `Serialization and omission of defaults` (16 tests)
  8. `Deep link preservation and unrelated parameter retention` (3 tests)
  9. `URL Roundtrip: serialize(parse(url)) === url for valid parameters` (5 tests)
  10. `isWorkspaceQueryEqual semantic comparison` (3 tests)
  11. `buildWorkspaceUrl helper` (2 tests)

---

## 4. Canonical URL Specification Recommendation

To eliminate ambiguity, route collisions, and duplicate vocabulary, QCET E-Office must enforce this unified URL contract across all surfaces.

### 4.1. Core URL Principles

1. **One Scope Vocabulary Everywhere**:
   - `scope=school` (Cấp trường / Toàn trường)
   - `scope=unit` (Cấp đơn vị / Khoa / Phòng)
   - `scope=my` (Cá nhân / Của tôi)
   - **Banned**: `all`, `personal`, `SCHOOL_TASKS`, `UNIT_TASKS`, `MY_TASKS`.
2. **Default Parameter Omission (Clean URLs)**:
   - Default parameter values MUST be omitted from the query string to maintain clean, readable URLs.
   - For `/tasks`: default `scope` is user's primary viewScope (omitted if default), default `view` is `table` (omitted), default `status` is `ALL` (omitted), default `month` is `ALL` (omitted).
3. **Deterministic Bidirectional Serialization**:
   - Every filter change in the UI immediately updates the URL via `window.history.replaceState` or `router.replace({ scroll: false })`.
   - Loading any canonical URL directly (SSR) reproduces the exact filtered dataset, active drawer/sheet, and layout mode.

### 4.2. Canonical Route & Parameter Specification Matrix

| Route | Parameter | Type / Allowed Values | Default Value | Semantics & Query Filtering Behavior |
|---|---|---|---|---|
| `/tasks` | `scope` | `school` \| `unit` \| `my` | Derived from `userContext.viewScopes` (e.g., `school` for BGH, `unit` for Dept Head, `my` for Staff) | Dataset scope filter. Filter parent tasks and subtasks accordingly. |
| | `dept` | String (Department Code, e.g., `CNTT`, `KHTV`) | Omitted (`ALL`) | Filter tasks where lead or participating department matches. Restricted to user's assigned unit unless user possesses `SCHOOL` viewScope. |
| | `month` | Integer `1..12` \| `ALL` | `ALL` (omitted) | Academic month filter according to vocational school calendar. |
| | `status` | `NOT_STARTED` \| `IN_PROGRESS` \| `WAITING_APPROVAL` \| `PENDING_EXECUTIVE_APPROVAL` \| `COMPLETED` \| `OVERDUE` \| `BLOCKED` | Omitted (All active/non-cancelled) | Primary task status filter. |
| | `attention` | `requires_my_approval` \| `requires_my_action` \| `blocked` \| `overdue` \| `due_soon` | Omitted | Subjective user attention backlog filter. |
| | `workbox` | `urgent` \| `waiting_approval` \| `pending` \| `overdue` | Omitted | Quick-action triage filter. |
| | `view` | `table` \| `kanban` | `table` (omitted) | Layout presentation mode. |
| | `q` | String (Search query) | Omitted | Full-text filter matching title, code, assignees, deliverables. |
| | `taskId` | String (UUID or Human Code, e.g. `TSK-2026-001`) | Omitted | Deep-link selection: automatically opens `TaskDetailSideSheet`. |
| | `viewId` | String (Preset ID or Custom View UUID) | Omitted | Hydrates predefined filter criteria bundle. |
| `/calendar` | `scope` | `school` \| `unit` \| `my` | `school` | Calendar event scope. Allows staff to view only their deadlines or department meetings. |
| | `dept` | String (Department Code) | Omitted (`ALL`) | Filter calendar events by responsible department. |
| | `date` | ISO Date `YYYY-MM-DD` | Today's system reference date | Focused calendar date. |
| | `view` | `month` \| `week` \| `day` \| `agenda` | `month` (omitted) | Calendar presentation mode. |
| | `q` | String (Search query) | Omitted | Search calendar tasks and events. |
| | `taskId` | String (UUID or Code) | Omitted | Deep-link: opens event or task detail sheet. |
| `/` (Dashboard) | `scope` | `school` \| `unit` \| `my` | Derived from `viewScopes` | Macro KPI and overview dataset scope. |
| | `dept` | String (Department Code) | Omitted (`ALL`) | Scope dashboard KPIs to a specific department. |
| | `month` | Integer `1..12` \| `ALL` | Current Academic Month | Time horizon for monthly progress rollup. |
| | `q` | String (Search query) | Omitted | Search query for dashboard task lists. |
| | `taskId` | String (UUID or Code) | Omitted | Deep-link: opens task modal/sheet from dashboard widgets. |

### 4.3. Legacy URL Migration & Alias Matrix

| Legacy URL Pattern | Handling / Layer | Canonical Destination | Description |
|---|---|---|---|
| `/?zone=tasks` | `308 Permanent Redirect` (Middleware) | `/tasks` | Migrates legacy multi-zone root URL to canonical route. |
| `/?zone=calendar` | `308 Permanent Redirect` (Middleware) | `/calendar` | Migrates legacy calendar zone to canonical route. |
| `/?zone=documents` | `308 Permanent Redirect` (Middleware) | `/documents` | Migrates legacy document zone to canonical route. |
| `/?zone=org` | `308 Permanent Redirect` (Middleware) | `/org` | Migrates legacy org zone to canonical route. |
| `/dashboard` | `308 Permanent Redirect` (`next.config.ts`) | `/` | Consolidates dashboard path to root. |
| `/unit-tasks` | `308 Permanent Redirect` (`next.config.ts`) | `/tasks?scope=unit` | Unifies standalone unit tasks into canonical `/tasks`. |
| `/tasks?tab=completed` | Client Normalization (`workspace-query.ts`) | `/tasks?status=COMPLETED` | Rewrites legacy `tab` parameter to `status`. |
| `/tasks?scope=all` | Client Normalization (`workspace-query.ts`) | `/tasks?scope=school` | Normalizes legacy `all` scope to `school`. |
| `/tasks?scope=personal` | Client Normalization (`workspace-query.ts`) | `/tasks?scope=my` | Normalizes legacy `personal` scope to `my`. |
| `/tasks?savedView=xyz` | Client Normalization (`workspace-query.ts`) | `/tasks?viewId=xyz` | Normalizes legacy view preset parameter. |
| `/tasks?academicMonth=9` | Client Normalization (`workspace-query.ts`) | `/tasks?month=9` | Normalizes legacy month parameter. |

---

## 5. Separation of State: 4-Tier Architecture

To guarantee stability, prevent state corruption, and enforce security boundaries, all workspace state must strictly adhere to this 4-tier model:

```
+---------------------------------------------------------------------------------------+
| TIER 1: URL STATE (Sharable, Bookmarkable, Refresh-Durable)                           |
| - scope (school | unit | my)         - month (1..12 | ALL)     - view (table | kanban)|
| - dept (CNTT, KHTV, etc.)            - status (IN_PROGRESS...) - q (search string)    |
| - taskId (deep-linked drawer)        - date (calendar anchor)  - viewId (preset UUID) |
| - attention (action backlog)         - workbox (triage filter)                        |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
| TIER 2: SERVER REQUEST & AUTH STATE (Authoritative Server Truth - Read Only to Client)|
| - Authenticated Session & DB User    - Statutory Positions & Assignments (Hiệu trưởng)|
| - viewScopes (SCHOOL | UNIT | PERS.) - Task & Subtask Entities with Prisma relations  |
| - Action Inbox Authoritative Queue   - Document Workflows & Statutory Signatures      |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
| TIER 3: CLIENT TRANSIENT STATE (Device & Window Local - Lost on Reload)               |
| - Modal Open / Close Flags           - Side Sheet Expansion & Drag Position           |
| - Unsaved Draft Form Inputs          - Dropdown Open Toggles & Popovers               |
| - Table Column Hover & Sorting State - Virtual List Scroll Position                   |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
| TIER 4: BROWSER LOCAL PREFERENCES (Device Scoped - Non-Business Metadata)             |
| - UI Display Density (compact/comf.) - UI Zoom Scale (100%, 110%)                     |
| - Left Sidebar Collapse State        - Recent Searches History (Command Palette)      |
+---------------------------------------------------------------------------------------+
```

### 5.1. Tier 1: URL State (Sharable, Bookmarkable, Refresh-Durable)
- **Role**: Defines the operational query view and active entity focus.
- **Rules**:
  1. Any state that affects *which items are displayed* or *which item is actively inspected* MUST live in the URL.
  2. A colleague sharing a URL must reproduce the exact same view for another authenticated user with identical permissions.
  3. Navigating back/forward in the browser must traverse filtering and selection steps predictably.

### 5.2. Tier 2: Server Request & Auth State (Authoritative Server Truth)
- **Role**: Determines permissions, statutory authority, and raw business data.
- **Rules**:
  1. Never trust client-provided roles, authorities, or permission tokens.
  2. `viewScopes` returned by `GET /api/me/context` dictates which `scope` values the client is permitted to query.
  3. If a non-executive user manipulates the URL to `?scope=school` or `?dept=OTHER`, server queries MUST enforce unit isolation and return only datasets the user is authorized to inspect.
  4. Server mutations (e.g. approve, submit, delegate) must strictly execute server authorization policies regardless of client UI state.

### 5.3. Tier 3: Client Transient State (Session & Window Local)
- **Role**: Handles micro-interactions, animations, and intermediate user inputs.
- **Rules**:
  1. Never persist intermediate form keystrokes or UI animations to the URL.
  2. Opening a modal that does not correspond to an entity deep link (e.g. "Create Task" or "Filter Popover") is transient React state.
  3. Closing a deep-linked side sheet removes `taskId` from the URL via `window.history.replaceState`.

### 5.4. Tier 4: Browser Local Preferences (Non-Business Device Settings)
- **Role**: Stores presentation choices specific to a display or device.
- **Rules**:
  1. Must NEVER store operational business records, task statuses, or security credentials.
  2. Storage keys must be isolated and protected against SSR errors via defensive try/catch blocks.

---

## 6. Actionable Implementation & Migration Roadmap for Downstream Agents

The following migration directives must be executed by the respective implementation shards:

1. **Shard F2 (Workspace State Infrastructure)**:
   - Wire `useWorkspaceQuery` as the sole canonical hook across all workspace components.
   - Deprecate `useUrlParamsSync` and `useTaskFilters.syncTaskUrlParams`.
2. **Shard P1 (Tasks Page Integration)**:
   - In `src/app/tasks/tasks-page-client.tsx`, replace `user?.role === "ADMIN"` fallback logic with `userContext.viewScopes.includes("SCHOOL") ? "school" : ...`.
   - Remove duplicate `router.replace` calls. Use `useWorkspaceQuery` for single-shot atomic updates.
   - In `src/components/workspace/components/attention-hubs.tsx`, purge `forcedRole="ADMIN"`, `forcedRole="MANAGER"`, and `forcedRole="STAFF"`. Derive workspace layout strictly from `userContext.highestPositionLevel`.
3. **Shard P2 (Calendar Page Integration)**:
   - In `src/app/calendar/page.tsx`, adopt `useWorkspaceQuery({ isCalendar: true })`.
   - Add support for `scope`, `dept`, and `q` to calendar queries, enabling cross-surface filter preservation between Tasks and Calendar.
4. **Shard P3 (Dashboard Page Integration)**:
   - In `src/components/dashboard/*`, replace `useUrlParamsSync` with `useWorkspaceQuery`.
   - Connect task card clicks to `setSelectedTask(taskId)`, syncing `?taskId=...` to the URL for deep-linkability and reload durability.
