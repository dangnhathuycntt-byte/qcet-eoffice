# API & Database Evolution Standards

> **QCET Issue #34 — Phase 0 Deliverable**
> Status: DOCUMENTATION ONLY — no `src/` or `prisma/` modifications.
> Canonical reference: `docs/architecture/enterprise-product-architecture.md` (Architecture Plan v1, frozen 2026-09-22).

---

## Table of Contents

1. [API Design Standards](#1-api-design-standards)
2. [Database Design Standards](#2-database-design-standards)
3. [Transactional Outbox Event Catalog](#3-transactional-outbox-event-catalog)
4. [FileObject Conceptual Framework](#4-fileobject-conceptual-framework)
5. [Architecture Risk Register](#5-architecture-risk-register)

---

## 1. API Design Standards

### 1.1 RESTful Resource-Oriented Paths

All API endpoints follow a resource-oriented URL structure:

```
/api/{resource}                  → collection (GET list, POST create)
/api/{resource}/{id}             → instance   (GET detail, PATCH update, DELETE remove)
/api/{resource}/{id}/{sub}       → sub-resource collection
/api/{resource}/{id}/actions/{verb} → explicit business command
```

**Invariant (Architecture Plan §III.8):** API contracts do not mirror the database schema 1:1. Endpoints are designed around business intent and domain resources.

### 1.2 Explicit Business Commands

**Invariant (Architecture Plan §III.9):** Business state transitions MUST go through explicit Business Command endpoints. Raw `PATCH { status: "..." }` to bypass State Machine and SoD rules is **prohibited**.

| Pattern | Example | Purpose |
|:--------|:--------|:--------|
| `POST /api/tasks/{id}/actions/approve` | Approve task result | State Machine transition with SoD guard |
| `POST /api/tasks/{id}/actions/submit-result` | Submit deliverables | Lifecycle transition with validation |
| `POST /api/tasks/{id}/actions/start` | Begin execution | State Machine transition |
| `POST /api/tasks/{id}/actions/cancel` | Cancel task | Guarded transition with authorization |
| `POST /api/documents/{id}/actions/present` | Present incoming document | NĐ 30/2020 workflow step |
| `POST /api/documents/{id}/actions/sign` | Sign document | Authorized signer only |
| `POST /api/delegations/{id}/revoke` | Revoke delegation grant | Authority-scoped command |

Each command endpoint:
- Accepts a JSON body with command-specific parameters (not generic field updates).
- Returns the updated resource representation or a `202 Accepted` for async operations.
- Validates preconditions (current state, authorization, SoD) before mutation.
- Emits a domain event via the Transactional Outbox on success.

### 1.3 Cursor-Based Pagination

All collection endpoints returning potentially large result sets use **opaque cursor-based pagination**, not offset-based.

**Response envelope:**

```json
{
  "data": [ ... ],
  "pagination": {
    "cursor": "eyJpZCI6ImNsdXh5ejEyMyIsImRpciI6Im5leHQifQ==",
    "hasMore": true,
    "totalCount": 142
  }
}
```

**Query parameters:**

| Parameter | Type | Default | Description |
|:----------|:-----|:--------|:------------|
| `cursor` | string | _(none)_ | Opaque cursor from previous response |
| `limit` | integer | 25 | Items per page (max 100) |
| `direction` | `next` \| `prev` | `next` | Pagination direction |

**Rules:**
- Cursors are opaque base64-encoded tokens; clients MUST NOT parse or construct them.
- `totalCount` is optional; omit when the cost of counting is prohibitive.
- First request omits `cursor`; subsequent requests pass the returned cursor.

### 1.4 Optimistic Concurrency Control

Resources subject to concurrent updates carry a `version` field (integer, monotonically increasing). Clients use HTTP conditional headers for safe mutations:

| Header | Direction | Purpose |
|:-------|:----------|:--------|
| `ETag` | Response | Entity version (e.g., `"v42"`) |
| `If-Match` | Request | Required on PATCH/DELETE; rejects if version mismatch |

**Conflict response:**

```http
HTTP/1.1 409 Conflict
Content-Type: application/problem+json

{
  "type": "https://qcet.edu.vn/problems/concurrent-modification",
  "title": "Resource was modified by another request",
  "status": 409,
  "detail": "Expected version 41, current version is 42.",
  "instance": "/api/tasks/cluxy1234"
}
```

### 1.5 Error Format — RFC 9457 Problem Details

All error responses use `application/problem+json` as defined by [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457).

**Standard fields:**

| Field | Type | Required | Description |
|:------|:-----|:---------|:------------|
| `type` | URI | Yes | Problem type URI (stable, machine-readable) |
| `title` | string | Yes | Short human-readable summary |
| `status` | integer | Yes | HTTP status code |
| `detail` | string | No | Human-readable explanation specific to this occurrence |
| `instance` | URI | No | URI of the specific resource/request |

**Extension fields (QCET-specific):**

| Field | Type | When present |
|:------|:-----|:-------------|
| `violations` | array | Validation errors (422) — list of `{ field, message, code }` |
| `retryAfter` | integer | Rate limiting (429) — seconds until retry |
| `traceId` | string | Always — correlation ID for debugging |

**Standard problem type URIs:**

```
https://qcet.edu.vn/problems/validation-error         → 422
https://qcet.edu.vn/problems/not-found                 → 404
https://qcet.edu.vn/problems/forbidden                 → 403
https://qcet.edu.vn/problems/unauthorized               → 401
https://qcet.edu.vn/problems/concurrent-modification    → 409
https://qcet.edu.vn/problems/invalid-state-transition   → 409
https://qcet.edu.vn/problems/sod-violation              → 403
https://qcet.edu.vn/problems/rate-limited               → 429
https://qcet.edu.vn/problems/internal-error             → 500
```

### 1.6 Content Negotiation

- Request bodies: `application/json` (default), `multipart/form-data` (file uploads).
- Response bodies: `application/json` (success), `application/problem+json` (errors).
- File downloads: appropriate MIME type with `Content-Disposition` header.
- Accept header is respected but `application/json` is the fallback.

### 1.7 API Versioning Strategy

**Current phase:** All endpoints live under `/api/` without version prefix. This is acceptable for the internal single-consumer (Next.js frontend) architecture.

**Target:** When external consumers or breaking changes are introduced, adopt URL-prefix versioning:

```
/api/v1/tasks         → stable v1
/api/v2/tasks         → breaking change version
```

**Migration policy:**
- Additive changes (new fields, new endpoints) do NOT require a version bump.
- Breaking changes (field removal, type change, behavior change) require a new version.
- Previous versions are supported for a minimum of 2 release cycles after deprecation notice.

---

## 2. Database Design Standards

### 2.1 Domain Ownership

Each Bounded Context (Architecture Plan §VI) owns its database tables. Cross-context references use foreign keys to shared identity tables (e.g., `User.id`, `OrganizationalUnit.id`) but never directly read/write another context's internal tables.

| Bounded Context | Owned Models |
|:----------------|:-------------|
| **Identity** | `User`, `Account`, `Session`, `VerificationToken` |
| **Organization** | `OrganizationalUnit`, `UnitClosurePath`, `OrganizationalBody`, `BodyMembership`, `PositionDefinition`, `PositionAssignment`, `ResponsibilityArea`, `PortfolioAssignment`, `DelegationGrant`, `DelegationScopeRule` |
| **Work Management** | `Task`, `TaskAssignee`¹, `TaskActor`, `TaskApprovalProcess`, `TaskApprovalStep`, `TaskResult`, `TaskRelation`, `TaskDeliverable`, `TaskSequence`, `ExecutiveResolution`, `JobCatalogItem`, `DacumDuty`, `DacumTaskDef`, `DacumDelegation`² |
| **Document Management** | `Document`, `DocumentNumberSequence`, `DocumentAttachment`, `DocumentDirective`, `DocumentIncomingWorkflow`, `UnitWorkAssignment`, `DocumentOutgoingWorkflow`, `SignatureRecord` |
| **Meeting** | `Meeting`, `MeetingParticipant`, `MeetingResolution` |
| **Archival** | `WorkDossier`, `DossierItem`, `RetentionRule` |
| **Platform / Shared** | `Notification`, `PushSubscription`, `AuditEvent`, `OutboxEvent`, `IdempotencyRecord`, `Department`³ |

> ¹ `TaskAssignee` — legacy model, RFC_REQUIRED for migration to `TaskActor` (RFC-01).
> ² `DacumDelegation` — legacy model, RFC_REQUIRED for migration to `DelegationGrant` (RFC-03).
> ³ `Department` — legacy flat model, RFC_REQUIRED for migration to `OrganizationalUnit` (RFC-02).

### 2.2 Temporal Validity Patterns

Models representing organizational structures that change over time use temporal validity columns:

```prisma
effectiveFrom    DateTime  @default(now())  // When this record becomes active
effectiveTo      DateTime?                   // When this record expires (null = current)
```

**Currently applied to:** `OrganizationalUnit`, `OrganizationalBody`, `PositionAssignment`, `DelegationGrant`, `PortfolioAssignment`, `ResponsibilityArea`.

**Query pattern:** Always filter by `effectiveFrom <= now() AND (effectiveTo IS NULL OR effectiveTo > now())` for current-state queries. Historical queries omit the filter.

### 2.3 Immutable Audit Logs

The `AuditEvent` model (`prisma/schema.prisma:1264`) is **append-only**:

```prisma
model AuditEvent {
  id         String   @id @default(uuid())
  actorId    String?                          // Who performed the action
  action     String                           // Controlled vocabulary action code
  entityType String                           // Aggregate type (e.g., "Task", "Document")
  entityId   String                           // Aggregate instance ID
  requestId  String?                          // Correlation ID for request tracing
  beforeData Json?                            // Snapshot before mutation
  afterData  Json?                            // Snapshot after mutation
  metadata   Json?                            // Additional context
  createdAt  DateTime @default(now())         // Immutable timestamp
}
```

**Rules:**
- No UPDATE or DELETE operations on `audit_events` table in application code.
- Every business command that mutates domain state MUST write an audit event within the same transaction.
- `beforeData` / `afterData` capture the relevant field diff, not the entire entity (to control storage growth).
- `requestId` links audit events to the originating HTTP request for cross-referencing.

### 2.4 Controlled Vocabulary Constraints

**Invariant (Architecture Plan D05, Finding F10):** Every status/category/type field MUST use a controlled vocabulary with an explicit constraint. Free-form `String` status fields are prohibited.

| Mechanism | When to use |
|:----------|:------------|
| Prisma `enum` | Fixed, small set of values unlikely to change without code deployment |
| Lookup/reference table | Values managed at runtime by administrators |
| Constrained `@db.VarChar` with CHECK | Values that need flexibility but must match a known pattern |

**Known violation (FACT F10):** `UnitWorkAssignment.status` is currently a free-form `String`. This must be converted to an enum or constrained type as part of the migration plan.

### 2.5 Soft-Delete vs Hard-Delete Policy

| Entity Type | Policy | Rationale |
|:------------|:-------|:----------|
| Audit / Compliance records | **Never delete** | Legal retention requirements |
| Tasks, Documents | **Soft-delete** via `archivedAt` timestamp | Business continuity, audit trail |
| User accounts | **Soft-delete** via `isActive` + `deactivatedAt` | Historical reference integrity |
| Sessions, Verification tokens | **Hard-delete** on expiry | No business value after expiry |
| Notifications (read) | **Hard-delete** allowed after retention period | Storage management |
| OutboxEvent (COMPLETED) | **Hard-delete** after processing + retention | Outbox pattern cleanup |

### 2.6 JSON Field Usage Policy

JSON fields (`Json` type in Prisma) are used sparingly and only for:

| Allowed Use | Example | Rationale |
|:------------|:--------|:----------|
| Semi-structured metadata | `Task.metadata`, `AuditEvent.metadata` | Extensible key-value context |
| Snapshot data (immutable) | `AuditEvent.beforeData/afterData` | Point-in-time capture |
| Configuration blobs | `User.onboardingData` | Schema-less per-user settings |

**Prohibited uses:**
- ❌ Storing relational data that should be a join table (ref Finding F09: `DocumentDirective.collaboratorIds` as CSV Text, `IncomingWorkflow.coordinatingUnitIds` as JSON array).
- ❌ Storing status or state that needs querying/filtering (use enum columns).
- ❌ Storing references to other entities without FK integrity.

---

## 3. Transactional Outbox Event Catalog

The Transactional Outbox pattern (Architecture Plan §XII, `prisma/schema.prisma:1293`) ensures reliable event publication alongside database transactions.

### 3.1 OutboxEvent Model Reference

```prisma
model OutboxEvent {
  id            String       @id @default(uuid())
  eventType     String       // e.g., "task.created"
  aggregateType String       // e.g., "Task"
  aggregateId   String       // e.g., "cluxy1234"
  payload       Json         // Event-specific data
  status        OutboxStatus @default(PENDING)   // PENDING → PROCESSING → COMPLETED / FAILED
  attempts      Int          @default(0)
  lastError     String?
  availableAt   DateTime     @default(now())      // Delayed delivery support
  processedAt   DateTime?
  createdAt     DateTime     @default(now())
}
```

### 3.2 Event Catalog

#### Event 1: `task.created`

| Field | Value |
|:------|:------|
| **eventType** | `task.created` |
| **aggregateType** | `Task` |
| **Payload shape** | `{ taskId, title, scope, priority, createdById, departmentId, parentId?, dacumTaskDefId?, dueDate? }` |
| **Producers** | `POST /api/tasks` (task creation handler) |
| **Consumers** | Notification service (notify assignees), Action Inbox projection, Dashboard stats aggregator |

#### Event 2: `task.status_changed`

| Field | Value |
|:------|:------|
| **eventType** | `task.status_changed` |
| **aggregateType** | `Task` |
| **Payload shape** | `{ taskId, previousStatus, newStatus, changedById, reason?, transitionCommand }` |
| **Producers** | All `/api/tasks/{id}/actions/*` command endpoints |
| **Consumers** | Notification service, Attention resolver refresh, Overdue monitoring, Dashboard stats |

#### Event 3: `task.assigned`

| Field | Value |
|:------|:------|
| **eventType** | `task.assigned` |
| **aggregateType** | `Task` |
| **Payload shape** | `{ taskId, actorUserId, actorRole, assignedById, unitId? }` |
| **Producers** | Task creation (initial assignment), `POST /api/tasks/{id}/actions/reassign` |
| **Consumers** | Notification service (notify new assignee), Action Inbox projection |

#### Event 4: `task.approved`

| Field | Value |
|:------|:------|
| **eventType** | `task.approved` |
| **aggregateType** | `Task` |
| **Payload shape** | `{ taskId, approvedById, approvalStepId?, resultId?, outcome: "APPROVED" | "REVISION_REQUIRED" | "REJECTED" }` |
| **Producers** | `POST /api/tasks/{id}/actions/approve`, `POST /api/tasks/{id}/actions/review`, `POST /api/tasks/{id}/actions/request-revision` |
| **Consumers** | Notification service (notify task owner), Task lifecycle FSM (status transition), Audit trail |

#### Event 5: `task.result_submitted`

| Field | Value |
|:------|:------|
| **eventType** | `task.result_submitted` |
| **aggregateType** | `Task` |
| **Payload shape** | `{ taskId, resultId, submittedById, deliverableIds[], description? }` |
| **Producers** | `POST /api/tasks/{id}/actions/submit-result` |
| **Consumers** | Notification service (notify reviewer/supervisor), Approval process initiation |

#### Event 6: `document.registered`

| Field | Value |
|:------|:------|
| **eventType** | `document.registered` |
| **aggregateType** | `Document` |
| **Payload shape** | `{ documentId, documentType: "VAN_BAN_DEN" | "VAN_BAN_DI" | "TO_TRINH_NOI_BO", registeredById, incomingNumber?, subject }` |
| **Producers** | `POST /api/documents/incoming`, `POST /api/documents/outgoing`, `POST /api/documents` |
| **Consumers** | Notification service, Document stats aggregator, Dossier auto-linking |

#### Event 7: `document.workflow_advanced`

| Field | Value |
|:------|:------|
| **eventType** | `document.workflow_advanced` |
| **aggregateType** | `Document` |
| **Payload shape** | `{ documentId, workflowType: "incoming" | "outgoing", previousStep, currentStep, actorId, unitId? }` |
| **Producers** | All `/api/documents/{id}/actions/*` command endpoints (present, direct, resolve, assign-unit, approve-content, approve-format, sign, issue, file, etc.) |
| **Consumers** | Notification service (notify next-step actor), Document status 2-tier sync service, Audit trail |

#### Event 8: `document.signed`

| Field | Value |
|:------|:------|
| **eventType** | `document.signed` |
| **aggregateType** | `Document` |
| **Payload shape** | `{ documentId, signatureId, signedById, signatureType: "CONTENT" | "FORMAT" | "AUTHORIZED" | "ORGANIZATION", timestamp }` |
| **Producers** | `POST /api/documents/{id}/actions/sign`, `POST /api/documents/{id}/actions/organization-sign` |
| **Consumers** | Notification service, Outgoing workflow FSM (advance to next step) |

#### Event 9: `delegation.granted`

| Field | Value |
|:------|:------|
| **eventType** | `delegation.granted` |
| **aggregateType** | `Delegation` |
| **Payload shape** | `{ delegationId, grantorPositionId, delegatePositionId, scopeRules[], effectiveFrom, effectiveTo? }` |
| **Producers** | `POST /api/delegations` |
| **Consumers** | Authorization engine cache invalidation, Notification service (notify delegate), Audit trail |

#### Event 10: `delegation.revoked`

| Field | Value |
|:------|:------|
| **eventType** | `delegation.revoked` |
| **aggregateType** | `Delegation` |
| **Payload shape** | `{ delegationId, revokedById, reason?, revokedAt }` |
| **Producers** | `POST /api/delegations/{id}/revoke` |
| **Consumers** | Authorization engine cache invalidation, Notification service, Audit trail |

#### Event 11: `meeting.scheduled`

| Field | Value |
|:------|:------|
| **eventType** | `meeting.scheduled` |
| **aggregateType** | `Meeting` |
| **Payload shape** | `{ meetingId, title, organizerId, bodyId?, unitId?, scheduledStart, scheduledEnd, location?, participantIds[] }` |
| **Producers** | `POST /api/meetings` |
| **Consumers** | Notification service (notify participants), Calendar projection, Lịch công tác aggregator |

#### Event 12: `dossier.status_changed`

| Field | Value |
|:------|:------|
| **eventType** | `dossier.status_changed` |
| **aggregateType** | `WorkDossier` |
| **Payload shape** | `{ dossierId, previousStatus, newStatus, changedById, retentionRuleId? }` |
| **Producers** | `POST /api/dossiers/{id}/actions/close`, `POST /api/dossiers/{id}/actions/submit-archive`, `POST /api/dossiers/{id}/actions/accept-archive` |
| **Consumers** | Notification service, Retention enforcement scheduler, Archival audit trail |

### 3.3 Outbox Processing Rules

1. **Write atomically:** OutboxEvent is INSERTed in the same database transaction as the domain mutation. If the transaction rolls back, the event is never published.
2. **Poll-and-publish:** A background worker polls `outbox_events WHERE status = 'PENDING' AND availableAt <= now()` ordered by `createdAt`.
3. **At-least-once delivery:** Consumers must be idempotent. The `IdempotencyRecord` model (`prisma/schema.prisma:1245`) provides deduplication on the consumer side.
4. **Retry with backoff:** On failure, `attempts` increments and `availableAt` is set to `now() + backoff(attempts)`. Max 5 attempts before `status = 'FAILED'`.
5. **Dead letter:** Events with `status = 'FAILED'` require manual investigation. `lastError` captures the failure reason.
6. **Cleanup:** `COMPLETED` events are retained for 30 days for debugging, then hard-deleted by a scheduled job.

---

## 4. FileObject Conceptual Framework

### 4.1 Overview

QCET manages binary assets (document attachments, task deliverables, signature images, meeting minutes attachments) through a unified file management abstraction.

### 4.2 Current State

- **Storage:** Local filesystem under a configured upload directory.
- **Serving:** `GET /api/files/[...path]` serves files by path.
- **Upload:** Multipart form data via specific resource endpoints (e.g., `POST /api/tasks/{id}/deliverables`, `POST /api/documents`).
- **Metadata:** `DocumentAttachment` and `TaskDeliverable` models store file metadata (filename, MIME type, size, path) alongside the domain entity.

### 4.3 Target Architecture — FileObject Model

A unified `FileObject` conceptual model abstracts storage concerns from domain models:

```
FileObject (conceptual, not yet in schema)
├── id:           UUID
├── storageKey:   String       // Opaque key for storage backend
├── originalName: String       // User-facing filename
├── mimeType:     String       // MIME type
├── sizeBytes:    BigInt       // File size
├── checksum:     String       // SHA-256 for integrity verification
├── uploadedById: String → User
├── visibility:   PRIVATE | INTERNAL | PUBLIC
├── metadata:     Json?        // Extensible metadata (dimensions, duration, etc.)
├── createdAt:    DateTime
└── deletedAt:    DateTime?    // Soft-delete
```

### 4.4 Storage Abstraction Layers

```
┌─────────────────────────────────────────┐
│           Domain Layer                   │
│  (TaskDeliverable, DocumentAttachment)   │
│         references FileObject.id         │
├─────────────────────────────────────────┤
│       File Service Interface             │
│  upload(file) → FileObject               │
│  download(id) → ReadableStream           │
│  delete(id) → void                       │
│  getSignedUrl(id, expiresIn) → URL       │
├─────────────────────────────────────────┤
│      Storage Backend (pluggable)         │
│  ┌──────────┐  ┌───────────────────┐    │
│  │  Local    │  │  S3-Compatible    │    │
│  │  (current)│  │  (target)         │    │
│  └──────────┘  └───────────────────┘    │
└─────────────────────────────────────────┘
```

### 4.5 Access Control Integration

- File access is governed by the **authorization engine** (Architecture Plan §III.6, deny-by-default).
- A file inherits its access policy from the owning domain entity:
  - `TaskDeliverable` → Task's visibility and actor permissions.
  - `DocumentAttachment` → Document's security level (`THUONG`, `MAT`, `TOI_MAT`, `TUYET_MAT`).
- Direct file URLs are not guessable; signed URLs with time-limited tokens are used for external sharing.
- Audit events are emitted for file access (`file.accessed`) and deletion (`file.deleted`).

### 4.6 Migration Path

1. **Phase 1 (current):** Local filesystem, metadata in domain-specific models.
2. **Phase 2:** Introduce `FileObject` model, migrate `DocumentAttachment` and `TaskDeliverable` to reference it.
3. **Phase 3:** Implement S3-compatible storage backend behind the service interface.
4. **Phase 4:** Add signed URL support for time-limited, authorization-checked downloads.

---

## 5. Architecture Risk Register

### Risk Summary

| ID | Risk | Severity | Status | Blocking |
|:---|:-----|:---------|:-------|:---------|
| R001 | SoD bypass from fragmented Maker checks | **Critical** | Open | ADR-001 (PROPOSED) |
| R002 | Role catalog inconsistency across FSM layers | **High** | Open | ADR-001 (PROPOSED) |
| R003 | 4 competing TaskStatus definitions | **High** | Open | ADR-003 (PROPOSED) |
| R004 | Dual assignment models (TaskAssignee / TaskActor) | **Medium** | Open | RFC-01 (REQUIRED) |
| R005 | Dual org models (Department / OrganizationalUnit) | **Medium** | Open | RFC-02 (REQUIRED) |
| R006 | Dual delegation models (DacumDelegation / DelegationGrant) | **Medium** | Open | RFC-03 (REQUIRED) |
| R007 | Document status 3-system fragmentation | **High** | Open | ADR-004 (PROPOSED) |
| R008 | JSON/Text denormalized relational data | **Low** | Open | RFC-05 (REQUIRED) |
| R009 | Free-form status string in UnitWorkAssignment | **Medium** | Open | D05 (DECISION) |
| R010 | Notification missing sender FK and controlled types | **Medium** | Open | RFC-06 (REQUIRED) |

### Risk Details

#### R001 — SoD Bypass from Fragmented Maker Checks

| Attribute | Value |
|:----------|:------|
| **Source Finding** | F01 (Architecture Plan §IV, Finding 1) |
| **Description** | Three independent Maker-detection functions (`TaskStateMachine.isMaker`, `checkAntiSelfApproval`, `isTaskMaker`) check overlapping but different sets of conditions. `isMaker` omits `creatorId` and `submittedByUserId`, potentially allowing the task creator or result submitter to approve their own work. |
| **Severity** | **Critical** — SoD is a core compliance requirement for government workflows. |
| **Impact** | A user could create a task, submit its result, and approve the result — bypassing separation of duties. |
| **Mitigation** | Consolidate into a single canonical `isMaker()` function in the domain layer, checking all maker signals: Creator, Primary DRI, every Assignee/Actor, Result Submitter, Deliverable Uploader. |
| **Blocking** | ADR-001 (Maker-Checker SoD, status: PROPOSED). Implementation WI-1.1 is blocked until ADR-001 is ACCEPTED. |

#### R002 — Role Catalog Inconsistency Across FSM Layers

| Attribute | Value |
|:----------|:------|
| **Source Finding** | F02 (Architecture Plan §IV, Finding 2) |
| **Description** | `MANAGER_ROLES` in the State Machine omits `TRUONG_KHOA` and `GIAM_DOC_TRUNG_TAM`. The Attention Resolver's `UNIT_HEAD_ROLES` omits `PHO_TRUONG_PHONG`. The Authorization Engine uses position codes instead of role strings. |
| **Severity** | **High** — Users holding `TRUONG_KHOA` position see "Cần tôi duyệt" badge but get rejected by the State Machine. |
| **Impact** | Functional UX inconsistency: UI promises an action the backend refuses. |
| **Mitigation** | Derive all authorization decisions from the contextual authorization policy (ADR-002, ACCEPTED), not from role string matching. Deprecate `MANAGER_ROLES` and `UNIT_HEAD_ROLES` constants. |
| **Blocking** | ADR-001 (PROPOSED). Correctness fix under ADR-002 (ACCEPTED) is permitted. |

#### R003 — 4 Competing TaskStatus Definitions

| Attribute | Value |
|:----------|:------|
| **Source Finding** | F03 (Architecture Plan §IV, Finding 3) |
| **Description** | Four distinct TaskStatus type definitions exist: Prisma `TaskStatus` (6 values), `CanonicalTaskStatus` (5 values, starts at `NEW`), `TaskLifecycleStatus` (7 values, starts at `NOT_STARTED`), `DomainTaskStatus` (6 values). Two normalizers produce different outputs for the same input. |
| **Severity** | **High** — Data inconsistency across layers leads to unpredictable behavior. |
| **Impact** | `OVERDUE` in one layer may be `IN_PROGRESS` in another; empty status input yields `""` in one normalizer and `NOT_STARTED` in another. |
| **Mitigation** | Define a single canonical lifecycle status set (ADR-003) and retire the other definitions. Build a single normalizer function. |
| **Blocking** | ADR-003 (PROPOSED). Implementation WI-2.2 is blocked until ADR-003 is ACCEPTED. |

#### R004 — Dual Assignment Models (TaskAssignee / TaskActor)

| Attribute | Value |
|:----------|:------|
| **Source Finding** | F04, RFC R01 (Architecture Plan §V) |
| **Description** | `TaskAssignee` (Phase 1, role-based: PRIMARY_OWNER/COLLABORATOR/SUPERVISOR) and `TaskActor` (Phase 5, ReBAC-aware with unit linkage) coexist. Both have active read/write code paths. |
| **Severity** | **Medium** — Semantic duplication, but both function. Risk increases as new features are built on one model while the other becomes stale. |
| **Impact** | New code may write to `TaskActor` while legacy queries read from `TaskAssignee`, causing data divergence. |
| **Mitigation** | RFC-01: Full consumer audit, backfill script design, parity test suite, rollback plan. 5-step migration: Expand → Backfill → Verify → Cutover → Contract. |
| **Blocking** | RFC-01 (REQUIRED). ADR-005 remains PROPOSED until RFC-01 completes. |

#### R005 — Dual Org Models (Department / OrganizationalUnit)

| Attribute | Value |
|:----------|:------|
| **Source Finding** | F05, RFC R02 (Architecture Plan §V) |
| **Description** | `Department` (flat, string ID like `"phong-dao-tao"`) and `OrganizationalUnit` (tree with closure path, CUID, temporal validity) coexist with no FK between them. `Task.departmentId` → Department; `TaskActor.unitId` → OrganizationalUnit. |
| **Severity** | **Medium** — Two sources of truth for organizational structure. |
| **Impact** | Reporting on tasks by organizational unit requires joining across both models. New organizational features must choose which model to use. |
| **Mitigation** | RFC-02: Map flat department IDs to closure-tree CUIDs, assess impact on historical queries, design backfill and ID mapping. |
| **Blocking** | RFC-02 (REQUIRED). ADR-006 remains PROPOSED until RFC-02 completes. |

#### R006 — Dual Delegation Models (DacumDelegation / DelegationGrant)

| Attribute | Value |
|:----------|:------|
| **Source Finding** | F06, RFC R03 (Architecture Plan §V) |
| **Description** | `DacumDelegation` (User-to-User, department-scoped) and `DelegationGrant` (Position-to-Position, with scope rules and temporal validity) coexist. |
| **Severity** | **Medium** — `DelegationGrant` is architecturally superior but `DacumDelegation` has existing UI and data. |
| **Impact** | Authorization engine must check both delegation models, increasing complexity and risk of inconsistency. |
| **Mitigation** | RFC-03: Audit existing delegation UI, map User-User grants to Position-Position grants, validate data conversion. |
| **Blocking** | RFC-03 (REQUIRED). |

#### R007 — Document Status 3-System Fragmentation

| Attribute | Value |
|:----------|:------|
| **Source Finding** | F07 (Architecture Plan §V) |
| **Description** | Three independent status systems: `Document.status` (5 values: CHO_PHAN_CONG → DA_HOAN_THANH), `IncomingDocumentStatus` (10 values), `OutgoingDocumentStatus` (10 values). No DB constraint enforces consistency between them. |
| **Severity** | **High** — A document can have conflicting statuses across tiers. |
| **Impact** | Dashboard counts may not match detail views. NĐ 30/2020 compliance depends on correct status tracking. |
| **Mitigation** | ADR-004: 2-tier status architecture where Tier 1 (NĐ 30/2020 administrative status) is auto-derived from Tier 2 (technical workflow status) via a domain service. |
| **Blocking** | ADR-004 (PROPOSED). Implementation WI-5.1 is blocked until ADR-004 is ACCEPTED. |

#### R008 — JSON/Text Denormalized Relational Data

| Attribute | Value |
|:----------|:------|
| **Source Finding** | F09 (Architecture Plan §V) |
| **Description** | Relational data stored as JSON arrays or CSV text: `DocumentDirective.collaboratorIds` (Text CSV), `DocumentIncomingWorkflow.coordinatingUnitIds` (JSON), `UnitWorkAssignment.collaboratorUserIds` (JSON). |
| **Severity** | **Low** — Functional but lacks FK integrity; joins require application-level parsing. |
| **Impact** | Cannot enforce referential integrity at database level. Orphaned IDs are possible if referenced users/units are deleted. |
| **Mitigation** | RFC-05: Evaluate normalization to join tables vs. keeping as snapshots (for historical immutability). Cost-benefit analysis per field. |
| **Blocking** | RFC-05 (REQUIRED). |

#### R009 — Free-form Status String in UnitWorkAssignment

| Attribute | Value |
|:----------|:------|
| **Source Finding** | F10 (Architecture Plan §V) |
| **Description** | `UnitWorkAssignment.status` is typed as `String` — the only status field in the entire schema without an enum constraint. |
| **Severity** | **Medium** — Any string can be written, making queries unreliable and reporting inconsistent. |
| **Impact** | Unknown set of status values in production data; queries that filter by status may miss records. |
| **Mitigation** | Create a `UnitWorkAssignmentStatus` enum with the known values currently in use, then migrate the column. This is covered by Decision D05 (controlled vocabulary constraint). |
| **Blocking** | D05 (DECISION, accepted). Can be implemented without additional RFC. |

#### R010 — Notification Missing Sender FK and Controlled Types

| Attribute | Value |
|:----------|:------|
| **Source Finding** | F11 (Architecture Plan §V) |
| **Description** | `Notification.actorName` is a free-form string with no FK to `User`. `category` and `type` fields are raw strings without enum constraints. |
| **Severity** | **Medium** — Cannot reliably query notifications by sender; category/type values may drift. |
| **Impact** | Notification UI cannot link to actor profile reliably. Filtering by category/type depends on string matching that may break with typos or refactors. |
| **Mitigation** | RFC-06: Add `actorId` FK to `User`, define `NotificationCategory` and `NotificationType` enums. Separate Action Inbox from Notification Feed (Architecture Invariant 5). |
| **Blocking** | RFC-06 (REQUIRED). Related to RFC-07 (Action Inbox separation). |

---

## Appendix A: Cross-Reference Matrix

| This Document Section | Architecture Plan Reference |
|:----------------------|:---------------------------|
| §1.2 Business Commands | Invariant 9 (§III) |
| §1.4 Optimistic Concurrency | ADR-007 (PROPOSED) |
| §1.5 RFC 9457 Errors | ADR-007 (PROPOSED) |
| §2.1 Domain Ownership | §VI Bounded Contexts Map |
| §2.3 Audit Logs | `prisma/schema.prisma:1264` |
| §2.4 Controlled Vocabulary | D05, Finding F10 |
| §3 Outbox Catalog | `prisma/schema.prisma:1293`, §XII |
| §5 Risk Register | §IV Findings, §V Classification Table |
