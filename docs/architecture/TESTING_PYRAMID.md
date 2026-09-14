# QCET E-Office - Testing Pyramid & Quality Architecture

## Mission
QCET E-Office serves as the institutional management operating system for Trường Cao đẳng Kỹ thuật Công nghệ Quy Nhơn . System integrity, authorization boundaries, and state transitions directly impact administrative compliance and operational auditability. The testing strategy enforces a strict 4-layer testing pyramid with automated verification gates.

---

## 1. Testing Pyramid Overview

```
                  ▲
                 / \
                /   \
               / L4  \       Layer 4: End-to-End Browser & Smoke Tests
              /-------\      (Playwright / Node Test Smoke, User Journeys)
             /   L3    \     Layer 3: API Integration Tests
            /-----------\    (Auth, Route Handlers, Command Services, Audit)
           /     L2      \   Layer 2: Component Presentation Tests
          /---------------\  (DOM, Layout Ergonomics, Active Filter Breadcrumbs)
         /       L1        \ Layer 1: Pure Unit & Domain Invariant Tests
        /-------------------\ (State Machine, Metrics, Dates, SoD / Maker-Checker)
```

The testing hierarchy prioritizes fast, deterministic, pure unit tests at the base while enforcing strict integration contracts and user journey verification at higher layers.

---

## 2. Layer-by-Layer Testing Architecture

### Layer 1: Pure Unit & Domain Invariant Tests (Base Layer)
*Target: 0ms external IO, 100% deterministic execution, zero framework coupling.*

- **Scope & Objectives**:
  - Pure domain state machines and business rules (`src/domain/tasks/state-machine.ts`).
  - Segregation of Duties (SoD) / Maker-Checker contract enforcement (`MAKER_CANNOT_BE_CHECKER`).
  - Metric calculations and denominator separation (`src/domain/tasks/metrics.ts`).
  - Academic calendar time arithmetic in Indochina Time (ICT / UTC+7) (`src/lib/academic-calendar.ts`).
  - Permission matrix & role normalization (`ActorContext`, `TaskContext`).
  - DACUM duty rollups and work decomposition models.
- **Key Test Files**:
  - `tests/task-state-machine.test.ts`
  - `tests/academic-calendar.test.ts`
  - `tests/workspace-metrics-contract.test.ts`
  - `tests/canonical-filter-engine-sync.test.ts`
  - `tests/timezone-safety.test.ts`

### Layer 2: Component Presentation & Ergonomics Tests
*Target: DOM assertions, view-state isolation, mobile/desktop ergonomics, accessibility.*

- **Scope & Objectives**:
  - Layout shell rendering and responsive navigation synchronization (`AppShell`, `AppTopbar`, `MobileBottomNav`).
  - Unified toolbar, filter controls, and active filter breadcrumb displays (`TaskToolbar`, `ActiveFilterBreadcrumb`).
  - Table rendering density, column sorting, pagination controls, and empty states (`CascadingTaskTable`).
  - Adaptive detail side sheets and mobile bottom sheets (`TaskDetailSideSheet`, `MobileBottomSheet`).
  - Light-only theme verification, touch targets (&ge; 44px), and contrast ratios.
- **Key Test Files**:
  - `tests/task-table-presentation.test.ts`
  - `tests/unified-task-toolbar.test.ts`
  - `tests/task-detail-side-sheet.test.ts`
  - `tests/active-filter-breadcrumb.test.ts`
  - `tests/touch-targets-ergonomics.test.ts`
  - `tests/mobile-bottom-nav.test.ts`

### Layer 3: API Integration & Service Contract Tests
*Target: Request-context processing, database transaction boundaries, audit trails.*

- **Scope & Objectives**:
  - Authenticated session lifecycle and role extraction (`getApiContext`, `normalizeRole`).
  - Domain command services (`taskCommandService`, `taskQueryService`).
  - HTTP error contracts and standardized JSON error envelopes.
  - Transaction atomicity, optimistic concurrency version checks, and database locks.
  - Audit log emission for administrative actions and state changes.
  - Push notification event dispatching and payload formatting.
- **Key Test Files**:
  - `tests/auth-api-routes.test.ts`
  - `tests/task-domain-services.test.ts`
  - `tests/atomic-transaction-boundaries.test.ts`
  - `tests/audit-events.test.ts`
  - `tests/api-rbac-and-sod.test.ts`
  - `tests/api-health.test.ts`

### Layer 4: End-to-End Browser & Smoke Tests (Top Layer)
*Target: Complete end-to-end user workflows, critical path verification.*

- **Scope & Objectives**:
  - Authentication flow: Login with credentials, role-based landing redirection.
  - "My Tasks" workbench: Filtering by month/year, searching, viewing assigned duties.
  - Deliverable submission workflow: File upload, deliverable creation, transition from `IN_PROGRESS` to `WAITING_APPROVAL`.
  - Approval workflow: Manager/Executive review, approval into `COMPLETED` or rejection back to `IN_PROGRESS`.
  - Delegation workflow: Temporary committee authority handover and time-bounded expiration.
- **Key Test Files**:
  - `tests/mobile-viewport-e2e.test.ts`
  - `tests/smoke-qcet-design-system.test.ts`
  - `tests/anti-slop-delegation-workflow.test.ts`
  - `tests/ban-lam-viec-workbench-2-integration.test.ts`

---

## 3. Architecture Fitness Guards (Cross-Cutting Layer)

In addition to the 4 behavioral testing layers, QCET E-Office executes automated architecture fitness checks (`tests/architecture-fitness.test.ts`) to prevent architectural degradation:

1. **Domain Layer Isolation**: `src/domain/` modules must have zero dependencies on `react`, `next`, or `src/components/`.
2. **Prisma Client Isolation**: UI and client components (`use client`) must never directly import `@prisma/client`.
3. **Environment Security**: UI code must never import server-only secrets or environment configs (`env.server.ts`).
4. **Public/Private File Separation**: `public/` directory must never contain confidential documents or private uploads.
5. **Canonical Domain Services**: Verifies existence of unified query, command, and state machine modules.

---

## 4. Test Execution & Quality Gate Guide

The project establishes standardized quality gates configured in `package.json` and executed in local development and CI:

### 1. Fast Domain & Unit Tests
Run targeted unit tests during active feature development:
```bash
npx tsx --test tests/task-state-machine.test.ts tests/academic-calendar.test.ts
```

### 2. Comprehensive Test Suite (`npm test`)
Executes all automated test suites across the repository:
```bash
npm test
```

### 3. Static Type Analysis (`npm run typecheck`)
Verifies strict TypeScript compliance with zero errors:
```bash
npm run typecheck
```

### 4. Linter Analysis (`npm run lint`)
Runs custom AST and pattern linting to prevent anti-patterns:
```bash
npm run lint
```

### 5. Full Pre-Merge Verification Gate (`npm run verify`)
The official pre-commit and CI verification pipeline that chains type checking, linting, and full test execution:
```bash
npm run verify
```

---

## 5. Summary Matrix: Layers vs Concerns

| Layer | Primary Focus | Execution Engine | Speed / Latency | External Dependencies |
| :--- | :--- | :--- | :--- | :--- |
| **L1: Unit** | Pure domain logic, invariants, SoD | Node test runner (`tsx --test`) | < 50ms | None (Pure TS) |
| **L2: Presentation** | UI layout, ergonomics, a11y | Node test runner (`tsx --test`) | 50ms - 200ms | DOM/AST Mocking |
| **L3: Integration** | API contracts, RBAC, DB transactions | Node test runner + Prisma | 200ms - 2s | SQLite/Postgres DB |
| **L4: E2E / Smoke** | User journeys, multi-step flows | Node test runner / Browser | 2s - 10s | Complete App Stack |
