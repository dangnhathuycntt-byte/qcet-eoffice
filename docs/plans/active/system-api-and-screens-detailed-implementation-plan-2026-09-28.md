# QCET System API and Screens Implementation Plan

> **For agentic workers:** Execute phases in order and keep each work item independently reviewable. Use inline execution with a checkpoint at every phase gate. Follow codebase invariants, UI polish rules (Base UI, motion tokens), and repository validation scripts.

**Goal:** Deliver a secure, coherent QCET E-Office API and a usable pilot of its core workflows (including Bàn làm việc, Văn bản & Hồ sơ, Lịch công tác), then expand to the full system screen inventory.

**Architecture:** Next.js `/api` route handlers acting as thin adapters over domain-owned queries and commands. Enforce contextual object authorization, state-machine transitions, optimistic concurrency, and idempotency.

---

## Phase 0: Baseline, Decisions, and Pilot Contract

**Objective:** Replace route-count assumptions with an implementable baseline and resolve open architecture decisions. **No code changes, route deletions, or renames are allowed in this phase.**

### Task 0.1: API Route and Method Inventory
*   **Files:** `docs/architecture/api-inventory-current-2026-09.md` (Create/Update); `docs/architecture/api-inventory.md` (Preserve as 2026-09-09 historical snapshot)
*   **Action:** The initial scan found 93 `route.ts` files; the current source-reconciled implementation checkpoint has 98 route files, 131 declared route/method pairs, and 133 exported handlers including NextAuth GET/POST. Map auth, object authorization, validation, CSRF, rate limit, and domain owner. Include source path/line evidence and distinguish route-local checks from shared middleware/helper behavior. Mark unverified classifications as provisional.
*   **Validation:** Reconcile each method against source exports; confirm one inventory row per exported method and resolve all unknowns or label them for follow-up. Do not overwrite the historical API audit.

### Task 0.2: Navigation Reconciliation (Documentation Only)
*   **Files:** `docs/architecture/navigation.md` (Update; it existed as a 2026-09-09 design reference)
*   **Action (complete 2026-09-28):** Record current behavior and recommend a canonical work surface for `/`, `/portal`, `/dashboard`, and `/unit-tasks`. The code currently makes `/` an authenticated dispatcher (default `/tasks`), redirects `/dashboard` to `/tasks`, redirects `/unit-tasks` to `/tasks?scope=unit`, and keeps `/portal` as a separate launcher. Treat `/tasks` as the current functional Task Hub; do not describe `/dashboard` as its implementation. **No `src/app/` files were modified in Phase 0.**
*   **Validation:** Manual review of the proposed routing changes.

### Task 0.3: Architecture Decision Gates
*   **Files:** `docs/architecture/decisions/RFC-04-*.md`, `docs/architecture/decisions/RFC-05-*.md`
*   **Action:** Hold a decision gate for document-domain relocation and schema normalization. Mark outcomes as Accepted/Revised/Rejected. Document the pending choice for digital signature provider and delivery channels (to be implemented in Phase 5).
*   **Validation:** Record each RFC decision and owner. RFC-04/RFC-05 block document-domain relocation and schema normalization only; they do not block security/correctness fixes that restore behavior required by accepted ADRs.

---

## Phase 1: Security and Lifecycle Blockers (P0)

**Objective:** Patch critical security gaps and enforce ACLs.

### Task 1.1: Strict ACL for Documents
*   **Files:** `src/app/api/documents/route.ts`; `src/app/api/documents/outgoing/route.ts`; reuse `src/server/policies/document-policy.ts`, `src/server/authorization/authorization-context-service.ts`, and `src/server/authorization/authorization-engine.ts`. Do not create `src/domain/documents/queries.ts` before RFC-04 is accepted.
*   **Action:** Apply contextual scoping to document list endpoints. Ensure `total` and returned rows contain only resources the session actor may read. Do not leak metadata, signatures, attachments, or existence through totals. Reuse the current server policy/authorization stack; add a narrowly scoped server query helper only if the route needs one.
*   **Validation:** Extend `tests/document-api-routes.test.ts` and `tests/idor-security.test.ts`; run `npm run test:security`, then `npm run typecheck` and `npm run lint`.

### Task 1.2: Mutation Security Hardening
*   **Files:** Mutation routes identified in the Phase 0.1 inventory; reuse `src/server/security/rate-limit.ts` and the existing CSRF/schema helpers. Do not assume every method needs the same rate-limit tier.
*   **Action:** Add the missing CSRF, rate-limit, request-size, and Zod validation controls identified per handler. Derive the exact route list from the inventory; retain valid existing controls and avoid broad behavior changes.
*   **Validation:** Extend the matching API/security suites; run `npm run test:security`, `npm run typecheck`, `npm run lint`, and `npm run verify` at the phase gate.

---

## Phase 2: Canonical Task-Document Pipeline

**Objective:** Standardize workflows around the Task Hub while maintaining separation between document directives and unit assignments.

### Task 2.1: Separate Directives and Unit Assignments
*   **Files:** `src/components/documents/directive-action-panel.tsx`, `src/lib/services/incoming-document-service.ts`
*   **Action:** Separate "Bút phê / Phân tuyến" (Directives) from "Giao việc cấp đơn vị" (Unit Assignment). Directives do NOT inherently create a Task. Unit assignments DO create a Task. Refactor UI to submit distinct commands to `DocumentIncomingWorkflow`. Use `@base-ui/react/dialog` for the UI flow.
*   **Validation:** `npm test` covering document routing and task creation.

### Task 2.2: Remove Legacy Direct Writes
*   **Files:** `src/app/api/documents/[id]/directives/route.ts` (Refactor)
*   **Action:** Eliminate legacy endpoints that mutate `Document.status` directly outside the state machine.
*   **Validation:** `npm run typecheck`, `npm run lint`.

### Task 2.3: Idempotent Numbering Engine
*   **Files:** `src/lib/documents/numbering-engine.ts`, `src/lib/services/outgoing-document-service.ts`
*   **Action:** Fix atomic counters to prevent duplicate number issuance on HTTP retries. Enforce unique constraints for document numbers per year/type. Return the already-issued number on retry instead of consuming a new sequence.
*   **Validation:** `npm test`.

---

## Phase 3: Dossier and File Foundation

**Objective:** Transition to the `FileObject` canonical model and strict dossier state machines.

### Task 3.1: Canonical `FileObject` Implementation
*   **Files:** `prisma/schema.prisma` (Modify); `src/app/api/upload/route.ts` and the current file/download routes (Modify); `src/lib/services/file-service.ts` (Create only if the service boundary is approved in the ADR-008 implementation design).
*   **Action:** Implement the accepted ADR-008 `FileObject` model. Compute SHA-256 from uploaded bytes. Migrate downloads to resource-based authorization and streaming. Split schema expand/backfill/parity/cutover/observe/contract into separate migration work items.
*   **Validation:** Extend `tests/file-streaming-security.test.ts`; run `npm run db:migrate:test-fresh`, `npm run db:migrate:test-upgrade`, `npm run test:security`, and `npm run verify` before cutover.

**Execution note (2026-09-28):** The additive expand migration, canonical upload metadata, resource-authorized ID download route, legacy download redirects, nullable document/task/dossier/meeting references, ClamAV worker, and dry-run/apply backfill command are implemented in the `qcet-api-screens` worktree. Current evidence: `npm run typecheck` passes; Prisma validation passes; Compose config parses with placeholder secrets; focused file tests pass 47/47; fresh and upgrade migration checks pass. The repo lint still reports 102 baseline errors. A dry-run against the primary checkout upload volume found 70 candidates, with 53 eligible local-storage references and no missing/unsafe files; 17 values cannot be safely mapped to local storage paths. The Docker daemon is unavailable, so there is no live ClamAV service; `--apply` remains unrun to avoid quarantining those 53 files before they can be scanned. Do not cut over: production-volume parity, rollback proof, live ClamAV operation, and observation remain required.

**Scanner decision for this slice:** Use the pinned `clamav/clamav:1.5.4-debian13-slim` daemon on the private Compose network, without publishing port 3310. Files stay `PENDING` when scanning is unavailable, and downloads fail closed unless the recorded result is `CLEAN`. Compose parsing and the protocol adapter mock passed; runtime container/signature-database readiness has not been exercised because Docker is not running on this host.

### Task 3.2: Isolate Archive Lifecycle
*   **Files:** `src/lib/services/incoming-document-service.ts`; `src/lib/services/dossier-service.ts`; `src/app/api/documents/[id]/actions/file/route.ts`; `src/app/api/documents/batch/route.ts`.
*   **Action:** Remove `archiveNow` from ordinary document filing and batch-file commands. Filing ends in `FILED`; archive submission and acceptance happen only through dossier workflow with submitter/archivist separation of duties.
*   **Validation:** Extend `tests/work-dossier-archive.test.ts`, `tests/domain/dossier-sod-guards.test.ts`, and `tests/document-actions-part2.test.ts`; run `npm run test:domain` and `npm run test:integration`.

### Task 3.3: Dossier API Expansion
*   **Files:** `src/lib/services/dossier-service.ts` (Modify); create `src/app/api/dossiers/[id]/actions/mark-ready-for-archive/route.ts`, `.../finalize-archive/route.ts`, and `.../reject-archive/route.ts` after reconciling them with the current `submit-archive`, `accept-archive`, and `close` commands.
*   **Action:** Expose only the missing lifecycle commands. Do not add duplicate transitions if an existing command already represents the same state change. Keep state bounds, retention, authorization, and SoD checks in the service.
*   **Validation:** Extend `tests/work-dossier-archive.test.ts` and `tests/domain/dossier-state-machine.test.ts`; run `npm run test:domain` and `npm run test:integration`.

---

## Phase 4: Pilot Screens and End-to-End Workflows

**Objective:** Ship the core 13–15 pilot page templates (Task Hub, Inbox, Incoming Registry, Lịch công tác, Organization lookup, minimum Dossier) utilizing strict dependency and motion rules.

### Task 4.1: Task Hub & Unified Workspace
*   **Files:** `src/app/tasks/page.tsx`; `src/components/tasks/table/modular-cascading-task-table.tsx`.
*   **Action:** Standardize the Task Hub utilizing `UnifiedAdaptiveWorkspace` and `ModularCascadingTaskTable`. Expose "Bảng" and "Kanban" as pure view modes of the same template. Do not create parallel tables.
*   **UI Constraints:** Use the existing Base UI and task workspace patterns; align styling with `docs/product/specs/SPEC_BAN_LAM_VIEC_UIUX_STANDARD.md`, `src/app/globals.css`, and the motion tokens where motion is useful.
*   **Validation:** `npm run typecheck`, `npm run lint`.

### Task 4.2: Incoming Document Detail Screen (Văn bản đến)
*   **Files:** Create `src/app/documents/incoming/[id]/page.tsx` and `src/components/documents/document-timeline.tsx`; reuse `src/app/api/documents/incoming/[id]/route.ts`, `src/app/api/documents/[id]/workflow/route.ts`, and the existing document PDF/viewer components.
*   **Action:** Build the definitive detail screen integrating PDF metadata, workflow timeline, directives, and linked Tasks.
*   **UI Constraints:** Use `@base-ui/react/dialog` for quick-actions. Use `motionEase`, `motionDuration` (from `tokens.ts`), and `fadeVariants` for entrance animations. Limit shadows to `--shadow-card`.
*   **Validation:** `npm run typecheck`, `npm test`.

### Task 4.3: Dossier List & Detail (Hồ sơ công việc)
*   **Files:** Create `src/app/dossiers/page.tsx`, `src/app/dossiers/[id]/page.tsx`, and the dossier composition component under `src/components/`; first inspect existing document/dossier registry components and reuse their patterns.
*   **Action:** Build dossier listing filtered by unit/owner/status. Implement detail page for assembling dossier components and submitting to archive.
*   **UI Constraints:** Filter breadcrumbs must be flat. Avoid nested cards (`box-shadow` overloading). Use `cva` for status badges.
*   **Validation:** `npm run verify`.

---

## Phase 5: Full-Scope Modules and Integrations

**Objective:** Complete the remaining approximately 7–9 page templates and operational components for the full system release; the exact count depends on whether meeting detail and notification center are separate routes or shared surfaces.

### Task 5.1: Digital Signature Integration (Moved from Phase 1)
*   **Files:** `src/lib/crypto/digital-signature-service.ts`, `src/lib/services/outgoing-document-service.ts`
*   **Action:** Replace simulated SHA-256 signatures with the chosen provider adapter. Verify cryptographic signatures, certificate chains, and timestamps. Deny issuance if `verificationStatus !== VALID`. Link signature proof to the exact document hash.
*   **Validation:** `npm test`.

### Task 5.2: Outgoing & Internal Document Workflows (Văn bản đi)
*   **Files:** Create `src/app/documents/outgoing/compose/page.tsx` and `src/components/documents/compose-form.tsx`; reuse current outgoing-document routes and service.
*   **Action:** Build the draft, review, signing, number issuance, and delivery forms for "Tạo văn bản đi".
*   **UI Constraints:** Form validation must use `zod` via `react-hook-form`. Confirm destruction of drafts using `@base-ui/react/alert-dialog`.
*   **Validation:** `npm run verify`.

### Task 5.3: Authority and Org Administration
*   **Files:** `src/app/org/page.tsx` (Modify existing); create `src/app/delegations/page.tsx`; reuse `src/app/api/delegations/route.ts` and `src/app/api/delegations/[id]/revoke/route.ts`.
*   **Action:** Build administrative consoles for organizational trees, positions, role provisioning, and delegation history.
*   **Validation:** `npm test`. Verify strict non-bypassable Server Session RBAC.

### Task 5.4: Notification Center Overlay
*   **Files:** Create `src/components/notifications/notification-center.tsx`; modify/reuse `src/app/api/notifications/route.ts` and the existing `src/components/notifications/notification-popover.tsx`.
*   **Action:** Build the notification feed. Differentiate from the action-required `Inbox` queue.
*   **UI Constraints:** Utilize `@base-ui/react/popover`. Apply `popoverVariants` from `src/lib/motion/variants.ts`.
*   **Validation:** `npm run lint`.

---

## Phase 6: Migration Cutover, Observation, and Release

**Objective:** Finalize legacy data parity, observe operational metrics, and prepare for production cutover.

### Task 6.1: Data Backfill and Parity
*   **Files:** Existing additive expand migration under `prisma/migrations/`; `scripts/backfill-file-objects.ts`; `scripts/scan-pending-file-objects.ts`.
*   **Action:** The expand foundation and dry-run/apply tool are implemented. A dry run found 53 eligible local-storage references; preserve `PENDING` and do not run `--apply` until a live ClamAV service can scan all eligible objects. Complete parity/rollback and obtain production-volume evidence before cutover.
*   **Validation:** `npm run verify`.

### Task 6.2: End-to-End Final Verification
*   **Files:** Project-wide
*   **Action:** Execute `npm run verify` (Typecheck + Lint + Test Suite).
*   **Validation:** Pipeline must return exit code 0.

### Task 6.3: Production Operations Readiness
*   **Files:** Modify `src/app/api/health/route.ts`; audit listing route is a new endpoint only if the approved operator-console policy requires it. Reuse existing document audit-log routes where suitable.
*   **Action:** Ensure correlation IDs are logged without sensitive payloads. Confirm recovery paths are documented for signature or delivery-gateway failures.
*   **Validation:** Run existing repository verification scripts and a documented operator recovery drill; do not invent load scripts as a prerequisite.

---

## Execution Status Snapshot — 2026-09-28

This status supplements the implementation tasks above and reflects the active `qcet-api-screens` worktree. A listed implementation does not imply a production release or an Owner decision.

| Phase | Worktree status | Remaining gate |
|---|---|---|
| 0 — Baseline and decisions | Route inventory, navigation reconciliation, page matrix, and plan crosswalk are documented. | RFC-04/RFC-05 and signature-provider/delivery decisions remain Owner-gated. No document-domain relocation or schema normalization is authorized. |
| 1 — Security and lifecycle | Planned route hardening is implemented in the worktree; focused contract/security evidence is recorded in the checkpoints. | Repository-wide security verification still has documented existing failures; resolve/review before release. |
| 2 — Task/document pipeline | Directive versus unit-assignment separation, lifecycle guards, and retry-safe workflow changes are implemented in the worktree. | Preserve the documented policy boundary; only assigned-unit workflow creates a Task. |
| 3 — Dossier and files | Additive FileObject foundation, guarded streaming, scan-pending behavior, backfill dry-run, and dossier lifecycle endpoints are present. | No `--apply` or cutover until ClamAV scans all 53 eligible files and parity/rollback are evidenced. |
| 4 — Pilot screens | Pilot screen and workflow work is delivered in the worktree; see Phase 4 batch checkpoints and the traceability matrix. | Pilot deployment and real observation require production access and operational readiness. |
| 5 — Full-scope screens and integrations | Unblocked local screens/modules are delivered. Template #21 audit is read-only and authorized through the canonical capability engine. Template #18 has a read-only directory and is `needs-enhancement`. | Account provisioning waits for RBAC design; signature integration waits for a provider; outgoing/internal workflow policy gates remain open. |
| 6 — Cutover and release | Recovery/rollback docs and pre-pilot finding reconciliation are complete. | Full verification gate, ClamAV-backed backfill, bounded pilot, observation window, and legacy-path retirement remain open. |

Current matrix totals: **18 `exists`, 3 `needs-enhancement`, 1 `needs-creation`**. Current focused admin/date validation: **79/79 tests pass**, `npm run typecheck` passes; the full `npm run verify` release gate has not been claimed as passing.
