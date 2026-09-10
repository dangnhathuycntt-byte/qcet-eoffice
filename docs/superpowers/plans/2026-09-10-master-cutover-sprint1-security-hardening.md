# Master Cutover & Production Hardening - Sprint 1: Security Boundary Plan

> **File:** `docs/superpowers/plans/2026-09-10-master-cutover-sprint1-security-hardening.md`  
> **Source:** `/Users/dnhhuy/Downloads/QCET E-Office — Master Cutover  Production Hardening Plan.md`  
> **Target:** Gate 0 — Security & Correctness Blockers (F01, F02, F04, F07, F08)  
> **Execution Strategy:** Multi-agent Workflow orchestration (`ultracode`). Independent implementation, review, and verification subagents.

---

## Executive Summary & Invariants

Sprint 1 addresses the immediate security and correctness vulnerabilities identified in the Master Cutover Plan before any major feature refactoring:
1. **F01 (Phase 1):** Zero Raw Prisma Dumps / Zero `passwordHash` leakage. API responses must return structured DTOs (`task`, `data`) and strip `raw: result.raw`.
2. **F02 (Phase 2):** Database-level Task List Authorization. `queryTasks()` must apply `buildTaskReadWhere(authContext)` directly to the SQL query. Enforce pagination ceilings (max 100).
3. **F04 (Phase 3):** Strict Aggregate ID Binding. Child resources (`TaskDeliverable`, `TaskResult`, `TaskApprovalStep`, `TaskActor`) must be resolved with `where: { id: childId, taskId: parentTaskId }`. Cross-task child mutations must be blocked with `DENY` (404/403).
4. **F07 (Phase 6):** File Access Default Deny. Disallow raw file downloads of unregistered/orphan files. Eliminate filename-based bypasses (`"mat"`, `"secret"`). Require DB attachment verification.
5. **F08 (Phase 7):** PWA Cross-User Cache Leak Prevention. Exclude `/api/*` from static asset caching in `public/sw.js`. Restrict static cache to strict allowlist paths (`/_next/static/`, `/icons/`, `/fonts/`). Purge stale caches on activate and on user logout.

---

## Task Breakdown

### Task 1: F01 — Sanitize Task Query Service & Eliminate `raw` from API Responses
- **Files:**
  - `src/server/tasks/task-query-service.ts`
  - `src/app/api/tasks/[id]/route.ts`
- **Steps:**
  1. In `src/server/tasks/task-query-service.ts`, line 384: Change `subTasks.assignees.include: { user: true }` to `select: { id: true, name: true, avatarUrl: true }`.
  2. In `src/server/tasks/task-query-service.ts`, remove `raw: rawTask` from public query return type and replace with sanitized `task` and `data` DTOs.
  3. In `src/app/api/tasks/[id]/route.ts`, remove `raw: result.raw` and `raw: updated` from JSON responses. Return clean DTOs.
- **Verification:** Run `npx tsx --test tests/security/sensitive-field-leak.test.ts` to ensure no `passwordHash` or internal fields are exposed.

### Task 2: F02 — Enforce Task List Authorization at Database Level
- **Files:**
  - `src/server/tasks/task-query-service.ts`
  - `src/app/api/tasks/route.ts`
- **Steps:**
  1. In `src/server/tasks/task-query-service.ts`, implement `buildTaskReadWhere(authContext: AuthenticatedUserContext)`:
     - For non-admin users, enforce scope filter or ownership: `WHERE (scope = 'SCHOOL' OR departmentId = userDeptId OR assignees.some(userId = user.id) OR actors.some(userId = user.id))`.
  2. Integrate `buildTaskReadWhere` into `queryTasks(ctx, filters)`.
  3. Enforce maximum pagination limit (`take = Math.min(filters.limit || 20, 100)`). Reject unbounded queries (`limit: 'all'` capped at 100).
- **Verification:** Unit tests verifying cross-department tasks are not returned to unauthorized staff users in `queryTasks()`.

### Task 3: F04 — Enforce Child Resource Aggregate ID Binding
- **Files:**
  - `src/lib/services/task-domain-actions.ts`
  - `src/app/api/tasks/[id]/actions/shared.ts`
- **Steps:**
  1. In `loadTaskAndBuildResource(taskId, extra)`:
     - When `extra.deliverableId` is provided: Query `prisma.taskDeliverable.findFirst({ where: { id: extra.deliverableId, taskId } })`. If not found, throw `NotFoundError` or `ForbiddenError`. Do NOT fall back to unrestricted `findUnique({ where: { id } })`.
     - When `extra.resultId` is provided: Query `prisma.taskResult.findFirst({ where: { id: extra.resultId, taskId } })`. If not found, reject.
     - When `extra.stepId` is provided: Query step within the task's approval processes only.
  2. Audit all domain action methods (`requestRevision`, `submitResult`, `reviewTask`, `approveTask`) to ensure child updates include `taskId` constraint in the `where` clause.
- **Verification:** Test `requestRevision(taskA, deliverableB)` -> Expect error/rejection.

### Task 4: F07 — File Access Default Deny & Storage Hardening
- **Files:**
  - `src/app/api/files/[...path]/route.ts`
- **Steps:**
  1. Remove lines 98-111 (unregistered file filename-based check with "secret"/"mat").
  2. If a file does not match an authorized `documentAttachment` OR an authorized `taskDeliverable`, throw `NotFoundError("Không tìm thấy tệp yêu cầu")` (Default Deny).
  3. Ensure path sanitization prevents directory traversal and restricts downloads strictly to authorized attachments.
- **Verification:** Test downloading an unregistered file in `uploads/` -> Expect 404 Not Found.

### Task 5: F08 — PWA Service Worker Cache Isolation & Asset Allowlist
- **Files:**
  - `public/sw.js`
  - `src/components/pwa/pwa-service-worker-manager.tsx`
- **Steps:**
  1. In `public/sw.js`:
     - Rule 0: If `url.pathname.startsWith('/api/')`, NEVER use static cache (`CACHE_STATIC_NAME`). Return immediately so it follows Network-Only / dynamic logic.
     - Rule 1: Restrict static asset caching to strict allowlisted prefixes: `/_next/static/`, `/icons/`, `/fonts/`, or exact precache assets (`/logo-qcet.png`, `/logo-qcet.webp`).
     - Remove the loose regex `url.pathname.match(/\.(png|jpg|...)$/)` that matched `/api/` image endpoints.
     - Bump `APP_VERSION = '2026.09.10.1'`, `CACHE_STATIC_NAME = 'qcet-static-2026.09.10.1'`.
     - In `activate` event handler, delete all old `qcet-static-*` and `qcet-shell-*` caches.
  2. In `src/components/pwa/pwa-service-worker-manager.tsx` and auth logout hooks:
     - Ensure logout purges IndexedDB and caches.
- **Verification:** Test service worker cache isolation script or unit test simulating SW fetch handler.

### Task 6: Comprehensive Verification & Regression Suite
- **Files:**
  - `tests/security/master-cutover-gate0.test.ts`
- **Steps:**
  1. Author comprehensive integration tests verifying all 5 gate 0 fixes.
  2. Run `npm run typecheck`.
  3. Run `npm test`.
  4. Dispatch specialized `security-reviewer` and `verifier` subagents to audit the worktree diff.
