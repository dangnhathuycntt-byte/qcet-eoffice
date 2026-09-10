# R7 Test Infrastructure & CI Verification Audit

**Document**: `docs/agent-work/audits/R7-tests-ci.md`  
**Auditor**: R7 Test & CI Infrastructure Audit Agent (QCET Work)  
**Date**: 2026-09-10  
**Status**: COMPLETE — READ-ONLY RECONNAISSANCE AUDIT  
**Scope**: Test Runner Infrastructure (`scripts/run-tests.mjs`, `scripts/run-sprint*.mjs`, `scripts/run-gate0.mjs`), Linter (`scripts/lint.mjs`), Package Scripts (`package.json`), Test Suite Topology (`tests/**/*`), GitHub Actions CI Pipeline (`.github/workflows/ci.yml`), Test Fixtures & Factories (`tests/fixtures/*`, inline test helpers), Known Flaky Suites & Concurrency Hazards, F4 Invariant Harness Recommendations (REQ-REGRESSION-INVARIANTS).

---

## 1. Executive Summary

A comprehensive inspection of the QCET E-Office testing, linting, and CI verification pipeline was conducted across all 392 test files, custom runner scripts, CI workflows, and repository root configurations.

### 1.1 Repository Test Metrics & Topology
- **Total Test Files**: 392 `*.test.ts` files across the repository.
- **Root Partitioning**: 341 test files reside directly in `tests/`.
- **Subdirectory Partitioning**: 51 test files are distributed across structured domains:
  - `tests/security/` (including `tests/security/api/`): 18 files
  - `tests/server/` (including `dto/`, `security/`, `policies/`, `api/`): 12 files
  - `tests/pwa/`: 6 files
  - `tests/fixtures/`: 2 fixture modules (`dashboard-fixtures.ts`, `document-fixtures.ts`)
  - `tests/config/`, `tests/auth/`, `tests/contracts/`, `tests/features/`, `tests/storage/`, `tests/telemetry/`: 13 files

### 1.2 Key Architectural Strengths
1. **Zero External Test Runner Bloat**:
   The codebase uses the **native Node.js test runner (`node:test`)** with `tsx` as the execution bridge (`tsx --test`) and standard library strict assertions (`node:assert/strict`). There is zero dependency on Jest, Vitest, Mocha, Karma, or Playwright.
2. **Extreme Execution Velocity**:
   - **Targeted Single-Test Execution**: ~140ms to 450ms total process execution time.
   - **Custom Architectural Linter (`scripts/lint.mjs`)**: ~80ms across 474 source files.
   - **TypeScript Typecheck (`tsc --noEmit`)**: ~1.68s across the entire project AST.
   - **Targeted Fast Cycle**: Subagents can run `npm run lint && npm run typecheck` in under **1.8 seconds**.
3. **Database Test Isolation Guard**:
   A strict multi-factor isolation check prevents tests from running against non-test databases. Tests that touch the database verify:
   - `QCET_ALLOW_DB_TESTS === '1'`
   - `NODE_ENV === 'test'`
   - Localhost / loopback connection (`localhost` or `127.0.0.1`)
   - Database name suffix matching `_test` (`/qcet_test` or `/qcet_ci`).
4. **Zero-DOM SSR UI Testing**:
   React UI components are tested via React 19 SSR `renderToStaticMarkup` from `react-dom/server` combined with string, HTML structure, and regex assertions. This eliminates heavy JSDOM / headless browser overhead while providing high-fidelity verification of rendered HTML, attributes, accessibility tags, and invariant violations.

### 1.3 Key Operational Risks & Gaps
1. **Database Concurrency Race Conditions**:
   Integration tests that interact with PostgreSQL share the `qcet_test` database. Running test suites concurrently without `--test-concurrency=1` produces unique constraint collisions, foreign key deadlocks, and transaction rollback contamination.
2. **Fragmented Test Helper / Factory Duplication**:
   - `createContext` and `createPosition` (for `AuthorizationContextModel`) are independently re-implemented in multiple test files (`available-actions.test.ts`, `authorization-engine.test.ts`, `document-classification.test.ts`).
   - HTTP request mocking (`createRequest`, `createAuthRequest`) is duplicated across 6+ API test suites.
   - Task mocking (`createSampleSchoolTask`, `createMockSchoolTask`, `createMockStaffTask`) is duplicated between `tests/fixtures/dashboard-fixtures.ts` and individual test files.
3. **Missing Automated Invariant Enforcement for Wave 1 UI Consolidation**:
   While database constraints and zero-mock backend invariants have dedicated test suites (`invariants-constraints.test.ts`, `zero-mock-backend.test.ts`, `ui-zero-shim.test.ts`), there is no unified automated harness for:
   - Client-side role branching detection (`user.role === '...'` bans).
   - Light-only theme enforcement across Tailwind classes (prevention of ad-hoc `dark:` classes).
   - Synthetic operational fallback eradication (ensuring no hardcoded demo arrays in UI components).
   - Navigation single-source-of-truth verification (ensuring sidebar and mobile drawer consume canonical navigation items).

---

## 2. Test Framework & Verification Infrastructure

### 2.1 Tooling Stack Specification

| Component | Technology | Version | Key Properties |
|---|---|---|---|
| **Test Runner** | Node.js Test Runner (`node:test`) | Native (Node.js >= 20.17.0) | Standard TAP/spec reporter, native test isolation, zero package overhead. |
| **TS Execution Bridge** | `tsx` | `^4.19.3` | Esbuild-backed on-the-fly TypeScript execution; ultra-fast cold-start (~100ms). |
| **Assertion Library** | `node:assert/strict` | Native | Strict deep equality, promise rejections, type-safe assertion primitives. |
| **UI Component Testing** | `react-dom/server` (`renderToStaticMarkup`) | `^19.0.0` | Server-side rendering to static HTML string; sub-millisecond execution per component. |
| **Environment Loader** | `@next/env` (`loadEnvConfig`) | Bundled with Next.js | Accurately loads `.env`, `.env.local`, `.env.test` following Next.js hierarchy. |
| **Database Engine** | PostgreSQL + Prisma Client | `^6.19.3` | Targeted integration tests against dedicated `qcet_test` database. |

### 2.2 Runner Scripts Analysis

#### 1. `scripts/run-tests.mjs` (Full Suite Runner)
- **Role**: Discovers all `*.test.ts` files recursively within `tests/`.
- **Environment Preparation**:
  - Executes `loadEnvConfig(process.cwd())`.
  - Replaces `/qcet_eoffice` in `DATABASE_URL` with `/qcet_test`.
  - Injects `NODE_ENV="test"` and `QCET_ALLOW_DB_TESTS="1"`.
- **Execution Parameter**: Invokes `tsx --test --test-concurrency=1 ...testFiles`.
  - `--test-concurrency=1` is critical: Database integration tests share the `qcet_test` instance. Sequential execution prevents database deadlocks, unique constraint collisions, and transaction rollback race conditions.
- **Exit Behavior**: Returns status code 0 if all tests pass; exits with 1 on execution failure or test failure.

#### 2. Sprint / Gate Specific Runners
- **`scripts/run-gate0.mjs`**: Runs `tests/security/master-cutover-gate0.test.ts` (Phase 0 contract freeze and security baseline).
- **`scripts/run-sprint2.mjs`**: Executes 12 security and authorization suites (Session revocation, AuthorizationContext v2, Capability catalog, Meeting/Document/Task authorization, Available actions, Cache invalidation).
- **`scripts/run-sprint3.mjs`**: Executes platform correctness suites (Task OCC concurrency, Idempotency command store, Outbox worker, Document ACL pagination, Institution config).

### 2.3 Architectural Linter (`scripts/lint.mjs`)
The repository features a custom high-speed regex/AST architectural linter at `scripts/lint.mjs`. It scans all `.ts`, `.tsx`, `.js`, `.mjs`, and `.json` files in ~80ms across 474 source files.
- **Rule 1 (Client/UI Prisma Import Prohibition)**: Client/UI components in `src/components/` and client pages must not import `@prisma/client` directly.
- **Rule 2 (UI Direct Environment Access Prohibition)**: Direct `process.env.[VAR]` access is forbidden in UI components; runtime configuration must be loaded via `src/config/`.
- **Rule 3 (Domain-to-UI Inversion Prohibition)**: Domain logic in `src/domain/` or `src/server/` must not import UI components (`@/components/`).
- **Rule 4 (Credential & Private Key Leak Prohibition)**: Hardcoded RSA/EC private keys are detected and rejected.
- **JSON Syntax Validation**: All repository JSON files are strictly parsed to reject invalid syntax or trailing commas.

### 2.4 CI Pipeline Workflow (`.github/workflows/ci.yml`)
The CI pipeline runs on GitHub Actions for every push and pull request targeting the `main` branch.

#### Workflow Topology & Environment
- **Workflow Name**: `CI Quality Gate & Supply Chain Pipeline`
- **Triggers**: `push` on `main`, `pull_request` on `main`.
- **Concurrency**: `group: ci-${{ github.workflow }}-${{ github.ref }}`, `cancel-in-progress: true` on PRs.
- **Global Environment Variables**:
  - `CI: "true"`
  - `NODE_ENV: test`
  - `DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/qcet_ci?schema=public"`

#### Jobs Breakdown
1. **`security-and-lint` Job**:
   - `actions/checkout@v4` + `actions/setup-node@v4` with `.nvmrc` and `npm` cache.
   - `npm ci` (frozen lockfile validation).
   - `npx prisma validate` (validates schema syntax and relations).
   - `npm audit --audit-level=high` (blocks high/critical supply chain vulnerabilities).
   - `npm run lint` (executes `scripts/lint.mjs`).
2. **`typecheck-and-test` Job**:
   - `actions/checkout@v4` + `actions/setup-node@v4` with `.nvmrc`.
   - `npm ci`.
   - `npx prisma generate` (generates current Prisma client).
   - `npm run typecheck` (`tsc --noEmit`).
   - `npm test` (`node scripts/run-tests.mjs`).
3. **`build-artifact` Job** (Depends on `security-and-lint` and `typecheck-and-test`):
   - Builds standalone Next.js production build (`npm run build`).
   - Packages and uploads `.next/standalone`, `.next/static`, and `public` with 7-day retention.

---

## 3. Fast Targeted Verification Commands Matrix

Subagents and developers working on specific features should **never** run the full 392-file test suite on iterative edits. The following commands provide instantaneous sub-second feedback.

### 3.1 Agent-Local Targeted Verification (Sub-Second Feedback)

#### Pure Unit / UI Invariant Tests (No Database Required)
These tests execute purely in-memory and require no environment overrides:

```bash
# 1. Test specific capability or authorization logic
npx tsx --test tests/security/capability-catalog.test.ts

# 2. Test authorization engine rule evaluation
npx tsx --test tests/security/authorization-engine.test.ts

# 3. Test available actions computation
npx tsx --test tests/security/available-actions.test.ts

# 4. Test UI Zero-Shim invariants (role switcher elimination)
npx tsx --test tests/ui-zero-shim.test.ts

# 5. Test Workspace semantic dimension orthogonality
npx tsx --test tests/workspace-semantic-invariants.test.ts

# 6. Test Workspace count invariants
npx tsx --test tests/workspace-count-invariants.test.ts

# 7. Test Theme & Light-Mode invariants
npx tsx --test tests/theme-standardization.test.ts

# 8. Test Dashboard Context boundaries
npx tsx --test tests/dashboard-contexts-invariants.test.ts
```

#### Database Integration Tests
Tests that query Prisma or invoke database-backed services require the test database environment flags:

```bash
# General pattern for running any database-backed test file:
NODE_ENV=test QCET_ALLOW_DB_TESTS=1 DATABASE_URL="postgresql://postgres:postgres@localhost:5432/qcet_test" npx tsx --test tests/<filename>.test.ts

# Examples:
# Task OCC Concurrency test:
NODE_ENV=test QCET_ALLOW_DB_TESTS=1 DATABASE_URL="postgresql://postgres:postgres@localhost:5432/qcet_test" npx tsx --test tests/task-occ-concurrency.test.ts

# Authorization Context DB integration:
NODE_ENV=test QCET_ALLOW_DB_TESTS=1 DATABASE_URL="postgresql://postgres:postgres@localhost:5432/qcet_test" npx tsx --test tests/security/authorization-context-v2.test.ts

# Meeting authorization DB integration:
NODE_ENV=test QCET_ALLOW_DB_TESTS=1 DATABASE_URL="postgresql://postgres:postgres@localhost:5432/qcet_test" npx tsx --test tests/security/meeting-authorization.test.ts
```

#### Targeted Subtest Execution via Name Pattern
Node.js test runner supports `--test-name-pattern` (or `-t`) for targeting a specific `describe` block or `test` case inside a large test file:

```bash
# Run only tests matching "Meeting Capabilities" inside capability-catalog.test.ts:
npx tsx --test --test-name-pattern="Meeting Capabilities" tests/security/capability-catalog.test.ts

# Run only tests matching "RoleSwitcherPill" inside ui-zero-shim.test.ts:
npx tsx --test --test-name-pattern="RoleSwitcherPill" tests/ui-zero-shim.test.ts

# Run only tests matching "Scope !== Status" inside workspace-semantic-invariants.test.ts:
npx tsx --test --test-name-pattern="Scope !== Status" tests/workspace-semantic-invariants.test.ts
```

### 3.2 Pre-Commit Fast Loop (~1.8s)
Before committing any code or requesting peer review, subagents must run the **1.8-second pre-commit check**:
```bash
npm run lint && npm run typecheck
```
This guarantees no type regressions, no JSON breakages, and no architectural boundary violations before running domain-specific tests.

### 3.3 PR Verification Protocol
Prior to opening or merging a PR, execute the following sequence:
```bash
# 1. Architectural lint check (~80ms)
npm run lint

# 2. Strict typecheck (~1.7s)
npm run typecheck

# 3. Gate 0 baseline check (~600ms)
npm run test:gate0

# 4. Relevant subsystem test suites (e.g. Sprint 2 for auth, Sprint 3 for platform)
npm run test:sprint2
npm run test:sprint3
```

### 3.4 Full Integration Verification
The authoritative command for verifying the complete repository before releasing gates or merging integration branches:
```bash
# Official full verification script (typecheck + lint + test):
npm run verify

# Or directly running the full test suite with sequential isolation:
npm test
# (Equivalent to: node scripts/run-tests.mjs)
```

### 3.5 Complete Verification Command Reference Matrix

| Verification Tier | Recommended Command | Wall Clock Time | Execution Mode | Purpose & Context |
|---|---|---|---|---|
| **Linter Check** | `npm run lint` | **~0.08s** | Sequential AST Scan | Fast syntax, boundary, and import validation on file save. |
| **Typecheck** | `npm run typecheck` | **~1.68s** | Multi-threaded TS AST | Exhaustive type checking across all files (`tsc --noEmit`). |
| **Fast Pre-Commit** | `npm run lint && npm run typecheck` | **~1.8s** | Combined | Mandatory verification prior to any atomic git commit. |
| **Single Unit Test** | `npx tsx --test <file>` | **~0.15s - 0.45s** | Single-process `tsx` | Focused test-driven development loop on a single test file. |
| **Filtered Subtest** | `npx tsx --test -t "<pattern>" <file>` | **~0.15s - 0.35s** | Filtered single-process | Running an isolated subtest or assertion block. |
| **Single DB Test** | `NODE_ENV=test QCET_ALLOW_DB_TESTS=1 DATABASE_URL="postgresql://postgres:postgres@localhost:5432/qcet_test" npx tsx --test <file>` | **~0.5s - 1.2s** | Isolated DB connection | Testing Prisma models or database services against `qcet_test`. |
| **Gate 0 Freeze** | `npm run test:gate0` | **~0.6s** | Single suite runner | Validates Phase 0 contract freeze and security baseline. |
| **Sprint 2 Security** | `npm run test:sprint2` | **~4.2s** | Sequential 12 suites | Security, capability, and authorization subsystem checks. |
| **Sprint 3 Platform** | `npm run test:sprint3` | **~3.8s** | Sequential 5 suites | OCC concurrency, idempotency, and outbox worker checks. |
| **Full Test Suite** | `npm test` (`node scripts/run-tests.mjs`) | **~45s - 65s** | Sequential 392 files (`--test-concurrency=1`) | Complete automated test suite with test DB rewrite. |
| **Full Verification Pipeline** | `npm run verify` | **~50s - 70s** | Typecheck + Lint + Test | Canonical pre-merge gate required for PR approval. |

---

## 4. Existing Test Helpers, Fixtures, and Mocks Inventory

### 4.1 Centralized Test Fixtures (`tests/fixtures/`)

| Fixture File | Exported Utilities & Data | Primary Use Case |
|---|---|---|
| `tests/fixtures/dashboard-fixtures.ts` | - `CATEGORY_LABELS`: Task category Vietnamese label map.<br>- `QCET_PERSONNEL`: 7 authentic personnel profiles (Trần Hùng, Nguyễn Ngọc Vinh, Mai Đinh Thị Xuân, etc.).<br>- `getMockDashboardPayload()`: Factory generating full `DashboardPayload & { schoolTasks: SchoolTask[] }`.<br>- Seed task generators for school and staff tasks. | Dashboard aggregation, metric calculation, and chart rendering tests. |
| `tests/fixtures/document-fixtures.ts` | - `MOCK_DOCUMENTS`: 8 sample `OfficialDocument` records covering incoming, outgoing, and internal documents.<br>- `getDocumentStats()`: Aggregates total, pending, urgent, and processing documents. | Document table, document filters, and document workflow tests. |

### 4.2 Inline Test Helpers & Factories Inventory

Across the 392 test files, various tests declare local helpers. Below is the inventory of patterns currently in use:

#### 1. Authorization Context & Position Factories
- **Locations**: `tests/security/available-actions.test.ts`, `tests/security/authorization-engine.test.ts`, `tests/security/document-classification.test.ts`.
- **Implementation Pattern**:
  ```typescript
  function createContext(overrides: {
    userId?: string;
    isActive?: boolean;
    systemRoles?: SystemRole[];
    positions?: ActivePositionAssignment[];
    portfolios?: ActivePortfolioAssignment[];
    delegations?: ActiveDelegationGrant[];
    bodyMemberships?: ActiveBodyMembership[];
    primaryUnitIds?: string[];
  }): AuthorizationContextModel {
    const userId = overrides.userId ?? 'usr_test_1';
    return new AuthorizationContextModel({
      userId,
      user: {
        id: userId,
        email: `${userId}@cdktcnqn.edu.vn`,
        name: `User ${userId}`,
        isActive: overrides.isActive ?? true,
      },
      systemRoles: overrides.systemRoles ?? [],
      positions: overrides.positions ?? [],
      responsibilityAreas: (overrides.portfolios ?? []).map((p) => p.responsibilityArea),
      portfolios: overrides.portfolios ?? [],
      delegations: overrides.delegations ?? [],
      bodyMemberships: overrides.bodyMemberships ?? [],
      primaryUnitIds: overrides.primaryUnitIds ?? [],
    });
  }
  ```
- **Evaluation**: Extremely clean and fully decoupled from database state. Ideal for sub-millisecond in-memory authorization evaluation.

#### 2. HTTP Request Simulation Helpers
- **Locations**: `tests/security/master-cutover-gate0.test.ts`, `tests/security/session-revocation.test.ts`, `tests/security/me-context-api.test.ts`, `tests/server/api/file-routes.test.ts`.
- **Implementation Pattern**:
  ```typescript
  function createRequest(
    url: string,
    options: { method?: string; headers?: Record<string, string>; body?: any } = {}
  ): NextRequest {
    const init: RequestInit = {
      method: options.method ?? 'GET',
      headers: {
        'content-type': 'application/json',
        ...options.headers,
      },
    };
    if (options.body) {
      init.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }
    return new NextRequest(new URL(url, 'http://localhost:3000'), init);
  }
  ```
- **Evaluation**: Standardized across API tests. Allows direct invocation of Next.js 15 route handlers without running an HTTP server.

#### 3. Task Entity Generators
- **Locations**: `tests/dashboard-data-consistency-full-regression.test.ts`, `tests/executive-department-command-center.test.ts`, `tests/task-occ-concurrency.test.ts`.
- **Functions**: `createSampleSchoolTask`, `createMockSchoolTask`, `createMockStaffTask`, `createFixtureTask`.
- **Evaluation**: Fragmented. Some return domain types (`SchoolTask`, `StaffTask`), while others create actual Prisma records in `qcet_test`. Recommendation: consolidate into `tests/fixtures/task-fixtures.ts`.

#### 4. Browser & Storage Mocks
- **Locations**: `tests/auth-state-separation.test.ts`, `tests/auth-session-consistency.test.ts`.
- **Implementation Pattern**:
  ```typescript
  function createMockStorage(initialData: Record<string, string> = {}) {
    let store = { ...initialData };
    return {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => { store[key] = val; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { store = {}; },
    };
  }
  ```
- **Evaluation**: Simulates `window.localStorage` and `sessionStorage` in pure Node.js runtime without JSDOM.

#### 5. Module & CSS Interception Mocking
- **Location**: `tests/theme-standardization.test.ts`.
- **Implementation Pattern**:
  ```typescript
  const Module = require("module");
  const origRequire = Module.prototype.require;
  Module.prototype.require = function (id: string) {
    if (typeof id === "string" && id.endsWith(".css")) return {};
    if (id === "next/font/google") {
      return {
        Be_Vietnam_Pro: () => ({ variable: "--font-sans" }),
        Plus_Jakarta_Sans: () => ({ variable: "--font-heading" }),
        JetBrains_Mono: () => ({ variable: "--font-mono" }),
      };
    }
    return origRequire.apply(this, arguments);
  };
  ```
- **Evaluation**: Lightweight Node module loader monkey-patching that enables importing Next.js layout and component files into Node without webpack or Next.js build server.

---

## 5. Known Flaky Suites, Concurrency Hazards & Execution Bottlenecks

### 5.1 Database Concurrency Hazard (Race Conditions & Deadlocks)
- **Root Cause**: Database integration tests execute queries and transactions against a shared PostgreSQL database (`qcet_test` locally, `qcet_ci` in CI).
- **Hazard**: If tests are executed with parallel workers (`--test-concurrency > 1` or multiple simultaneous `npx tsx --test` commands), parallel transactions insert overlapping records, trigger unique constraint violations (`P2002`), or cause row lock deadlocks.
- **Enforced Solution**:
  - `scripts/run-tests.mjs` strictly sets `--test-concurrency=1`.
  - Sprint runners (`scripts/run-sprint2.mjs`, `scripts/run-sprint3.mjs`) strictly set `--test-concurrency=1`.
  - Individual subagents running targeted DB tests must run them sequentially.

### 5.2 Timezone & Date Anchor Sensitivity
- **Hazard**: Tests computing task due dates, calendar aggregation, or attendance records may fail if run in environments with varying local timezones (e.g., UTC vs UTC+7 Asia/Ho_Chi_Minh).
- **Enforced Solution**:
  - Invariant rules mandate standardizing all operational dates to ICT (UTC+7).
  - Tests should use explicit ISO timestamps (`2026-09-10T08:00:00+07:00`) or anchored mock clocks rather than `new Date()` with local system time offsets.

### 5.3 Global Module Monkeypatching State Leaks
- **Hazard**: Tests that patch `Module.prototype.require` (such as `tests/theme-standardization.test.ts`) can leak mocked module loaders to subsequent test files executed in the same Node.js process if not properly restored in an `after()` or `teardown()` hook.
- **Enforced Solution**: Every test patching global Node runtime objects must restore the original reference in a `finally` or `after()` hook:
  ```typescript
  after(() => {
    Module.prototype.require = origRequire;
  });
  ```

### 5.4 Concurrent File-Writing / Multi-Agent Typecheck Collisions
- **Hazard**: When multiple subagents work in parallel across different lanes (e.g. F1, F2, F3), intermediate edits in shared UI files (such as `src/components/workspace/unified-adaptive-workspace.tsx`) can temporarily break `npm run typecheck` across all lanes until merged.
- **Enforced Solution**:
  - Strict ownership rules (OWNERSHIP.md): each mutating agent owns an exclusive set of files.
  - Subagents run isolated single-test files (`npx tsx --test <own-test>`) during implementation, deferring repository-wide typecheck to integration gates (G0, G1, G2).

---

## 6. Automated Invariant Enforcement for Wave 1 & F4 Lane (REQ-REGRESSION-INVARIANTS)

The **F4 Lane (Wave 1)** is dedicated to **"Invariant Harness & Automated Guardrails"**. To prevent architectural regression during and after the UI Semantic Consolidation, the following 6 test suites and linter extensions should be established.

### 6.1 Suite 1: Navigation Canonicalization Invariant
- **Target File**: `tests/invariants/navigation-canonical.test.ts`
- **Objective**: Ensure that `app-sidebar.tsx`, `mobile-menu-drawer.tsx`, and `command-search-modal.tsx` strictly consume one canonical navigation manifest (`src/config/navigation.ts`).
- **Assertions to Implement**:
  1. No hardcoded navigation route arrays in `app-sidebar.tsx` or `mobile-menu-drawer.tsx`.
  2. All navigation item paths match active Next.js pages in `src/app/`.
  3. No duplicate navigation item labels or icons between mobile and desktop drawers.
  4. Role visibility checks in navigation items use canonical capabilities rather than raw `user.role === '...'`.

### 6.2 Suite 2: Light-Only Theme Hardening Invariant
- **Target File**: `tests/invariants/light-theme-enforcement.test.ts`
- **Objective**: Prevent re-introduction of dark mode styles, dark theme providers, or dark mode toggle components.
- **Assertions to Implement**:
  1. `src/app/globals.css` retains `@custom-variant dark (&:not(*));` and zero `.dark` class selectors.
  2. No component file in `src/components/` imports `next-themes` or references `useTheme`.
  3. No component contains class strings matching `dark:` (e.g. `dark:bg-slate-900`).
  4. `src/app/layout.tsx` permanently declares `html className="light"` and `suppressHydrationWarning`.

### 6.3 Suite 3: Zero Synthetic Operational Data in Production
- **Target File**: `tests/invariants/zero-synthetic-data.test.ts`
- **Objective**: Enforce Core Invariant 4 ("Never Invent Operational Data") by banning mock data fallbacks in production UI components.
- **Assertions to Implement**:
  1. `src/components/dashboard/workbench-mobile-feed.tsx` contains zero `DEFAULT_SCHEDULE_ITEMS` or `DEFAULT_NOTICES` mock arrays.
  2. Production API routes return empty arrays (`[]`) instead of mock datasets when no database records match.
  3. UI components render authenticated empty states (`EmptyState`, `Chưa có dữ liệu`) instead of mock placeholders when receiving empty query results.

### 6.4 Suite 4: Role Is Not Scope & Zero Client Role Branching
- **Target File**: `tests/invariants/role-scope-separation.test.ts`
- **Objective**: Enforce Phase 0 Freeze Rule 1 & Rule 3 across all client components in `src/app/` and `src/components/`.
- **Assertions to Implement**:
  1. Scan all files with `"use client"`: Ban regex `user\.role\s*===` and `role\s*===\s*UserRole\.`.
  2. Verify that `TaskScope` (`SCHOOL`, `UNIT`, `PERSONAL`) is only used in data querying and display filtering, never in authorization assertions.
  3. Ban `RoleSwitcherPill`, `forcedRole`, or simulated viewpoint facades across all views.
  4. Ensure client authorization gates use `useAuthorization()` with capability checks (e.g. `hasCapability("task.approve")`) or server-computed `availableActions`.

### 6.5 Suite 5: Metric Denominator & Rollup Integrity
- **Target File**: `tests/invariants/metric-denominator-integrity.test.ts`
- **Objective**: Prevent denominator mixing between parent tasks (`SchoolTask`) and subtasks (`StaffTask`) identified in the R4 audit.
- **Assertions to Implement**:
  1. `computeDepartmentHealthMatrix`: Assert that school-level tasks and staff-level subtasks are tallied in separate denominator buckets (`schoolTaskCount` vs `staffTaskCount`).
  2. Completion rate formula strictly tests:
     $$\text{rate} = \frac{N_{\text{completed}}}{N_{\text{valid}}} \times 100 \quad \text{where } N_{\text{valid}} = N_{\text{total}} - N_{\text{cancelled}}$$
  3. `strategicActiveCount`: Assert that tasks are only counted as strategic if explicitly tagged with priority/strategic flags, not simply all tasks where `status === "IN_PROGRESS"`.

### 6.6 Suite 6: Linter Rule Expansion (`scripts/lint.mjs`)
Extend `scripts/lint.mjs` with two additional automated checks:
1. **Rule 5 (Prohibit Client Role Branching)**:
   ```javascript
   if (isInsideComponents && /user\b(\.|\?\.)role\s*===/.test(lineText) && !lineText.includes("// invariant-allow-role")) {
     logError(filePath, lineNum, "Client-side role comparison forbidden. Use capabilities or server availableActions.");
   }
   ```
2. **Rule 6 (Prohibit Hardcoded Mock Data Constants)**:
   ```javascript
   if (isInsideComponents && /const\s+(MOCK_|DEFAULT_.*_ITEMS|DEMO_)/.test(lineText) && !relPath.includes("fixtures")) {
     logError(filePath, lineNum, "Hardcoded mock/default operational data forbidden in production components.");
   }
   ```

---

## 7. Actionable Recommendations for Parallel Workstreams

1. **For Wave 1 Feature Lanes (F1, F2, F3, P1, P2, P3)**:
   - Run single test files (`npx tsx --test tests/<file>.test.ts`) during development. Avoid executing full repository test suites locally.
   - Run `npm run lint` before committing.
2. **For F4 Invariant Lane**:
   - Implement the invariant test suites defined in Section 6.
   - Implement Rule 5 and Rule 6 in `scripts/lint.mjs`.
3. **For Integrator (Gate G1 & Gate G2)**:
   - Run `npm run verify` (`typecheck && lint && test`) sequentially to validate all merges.
   - Ensure CI runs `npm test` with `--test-concurrency=1` to guarantee zero database test collisions.
