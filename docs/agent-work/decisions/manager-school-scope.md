# Decision: Manager (Unit-Head) School-Scope Read Authority

- **Status**: Decided (evidence-based) — recorded by `shard-contracts-freeze`
- **Date**: 2026-09-12
- **Scope**: §24 "UNRESOLVED MANAGER SCHOOL SCOPE" of `docs/plans/active/QCET_EOFFICE_WORLD_CLASS_UX_MASTER_PLAN_V5_1_FINAL_2026-09-12.md`
- **Owner shard**: `shard-contracts-freeze` (contracts/governance lane; `src/**` and `tests/**` are out of scope for this record, and no code change is implied by the decision)
- **Method**: Trace of four required artifacts (server read authorization, `/api/tasks` scope behavior, dashboard service scoping, roles/scopes docs) plus corroborating read surfaces. No guessing; every claim below is cited to **file + symbol** (function/constant names) rather than brittle line numbers, which drift under parallel edits.

## Decision

**NO.** A user whose authority tier is `MANAGER` / unit-head (`TRUONG_DON_VI`, `TRUONG_PHONG`, `TRUONG_KHOA`) may **not** read school-wide dataset scope on any surface traced. A manager's server-authorized read is bounded to exactly two sets:

1. **Active unit(s) membership** — tasks whose `departmentId` is in the manager's active units (`primaryUnitIds` + active position `unitId` + `user.departmentId`).
2. **Direct participation** — tasks where the manager is an assignee, actor, creator, or collaborator.

School-wide read is granted **only** by (a) the `SYSTEM_ADMIN` system role, or (b) an **active institutional-leadership `PositionAssignment`** (Hiệu trưởng / Phó Hiệu trưởng / Ban Giám hiệu / school- or board-level oversight unit). That authority is **never derived from the `MANAGER` tier**.

The `?scope=school` query parameter is a **downward-narrowing, visual dataset filter**. It can only intersect (never widen) the server-authorized dataset, consistent with the frozen invariant *"Role Is Not Scope"* (`00-core.md`).

## Evidence by traced artifact

### 1. Server read authorization (list) — `src/server/tasks/task-query-service.ts`

`buildTaskReadWhere()` builds the canonical Prisma `TaskWhereInput` (one function, branching on whether the context is an `AuthorizationContext` or a session `AuthenticatedUser`):

- **System Admin** (`SYSTEM_ADMIN` system role or `ADMIN`) → unrestricted `{}` (the `isSystemAdmin` branch).
- **Institutional leadership** → unrestricted `{}` (the `isLeadership` branch):
  - `AuthorizationContext` branch delegates to `isInstitutionalLeadershipPosition()`: position code `HIEU_TRUONG`/`PHO_HIEU_TRUONG`/`BAN_GIAM_HIEU`/`BGH`, or a `title` containing "hiệu trưởng", or `pos.isLeadership &&` unit type `BOARD|SCHOOL` (or unit code `BGH`/`BGH_UNIT`/`SCHOOL`).
  - `AuthenticatedUser` branch checks `positionCode`, `role`, and `title` for the same leadership set via `roleUpper`/`titleLower`.
- **Manager / unit-head and staff** fall to the `authConditions` OR filter:

```ts
const authConditions: Prisma.TaskWhereInput[] = [
  { assignees: { some: { userId } } },
  { actors: { some: { userId } } },
];
if (unitIds.length === 1) authConditions.push({ departmentId: unitIds[0] });
else if (unitIds.length > 1) authConditions.push({ departmentId: { in: unitIds } });
return { OR: authConditions };
```

`unitIds` is assembled from `primaryUnitIds` + active position `unitId`s + `user.departmentId`. **A manager appears in neither the admin nor the leadership branch, so a manager's read filter is identical to a staff read filter.** The `buildTaskReadWhere` doc comment states this intent explicitly.

**Position-leadership enrichment (list reads).** `queryTasks()` augments the session-derived filter with `hasInstitutionalLeadershipPosition(userId)`: when the canonical `AuthorizationContext` (loaded via `loadAuthorizationContext`) confirms an active institutional-leadership `PositionAssignment` for a session user, the unit-bounded `buildTaskReadWhere` filter is **not** applied, matching the `AuthorizationContext` leadership branch. This closes latent divergence #2 below. It does **not** widen manager authority — `isInstitutionalLeadershipPosition()` excludes `TRUONG_*` position codes and `MANAGER`-tier role signals.

### 2. `/api/tasks` scope behavior — `src/app/api/tasks/route.ts` + `task-query-service.ts`

- Route handler GET: `getApiContext(req)` at **line 22**, `TaskQuerySchema.parse(rawParams)` at **line 51**, forwards `scope` into `taskQueryService.queryTasks(context, {...})` at **lines 76–94**.
- No `AuthorizationContext` is constructed: `getApiContext` returns an `ApiRequestContext` (`{ user, ... }`) — interface declared at `src/server/api/request-context.ts` (`ApiRequestContext`) — so `queryTasks` resolves `authTarget` to `ctx.user` (`AuthenticatedUser`) in its `authTarget` resolution block.
- Scope mapping in `queryTasks()`: `school` → `where.scope = TaskScope.SCHOOL`; `unit`/`department` → `DEPARTMENT`; `individual`/`personal` → `INDIVIDUAL`; `my` → assignee clause.
- The scope clause is **ANDed** with the authorization filter (`where.AND = [... , authWhere]`), except when the position-leadership enrichment above confirms institutional leadership and suppresses `authWhere`.

**Consequence**: a manager calling `?scope=school` receives `SCHOOL`-scope tasks **intersected** with `(own unit(s) OR direct participation)`. Unassigned school tasks (`departmentId` null) are **not** returned. A manager cannot widen their dataset by changing the query param.

Corroborated by tests: `tests/security/task-read-v2-parity.test.ts` — multi-unit manager builds `departmentId: { in: [...] }` (**lines 424–441**); staff must not see unassigned school task (**lines 445–503**). No test grants a manager a school-wide read.

### 3. Single-task read — `src/server/policies/task-policy.ts`

`canReadTask(user, task)` at **lines 109–129** grants read when: admin, OR creator/assignee/collaborator, OR **same department** (`task.departmentId === user.departmentId`). There is **no** manager special-case and no school-wide case. Consumed by `src/app/api/tasks/[id]/route.ts` (detail route).

### 4. Dashboard service scoping — `src/lib/server/dashboard-service.ts`

- `getLiveDashboardData(options)` at **lines 26–50** has **no role parameter** — only `userId`, `departmentId`, `academicMonth`, `academicYear`. `whereTask` = `scope IN (SCHOOL, DEPARTMENT)` with optional `departmentId` and/or `assignees.some.userId` (`userId` further narrows to participation).
- **Role enforcement lives at the callers, not in the service**:
  - `src/app/api/dashboard/overview/route.ts` (**lines 40–70**): `isAdmin(authUser)` may choose any department or all; **every non-admin including a MANAGER** is hard-bound to `authUser.departmentId` (**lines 46–51**) plus a post-filter that discards cross-department rows (**lines 56–70**).
  - `src/app/page.tsx` (**lines 72–79**) and `src/app/tasks/page.tsx` (**lines 16–19**) use `isUserExecutive()` to decide school-wide (`departmentId` undefined) vs own department. `isUserExecutive()` (`src/domain/tasks/attention-resolver.ts:66–73`) uses `EXECUTIVE_ROLES`/`EXECUTIVE_POSITION_CODES`, which exclude `MANAGER`/`TRUONG_*`.

**Consequence**: a manager's dashboard is own-department only; managers are never treated as executive.

### 5. Client scope guard — `src/lib/auth/roles.ts` + `src/lib/unified-task-hub.ts`

- `isScopeAllowed(role, scope)` at **`roles.ts:39–45`**: `MANAGER` → only `unit` | `my`; `school` returns `false`. `STAFF` → only `my`.
- `getDefaultScopeForRole()` at **`unified-task-hub.ts:127–131`**: `MANAGER` → `UNIT_TASKS`.
- `parseScopeParam()` at **`unified-task-hub.ts:171–199`**: a non-executive `?scope=school` is downgraded to the caller's default scope.
- `resolveScopeDetails("school", …, managerUser)` forces `unit` — asserted in `tests/scope-switcher.test.ts:179–191`.

**Consequence**: the client guard is strictly narrower than (or equal to) the server filter; it never permits a manager to widen scope.

### 6. Canonical doc — `docs/product/roles-and-scopes.md`

- §3.2 Scope Permission Matrix (**lines 63–69**) currently states: Manager (`TRUONG_DON_VI`, `PHO_PHONG`) school scope = **"Read-only Overview"**, with default landed scope `unit`.

**This row is contradicted by the implemented behavior** (see Contradiction below). It is aspirational text, not a granted authority.

### 7. Corroborating read surfaces

- `src/domain/tasks/contract.ts`: `CAN_VIEW` (**lines 305–345**) = executive || creator || assignee || unitHead || sameDepartment || delegation; `isActorUnitHead()` (**lines 259–265**) is bounded by `task.departmentId`. No school-wide case.
- `src/domain/tasks/attention-resolver.ts`: `isUserExecutive()` (**lines 66–73**) excludes managers from executive/school handling.

## Contradiction raised (do not resolve by guessing)

**`docs/product/roles-and-scopes.md` §3.2 (lines 63–69)** grants a Manager a "Read-only Overview" of `school` scope. This is **unimplemented and refuted** by:

- the client guard `isScopeAllowed(MANAGER, 'school') === false` (`roles.ts:39–45`);
- manager default/forced `unit` scope (`unified-task-hub.ts:127–131, 171–199`; `tests/scope-switcher.test.ts:179–191`);
- the server read filter (`buildTaskReadWhere`'s manager/staff `authConditions` branch), which never grants school-wide to a manager;
- the dashboard binding of non-admins to their own department (`dashboard/overview/route.ts:46–51`).

**Disposition options (documented, not executed — `src/**` and the frozen doc are outside this shard's ownership):**

- **(a) Correct the doc to match code** (recommended): change the Manager `school` cell to "Prohibited / Hidden (see §3.1 Audience)" so the matrix reflects the enforced boundary. This aligns with domain-freeze rule `05-domain-freeze.md` §3 (scope is not a permission) and `20-tasks.md` §4.
- **(b) Treat it as a genuine future requirement**: this would require a new *institutional-leadership* authority grant (e.g., a `PositionAssignment`), **not** a widening of the `MANAGER` tier, and would need an accompanying regression test. Per the freeze rules, scope must not become a permission grant, so any implementation must be expressed as an authorization authority, evaluated server-side.

Either way, the contradiction is recorded here with evidence rather than silently accepted. Because the frozen doc and `src/**` are owned elsewhere, this decision only raises it.

## Latent divergences flagged (owned outside this shard)

1. **Authorization engine not wired to read endpoints.** `src/server/authorization/authorization-engine.ts` STEP_5 grants `task.read` / `task.monitor` to unit leaders (**lines 671–705**), deputies (**lines 708–724**), and staff (**lines 726–746**); STEP_7's organizational-scope boundary (**lines 849–896**) does **not** list `task.read`/`task.monitor` among its unit-bounded guards. Yet no task-read route calls `authorize('task.read')`: `/api/tasks` uses `buildTaskReadWhere`, `/api/tasks/[id]` uses `canReadTask`. The capability catalog and the actual read filters therefore diverge. Flagged as a latent contract inconsistency; a future manager-scope change must target the correct read path, and reconciling engine-vs-filter should be its own task.

2. **List read path lacked `positionCode`/positions — RESOLVED (server lane, working tree).** The `/api/tasks` list path authorizes from `AuthenticatedUser`, and `getApiContext` never populates `positionCode`. Originally `buildTaskReadWhere`'s `AuthenticatedUser` branch detected institutional leadership only via DB `role`/`title`, not via a `PositionAssignment`, so a statutory leader (e.g., Hiệu trưởng) whose stored role string was generic could be denied school-wide list read even though the `AuthorizationContext` branch would grant it. This was closed **server-side** by a parallel lane's change in `src/server/tasks/task-query-service.ts`: `queryTasks()` now calls `hasInstitutionalLeadershipPosition(userId)` (declared in that file, backed by `loadAuthorizationContext`) and suppresses the unit-bounded `authWhere` when canonical position data confirms institutional leadership — the same condition the `AuthorizationContext` branch uses. The `hasInstitutionalLeadershipPosition` doc comment itself cross-references this decision's item #2. This is **not** this shard's change (`src/server/**` is anti-owned here); it is recorded as the resolving implementation. The manager conclusion is unaffected: `isInstitutionalLeadershipPosition()` excludes `TRUONG_*`.

3. **Two task-policy modules.** `src/server/tasks/task-policy.ts` (legacy transition helpers) and `src/server/policies/task-policy.ts` (`canReadTask`/`canApproveTask`, imported by routes as `@/server/policies/task-policy`) implement overlapping but divergent role logic. Any future manager-scope change must target the route-consumed module.

## Consequences and constraints

- The **manager** conclusion requires no code change: `buildTaskReadWhere` already denies the `MANAGER` tier school-wide read. The one divergence on this path that *did* imply a server behavior change — list reads not consulting `PositionAssignment` data (#2) — has been closed server-side by a parallel lane (see above); this decision only records it.
- Any future attempt to grant a manager school-wide read must **not** be implemented as a `TaskScope`-based permission or a client-side role branch (frozen by `05-domain-freeze.md` §§1, 3). It must be a server-evaluated authority, and it would require a new regression test (`tests/**` is owned elsewhere).
- No repository test currently asserts that a manager is **denied** school-wide read (or granted a read-only school overview). Adding that assertion is a follow-up owned by the tests shard.

## References

- `src/server/tasks/task-query-service.ts` — symbols: `isInstitutionalLeadershipPosition()`, `hasInstitutionalLeadershipPosition()`, `buildTaskReadWhere()` (`isSystemAdmin` / `isLeadership` / manager-staff `authConditions` branches), `TaskQueryService.queryTasks()` (scope mapping, `authTarget` resolution, `authWhere` application)
- `src/app/api/tasks/route.ts` (22, 51, 76–94)
- `src/app/api/tasks/[id]/route.ts` (detail read via `canReadTask`)
- `src/server/policies/task-policy.ts` (109–129)
- `src/server/api/request-context.ts` (`ApiRequestContext` interface; session `user` object construction)
- `src/lib/server/dashboard-service.ts` (26–50)
- `src/app/api/dashboard/overview/route.ts` (40–70)
- `src/app/page.tsx` (72–79); `src/app/tasks/page.tsx` (16–19)
- `src/domain/tasks/attention-resolver.ts` (66–73)
- `src/domain/tasks/contract.ts` (259–265, 305–345)
- `src/lib/auth/roles.ts` (39–45)
- `src/lib/unified-task-hub.ts` (127–131, 171–199)
- `src/server/authorization/authorization-engine.ts` (671–705, 708–724, 726–746, 849–896)
- `tests/security/task-read-v2-parity.test.ts` (424–441, 445–503); `tests/scope-switcher.test.ts` (179–191); `tests/role-task-filter.test.ts`
- `docs/product/roles-and-scopes.md` (63–69)
- `docs/plans/active/QCET_EOFFICE_WORLD_CLASS_UX_MASTER_PLAN_V5_1_FINAL_2026-09-12.md` §24 (1268–1285)
