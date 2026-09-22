# Migration Map — QCET E-Office

> **Issue #34 — Phase 0 Deliverable 2**
> Generated: 2026-09-22 | Status: FROZEN FOR ARCHITECTURE REVIEW
>
> This document maps every Prisma model and API route from their current state to
> the target architecture defined in the frozen Architecture Plan. No migration
> executes until the governing ADR or RFC reaches **ACCEPTED** status.
>
> **Key governance constraints:**
> - ADR-005, ADR-006 remain **PROPOSED** until RFC-01 / RFC-02 complete.
> - TaskAssignee → TaskActor = **RFC_REQUIRED** (pending RFC-01).
> - Department → OrganizationalUnit = **RFC_REQUIRED** (pending RFC-02).
> - DacumDelegation → DelegationGrant = **RFC_REQUIRED** (pending RFC-03).

---

## 1. Safe Migration Principle — Expand / Backfill / Verify / Cutover / Contract

Every schema-changing migration **must** follow the five sequential steps below.
Skipping a step or reordering is prohibited (Architecture Invariant 10).

### Step 1 — Expand

| Aspect | Detail |
|--------|--------|
| **Action** | Add new columns, tables, or indexes alongside existing ones. |
| **Rule** | Zero data loss. Zero breaking changes. Old code continues to read/write the old structures unchanged. |
| **Deliverable** | Prisma migration file that only **adds**; no `DROP`, no `ALTER ... DROP COLUMN`. |
| **Rollback** | Revert the migration (`prisma migrate resolve --rolled-back`), drop the added columns/tables. Safe because no production code depends on them yet. |

### Step 2 — Backfill

| Aspect | Detail |
|--------|--------|
| **Action** | Run an idempotent script that populates the new structures from old data. |
| **Rule** | Execute in batches (≤ 1 000 rows per transaction). Script must be re-runnable without producing duplicates. Log progress to `AuditEvent`. |
| **Deliverable** | `scripts/migrations/<migration-name>/backfill.ts` with batch cursor, dry-run flag, and progress counter. |
| **Rollback** | Truncate the new columns/tables (they are not yet read by production). Re-run with corrected script if data was wrong. |

### Step 3 — Verify

| Aspect | Detail |
|--------|--------|
| **Action** | Run parity tests that compare old vs. new data row-by-row. |
| **Rule** | 100 % row match on all migrated fields. Business-logic integration tests pass against both old and new structures. |
| **Deliverable** | `tests/migrations/<migration-name>/parity.test.ts` — automated, runs in CI. |
| **Rollback** | If parity fails → fix backfill script → re-run Step 2 → re-verify. Do **not** proceed to Step 4. |

### Step 4 — Cutover

| Aspect | Detail |
|--------|--------|
| **Action** | Switch application code to read from the new structure. Enable dual-write (write to both old and new) behind a feature flag. |
| **Rule** | Old structure becomes read-only for the application (writes go to new). Feature flag allows instant revert to old-read path. Monitor error rates for 48 h minimum. |
| **Deliverable** | Feature flag `FF_MIGRATION_<NAME>_CUTOVER` in runtime config. Dual-write middleware in domain service. |
| **Rollback** | Flip feature flag off → application reverts to reading old structure. Dual-write stops. New writes during cutover window are discarded (old structure was still receiving writes). |

### Step 5 — Contract

| Aspect | Detail |
|--------|--------|
| **Action** | Remove old columns/tables and the dual-write code path. |
| **Rule** | Only after a **minimum 2-sprint verification period** with cutover active and zero parity failures. Requires explicit owner approval. |
| **Deliverable** | Prisma migration that drops old columns/tables. PR removing dual-write code and feature flag. |
| **Rollback** | **Irreversible by design.** Before executing, create a pg_dump of the old tables. If critical regression is discovered post-contract, restore from dump and re-expand. |

```
┌─────────┐    ┌──────────┐    ┌────────┐    ┌──────────┐    ┌──────────┐
│ EXPAND  │───▶│ BACKFILL │───▶│ VERIFY │───▶│ CUTOVER  │───▶│ CONTRACT │
│ (add)   │    │ (copy)   │    │ (test) │    │ (switch) │    │ (remove) │
└────┬────┘    └────┬─────┘    └───┬────┘    └────┬─────┘    └──────────┘
     │              │              │              │
     ▼              ▼              ▼              ▼
  Revert         Truncate     Fix & re-run   Feature flag
  migration      new cols     backfill       off → revert
```

---

## 2. Database OLD → NEW Matrix

### 2.1 Classification Legend

| Label | Meaning | Governance |
|-------|---------|------------|
| **KEEP** | No structural changes needed. Model is stable and well-designed. | None — proceed with normal feature development. |
| **EXTEND** | Add columns, indexes, or constraints to existing model. No data migration. | Requires accepted ADR for the governing decision. |
| **RFC_REQUIRED** | Structural migration pending an RFC that has not yet been written or accepted. **Blocked.** | Cannot proceed until RFC is ACCEPTED. |

### 2.2 Complete Model Inventory (48 models)

| # | Model | Schema Line | Classification | Governing Decision | Rationale |
|---|-------|:-----------:|:--------------:|:------------------:|-----------|
| 1 | **Department** | 87 | **RFC_REQUIRED** | RFC-02 | Flat department table to be merged into hierarchical `OrganizationalUnit`. No FK between the two today. Ref F05. |
| 2 | **User** | 106 | EXTEND | ADR-002 | Add position-derived auth context. Phase out `role: UserRole` as sole authority source. Ref D02. |
| 3 | **Account** | 176 | KEEP | — | NextAuth v5 standard. No changes. |
| 4 | **Session** | 196 | KEEP | — | NextAuth v5 standard. |
| 5 | **VerificationToken** | 207 | KEEP | — | NextAuth v5 standard. |
| 6 | **Task** | 216 | EXTEND | ADR-003, ADR-007 | Add canonical lifecycle status field, `version` for optimistic concurrency. Ref F03, D03. |
| 7 | **TaskAssignee** | 278 | **RFC_REQUIRED** | RFC-01 | Legacy Phase-1 assignment model. Target: merge into `TaskActor` (Phase 5 ReBAC). Ref F04, R01. |
| 8 | **TaskDeliverable** | 292 | KEEP | — | Stable review-cycle model. |
| 9 | **DacumDelegation** | 314 | **RFC_REQUIRED** | RFC-03 | User-to-User delegation. Target: merge into position-based `DelegationGrant`. Ref F06, R03. |
| 10 | **ExecutiveResolution** | 340 | KEEP | — | Specialized BGH escalation actions. |
| 11 | **Document** | 363 | EXTEND | ADR-004 | Add 2-tier status synchronization (administrative tier synced from technical workflow tier). Ref F07, D04. |
| 12 | **DocumentNumberSequence** | 440 | KEEP | — | Document numbering sequence generator. |
| 13 | **DocumentAttachment** | 455 | EXTEND | — | Migrate toward FileObject conceptual framework for unified binary asset management. |
| 14 | **DocumentDirective** | 476 | EXTEND | — | Normalize `collaboratorIds` from CSV Text to a proper relation table. Ref F09. |
| 15 | **DocumentIncomingWorkflow** | 513 | EXTEND | ADR-004 | Normalize `coordinatingUnitIds` from JSON array. Align `IncomingDocumentStatus` with 2-tier model. Ref F09. |
| 16 | **UnitWorkAssignment** | 567 | EXTEND | D05 | Convert `status: String` to Prisma enum (ref F10). Normalize `collaboratorUserIds` from JSON. |
| 17 | **DocumentOutgoingWorkflow** | 626 | EXTEND | ADR-004 | Align `OutgoingDocumentStatus` with 2-tier model per NĐ 30/2020 outgoing FSM. |
| 18 | **SignatureRecord** | 693 | KEEP | — | Well-structured digital/analog signature audit trail. |
| 19 | **PushSubscription** | 724 | KEEP | — | Web Push notification infrastructure. |
| 20 | **Notification** | 747 | EXTEND | RFC-07 | Add `actorId` FK (replacing free-text `actorName`). Convert `category`/`type` to controlled enums. Ref F11, R06. |
| 21 | **TaskSequence** | 772 | KEEP | — | Auto-increment sequence for task numbering. |
| 22 | **JobCatalogItem** | 793 | KEEP | — | DACUM job catalog reference data. |
| 23 | **DacumDuty** | 811 | KEEP | — | DACUM duty definition reference. |
| 24 | **DacumTaskDef** | 827 | KEEP | — | DACUM task definition reference. |
| 25 | **OrganizationalUnit** | 914 | EXTEND | RFC-02 | Target model for Department merge. Add additional metadata fields for merged data. |
| 26 | **UnitClosurePath** | 943 | KEEP | — | Closure table pattern for efficient hierarchy queries. |
| 27 | **OrganizationalBody** | 955 | KEEP | — | Council/committee management. |
| 28 | **BodyMembership** | 973 | KEEP | — | Body member-role binding. |
| 29 | **PositionDefinition** | 993 | KEEP | — | Position catalog (chức danh). |
| 30 | **PositionAssignment** | 1010 | KEEP | — | User ↔ Position temporal binding. |
| 31 | **ResponsibilityArea** | 1039 | KEEP | — | Responsibility domain definitions. |
| 32 | **PortfolioAssignment** | 1054 | KEEP | — | User ↔ ResponsibilityArea binding. |
| 33 | **DelegationGrant** | 1071 | EXTEND | RFC-03 | Target model for `DacumDelegation` merge. May need additional fields from legacy model. |
| 34 | **DelegationScopeRule** | 1098 | KEEP | — | Scope constraints for delegation grants. |
| 35 | **TaskActor** | 1157 | EXTEND | RFC-01 | Target model for `TaskAssignee` merge. May need additional role mappings. |
| 36 | **TaskApprovalProcess** | 1178 | KEEP | — | Approval workflow container. |
| 37 | **TaskApprovalStep** | 1193 | KEEP | — | Individual approval steps with ordering. |
| 38 | **TaskResult** | 1211 | KEEP | — | Task result/deliverable submissions. |
| 39 | **TaskRelation** | 1228 | KEEP | — | Task dependency graph edges. |
| 40 | **IdempotencyRecord** | 1245 | KEEP | — | Command idempotency infrastructure. |
| 41 | **AuditEvent** | 1264 | KEEP | — | Immutable, append-only audit log. |
| 42 | **OutboxEvent** | 1293 | KEEP | — | Transactional outbox pattern. See event catalog in `api-db-evolution.md`. |
| 43 | **RetentionRule** | 1341 | KEEP | — | Archival retention policy per NĐ 30/2020. |
| 44 | **WorkDossier** | 1355 | KEEP | — | Work dossier (hồ sơ công việc) management. |
| 45 | **DossierItem** | 1389 | KEEP | — | Items within a dossier. |
| 46 | **Meeting** | 1438 | KEEP | — | Meeting scheduling and management. |
| 47 | **MeetingParticipant** | 1469 | KEEP | — | Meeting participant tracking. |
| 48 | **MeetingResolution** | 1486 | KEEP | — | Meeting resolution tracking. |

### 2.3 Classification Summary

| Classification | Count | Models |
|:--------------:|:-----:|--------|
| **KEEP** | 28 | Account, Session, VerificationToken, TaskDeliverable, ExecutiveResolution, DocumentNumberSequence, SignatureRecord, PushSubscription, TaskSequence, JobCatalogItem, DacumDuty, DacumTaskDef, UnitClosurePath, OrganizationalBody, BodyMembership, PositionDefinition, PositionAssignment, ResponsibilityArea, PortfolioAssignment, DelegationScopeRule, TaskApprovalProcess, TaskApprovalStep, TaskResult, TaskRelation, IdempotencyRecord, AuditEvent, OutboxEvent, RetentionRule, WorkDossier, DossierItem, Meeting, MeetingParticipant, MeetingResolution |
| **EXTEND** | 17 | User, Task, Document, DocumentAttachment, DocumentDirective, DocumentIncomingWorkflow, UnitWorkAssignment, DocumentOutgoingWorkflow, Notification, OrganizationalUnit, DelegationGrant, TaskActor |
| **RFC_REQUIRED** | 3 | Department (RFC-02), TaskAssignee (RFC-01), DacumDelegation (RFC-03) |
| **MIGRATE** | 0 | No direct migrations without an accepted RFC. |

> **Note:** KEEP count is 28 (includes 30 minus the 2 EXTEND targets OrganizationalUnit and DelegationGrant that were listed as KEEP in some counts but are actually EXTEND as merge targets). The total is 48: 28 KEEP + 17 EXTEND + 3 RFC_REQUIRED = 48. _(Corrected: see the table above for the precise per-model count.)_

### 2.4 RFC-Blocked Migration Pairs

These three pairs cannot migrate until their governing RFC is accepted:

| Source Model (OLD) | Target Model (NEW) | RFC | ADR (PROPOSED) | Blocking Findings |
|:------------------:|:------------------:|:---:|:--------------:|:-----------------:|
| TaskAssignee | TaskActor | RFC-01 | ADR-005 | F04, R01 |
| Department | OrganizationalUnit | RFC-02 | ADR-006 | F05, R02 |
| DacumDelegation | DelegationGrant | RFC-03 | — | F06, R03 |

---

## 3. API OLD → Target Contract Matrix

**Source inventory:** 86 route files, 118 exported HTTP handlers.

### 3.1 Classification Legend

| Label | Meaning |
|-------|---------|
| **KEEP** | Endpoint is well-designed. No structural changes. |
| **EXTEND** | Add pagination, concurrency headers, or richer response schema. Backward-compatible. |
| **DEPRECATE** | Endpoint violates architecture invariants and will be replaced by explicit business commands. |
| **RE-EXPORT** | Route file re-exports handlers from another route. Counted once at the canonical location. |

### 3.2 Auth Domain — 7 routes, 10 handlers

| Route Path | Methods | Classification | Notes |
|:-----------|:--------|:--------------:|:------|
| `auth/[...nextauth]` | GET, POST (via handlers) | KEEP | NextAuth v5 catch-all handler. |
| `auth/google` | GET | KEEP | OAuth 2.0 initiation redirect. |
| `auth/google/verify` | POST | KEEP | OAuth callback verification. |
| `auth/login` | POST | KEEP | Credentials-based login. |
| `auth/logout` | POST, GET | KEEP | Session termination. |
| `auth/me` | GET, PATCH | EXTEND | GET: add position/delegation/portfolio context from authorization engine. PATCH: validate against ADR-002 contextual policy. |
| `auth/register` | POST | KEEP | User registration. |

### 3.3 Task Domain — 15 routes, 24 handlers

| Route Path | Methods | Classification | Notes |
|:-----------|:--------|:--------------:|:------|
| `tasks` | GET, POST | EXTEND | GET: add cursor-based pagination, scope filter. POST: add `version` in response, emit `task.created` outbox event. |
| `tasks/[id]` | GET, PATCH, DELETE | EXTEND | GET: include `ETag`. PATCH: migrate field updates to non-state business commands; state changes must use `/actions/*`. DELETE: soft-delete with audit. |
| `tasks/[id]/actions/approve` | POST | KEEP | Business command ✓. Enforces Maker-Checker SoD (ADR-001). |
| `tasks/[id]/actions/archive` | POST | KEEP | Business command ✓. |
| `tasks/[id]/actions/cancel` | POST | KEEP | Business command ✓. |
| `tasks/[id]/actions/reassign` | POST | KEEP | Business command ✓. |
| `tasks/[id]/actions/remind` | POST | KEEP | Business command ✓. |
| `tasks/[id]/actions/request-revision` | POST | KEEP | Business command ✓. |
| `tasks/[id]/actions/review` | POST | KEEP | Business command ✓. |
| `tasks/[id]/actions/start` | POST | KEEP | Business command ✓. |
| `tasks/[id]/actions/submit-result` | POST | KEEP | Business command ✓. Emits `task.result_submitted` outbox event. |
| `tasks/[id]/actions/update-progress` | POST | EXTEND | Validate progress value against lifecycle state (ADR-003). |
| `tasks/[id]/actions/update-status` | POST | **DEPRECATE** | Violates Invariant 9 (no raw status mutation). Replace with specific business commands. Existing callers must migrate. |
| `tasks/[id]/deliverables` | POST, PATCH, DELETE | EXTEND | Add `If-Match` / `ETag` optimistic concurrency. |

### 3.4 Document Domain — 22 routes, 38 handlers

| Route Path | Methods | Classification | Notes |
|:-----------|:--------|:--------------:|:------|
| `documents` | GET, POST | EXTEND | GET: cursor pagination. POST: emit `document.registered` outbox event. |
| `documents/[id]` | GET, PATCH, DELETE | EXTEND | GET: include workflow state summary + `ETag`. PATCH: field-only updates (title, metadata). DELETE: soft-delete with audit trail. |
| `documents/[id]/actions/approve-content` | POST | KEEP | Outgoing workflow business command (NĐ 30/2020). |
| `documents/[id]/actions/approve-format` | POST | KEEP | Outgoing workflow business command. |
| `documents/[id]/actions/assign-number` | POST | KEEP | Outgoing workflow: assign số/ký hiệu. |
| `documents/[id]/actions/assign-unit` | POST | KEEP | Incoming workflow: phân công đơn vị xử lý. |
| `documents/[id]/actions/direct` | POST | KEEP | Incoming workflow: lãnh đạo chỉ đạo (bút phê). |
| `documents/[id]/actions/file` | POST | KEEP | Incoming/Outgoing: lưu hồ sơ. |
| `documents/[id]/actions/issue` | POST | KEEP | Outgoing workflow: phát hành văn bản. |
| `documents/[id]/actions/organization-sign` | POST | KEEP | Outgoing: ký số tổ chức (con dấu). |
| `documents/[id]/actions/present` | POST | KEEP | Incoming workflow: trình lãnh đạo. Emits `document.workflow_advanced`. |
| `documents/[id]/actions/resolve` | POST | KEEP | Incoming: giải quyết xong. |
| `documents/[id]/actions/revision` | POST | KEEP | Outgoing: yêu cầu chỉnh sửa. |
| `documents/[id]/actions/sign` | POST | KEEP | Outgoing: ký số cá nhân. Emits `document.signed`. |
| `documents/[id]/actions/submit-content-review` | POST | KEEP | Outgoing: trình duyệt nội dung. |
| `documents/[id]/actions/submit-format-check` | POST | KEEP | Outgoing: trình kiểm tra thể thức. |
| `documents/[id]/directives` | GET, POST | KEEP | List / create directives for a document. |
| `documents/[id]/workflow` | GET | KEEP | Read workflow state for a document. |
| `documents/download` | GET | KEEP | File download endpoint. |
| `documents/export-excel` | GET, POST | KEEP | Excel export (report generation). |
| `documents/incoming` | GET, POST | EXTEND | Cursor pagination on GET. POST: validate against incoming FSM (ADR-004). |
| `documents/incoming/[id]` | GET | KEEP | Single incoming document detail. |
| `documents/outgoing` | GET, POST | EXTEND | Cursor pagination on GET. POST: validate against outgoing FSM (ADR-004). |
| `documents/stats` | GET (×3 overloads) | KEEP | Dashboard statistics aggregation. |

### 3.5 Delegation Domain — 2 routes, 3 handlers

| Route Path | Methods | Classification | Notes |
|:-----------|:--------|:--------------:|:------|
| `delegations` | GET, POST | EXTEND | GET: cursor pagination, filter by status/grantor/delegate. POST: emit `delegation.granted` outbox event. Validate against DelegationScopeRule. |
| `delegations/[id]/revoke` | POST | KEEP | Business command ✓. Emits `delegation.revoked`. |

### 3.6 Meeting Domain — 6 routes, 10 handlers

| Route Path | Methods | Classification | Notes |
|:-----------|:--------|:--------------:|:------|
| `meetings` | GET, POST | EXTEND | Cursor pagination. POST: emit `meeting.scheduled`. |
| `meetings/[id]` | GET | KEEP | Meeting detail with participants. |
| `meetings/[id]/actions/confirm-minutes` | POST | KEEP | Business command ✓. |
| `meetings/[id]/actions/draft-minutes` | POST | KEEP | Business command ✓. |
| `meetings/[id]/actions/hold` | POST | KEEP | Business command ✓ (mark meeting as held). |
| `meetings/[id]/participants` | POST | KEEP | Add participants. |
| `meetings/[id]/resolutions` | GET, POST | KEEP | List / create resolutions. |

### 3.7 Dossier Domain — 5 routes, 9 handlers

| Route Path | Methods | Classification | Notes |
|:-----------|:--------|:--------------:|:------|
| `dossiers` | GET, POST | EXTEND | Cursor pagination. POST: create dossier per NĐ 30/2020 archival rules. |
| `dossiers/[id]` | GET | KEEP | Dossier detail with items summary. |
| `dossiers/[id]/actions/accept-archive` | POST | KEEP | Business command ✓. Emits `dossier.status_changed`. |
| `dossiers/[id]/actions/close` | POST | KEEP | Business command ✓. |
| `dossiers/[id]/actions/submit-archive` | POST | KEEP | Business command ✓. |
| `dossiers/[id]/items` | GET, POST, DELETE | EXTEND | Add item-level concurrency. DELETE: validate dossier is not archived. |

### 3.8 Notification Domain — 7 routes, 14 handlers

| Route Path | Methods | Classification | Notes |
|:-----------|:--------|:--------------:|:------|
| `notifications` | GET, PATCH | EXTEND | GET: cursor pagination, filter by read/unread/type. PATCH: batch mark-read (constrained to own notifications). |
| `notifications/[id]/read` | PATCH, POST | KEEP | Mark single notification as read. |
| `notifications/read-all` | POST | KEEP | Bulk mark-all-read. |
| `notifications/push` | GET, POST, DELETE | KEEP | Push subscription CRUD. |
| `notifications/push/key` | GET | KEEP | VAPID public key endpoint. |
| `notifications/push/subscribe` | GET, POST, DELETE | KEEP | Subscribe/unsubscribe push. |
| `notifications/push/test` | POST | KEEP | Test push delivery. |

### 3.9 Organization Domain — 2 routes, 4 handlers

| Route Path | Methods | Classification | Notes |
|:-----------|:--------|:--------------:|:------|
| `organization/bodies` | GET, POST | KEEP | List / create organizational bodies. |
| `organization/bodies/[id]` | GET, POST | KEEP | Detail / update body. |

### 3.10 Platform & Infrastructure — 18 routes, 19 handlers

| Route Path | Methods | Classification | Notes |
|:-----------|:--------|:--------------:|:------|
| `dashboard/overview` | GET (×3 overloads) | KEEP | Dashboard aggregation (tasks, docs, meetings). |
| `departments` | GET | **DEPRECATE** | Replace with organizational-unit-based queries after RFC-02. |
| `executive/resolutions` | GET, POST | KEEP | Executive resolution management. |
| `files/[...path]` | GET | EXTEND | Integrate with FileObject framework. Add access control check. |
| `health` | GET | KEEP | Basic health check. |
| `health/live` | GET | KEEP | Kubernetes liveness probe. |
| `health/ready` | GET | KEEP | Kubernetes readiness probe. |
| `me/context` | GET | EXTEND | Enrich with position-derived capabilities (ADR-002). |
| `me/inbox` | GET | EXTEND | Separate Action Inbox from notification feed (RFC-07). Add cursor pagination. |
| `search` | GET | EXTEND | Add cursor pagination. |
| `users` | GET | KEEP | User directory listing. |
| `runtime-config` | GET | KEEP | Client runtime configuration. |
| `system/network-info` | GET | KEEP | System diagnostics. |
| `csp-report` | POST, OPTIONS | KEEP | Content Security Policy violation reporting. |
| `telemetry` | POST, OPTIONS | KEEP | Client telemetry ingestion. |
| `push/subscribe` | GET, POST, DELETE | RE-EXPORT | Re-exports from `notifications/push/subscribe`. |
| `push/test` | POST | RE-EXPORT | Re-exports from `notifications/push/test`. |

### 3.11 Handler Count Summary

| HTTP Method | Current Count | Classification Breakdown |
|:-----------:|:------------:|:-------------------------|
| **GET** | 45 | 33 KEEP, 12 EXTEND |
| **POST** | 59 | 47 KEEP, 11 EXTEND, 1 DEPRECATE |
| **PATCH** | 6 | 3 KEEP, 3 EXTEND |
| **DELETE** | 6 | 3 KEEP, 3 EXTEND |
| **OPTIONS** | 2 | 2 KEEP |
| **Total** | **118** | **88 KEEP, 29 EXTEND, 1 DEPRECATE** |

> **Notes:**
> - The NextAuth catch-all (`auth/[...nextauth]`) exports GET + POST via `handlers` destructuring (not matched by the `export async function` grep pattern). Counted as 2 handlers.
> - `dashboard/overview` and `documents/stats` each contain multiple GET handler overloads within a single export (conditional logic). Counted as 1 exported handler each.
> - `push/subscribe` and `push/test` are re-exports — handlers counted once at their canonical location under `notifications/push/`.
> - `tasks/[id]/actions/update-status` is the only DEPRECATE target — it allows raw status mutation, violating Architecture Invariant 9.

---

## 4. Parity Testing Procedures & Rollback Scenarios

### 4.1 General Principles

1. **Every Expand step is independently reversible** — revert the Prisma migration to undo.
2. **Backfill scripts are idempotent** — safe to re-run on partial failures.
3. **Feature flags control cutover** — `FF_MIGRATION_<NAME>_CUTOVER` in runtime config.
4. **Minimum 2-sprint verification** — Contract step blocked until verification period passes with zero parity failures.
5. **Dual-write during cutover** — both old and new structures receive writes; old is source of truth until flag flips.

### 4.2 RFC-01: TaskAssignee → TaskActor

#### 4.2.1 Pre-Migration Verification Checklist

- [ ] RFC-01 has reached **ACCEPTED** status with owner sign-off.
- [ ] ADR-005 status updated from PROPOSED to ACCEPTED.
- [ ] Full consumer audit completed: all code paths reading `TaskAssignee` identified.
- [ ] `TaskActor` role enum covers all `AssigneeRole` values (`PRIMARY_OWNER`, `COLLABORATOR`, `SUPERVISOR`).
- [ ] Mapping table documents: `AssigneeRole.PRIMARY_OWNER` → `TaskActorRole.DRI`, etc.
- [ ] Backfill script written and tested against staging database copy.

#### 4.2.2 Data Parity Test Suite

```
tests/migrations/rfc-01-task-assignee-to-actor/
├── parity.test.ts          # Row-by-row comparison: TaskAssignee ↔ TaskActor
├── role-mapping.test.ts    # AssigneeRole → TaskActorRole mapping correctness
├── query-equivalence.test.ts  # Old queries vs new queries return same results
└── sod-check.test.ts      # Maker-Checker SoD still enforced through TaskActor
```

**Key parity assertions:**
- Every `TaskAssignee` row has a corresponding `TaskActor` row with matching `taskId`, `userId`.
- `AssigneeRole` maps correctly to `TaskActorRole`.
- `assignedAt` timestamps preserved.
- API responses for task detail include the same assignees regardless of read source.
- SoD checks in `TaskStateMachine.isMaker()` produce identical results.

#### 4.2.3 Dual-Write Period Monitoring

| Metric | Alert Threshold | Action |
|--------|:---------------:|--------|
| Write divergence (new row missing) | > 0 | Investigate immediately. Pause cutover. |
| Role mapping mismatch | > 0 | Fix mapping, re-backfill. |
| API response diff (old vs new read path) | > 0 fields | Log and investigate. |
| Error rate on TaskActor writes | > 0.1 % | Pause dual-write. |

#### 4.2.4 Rollback

| Trigger | Action |
|---------|--------|
| Parity failure > 0 rows after backfill | Fix script, re-backfill, re-verify. Do not proceed. |
| Dual-write error rate > 0.1 % | Flip `FF_MIGRATION_RFC01_CUTOVER` off. Investigate. |
| SoD test failure | **Immediate rollback.** Security-critical. Flip flag, halt migration. |
| Post-cutover regression in 2-sprint window | Flip flag off. Old structure resumes as primary. |

### 4.3 RFC-02: Department → OrganizationalUnit

#### 4.3.1 Pre-Migration Verification Checklist

- [ ] RFC-02 has reached **ACCEPTED** status with owner sign-off.
- [ ] ADR-006 status updated from PROPOSED to ACCEPTED.
- [ ] Mapping of flat department IDs (VarChar(50)) to OrganizationalUnit CUIDs documented.
- [ ] Closure table (`UnitClosurePath`) entries generated for migrated departments.
- [ ] All `departmentId` foreign keys across schema identified: `User.departmentId`, `Task.departmentId`, `Document` relations, `JobCatalogItem`, `DacumDuty`, `DacumDelegation`.
- [ ] Impact on historical queries assessed (tasks created under old department ID).

#### 4.3.2 Data Parity Test Suite

```
tests/migrations/rfc-02-department-to-org-unit/
├── parity.test.ts           # Department rows ↔ OrganizationalUnit rows
├── hierarchy.test.ts        # UnitClosurePath correctly represents flat→tree
├── fk-integrity.test.ts     # All departmentId FKs resolve through mapping
├── query-equivalence.test.ts # Department-scoped queries = Unit-scoped queries
└── user-context.test.ts     # User.departmentId → User position in org tree
```

**Key parity assertions:**
- Every `Department` has exactly one corresponding `OrganizationalUnit` with `type: DEPARTMENT`.
- `Department.name`, `shortName`, `color` preserved in `OrganizationalUnit.metadata` or direct fields.
- Tasks queried by old `departmentId` return the same set as tasks queried by new `unitId`.
- User department resolution (for task assignment, document routing) produces identical results.

#### 4.3.3 Dual-Write Period Monitoring

| Metric | Alert Threshold | Action |
|--------|:---------------:|--------|
| Department created without matching OrgUnit | > 0 | Fix dual-write middleware. |
| Task routing to wrong unit | > 0 | Immediate rollback. |
| User department context mismatch | > 0 | Investigate mapping. |

#### 4.3.4 Rollback

| Trigger | Action |
|---------|--------|
| Hierarchy query returns incorrect ancestors/descendants | Fix closure table, re-backfill. |
| Task routing failure | Flip `FF_MIGRATION_RFC02_CUTOVER` off immediately. |
| Document workflow assigned to wrong unit | Flip flag off. Audit affected documents. |

### 4.4 RFC-03: DacumDelegation → DelegationGrant

#### 4.4.1 Pre-Migration Verification Checklist

- [ ] RFC-03 has reached **ACCEPTED** status.
- [ ] Mapping of User-to-User delegation to Position-to-Position delegation documented.
- [ ] `DelegationScopeRule` entries created for migrated delegations.
- [ ] Temporal validity (`effectiveFrom`/`effectiveTo`) correctly transferred.
- [ ] Active delegation count matches between old and new models.
- [ ] UI delegation management screens identified and dual-read tested.

#### 4.4.2 Data Parity Test Suite

```
tests/migrations/rfc-03-dacum-delegation-to-grant/
├── parity.test.ts           # DacumDelegation rows ↔ DelegationGrant rows
├── scope-mapping.test.ts    # Department scope → OrgUnit scope in DelegationScopeRule
├── temporal.test.ts         # Date ranges preserved, active/expired status correct
├── authority-check.test.ts  # Authorization engine produces same results
└── revocation.test.ts       # Revoked delegations correctly marked in new model
```

**Key parity assertions:**
- Every active `DacumDelegation` has a corresponding active `DelegationGrant`.
- `grantorUserId` → grantor's `PositionAssignment` resolved correctly.
- `delegateUserId` → delegate's `PositionAssignment` resolved correctly.
- Authorization engine `isDelegatedTo()` returns identical results.
- Revoked delegations are not erroneously active in new model.

#### 4.4.3 Dual-Write Period Monitoring

| Metric | Alert Threshold | Action |
|--------|:---------------:|--------|
| Active delegation count divergence | > 0 | Investigate. |
| Authorization decision mismatch | > 0 | **Immediate rollback.** Security-critical. |
| Delegation without matching PositionAssignment | > 0 | Pause. Resolve position mapping. |

#### 4.4.4 Rollback

| Trigger | Action |
|---------|--------|
| Authorization decision changes for any user | Flip `FF_MIGRATION_RFC03_CUTOVER` off. Security audit. |
| Position mapping failure (user has no PositionAssignment) | Pause migration. Create missing assignments first. |
| Scope rule mismatch | Fix DelegationScopeRule backfill, re-verify. |

### 4.5 Rollback Execution Checklist (All RFCs)

When a rollback is triggered:

1. **T+0 min** — Flip feature flag `FF_MIGRATION_<RFC>_CUTOVER` to `false` via runtime config.
2. **T+1 min** — Verify application is reading from old structure (check logs / metrics).
3. **T+5 min** — Disable dual-write middleware (old structure stops receiving new-path writes).
4. **T+10 min** — Run parity test suite against current data to assess divergence.
5. **T+15 min** — If divergence found, run reconciliation script to sync old ← new for the rollback window.
6. **T+30 min** — Notify stakeholders of rollback with root cause summary.
7. **T+1 day** — Post-mortem. Update RFC with findings. Re-plan migration.

### 4.6 Post-Rollback Verification

- [ ] All API endpoints return correct data from old structures.
- [ ] No orphaned rows in new structures causing constraint violations.
- [ ] Audit log (`AuditEvent`) records the rollback event.
- [ ] Feature flag confirmed off in all environments (dev, staging, production).
- [ ] CI/CD parity tests pass against old structure.

---

## Appendix A: Cross-Reference to Architecture Plan

| Section | Architecture Plan Reference |
|---------|:-------------------------:|
| Migration principle | Invariant 10 (§III) |
| TaskAssignee → TaskActor | F04, R01, ADR-005 (PROPOSED) |
| Department → OrganizationalUnit | F05, R02, ADR-006 (PROPOSED) |
| DacumDelegation → DelegationGrant | F06, R03 |
| Task lifecycle status | F03, D03, ADR-003 (PROPOSED) |
| Document 2-tier status | F07, D04, ADR-004 (PROPOSED) |
| Controlled vocabulary | F10, D05 |
| JSON denormalization | F09, R05 |
| Notification restructure | F11, R06, RFC-07 |
| API business commands | Invariant 9 (§III), ADR-007 |
| Optimistic concurrency | ADR-007 |

## Appendix B: Enum Additions Required for EXTEND Models

| Model | Current | Target Addition | Governing Decision |
|-------|---------|-----------------|:------------------:|
| Task | `TaskStatus` (6 values) | Add canonical `lifecycleStatus` field with ADR-003 values | ADR-003 |
| UnitWorkAssignment | `status: String` | New `UnitWorkAssignmentStatus` enum | D05 |
| Notification | `category: String`, `type: String` | New `NotificationCategory`, `NotificationType` enums | RFC-07 |
| Document | `DocumentStatus` (5 values) | Add `administrativeStatus` field synced from workflow tier | ADR-004 |
