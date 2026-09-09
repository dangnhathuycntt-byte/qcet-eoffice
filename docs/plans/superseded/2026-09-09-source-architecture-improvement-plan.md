---
status: superseded
domain: architecture
created: 2026-09-09
superseded_by: 2026-09-09-remaining-source-improvement-master-plan.md
---

# QCET E-Office — Source Architecture Improvement Plan

## Global Constraints
- **One Capability, One Canonical Implementation**: Never build parallel engines or temporary V2 facades.
- **Role Is Not Scope**: Role represents authority (who can take action); Scope represents active dataset filter (`school`, `unit`, `personal`).
- **Server Truth Wins**: Database and authenticated server session are authoritative. Client optimistic state must yield to server truth.
- **Never Invent Operational Data**: Use real schema records; never create mock data or fake business metrics.
- **Preserve Unrelated Changes**: Keep edits strictly confined to the assigned task.
- **Never Weaken Security to Pass Tests**: Enforce server-side authentication, authorization, and input validation.
- **Never Claim Verification That Was Not Run**: Run `npm run typecheck` and tests, confirming outputs.
- **Light-Only Standard**: Zero `dark:` CSS classes; standard Vietnamese institutional education design.
- **Anti-Slop Standard**: Zero emojis in code/markup, tabular figures for numbers/dates, Lucide 1.5 stroke width.

---

## Task 1: Security & Dependency Baseline Audit (Phase 1)
- **Objective**: Audit current resolved dependencies, check Next.js version against security advisories (target >= 15.5.24 in Next 15 LTS), run audit, check React 19 / RSC dependencies, verify typecheck and regression tests.
- **Files**:
  - `package.json`
  - `package-lock.json`
  - `docs/architecture/dependency-baseline.md`
- **Verification**:
  - `npm ls next react react-dom`
  - `npm audit`
  - `npm run typecheck`
  - `npm test`

---

## Task 2: Server / Client Boundary Audit & Direct Server Reads (Phase 2 & Phase 3)
- **Objective**: Eliminate top-level `"use client"` on route pages where server-side data fetching and static rendering should occur. Replace client `useEffect(fetch('/api/...'))` with direct domain service calls during server render. Isolate interactivity into explicit client island components.
- **Files**:
  - `src/app/page.tsx`
  - `src/app/dashboard/page.tsx`
  - `src/app/tasks/page.tsx`
  - `src/lib/server/` or `src/server/` domain services
- **Verification**:
  - Route pages render server components with initial data passed to client islands.
  - No internal HTTP round-trips (`fetch('http://localhost:3000/api/...')` from server component to its own Route Handler).
  - `npm run typecheck` and route tests.

---

## Task 3: Canonical Task Query & Command Domain Services (Phase 4 & Phase 5)
- **Objective**: Consolidate task operations into canonical domain services: `TaskQueryService` (reads, scope filtering, metrics) and `TaskCommandService` (atomic mutations: create, update, approve, reject, submit deliverable). Ensure Route Handlers and Server Actions both invoke the same underlying command service with uniform authorization policy.
- **Files**:
  - `src/server/tasks/task-query-service.ts`
  - `src/server/tasks/task-command-service.ts`
  - `src/server/tasks/task-policy.ts`
  - `src/app/api/tasks/route.ts`
  - `src/app/api/tasks/[id]/route.ts`
- **Verification**:
  - Unit tests verifying `TaskQueryService` and `TaskCommandService`.
  - API routes delegate completely to domain services.
  - Zero duplicate mutation logic.

---

## Task 4: Data Contract, DTO/Zod Layer & Data Correctness Consolidation (Phase 6 & Phase 7)
- **Objective**: Enforce strict data contract separation: Prisma DB Model -> Domain Model -> API DTO -> UI ViewModel. Define canonical Zod schemas for all task mutations and query parameters. Enforce canonical single sources for AcademicYear, Semester, ReferenceDate, Overdue calculation, and Task metrics.
- **Files**:
  - `src/contracts/tasks.ts`
  - `src/domain/tasks/types.ts`
  - `src/domain/tasks/mappers.ts`
  - `src/lib/academic-calendar.ts`
  - `src/lib/task-metrics.ts`
- **Verification**:
  - Zod validation on inputs.
  - No direct leaking of raw Prisma models into presentation layer.
  - Unit tests for contracts and metrics consolidation.

---

## Task 5: Auth & Session Truth Cleanup (Phase 8)
- **Objective**: Disentangle `AuthenticatedSession` vs `CachedOfflineIdentity` vs `DemoIdentity`. Ensure server session is the authoritative gate for all privileged mutations. Offline cached identity may only read cached data and cannot forge server mutations.
- **Files**:
  - `src/lib/auth.ts`
  - `src/context/auth-context.tsx`
  - `src/types/auth.ts`
  - `tests/auth-role-isolation.test.ts`
- **Verification**:
  - Type-level distinction for `AuthState`.
  - Server validation strictly checks signed session cookie, refusing client-claimed role overrides.
  - Tests verify auth role isolation and session enforcement.

---

## Task 6: Error Contract & Route-level Loading/Error Architecture (Phase 9 & Phase 20)
- **Objective**: Standardize unified `ApiError` schema with structured error codes (`AUTH_REQUIRED`, `FORBIDDEN`, `VALIDATION_ERROR`, `NOT_FOUND`, `INVALID_TRANSITION`, `INTERNAL_ERROR`). Add route-level `loading.tsx`, `error.tsx`, and `not-found.tsx` with Suspense boundaries for streaming across core routes (`/tasks`, `/documents`, `/calendar`, `/org`, `/notifications`).
- **Files**:
  - `src/lib/api-error.ts`
  - `src/app/tasks/loading.tsx`
  - `src/app/tasks/error.tsx`
  - `src/app/documents/loading.tsx`
  - `src/app/documents/error.tsx`
  - `src/app/error.tsx`
- **Verification**:
  - API responses return consistent JSON error shape with `code`, `message`, `requestId`.
  - Routes feature isolated loading skeletons and error boundaries.

---

## Task 7: Observability & Structured Logging & Business Audit Trail (Phase 10 & Phase 11)
- **Objective**: Create `src/instrumentation.ts` for Next.js runtime monitoring. Implement structured JSON logging with `requestId`, duration, and zero credential leakage. Implement business audit trail logging for institutional actions (`TASK_CREATED`, `TASK_ASSIGNED`, `TASK_STATUS_CHANGED`, `DELIVERABLE_SUBMITTED`, `TASK_APPROVED`, `TASK_REJECTED`).
- **Files**:
  - `src/instrumentation.ts`
  - `src/lib/logger.ts`
  - `src/lib/audit-trail.ts`
  - `tests/audit-trail.test.ts`
- **Verification**:
  - Structured logs format as valid JSON.
  - Business mutations record audit events with actor, timestamp, entity, before/after states.

---

## Task 8: Prisma / Database Production Hardening & Server-side Filtering/Pagination (Phase 12 & Phase 13)
- **Objective**: Audit Prisma client singleton and connection pooling. Add composite indexes for common query patterns (Tasks, Notifications, Documents). Ensure multi-step business writes are executed within `prisma.$transaction`. Support server-side filtering and cursor/offset pagination via URL search parameters.
- **Files**:
  - `prisma/schema.prisma`
  - `src/lib/prisma.ts`
  - `src/server/tasks/task-query-service.ts`
- **Verification**:
  - `prisma validate` passes.
  - Transactions ensure atomic commits/rollbacks.
  - Query benchmarks / tests pass.

---

## Task 9: Component & Context Decomposition & Heavy Surface Code Splitting (Phase 14, Phase 15, Phase 16, Phase 17)
- **Objective**: Decompose monolithic workspaces (e.g. `task-management-workspace.tsx`) into decoupled presentation components: Container, Header, Toolbar, Canvas, DetailSurface. Break large monolithic Contexts into focused stores. Code-split heavy surfaces (PDF viewer, heavy charts, modals) with `dynamic(() => import(...), { ssr: false })`.
- **Files**:
  - `src/components/tasks/`
  - `src/context/`
  - `src/app/tasks/page.tsx`
- **Verification**:
  - Component files are modular and maintainable (< 350 lines).
  - Heavy features are lazy loaded on demand.
  - `npm run typecheck` and component tests pass.

---

## Task 10: Testing Pyramid, Contract Tests, State Machine Engine & CI Quality Gates (Phase 18, Phase 19, Phase 21, Phase 27, Phase 28)
- **Objective**: Formalize TaskStateMachine with `canTransition(user, task, from, to)`. Add authorization matrix contract tests. Implement architectural lint/check script (restricting client imports of prisma or server-only modules). Add comprehensive CI verify script (`npm run verify`).
- **Files**:
  - `src/domain/tasks/task-state-machine.ts`
  - `tests/authorization-matrix.test.ts`
  - `scripts/verify-architecture.ts`
  - `package.json`
- **Verification**:
  - Task state machine rejects illegal transitions.
  - Authorization contract test passes across all roles and scopes.
  - `npm run verify` runs typecheck, lint/architecture guards, and test suites green.
